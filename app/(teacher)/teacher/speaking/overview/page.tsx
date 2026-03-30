'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import TeacherLayout from '@/components/TeacherLayout'
import { listSpeakingResponsesByStudentIds, buildSpeakingOverviewFromResponses, StudentSpeakingOverview } from '@/lib/speakingService'
import { auth } from '@/lib/firebase'
import { getUserProfile } from '@/lib/auth'
import { getStudentsByClassIds } from '@/lib/groupService'

function formatDate(value: string) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ overview }: { overview: StudentSpeakingOverview }) {
    if (overview.totalResponses === 0) {
        return (
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-400 text-xs font-semibold px-2.5 py-1">
                No Sessions
            </span>
        )
    }
    if (overview.hasAnalysis) {
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1">
                Analyzed
            </span>
        )
    }
    return (
        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1">
            Pending
        </span>
    )
}

export default function TeacherSpeakingOverviewPage() {
    const router = useRouter()
    const [overviews, setOverviews] = useState<StudentSpeakingOverview[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                if (!auth.currentUser) return
                const profile = await getUserProfile(auth.currentUser.uid)
                const classIds: string[] = (profile as any)?.classIds ?? []
                const students = classIds.length > 0 ? await getStudentsByClassIds(classIds) : []
                const studentIds = students.map(s => s.uid)
                const responses = studentIds.length > 0 ? await listSpeakingResponsesByStudentIds(studentIds) : []
                const data = buildSpeakingOverviewFromResponses(responses)
                setOverviews(data)
            } catch (err) {
                console.error(err)
                setError('Failed to load student overview.')
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return overviews
        return overviews.filter(s =>
            s.studentName.toLowerCase().includes(q) ||
            s.studentEmail.toLowerCase().includes(q) ||
            s.studentGroup.toLowerCase().includes(q)
        )
    }, [overviews, search])

    const withSessions = filtered.filter(s => s.totalResponses > 0)
    const noSessions = filtered.filter(s => s.totalResponses === 0)
    const displayed = [...withSessions, ...noSessions]

    return (
        <TeacherLayout title="Student Performance Overview">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Student Performance Overview</h1>
                        <p className="text-sm text-slate-500 mt-1">All students and their speaking activity.</p>
                    </div>
                    <button
                        onClick={() => router.push('/teacher/speaking/logs')}
                        className="px-4 py-2 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white text-sm font-semibold transition-colors"
                    >
                        View Logs & Batch Analysis
                    </button>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, or group"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    style={{ backgroundColor: '#ffffff', color: '#334155', colorScheme: 'light' }}
                />

                {loading ? (
                    <div className="min-h-[30vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm text-slate-500">
                        No students found.
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-3 text-left">Student</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Group</th>
                                    <th className="px-5 py-3 text-center hidden lg:table-cell">Sessions</th>
                                    <th className="px-5 py-3 text-center hidden lg:table-cell">Responses</th>
                                    <th className="px-5 py-3 text-center hidden xl:table-cell">Avg Speaking</th>
                                    <th className="px-5 py-3 text-center hidden xl:table-cell">Warnings</th>
                                    <th className="px-5 py-3 text-center hidden lg:table-cell">Avg Band</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Last Active</th>
                                    <th className="px-5 py-3 text-center">Status</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {displayed.map(student => (
                                    <tr
                                        key={student.studentId}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/teacher/speaking/logs/${student.studentId}`)}
                                    >
                                        <td className="px-5 py-4 align-middle">
                                            <div className="font-semibold text-slate-900">{student.studentName}</div>
                                            <div className="text-xs text-slate-400 mt-0.5 hidden md:block">{student.studentEmail || '—'}</div>
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell text-slate-500 text-xs">
                                            {student.studentGroup || '—'}
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center hidden lg:table-cell">
                                            <span className="text-sm font-semibold text-slate-700">{student.totalSessions}</span>
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center hidden lg:table-cell">
                                            <span className="text-sm text-slate-600">{student.totalResponses}</span>
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center hidden xl:table-cell">
                                            <span className="text-xs text-slate-500">{student.avgSpeakingSeconds}s</span>
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center hidden xl:table-cell">
                                            <span className={`text-xs font-semibold ${student.totalWarnings > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                {student.totalWarnings}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center hidden lg:table-cell">
                                            {student.avgBand !== null ? (
                                                <span className={`text-sm font-bold ${student.avgBand >= 7 ? 'text-emerald-600' : student.avgBand >= 5.5 ? 'text-amber-600' : 'text-red-500'}`}>
                                                    {student.avgBand}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell text-slate-500 text-xs whitespace-nowrap">
                                            {formatDate(student.lastActivity)}
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center">
                                            <StatusBadge overview={student} />
                                        </td>
                                        <td className="px-5 py-4 align-middle text-right">
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); router.push(`/teacher/speaking/logs/${student.studentId}`) }}
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

                {/* Summary row */}
                {!loading && displayed.length > 0 && (
                    <div className="flex gap-6 text-sm text-slate-500">
                        <span><strong className="text-slate-700">{displayed.length}</strong> students</span>
                        <span><strong className="text-slate-700">{withSessions.length}</strong> with sessions</span>
                        <span><strong className="text-emerald-600">{displayed.filter(s => s.hasAnalysis).length}</strong> analyzed</span>
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}
