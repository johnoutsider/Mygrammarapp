import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { adminDb } from '@/lib/firebase-admin'
import { buildAnalysisPrompt } from '@/lib/speakingPromptBuilder'

export const maxDuration = 60

const CHUNK_SIZE = 5
const SESSION_WINDOW_MS = 30 * 60 * 1000

function sanitizeJson(text: string) {
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '')
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '')
    }
    return jsonText
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const jobId = searchParams.get('jobId')

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 })
        }

        // Status poll for a specific job
        if (jobId) {
            const jobDoc = await adminDb.collection('batchJobs').doc(jobId).get()
            if (!jobDoc.exists) {
                return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
            }
            const job = jobDoc.data()!
            return NextResponse.json({
                batchJobId: jobId,
                status: job.status,
                totalResponses: job.totalResponses ?? 0,
                processedSoFar: job.processedCount ?? 0,
            })
        }

        // Cron path: continue all in-progress speaking-analysis jobs
        const inProgressSnapshot = await adminDb
            .collection('batchJobs')
            .where('type', '==', 'speaking-analysis')
            .where('status', '==', 'in_progress')
            .get()

        if (inProgressSnapshot.empty) {
            return NextResponse.json({ message: 'No in-progress speaking batch jobs.' })
        }

        const openai = new OpenAI({ apiKey })
        let totalProcessed = 0

        for (const jobDoc of inProgressSnapshot.docs) {
            const job = jobDoc.data()
            const jobRef = adminDb.collection('batchJobs').doc(jobDoc.id)

            const allTargets: { studentId: string; responseId: string }[] = Array.isArray(job.responseTargets)
                ? job.responseTargets
                : []

            // Find remaining unanalyzed responses
            const remaining: { studentId: string; responseId: string; questionText: string; transcript: string; assignmentId: string; createdAt: string; stepIndex: number }[] = []

            for (const target of allTargets) {
                const studentDoc = await adminDb.collection('users').doc(target.studentId).get()
                const data = studentDoc.data() || {}
                const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []
                const r = responses.find((rr: any) => rr.id === target.responseId)
                if (r && String(r.transcript || '').trim() && !r.aiAnalysis) {
                    remaining.push({
                        studentId: target.studentId,
                        responseId: target.responseId,
                        questionText: String(r.questionText || ''),
                        transcript: String(r.transcript || ''),
                        assignmentId: String(r.assignmentId || ''),
                        createdAt: String(r.createdAt || ''),
                        stepIndex: Number(r.stepIndex ?? 0),
                    })
                }
            }

            if (remaining.length === 0) {
                await jobRef.update({ status: 'completed', completedAt: new Date().toISOString() })
                continue
            }

            const chunk = remaining.slice(0, CHUNK_SIZE)
            let chunkProcessed = 0

            for (const target of chunk) {
                try {
                    const studentDoc = await adminDb.collection('users').doc(target.studentId).get()
                    const studentData = studentDoc.data() || {}
                    const allResponses = Array.isArray(studentData.speakingResponses) ? studentData.speakingResponses : []

                    const targetTime = new Date(target.createdAt).getTime()
                    const sessionResponses = allResponses
                        .filter((r: any) =>
                            r.assignmentId === target.assignmentId &&
                            Math.abs(new Date(r.createdAt).getTime() - targetTime) < SESSION_WINDOW_MS &&
                            String(r.transcript || '').trim()
                        )
                        .sort((a: any, b: any) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0))

                    const pairs = sessionResponses.length > 1
                        ? sessionResponses.map((r: any) => ({
                            questionText: String(r.questionText || ''),
                            transcript: String(r.transcript || ''),
                        }))
                        : [{ questionText: target.questionText, transcript: target.transcript }]

                    const prompt = buildAnalysisPrompt(pairs)
                    const completion = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.3,
                    })

                    const text = completion.choices[0]?.message?.content || ''
                    const parsed = JSON.parse(sanitizeJson(text))

                    const analysis = {
                        criteria: {
                            taskResponse: Number(parsed.taskResponse ?? 0),
                            fluencyCoherence: Number(parsed.fluencyCoherence ?? 0),
                            lexicalResource: Number(parsed.lexicalResource ?? 0),
                            grammaticalRangeAccuracy: Number(parsed.grammaticalRangeAccuracy ?? 0),
                            pronunciation: Number(parsed.pronunciation ?? 0),
                        },
                        overallBand: Number(parsed.overallBand ?? 0),
                        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((i: unknown) => typeof i === 'string') : [],
                        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.filter((i: unknown) => typeof i === 'string') : [],
                        feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
                        analyzedAt: new Date().toISOString(),
                    }

                    const updatedResponses = allResponses.map((r: any) =>
                        r.id === target.responseId ? { ...r, aiAnalysis: analysis } : r
                    )
                    await adminDb.collection('users').doc(target.studentId).update({ speakingResponses: updatedResponses })
                    chunkProcessed++
                    totalProcessed++
                } catch (err) {
                    console.error(`Collect error for response ${target.responseId}:`, err)
                }

                await new Promise(resolve => setTimeout(resolve, 200))
            }

            const newProcessedCount = (job.processedCount ?? 0) + chunkProcessed
            const allDone = remaining.length - chunkProcessed === 0
            await jobRef.update({
                processedCount: newProcessedCount,
                status: allDone ? 'completed' : 'in_progress',
                ...(allDone ? { completedAt: new Date().toISOString() } : {}),
            })
        }

        return NextResponse.json({ collected: totalProcessed })

    } catch (error: any) {
        console.error('Batch collect error:', error)
        return NextResponse.json({ error: error?.message || 'Batch collect failed.' }, { status: 500 })
    }
}
