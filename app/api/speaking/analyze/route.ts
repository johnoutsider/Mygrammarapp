import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { adminDb } from '@/lib/firebase-admin'

function sanitizeJson(text: string) {
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '')
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '')
    }
    return jsonText
}

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

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'GOOGLE_GEMINI_API_KEY is not configured.' }, { status: 500 })
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

        const response = responses[responseIndex]
        if (response.aiAnalysis) {
            return NextResponse.json({ success: true, analysis: response.aiAnalysis, cached: true })
        }

        const transcript = String(response.transcript || '').trim()
        if (!transcript) {
            return NextResponse.json({ error: 'Transcript is empty. There is nothing to analyze.' }, { status: 400 })
        }

        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.0-flash' })
        const prompt = `You are an experienced IELTS Speaking examiner. Assess the student's speaking response using these criteria:
1. Task Response
2. Fluency and Coherence
3. Lexical Resource
4. Grammatical Range and Accuracy
5. Pronunciation

Question:
${String(response.questionText || '')}

Student Transcript:
${transcript}

Return strict JSON in this exact shape:
{
  "taskResponse": <0-9 in 0.5 increments>,
  "fluencyCoherence": <0-9 in 0.5 increments>,
  "lexicalResource": <0-9 in 0.5 increments>,
  "grammaticalRangeAccuracy": <0-9 in 0.5 increments>,
  "pronunciation": <0-9 in 0.5 increments>,
  "overallBand": <0-9 in 0.5 increments>,
  "strengths": ["short point", "short point"],
  "improvements": ["short action point", "short action point", "short action point"],
  "feedback": "A concise but specific teacher-facing evaluation in 180-260 words."
}

Be concrete. Quote or reference details from the transcript. If pronunciation cannot be fully verified from transcript alone, infer cautiously and say so in the feedback.`

        const result = await model.generateContent(prompt)
        const text = result.response.text()
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

        responses[responseIndex] = {
            ...response,
            aiAnalysis: analysis,
        }

        await studentRef.update({ speakingResponses: responses })

        return NextResponse.json({ success: true, analysis })
    } catch (error: any) {
        console.error('Speaking analysis error:', error)
        return NextResponse.json({ error: error?.message || 'Failed to analyze speaking response.' }, { status: 500 })
    }
}