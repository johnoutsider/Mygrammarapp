'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import StudentLayout from '@/components/StudentLayout'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { auth } from '@/lib/firebase'
import { getStudentGuidedSpeakingSubmission } from '@/lib/guidedSpeakingService'

function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function countWords(text) {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
}

export default function StudentGuidedSpeakingResultDetailPage() {
    useAccessGuard()

    const params = useParams()
    const router = useRouter()
    const submissionId = Array.isArray(params?.submissionId) ? params.submissionId[0] : params?.submissionId
    const [submission, setSubmission] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user || !submissionId) {
                setLoading(false)
                return
            }

            try {
                const nextSubmission = await getStudentGuidedSpeakingSubmission(submissionId, user.uid)
                if (!nextSubmission) {
                    setError('Guided speaking result not found.')
                    setLoading(false)
                    return
                }

                setSubmission(nextSubmission)
                setError('')
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load this guided speaking result.')
            } finally {
                setLoading(false)
            }
        })

        return () => unsubscribe()
    }, [submissionId])

    const summary = useMemo(() => {
        if (!submission) {
            return { totalQuestions: 0, totalWords: 0, totalDuration: 0 }
        }

        return submission.answers.reduce((totals, answer) => ({
            totalQuestions: totals.totalQuestions + 1,
            totalWords: totals.totalWords + countWords(answer.transcript || ''),
            totalDuration: totals.totalDuration + Number(answer.durationSeconds || 0),
        }), { totalQuestions: 0, totalWords: 0, totalDuration: 0 })
    }, [submission])

    if (loading) {
        return (
            <StudentLayout title="My Results">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                </div>
            </StudentLayout>
        )
    }

    if (error || !submission) {
        return (
            <StudentLayout title="My Results">
                <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error || 'Guided speaking result not found.'}
                    </div>
                    <button
                        onClick={() => router.push('/student/speaking/results')}
                        className="text-sm text-[#4c75c3] hover:underline"
                    >
                        &larr; Back to Results
                    </button>
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="My Results">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <div>
                    <button
                        onClick={() => router.push('/student/speaking/results')}
                        className="text-sm text-[#4c75c3] hover:underline mb-2 inline-block"
                    >
                        &larr; Back to Results
                    </button>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-slate-900">{submission.topicTitle}</h1>
                        <span className="inline-flex items-center rounded-full bg-teal-100 text-teal-700 px-2.5 py-1 text-xs font-semibold">
                            Guided Practice
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{formatDate(submission.completedAt)}</p>
                </div>

                <div className="space-y-5">
                    {submission.answers.map((answer, index) => {
                        const wordCount = countWords(answer.transcript || '')
                        return (
                            <div key={`${answer.questionId}-${index}`} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                                                Question {index + 1}
                                            </div>
                                            <div className="text-lg font-semibold text-slate-900 mt-1">{answer.questionText}</div>
                                        </div>
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                            {wordCount} words
                                        </span>
                                    </div>
                                </div>

                                <div className="px-6 py-5 space-y-3">
                                    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                                        <span>Started at {answer.startedAt}</span>
                                        <span>Duration: {answer.durationSeconds}s</span>
                                    </div>
                                    {answer.transcript.trim() ? (
                                        <div className="text-base leading-8 text-slate-700 whitespace-pre-wrap">{answer.transcript}</div>
                                    ) : (
                                        <div className="text-base text-slate-400 italic">No transcript captured.</div>
                                    )}
                                    {answer.audioUrl ? (
                                        <audio
                                            controls
                                            src={answer.audioUrl}
                                            className="w-full rounded-lg"
                                        />
                                    ) : null}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 px-4 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Questions Answered</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.totalQuestions}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Total Words Spoken</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.totalWords}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-4 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Total Speaking Duration</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.totalDuration}s</div>
                        </div>
                    </div>
                </div>
            </div>
        </StudentLayout>
    )
}

