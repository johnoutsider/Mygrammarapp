import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { adminDb } from '@/lib/firebase-admin'
import { buildAnalysisPrompt, QAPair } from '@/lib/speakingPromptBuilder'

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

function buildAnalysisPayload(parsed: any) {
    return {
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
}

async function analyzeTranscriptPairs(openai: OpenAI, pairs: QAPair[]) {
    const prompt = buildAnalysisPrompt(pairs)
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
    })

    const text = completion.choices[0]?.message?.content || ''
    const parsed = JSON.parse(sanitizeJson(text))
    return buildAnalysisPayload(parsed)
}

export async function POST(req: Request) {
    try {
        const { teacherId, studentId, guidedSubmissionId, answers } = await req.json()
        if (!teacherId) {
            return NextResponse.json({ error: 'teacherId is required' }, { status: 400 })
        }

        const teacherDoc = await adminDb.collection('users').doc(String(teacherId)).get()
        const teacherRole = String(teacherDoc.data()?.role || '')
        if (!teacherDoc.exists || !['teacher', 'admin'].includes(teacherRole)) {
            return NextResponse.json({ error: 'Only teachers can run batch analysis.' }, { status: 403 })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 })
        }

        const openai = new OpenAI({ apiKey })

        if (guidedSubmissionId) {
            const teacherClassIds = Array.isArray(teacherDoc.data()?.classIds)
                ? teacherDoc.data()!.classIds.filter((classId: unknown): classId is string => typeof classId === 'string')
                : []

            const submissionSnapshot = await adminDb.collection('speakingSubmissions').doc(String(guidedSubmissionId)).get()
            if (!submissionSnapshot.exists) {
                return NextResponse.json({ error: 'Guided submission not found.' }, { status: 404 })
            }

            const submissionData = submissionSnapshot.data() || {}
            const submissionStudentId = String(submissionData.studentId || '')
            if (!submissionStudentId) {
                return NextResponse.json({ error: 'Guided submission is missing student information.' }, { status: 400 })
            }

            if (studentId && String(studentId) !== submissionStudentId) {
                return NextResponse.json({ error: 'Guided submission student mismatch.' }, { status: 400 })
            }

            if (teacherRole !== 'admin') {
                const studentSnapshot = await adminDb.collection('users').doc(submissionStudentId).get()
                const classId = String(studentSnapshot.data()?.classId || '')
                if (!classId || !teacherClassIds.includes(classId)) {
                    return NextResponse.json({ error: 'Student not in your classes.' }, { status: 403 })
                }
            }

            const sourceAnswers = Array.isArray(answers) ? answers : submissionData.answers
            const transcriptPairs = Array.isArray(sourceAnswers)
                ? sourceAnswers.map((answer: any) => ({
                    questionText: String(answer?.questionText || ''),
                    transcript: String(answer?.transcript || ''),
                }))
                : []

            if (transcriptPairs.every(pair => !pair.transcript.trim())) {
                return NextResponse.json({ error: 'No transcript captured for this guided submission.' }, { status: 400 })
            }

            const analysis = await analyzeTranscriptPairs(openai, transcriptPairs)
            return NextResponse.json({
                status: 'completed',
                mode: 'guided',
                analysis,
                submissionId: guidedSubmissionId,
            })
        }

        // Find all responses with transcripts but no analysis
        const usersSnapshot = await adminDb.collection('users').where('role', '==', 'student').get()

        interface ResponseTarget {
            studentId: string
            responseId: string
            questionText: string
            transcript: string
            assignmentId: string
            createdAt: string
            stepIndex: number
        }

        const targets: ResponseTarget[] = []

        usersSnapshot.forEach(doc => {
            const data = doc.data()
            const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []
            for (const r of responses) {
                const transcript = String(r.transcript || '').trim()
                if (transcript && !r.aiAnalysis) {
                    targets.push({
                        studentId: doc.id,
                        responseId: String(r.id || ''),
                        questionText: String(r.questionText || ''),
                        transcript,
                        assignmentId: String(r.assignmentId || ''),
                        createdAt: String(r.createdAt || ''),
                        stepIndex: Number(r.stepIndex ?? 0),
                    })
                }
            }
        })

        if (targets.length === 0) {
            return NextResponse.json({ message: 'No responses need analysis.', totalResponses: 0, processedSoFar: 0 })
        }

        // Create batch job doc
        const batchRef = adminDb.collection('batchJobs').doc()
        const batchJobId = batchRef.id
        await batchRef.set({
            batchJobId,
            type: 'speaking-analysis',
            status: 'in_progress',
            createdBy: teacherId,
            totalResponses: targets.length,
            processedCount: 0,
            responseTargets: targets.map(t => ({ studentId: t.studentId, responseId: t.responseId })),
            submittedAt: new Date().toISOString(),
        })

        // Process first chunk
        const chunk = targets.slice(0, CHUNK_SIZE)
        let processedCount = 0

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

                const analysis = await analyzeTranscriptPairs(openai, pairs)

                const updatedResponses = allResponses.map((r: any) =>
                    r.id === target.responseId ? { ...r, aiAnalysis: analysis } : r
                )
                await adminDb.collection('users').doc(target.studentId).update({ speakingResponses: updatedResponses })
                processedCount++
            } catch (err) {
                console.error(`Batch analysis error for response ${target.responseId}:`, err)
            }

            await new Promise(resolve => setTimeout(resolve, 200))
        }

        const allDone = processedCount >= targets.length
        await batchRef.update({
            processedCount,
            status: allDone ? 'completed' : 'in_progress',
            ...(allDone ? { completedAt: new Date().toISOString() } : {}),
        })

        return NextResponse.json({
            batchJobId,
            totalResponses: targets.length,
            processedSoFar: processedCount,
            status: allDone ? 'completed' : 'in_progress',
        })

    } catch (error: any) {
        console.error('Batch analyze error:', error)
        return NextResponse.json({ error: error?.message || 'Batch analysis failed.' }, { status: 500 })
    }
}
