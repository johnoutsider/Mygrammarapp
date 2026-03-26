import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { adminDb } from '@/lib/firebase-admin'
import { buildAnalysisPrompt } from '@/lib/speakingPromptBuilder'

function sanitizeJson(text: string) {
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '')
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '')
    }
    return jsonText
}

const SESSION_WINDOW_MS = 30 * 60 * 1000

export async function POST(req: Request) {
    try {
        const { teacherId, studentId, responseId } = await req.json()

        if (!teacherId || !studentId || !responseId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const teacherDoc = await adminDb.collection('users').doc(String(teacherId)).get()
        if (!teacherDoc.exists || teacherDoc.data()?.role !== 'teacher') {
            return NextResponse.json({ error: 'Only teachers can analyze speaking responses.' }, { status: 403 })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 })
        }

        const studentRef = adminDb.collection('users').doc(String(studentId))
        const studentDoc = await studentRef.get()
        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 })
        }

        const studentData = studentDoc.data() || {}
        const responses = Array.isArray(studentData.speakingResponses) ? [...studentData.speakingResponses] : []
        const responseIndex = responses.findIndex((item: any) => item?.id === responseId)
        if (responseIndex === -1) {
            return NextResponse.json({ error: 'Speaking response not found' }, { status: 404 })
        }

        const targetResponse = responses[responseIndex]
        if (targetResponse.aiAnalysis) {
            return NextResponse.json({ success: true, analysis: targetResponse.aiAnalysis, cached: true })
        }

        const transcript = String(targetResponse.transcript || '').trim()
        if (!transcript) {
            return NextResponse.json({ error: 'Transcript is empty. There is nothing to analyze.' }, { status: 400 })
        }

        // Gather session responses for full Q&A context
        const targetTime = new Date(targetResponse.createdAt).getTime()
        const sessionResponses = responses
            .filter((r: any) =>
                r.assignmentId === targetResponse.assignmentId &&
                Math.abs(new Date(r.createdAt).getTime() - targetTime) < SESSION_WINDOW_MS &&
                String(r.transcript || '').trim()
            )
            .sort((a: any, b: any) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0))

        const pairs = sessionResponses.length > 1
            ? sessionResponses.map((r: any) => ({
                questionText: String(r.questionText || ''),
                transcript: String(r.transcript || ''),
            }))
            : [{ questionText: String(targetResponse.questionText || ''), transcript }]

        const prompt = buildAnalysisPrompt(pairs)

        const openai = new OpenAI({ apiKey })
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
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((item: unknown) => typeof item === 'string') : [],
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements.filter((item: unknown) => typeof item === 'string') : [],
            feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
            analyzedAt: new Date().toISOString(),
        }

        responses[responseIndex] = { ...targetResponse, aiAnalysis: analysis }
        await studentRef.update({ speakingResponses: responses })

        return NextResponse.json({ success: true, analysis })
    } catch (error: any) {
        console.error('Speaking analysis error:', error)
        return NextResponse.json({ error: error?.message || 'Failed to analyze speaking response.' }, { status: 500 })
    }
}
