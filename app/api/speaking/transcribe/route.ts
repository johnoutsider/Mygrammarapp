import { NextResponse } from 'next/server'

const GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'

export async function POST(request: Request) {
    try {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GROQ_API_KEY is not configured.' },
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
        upstream.append('model', GROQ_TRANSCRIPTION_MODEL)
        upstream.append('language', 'en')
        upstream.append('response_format', 'json')

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            body: upstream,
        })

        const data = await response.json()

        if (!response.ok) {
            const message = typeof data?.error?.message === 'string'
                ? data.error.message
                : 'Transcription failed.'

            return NextResponse.json({ error: message }, { status: response.status })
        }

        return NextResponse.json({ text: data.text || '' })
    } catch (error) {
        console.error('Speaking transcription error:', error)
        return NextResponse.json(
            { error: 'Unexpected transcription error.' },
            { status: 500 }
        )
    }
}
