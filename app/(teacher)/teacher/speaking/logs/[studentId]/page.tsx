'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TeacherLayout from '@/components/TeacherLayout'
import { listAllSpeakingResponses, TeacherSpeakingResponse } from '@/lib/speakingService'

const SESSION_WINDOW_MS = 30 * 60 * 1000

interface SessionGroup {
    id: string          // first response id — used for navigation
    assignmentId: string
    partLabel: string
    createdAt: string
    responses: TeacherSpeakingResponse[]
    totalWarnings: number
    hasAnalysis: boolean
    allSent: boolean
}

function groupIntoSessions(responses: TeacherSpeakingResponse[]): SessionGroup[] {
    const sorted = responses.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const groups: SessionGroup[] = []

    for (const r of sorted) {
        const t = new Date(r.createdAt).getTime()
        const existing = groups.find(g =>
            g.assignmentId === r.assignmentId &&
            Math.abs(new Date(g.responses[g.responses.length - 1].createdAt).getTime() - t) < SESSION_WINDOW_MS
        )
        if (existing) {
            existing.responses.push(r)
            existing.totalWarnings += r.warningCount
            if (r.aiAnalysis) existing.hasAnalysis = true
            if (!r.sentForAnalysis) existing.allSent = false
        } else {
            groups.push({
                id: r.id,
                assignmentId: r.assignmentId,
                partLabel: r.partLabel,
                createdAt: r.createdAt,
                responses: [r],
                totalWarnings: r.warningCount,
                hasAnalysis: Boolean(r.aiAnalysis),
                allSent: Boolean(r.sentForAnalysis),
            })
        }
    }

    return groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function formatDate(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TeacherStudentSessionsPage() {
    const params = useParams<{ studentId: string }>()
    const router = useRouter()
    const [responses, setResponses] = useState<TeacherSpeakingResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const all = await listAllSpeakingResponses()
                setResponses(all.filter(r => r.studentId === params.studentId))
            } catch (err) {
                console.error(err)
                setError('Failed to load student sessions.')
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [params.studentId])

    const sessions = useMemo(() => groupIntoSessions(responses), [responses])

    const studentName = responses[0]?.studentName ?? 'Student'
    const studentGroup = responses[0]?.studentGroup ?? ''

    return (
        <TeacherLayout title="Student Sessions">
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div>
                    <button
                        onClick={() => router.push('/teacher/speaking/logs')}
                        className="text-sm text-[#1a9aaa] hover:underline mb-2 inline-block"
                    >
                        &larr; Back to Students
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">{studentName}</h1>
                    {studentGroup && (
                        <p className="text-sm text-slate-500 mt-0.5">{studentGroup}</p>
                    )}
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {loading ? (
                    <div className="min-h-[30vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm text-slate-500">
                        No sessions found for this student.
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-3 text-left">Topic</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Date</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Questions</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Warnings</th>
                                    <th className="px-5 py-3 text-center hidden md:table-cell">Status</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sessions.map(session => (
                                    <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 align-middle">
                                            <span className="rounded-full bg-teal-50 text-teal-700 px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
                                                {session.partLabel || '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell text-xs text-slate-500 whitespace-nowrap">
                                            {formatDate(session.createdAt)}
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell">
                                            <span className="text-xs text-slate-600 font-medium">
                                                {session.responses.length} question{session.responses.length !== 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell">
                                            <span className={`text-xs font-semibold ${session.totalWarnings > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                {session.totalWarnings}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center hidden md:table-cell">
                                            {session.hasAnalysis ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1">
                                                    Analyzed
                                                </span>
                                            ) : session.allSent ? (
                                                <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1">
                                                    Pending
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-400 text-xs font-semibold px-2.5 py-1">
                                                    Not Sent
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 align-middle text-right">
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/teacher/speaking/logs/${params.studentId}/${session.id}`)}
                                                className="px-3 py-1.5 rounded-lg bg-[#1a9aaa] hover:bg-[#127080] text-white text-xs font-semibold transition-colors"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}
