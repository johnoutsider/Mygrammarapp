'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import StudentLayout from '@/components/StudentLayout'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { auth } from '@/lib/firebase'
import { listStudentSpeakingResponses, SpeakingResponse } from '@/lib/speakingService'

const SESSION_WINDOW_MS = 30 * 60 * 1000 // 30 minutes

interface SessionGroup {
    id: string              // first response ID — used for navigation
    assignmentId: string
    partLabel: string
    createdAt: string       // earliest in session
    responses: SpeakingResponse[]
    totalWarnings: number
}

function groupIntoSessions(responses: SpeakingResponse[]): SessionGroup[] {
    // Sort oldest first so step 1 comes before step 2
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
        } else {
            groups.push({
                id: r.id,
                assignmentId: r.assignmentId,
                partLabel: r.partLabel,
                createdAt: r.createdAt,
                responses: [r],
                totalWarnings: r.warningCount,
            })
        }
    }

    // Most recent sessions first
    return groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function formatDate(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SpeakingLogPage() {
    useAccessGuard()

    const router = useRouter()
    const [responses, setResponses] = useState<SpeakingResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false)
                return
            }
            try {
                const nextResponses = await listStudentSpeakingResponses(user.uid)
                setResponses(nextResponses)
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load your speaking log.')
            } finally {
                setLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    const sessions = useMemo(() => groupIntoSessions(responses), [responses])

    return (
        <StudentLayout title="Speaking Log">
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Speaking Log</h1>
                    <p className="text-sm text-slate-500 mt-1">Each row is one session. Click View to see all questions and your answers.</p>
                </div>

                {loading && (
                    <div className="min-h-[30vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {!loading && !error && sessions.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800">No Speaking Attempts Yet</h2>
                        <p className="text-sm text-slate-500 mt-2">Complete a speaking session and your answers will appear here.</p>
                    </div>
                )}

                {!loading && !error && sessions.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-3 text-left">Topic</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Date</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Questions</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Warnings</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sessions.map(session => (
                                    <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 align-top">
                                            <span className="rounded-full bg-teal-50 text-teal-700 px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
                                                {session.partLabel || '-'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-top hidden md:table-cell whitespace-nowrap text-xs text-slate-500">
                                            {formatDate(session.createdAt)}
                                        </td>
                                        <td className="px-5 py-4 align-top hidden md:table-cell">
                                            <span className="text-xs text-slate-600 font-medium">
                                                {session.responses.length} question{session.responses.length !== 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-top hidden md:table-cell">
                                            <span className={`text-xs font-semibold ${session.totalWarnings > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                {session.totalWarnings}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-top text-right">
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/speaking-log/${session.id}`)}
                                                className="px-3 py-1.5 rounded-lg bg-[#4c75c3] hover:bg-[#3f64ab] text-white text-xs font-semibold transition-colors"
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
        </StudentLayout>
    )
}
