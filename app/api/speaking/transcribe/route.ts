import { NextResponse } from 'next/server'

const OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'

export async function POST(request: Request) {
    try {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'OPENAI_API_KEY is not configured.' },
                { status: 500 }
            )
        }

        const formData = await request.formData()
        const audio = formData.get('audio')

        if (!(audio instanceof File)) {
            return NextResponse.json(
                { error: 'Audio file is required.' },
                { status: 400 }
            )
        }

        const upstream = new FormData()
        upstream.append('file', audio, audio.name || 'recording.webm')
        upstream.append('model', OPENAI_TRANSCRIPTION_MODEL)
        upstream.append('language', 'en')

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            body: upstream,
        })

        const contentType = response.headers.get('content-type') || ''
        const rawBody = await response.text()

        if (!response.ok) {
            console.error('OpenAI transcription error:', response.status, rawBody)
            let message = 'Transcription failed.'
            try {
                const errData = JSON.parse(rawBody)
                if (typeof errData?.error?.message === 'string') message = errData.error.message
            } catch { /* plain text error */ }
            return NextResponse.json({ error: message }, { status: response.status })
        }

        // Handle both JSON and plain text responses
        let text = ''
        if (contentType.includes('application/json')) {
            try {
                const data = JSON.parse(rawBody)
                text = typeof data?.text === 'string' ? data.text.trim() : ''
            } catch { text = rawBody.trim() }
        } else {
            text = rawBody.trim()
        }

        return NextResponse.json({ text })
    } catch (error) {
        console.error('Speaking transcription error:', error)
        return NextResponse.json(
            { error: 'Unexpected transcription error.' },
            { status: 500 }
        )
    }
}
