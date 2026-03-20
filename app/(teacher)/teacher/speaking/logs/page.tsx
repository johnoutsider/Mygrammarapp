'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import TeacherLayout from '@/components/TeacherLayout'
import { listAnalyzedSpeakingResponses, TeacherSpeakingResponse } from '@/lib/speakingService'

interface StudentRow {
    studentId: string
    studentName: string
    studentEmail: string
    studentGroup: string
    sessionCount: number
    lastActivity: string
}

function groupByStudent(responses: TeacherSpeakingResponse[]): StudentRow[] {
    const map = new Map<string, StudentRow>()
    for (const r of responses) {
        if (!map.has(r.studentId)) {
            map.set(r.studentId, {
                studentId: r.studentId,
                studentName: r.studentName,
                studentEmail: r.studentEmail || '',
                studentGroup: r.studentGroup || '',
                sessionCount: 0,
                lastActivity: r.createdAt,
            })
        }
        const entry = map.get(r.studentId)!
        if (r.createdAt > entry.lastActivity) entry.lastActivity = r.createdAt
        entry.sessionCount += 1
    }
    return [...map.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}

function formatDate(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TeacherSpeakingLogsPage() {
    const router = useRouter()
    const [responses, setResponses] = useState<TeacherSpeakingResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const data = await listAnalyzedSpeakingResponses()
                setResponses(data)
            } catch (err) {
                console.error(err)
                setError('Failed to load speaking logs.')
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [])

    const students = useMemo(() => groupByStudent(responses), [responses])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return students
        return students.filter(s =>
            s.studentName.toLowerCase().includes(q) ||
            s.studentEmail.toLowerCase().includes(q) ||
            s.studentGroup.toLowerCase().includes(q)
        )
    }, [students, search])

    return (
        <TeacherLayout title="Speaking Logs">
            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Speaking Logs</h1>
                    <p className="text-sm text-slate-500 mt-1">Students who sent their speaking sessions for analysis.</p>
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
                ) : filtered.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm text-slate-500">
                        No students have sent speaking sessions for analysis yet.
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-3 text-left">Student</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Email</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Group</th>
                                    <th className="px-5 py-3 text-left hidden lg:table-cell">Last Activity</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(student => (
                                    <tr key={student.studentId} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 align-middle">
                                            <div className="font-semibold text-slate-900">{student.studentName}</div>
                                            {student.studentGroup && (
                                                <div className="text-xs text-slate-400 mt-0.5 md:hidden">{student.studentGroup}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell text-slate-500">
                                            {student.studentEmail || '—'}
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell text-slate-500">
                                            {student.studentGroup || '—'}
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden lg:table-cell text-slate-500 text-xs whitespace-nowrap">
                                            {formatDate(student.lastActivity)}
                                        </td>
                                        <td className="px-5 py-4 align-middle text-right">
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/teacher/speaking/logs/${student.studentId}`)}
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
