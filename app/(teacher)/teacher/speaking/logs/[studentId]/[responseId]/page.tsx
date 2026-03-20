'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TeacherLayout from '@/components/TeacherLayout'
import { listAnalyzedSpeakingResponses, TeacherSpeakingResponse } from '@/lib/speakingService'

const SESSION_WINDOW_MS = 30 * 60 * 1000

function formatDate(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TeacherSessionDetailPage() {
    const params = useParams<{ studentId: string; responseId: string }>()
    const router = useRouter()
    const [allResponses, setAllResponses] = useState<TeacherSpeakingResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const data = await listAnalyzedSpeakingResponses()
                setAllResponses(data.filter(r => r.studentId === params.studentId))
            } catch (err) {
                console.error(err)
                setError('Failed to load session.')
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [params.studentId])

    const { target, sessionResponses } = useMemo(() => {
        const found = allResponses.find(r => r.id === params.responseId)
        if (!found) return { target: null, sessionResponses: [] }

        const targetTime = new Date(found.createdAt).getTime()
        const session = allResponses
            .filter(r =>
                r.assignmentId === found.assignmentId &&
                Math.abs(new Date(r.createdAt).getTime() - targetTime) < SESSION_WINDOW_MS
            )
            .sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0))

        return { target: found, sessionResponses: session }
    }, [allResponses, params.responseId])

    if (loading) {
        return (
            <TeacherLayout title="Session Detail">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                </div>
            </TeacherLayout>
        )
    }

    if (error || !target) {
        return (
            <TeacherLayout title="Session Detail">
                <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error || 'Session not found.'}
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
        <TeacherLayout title="Session Detail">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div>
                    <button
                        onClick={() => router.push(`/teacher/speaking/logs/${params.studentId}`)}
                        className="text-sm text-[#1a9aaa] hover:underline mb-2 inline-block"
                    >
                        &larr; Back to Sessions
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">{target.partLabel}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {target.studentName}
                        {target.studentGroup ? ` · ${target.studentGroup}` : ''}
                        {' · '}{formatDate(target.createdAt)}
                    </p>
                </div>

                {/* Chat-style Q&A */}
                <div className="space-y-6">
                    {sessionResponses.map((response, index) => (
                        <div key={response.id} className="space-y-2">
                            {/* Question bubble */}
                            <div className="flex gap-3 items-start">
                                <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs font-bold mt-0.5">
                                    Q
                                </span>
                                <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-slate-800 max-w-[85%]">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                                        Question {index + 1}
                                    </div>
                                    {response.questionText}
                                </div>
                            </div>

                            {/* Student answer bubble */}
                            <div className="flex gap-3 items-start flex-row-reverse">
                                <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#1a9aaa] text-white text-xs font-bold mt-0.5">
                                    A
                                </span>
                                <div className="rounded-2xl rounded-tr-sm bg-[#e8f7f9] border border-teal-100 px-4 py-3 text-sm text-slate-800 max-w-[85%] space-y-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-teal-500 mb-1">
                                        {response.studentName}&apos;s Answer
                                    </div>
                                    {response.transcript ? (
                                        <div className="leading-7 whitespace-pre-wrap">{response.transcript}</div>
                                    ) : (
                                        <div className="italic text-slate-400">No transcript captured.</div>
                                    )}
                                    {response.audioUrl && (
                                        <audio
                                            controls
                                            src={response.audioUrl}
                                            className="w-full rounded-lg mt-2"
                                            style={{ height: '36px' }}
                                        />
                                    )}
                                    <div className="flex gap-3 text-[10px] text-slate-400 pt-1">
                                        {response.speakingSeconds > 0 && (
                                            <span>Spoke {response.speakingSeconds}s</span>
                                        )}
                                        {response.warningCount > 0 && (
                                            <span className="text-amber-500">{response.warningCount} warning{response.warningCount !== 1 ? 's' : ''}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </TeacherLayout>
    )
}
