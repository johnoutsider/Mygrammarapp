import { NextResponse } from 'next/server'

const GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'

// Groq supports: flac, mp3, mp4, mpeg, mpga, m4a, ogg, opus, wav — NOT webm
function resolveExt(mimeType: string, fallbackFromUrl?: string): string {
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('mp4')) return 'mp4'
    if (mimeType.includes('mpeg')) return 'mp3'
    if (mimeType.includes('flac')) return 'flac'
    if (mimeType.includes('wav')) return 'wav'
    if (mimeType.includes('opus')) return 'ogg'
    // Fallback: derive from URL path if provided
    if (fallbackFromUrl) {
        if (fallbackFromUrl.includes('.ogg')) return 'ogg'
        if (fallbackFromUrl.includes('.mp4')) return 'mp4'
        if (fallbackFromUrl.includes('.mp3')) return 'mp3'
        if (fallbackFromUrl.includes('.wav')) return 'wav'
    }
    // webm is not supported by Groq — treat opus-in-webm as ogg
    if (mimeType.includes('webm')) return 'ogg'
    return 'ogg'
}

function resolveGroqMime(ext: string): string {
    if (ext === 'mp4') return 'audio/mp4'
    if (ext === 'mp3') return 'audio/mpeg'
    if (ext === 'flac') return 'audio/flac'
    if (ext === 'wav') return 'audio/wav'
    return 'audio/ogg'
}

async function transcribeBlob(blob: Blob, originalMime: string, apiKey: string, urlPath?: string): Promise<string> {
    const ext = resolveExt(originalMime, urlPath)
    const groqMime = resolveGroqMime(ext)
    const filename = `recording.${ext}`

    // Re-wrap as a File with the correct content-type so Groq can parse it
    const file = new File([blob], filename, { type: groqMime })

    const upstream = new FormData()
    upstream.append('file', file, filename)
    upstream.append('model', GROQ_TRANSCRIPTION_MODEL)
    upstream.append('language', 'en')
    upstream.append('response_format', 'json')

    const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upstream,
    })

    const contentType = response.headers.get('content-type') || ''
    const rawBody = await response.text()

    if (!response.ok) {
        console.error('Groq transcription error:', response.status, rawBody)
        let message = 'Transcription failed.'
        try {
            const errData = JSON.parse(rawBody)
            if (typeof errData?.error?.message === 'string') message = errData.error.message
        } catch { /* plain text error */ }
        throw new Error(message)
    }

    if (contentType.includes('application/json')) {
        try {
            const data = JSON.parse(rawBody)
            return typeof data?.text === 'string' ? data.text.trim() : ''
        } catch {
            return rawBody.trim()
        }
    }
    return rawBody.trim()
}

export async function POST(request: Request) {
    try {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GROQ_API_KEY is not configured.' },
                { status: 500 }
            )
        }

        const contentType = request.headers.get('content-type') || ''

        // --- Path A: JSON body with { audioUrl } ---
        if (contentType.includes('application/json')) {
            const body = await request.json()
            const audioUrl = typeof body?.audioUrl === 'string' ? body.audioUrl : ''
            if (!audioUrl) {
                return NextResponse.json({ error: 'audioUrl is required.' }, { status: 400 })
            }

            const audioResponse = await fetch(audioUrl)
            if (!audioResponse.ok) {
                return NextResponse.json({ error: 'Failed to fetch audio from storage.' }, { status: 400 })
            }

            const audioBlob = await audioResponse.blob()
            const storageMime = audioResponse.headers.get('content-type') || audioBlob.type || ''
            const urlPath = new URL(audioUrl).pathname

            try {
                const text = await transcribeBlob(audioBlob, storageMime, apiKey, urlPath)
                return NextResponse.json({ text })
            } catch (err: any) {
                console.error('Groq audioUrl transcription error:', err)
                return NextResponse.json({ error: err.message || 'Transcription failed.' }, { status: 500 })
            }
        }

        // --- Path B: FormData with audio blob (direct upload from recorder) ---
        const formData = await request.formData()
        const audio = formData.get('audio')

        if (!(audio instanceof File)) {
            return NextResponse.json(
                { error: 'Audio file is required.' },
                { status: 400 }
            )
        }

        try {
            const text = await transcribeBlob(audio, audio.type || '', apiKey, audio.name)
            return NextResponse.json({ text })
        } catch (err: any) {
            console.error('Groq FormData transcription error:', err)
            return NextResponse.json({ error: err.message || 'Transcription failed.' }, { status: 500 })
        }

    } catch (error) {
        console.error('Speaking transcription error:', error)
        return NextResponse.json(
            { error: 'Unexpected transcription error.' },
            { status: 500 }
        )
    }
}
