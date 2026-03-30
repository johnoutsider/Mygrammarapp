'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import TeacherLayout from '@/components/TeacherLayout'
import { auth } from '@/lib/firebase'
import type { SpeakingSubmissionAnswer } from '@/lib/guidedSpeakingService'

interface GuidedSubmissionDetail {
    id: string
    studentId: string
    studentName: string
    studentEmail: string
    studentGroup: string
    topicId: string
    topicTitle: string
    completedAt: string
    answers: SpeakingSubmissionAnswer[]
}

function formatDate(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export default function TeacherGuidedSubmissionDetailPage() {
    const params = useParams<{ studentId: string; submissionId: string }>()
    const router = useRouter()
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [submission, setSubmission] = useState<GuidedSubmissionDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setTeacherId(user?.uid || null)
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        const load = async () => {
            if (!teacherId) {
                setLoading(false)
                return
            }

            try {
                const response = await fetch(`/api/speaking/guided/teacher/students/${params.studentId}/submissions/${params.submissionId}?teacherId=${encodeURIComponent(teacherId)}`)
                const data = await response.json()
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load guided submission.')
                }

                setSubmission(data.submission || null)
                setError(null)
            } catch (err: any) {
                console.error(err)
                setError(err.message || 'Failed to load guided submission.')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [params.studentId, params.submissionId, teacherId])

    const showToast = (message: string, ok: boolean) => {
        setToast({ message, ok })
        setTimeout(() => setToast(null), 4000)
    }

    const handleAnalyze = async () => {
        if (!teacherId || !submission) return

        setAnalyzing(true)
        try {
            const response = await fetch('/api/speaking/batch-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId,
                    studentId: submission.studentId,
                    guidedSubmissionId: submission.id,
                    answers: submission.answers,
                }),
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze guided submission.')
            }

            showToast('Guided speaking analysis submitted successfully.', true)
        } catch (err: any) {
            console.error(err)
            showToast(err.message || 'Failed to analyze guided submission.', false)
        } finally {
            setAnalyzing(false)
        }
    }

    if (loading) {
        return (
            <TeacherLayout title="Guided Practice">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                </div>
            </TeacherLayout>
        )
    }

    if (error || !submission) {
        return (
            <TeacherLayout title="Guided Practice">
                <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error || 'Guided submission not found.'}
                    </div>
                    <button
                        onClick={() => router.push(`/teacher/speaking/logs/${params.studentId}`)}
                        className="text-sm text-[#1a9aaa] hover:underline"
                    >
                        &larr; Back
                    </button>
                </div>
            </TeacherLayout>
        )
    }

    return (
        <TeacherLayout title="Guided Practice">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        {toast.message}
                    </div>
                )}

                <div>
                    <button
                        onClick={() => router.push(`/teacher/speaking/logs/${params.studentId}`)}
                        className="text-sm text-[#1a9aaa] hover:underline mb-2 inline-block"
                    >
                        &larr; Back to Sessions
                    </button>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-slate-900">{submission.topicTitle}</h1>
                        <span className="inline-flex items-center rounded-full bg-teal-100 text-teal-700 px-2.5 py-1 text-xs font-semibold">
                            Guided Practice
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        {submission.studentName} · {formatDate(submission.completedAt)}
                    </p>
                </div>

                <div className="space-y-8">
                    {submission.answers.map((answer, index) => (
                        <div key={`${answer.questionId}-${index}`} className="space-y-3">
                            <div className="flex gap-3 items-start">
                                <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs font-bold mt-0.5">
                                    Q
                                </span>
                                <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-slate-800 max-w-[85%] space-y-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                        Question {index + 1}
                                    </div>
                                    <div>{answer.questionText}</div>
                                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 pt-1">
                                        <span>Started at {answer.startedAt}</span>
                                        <span>Duration: {answer.durationSeconds}s</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 items-start flex-row-reverse">
                                <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#1a9aaa] text-white text-xs font-bold mt-0.5">
                                    A
                                </span>
                                <div className="rounded-2xl rounded-tr-sm bg-[#e8f7f9] border border-teal-100 px-4 py-3 text-sm text-slate-800 max-w-[85%] space-y-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-teal-500 mb-1">
                                        {submission.studentName.toUpperCase()}'S ANSWER
                                    </div>
                                    {answer.transcript.trim() ? (
                                        <div className="leading-7 whitespace-pre-wrap">{answer.transcript}</div>
                                    ) : (
                                        <div className="italic text-slate-400">No transcript captured.</div>
                                    )}
                                    {answer.audioUrl ? (
                                        <audio
                                            controls
                                            src={answer.audioUrl}
                                            className="w-full rounded-lg"
                                        />
                                    ) : null}
                                    <div className="text-[11px] font-medium text-teal-600">
                                        Guided Practice Response
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => void handleAnalyze()}
                        disabled={analyzing}
                        className="px-4 py-2 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {analyzing ? 'Sending...' : 'Send for Analysis'}
                    </button>
                </div>
            </div>
        </TeacherLayout>
    )
}


