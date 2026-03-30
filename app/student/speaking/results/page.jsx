'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import StudentLayout from '@/components/StudentLayout'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { auth } from '@/lib/firebase'
import { listStudentSpeakingResponses } from '@/lib/speakingService'
import { listStudentGuidedSpeakingSubmissions } from '@/lib/guidedSpeakingService'

const SESSION_WINDOW_MS = 30 * 60 * 1000

function groupIntoSessions(responses) {
    const sorted = responses.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const groups = []

    for (const response of sorted) {
        const responseTime = new Date(response.createdAt).getTime()
        const existing = groups.find(group =>
            group.assignmentId === response.assignmentId &&
            Math.abs(new Date(group.responses[group.responses.length - 1].createdAt).getTime() - responseTime) < SESSION_WINDOW_MS,
        )

        if (existing) {
            existing.responses.push(response)
        } else {
            groups.push({
                id: response.id,
                assignmentId: response.assignmentId,
                partLabel: response.partLabel,
                createdAt: response.createdAt,
                responses: [response],
            })
        }
    }

    return groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function StudentSpeakingResultsPage() {
    useAccessGuard()

    const router = useRouter()
    const [testResponses, setTestResponses] = useState([])
    const [guidedSubmissions, setGuidedSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user) {
                setLoading(false)
                return
            }

            try {
                const [responses, guided] = await Promise.all([
                    listStudentSpeakingResponses(user.uid),
                    listStudentGuidedSpeakingSubmissions(user.uid),
                ])
                setTestResponses(responses)
                setGuidedSubmissions(guided)
                setError('')
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load your speaking results.')
            } finally {
                setLoading(false)
            }
        })

        return () => unsubscribe()
    }, [])

    const rows = useMemo(() => {
        const testRows = groupIntoSessions(testResponses).map(session => ({
            id: session.id,
            topic: session.partLabel || 'Speaking Test',
            date: session.createdAt,
            type: 'test',
            questions: session.responses.length,
            href: `/speaking-log/${session.id}`,
        }))

        const guidedRows = guidedSubmissions.map(submission => ({
            id: submission.id,
            topic: submission.topicTitle || 'Guided Practice',
            date: submission.completedAt,
            type: 'guided',
            questions: submission.answers.length,
            href: `/student/speaking/results/guided-${submission.id}`,
        }))

        return [...testRows, ...guidedRows].sort((left, right) => right.date.localeCompare(left.date))
    }, [guidedSubmissions, testResponses])

    return (
        <StudentLayout title="My Results">
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My Speaking Results</h1>
                    <p className="text-sm text-slate-500 mt-1">Review your speaking sessions and practice transcripts.</p>
                </div>

                {loading && (
                    <div className="min-h-[30vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {!loading && !error && rows.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800">No Speaking Results Yet</h2>
                        <p className="text-sm text-slate-500 mt-2">Complete a speaking session and it will appear here.</p>
                    </div>
                )}

                {!loading && !error && rows.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-3 text-left">Topic</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Date</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Type</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Questions</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map(row => (
                                    <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 align-top">
                                            <div className="font-semibold text-slate-900">{row.topic}</div>
                                        </td>
                                        <td className="px-5 py-4 align-top hidden md:table-cell whitespace-nowrap text-xs text-slate-500">
                                            {formatDate(row.date)}
                                        </td>
                                        <td className="px-5 py-4 align-top hidden md:table-cell">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${row.type === 'test' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                                                {row.type === 'test' ? 'Speaking Test' : 'Guided Practice'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-top hidden md:table-cell">
                                            <span className="text-xs text-slate-600 font-medium">
                                                {row.questions} question{row.questions !== 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-top text-right">
                                            <button
                                                type="button"
                                                onClick={() => router.push(row.href)}
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
