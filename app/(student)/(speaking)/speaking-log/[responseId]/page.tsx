'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import StudentLayout from '@/components/StudentLayout'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { auth } from '@/lib/firebase'
import {
    deleteSessionResponses,
    listStudentSpeakingResponses,
    sendSessionForAnalysis,
    updateResponseTranscript,
    SpeakingResponse,
} from '@/lib/speakingService'
import SpeakingAnalysisCard from '@/components/speaking/SpeakingAnalysisCard'

function formatDate(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SpeakingLogDetailPage() {
    useAccessGuard()

    const params = useParams<{ responseId: string }>()
    const searchParams = useSearchParams()
    const router = useRouter()
    const isReview = searchParams.get('review') === 'true'

    const [allResponses, setAllResponses] = useState<SpeakingResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sending, setSending] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [studentId, setStudentId] = useState<string | null>(null)
    // Map of responseId -> 'transcribing' | 'done' | 'error'
    const [transcribeStatus, setTranscribeStatus] = useState<Record<string, 'transcribing' | 'done' | 'error'>>({})
    const transcribingRef = useRef(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false)
                return
            }
            setStudentId(user.uid)
            try {
                const responses = await listStudentSpeakingResponses(user.uid)
                setAllResponses(responses)
            } catch (err) {
                console.error(err)
                setError('Failed to load speaking responses.')
            } finally {
                setLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    const { target, sessionResponses } = useMemo(() => {
        const found = allResponses.find(r => r.id === params.responseId)
        if (!found) return { target: null, sessionResponses: [] }

        const sameAssignment = allResponses.filter(r => r.assignmentId === found.assignmentId)
        const targetTime = new Date(found.createdAt).getTime()
        const sessionWindow = 30 * 60 * 1000

        const session = sameAssignment
            .filter(r => Math.abs(new Date(r.createdAt).getTime() - targetTime) < sessionWindow)
            .sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0))

        return { target: found, sessionResponses: session }
    }, [allResponses, params.responseId])

    // Auto-transcribe responses with empty transcripts (on review=true or when audioUrl exists but no transcript)
    useEffect(() => {
        if (!studentId || loading || !target || transcribingRef.current) return

        const needsTranscription = sessionResponses.filter(r => !r.transcript && r.audioUrl)
        if (needsTranscription.length === 0) return

        transcribingRef.current = true

        const runTranscription = async () => {
            for (const r of needsTranscription) {
                setTranscribeStatus(prev => ({ ...prev, [r.id]: 'transcribing' }))
                try {
                    const res = await fetch('/api/speaking/transcribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ audioUrl: r.audioUrl }),
                    })
                    const data = await res.json()
                    if (res.ok && typeof data?.text === 'string') {
                        const transcript = data.text.trim()
                        // Update local state
                        setAllResponses(prev => prev.map(p => p.id === r.id ? { ...p, transcript } : p))
                        // Persist to Firestore
                        await updateResponseTranscript(studentId, r.id, transcript)
                        setTranscribeStatus(prev => ({ ...prev, [r.id]: 'done' }))
                    } else {
                        setTranscribeStatus(prev => ({ ...prev, [r.id]: 'error' }))
                    }
                } catch {
                    setTranscribeStatus(prev => ({ ...prev, [r.id]: 'error' }))
                }
            }
            transcribingRef.current = false
        }

        void runTranscription()
    }, [studentId, loading, target, sessionResponses])

    const alreadySent = sessionResponses.length > 0 && sessionResponses.every(r => r.sentForAnalysis)

    const handleSendForAnalysis = async () => {
        if (!studentId || sessionResponses.length === 0) return
        setSending(true)
        setError(null)
        try {
            const ids = sessionResponses.map(r => r.id)
            await sendSessionForAnalysis(studentId, ids)
            setAllResponses(prev => prev.map(r => ids.includes(r.id) ? { ...r, sentForAnalysis: true } : r))
        } catch (err) {
            console.error(err)
            setError('Failed to send for analysis.')
        } finally {
            setSending(false)
        }
    }

    const handleDelete = async () => {
        if (!studentId || sessionResponses.length === 0) return
        if (!confirm('Delete this session? This cannot be undone.')) return
        setDeleting(true)
        setError(null)
        try {
            const ids = sessionResponses.map(r => r.id)
            await deleteSessionResponses(studentId, ids)
            router.push('/speaking-log')
        } catch (err) {
            console.error(err)
            setError('Failed to delete session.')
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <StudentLayout title="Speaking Log">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                </div>
            </StudentLayout>
        )
    }

    if (!target) {
        return (
            <StudentLayout title="Speaking Log">
                <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error || 'Response not found.'}
                    </div>
                    <button
                        onClick={() => router.push('/speaking-log')}
                        className="text-sm text-[#4c75c3] hover:underline"
                    >
                        &larr; Back to Speaking Log
                    </button>
                </div>
            </StudentLayout>
        )
    }

    const isTranscribing = Object.values(transcribeStatus).some(s => s === 'transcribing')

    return (
        <StudentLayout title={isReview ? 'Review Your Session' : 'Speaking Log'}>
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <button
                            onClick={() => router.push('/speaking-log')}
                            className="text-sm text-[#4c75c3] hover:underline mb-2 inline-block"
                        >
                            &larr; Back to Speaking Log
                        </button>
                        <h1 className="text-2xl font-bold text-slate-900">{target.partLabel}</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {sessionResponses.length} question{sessionResponses.length !== 1 ? 's' : ''} &middot; {formatDate(target.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 pt-7 flex-wrap">
                        {isTranscribing && (
                            <span className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                <span className="animate-spin inline-block w-3 h-3 border border-slate-400 border-t-transparent rounded-full" />
                                Transcribing with Groq...
                            </span>
                        )}
                        {alreadySent ? (
                            <span className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-4 py-2">
                                Sent for analysis
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void handleSendForAnalysis()}
                                disabled={sending || isTranscribing}
                                className="px-4 py-2 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {sending ? 'Sending...' : 'Send for Analysis'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {isReview && isTranscribing && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-700">
                        Your recording is being transcribed. This only takes a few seconds with Groq.
                    </div>
                )}

                {/* Questions & Answers in order */}
                <div className="space-y-5">
                    {sessionResponses.map((response, index) => {
                        const status = transcribeStatus[response.id]
                        return (
                            <div key={response.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                {/* Question header */}
                                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#4c75c3] text-white text-sm font-bold">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                                                    Question {(response.stepIndex ?? index) + 1} of {response.stepTotal ?? sessionResponses.length}
                                                </div>
                                                <div className="text-lg font-semibold text-slate-900 mt-0.5">{response.questionText}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className={`text-xs font-semibold ${response.warningCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                {response.warningCount} warning{response.warningCount !== 1 ? 's' : ''}
                                            </span>
                                            {response.speakingSeconds > 0 && (
                                                <span className="text-xs text-slate-400">Spoke for {response.speakingSeconds}s</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Student answer */}
                                <div className="px-6 py-5 space-y-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#4c75c3] mb-2">Your Answer</div>
                                    {status === 'transcribing' ? (
                                        <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                                            <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-[#4c75c3] rounded-full" />
                                            Transcribing your recording...
                                        </div>
                                    ) : status === 'error' ? (
                                        <div className="text-sm text-red-500 italic">Transcription failed. Audio is still saved above.</div>
                                    ) : response.transcript ? (
                                        <div className="text-base leading-8 text-slate-700 whitespace-pre-wrap">{response.transcript}</div>
                                    ) : (
                                        <div className="text-base text-slate-400 italic">No transcript captured for this attempt.</div>
                                    )}
                                    {response.audioUrl && (
                                        <audio
                                            controls
                                            src={response.audioUrl}
                                            className="w-full rounded-lg"
                                        />
                                    )}
                                </div>

                                {/* AI Analysis (if available) */}
                                {response.aiAnalysis && (
                                    <div className="px-6 pb-6">
                                        <SpeakingAnalysisCard analysis={response.aiAnalysis} />
                                    </div>
                                )}

                                {/* Analysis pending state */}
                                {!response.aiAnalysis && response.sentForAnalysis && (
                                    <div className="px-6 pb-5">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 italic">
                                            Analysis pending — your teacher will run the analysis soon.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </StudentLayout>
    )
}
