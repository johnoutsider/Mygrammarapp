'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import TeacherLayout from '@/components/TeacherLayout'
import { auth } from '@/lib/firebase'
import { listSpeakingResponsesByStudentIds, TeacherSpeakingResponse } from '@/lib/speakingService'
import { getUserProfile } from '@/lib/auth'
import { getStudentsByClassIds } from '@/lib/groupService'

interface StudentRow {
    studentId: string
    studentName: string
    studentEmail: string
    studentGroup: string
    sessionCount: number
    lastActivity: string
    hasAnalysis: boolean
    allSent: boolean
    unanalyzedCount: number
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
                hasAnalysis: false,
                allSent: true,
                unanalyzedCount: 0,
            })
        }
        const entry = map.get(r.studentId)!
        if (r.createdAt > entry.lastActivity) entry.lastActivity = r.createdAt
        entry.sessionCount += 1
        if (r.aiAnalysis) entry.hasAnalysis = true
        if (!r.sentForAnalysis) entry.allSent = false
        if (r.transcript && !r.aiAnalysis) entry.unanalyzedCount += 1
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
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number } | null>(null)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, user => {
            if (user) setTeacherId(user.uid)
        })
        return () => unsub()
    }, [])

    useEffect(() => {
        const load = async () => {
            if (!auth.currentUser) return
            try {
                // Scope to teacher's own class students
                const teacherProfile = await getUserProfile(auth.currentUser.uid)
                const classIds: string[] = (teacherProfile as any)?.classIds || []
                const students = classIds.length > 0 ? await getStudentsByClassIds(classIds) : []
                const studentIds = students.map(s => s.uid)
                const data = await listSpeakingResponsesByStudentIds(studentIds)
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
    const totalUnanalyzed = useMemo(() => responses.filter(r => r.transcript && !r.aiAnalysis).length, [responses])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return students
        return students.filter(s =>
            s.studentName.toLowerCase().includes(q) ||
            s.studentEmail.toLowerCase().includes(q) ||
            s.studentGroup.toLowerCase().includes(q)
        )
    }, [students, search])

    const handleBatchAnalysis = async () => {
        if (!teacherId || totalUnanalyzed === 0) return
        if (!confirm(`Run batch analysis on ${totalUnanalyzed} unanalyzed response${totalUnanalyzed !== 1 ? 's' : ''}? This may take a few minutes.`)) return

        setBatchStatus('running')
        setBatchProgress(null)

        try {
            const res = await fetch('/api/speaking/batch-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Batch analysis failed.')

            setBatchProgress({ processed: data.processedSoFar ?? 0, total: data.totalResponses ?? totalUnanalyzed })

            // Poll for completion
            const jobId = data.batchJobId
            if (jobId) {
                const poll = async () => {
                    const pollRes = await fetch(`/api/speaking/batch-analyze/collect?jobId=${jobId}`)
                    const pollData = await pollRes.json()
                    setBatchProgress({ processed: pollData.processedSoFar ?? 0, total: pollData.totalResponses ?? totalUnanalyzed })
                    if (pollData.status === 'completed') {
                        setBatchStatus('done')
                        // Reload responses scoped to teacher's students
                        if (auth.currentUser) {
                            const teacherProfile = await getUserProfile(auth.currentUser.uid)
                            const classIds: string[] = (teacherProfile as any)?.classIds || []
                            const students = classIds.length > 0 ? await getStudentsByClassIds(classIds) : []
                            const fresh = await listSpeakingResponsesByStudentIds(students.map(s => s.uid))
                            setResponses(fresh)
                        }
                    } else if (pollData.status === 'failed') {
                        setBatchStatus('error')
                    } else {
                        setTimeout(() => void poll(), 5000)
                    }
                }
                await poll()
            } else {
                setBatchStatus('done')
                if (auth.currentUser) {
                    const teacherProfile = await getUserProfile(auth.currentUser.uid)
                    const classIds: string[] = (teacherProfile as any)?.classIds || []
                    const students = classIds.length > 0 ? await getStudentsByClassIds(classIds) : []
                    const fresh = await listSpeakingResponsesByStudentIds(students.map(s => s.uid))
                    setResponses(fresh)
                }
            }
        } catch (err: any) {
            console.error(err)
            setError(err.message || 'Batch analysis failed.')
            setBatchStatus('error')
        }
    }

    return (
        <TeacherLayout title="Speaking Logs">
            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Speaking Logs</h1>
                        <p className="text-sm text-slate-500 mt-1">All students and their speaking sessions.</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => router.push('/teacher/speaking/overview')}
                            className="px-4 py-2 rounded-xl border border-[#1a9aaa] text-[#1a9aaa] hover:bg-teal-50 text-sm font-semibold transition-colors"
                        >
                            Performance Overview
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleBatchAnalysis()}
                            disabled={batchStatus === 'running' || totalUnanalyzed === 0 || !teacherId}
                            className="px-4 py-2 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {batchStatus === 'running'
                                ? `Analyzing${batchProgress ? ` ${batchProgress.processed}/${batchProgress.total}` : '...'}`
                                : batchStatus === 'done'
                                ? 'Analysis Complete'
                                : `Run Batch Analysis${totalUnanalyzed > 0 ? ` (${totalUnanalyzed})` : ''}`}
                        </button>
                    </div>
                </div>

                {batchStatus === 'done' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
                        Batch analysis complete. All responses have been analyzed.
                    </div>
                )}

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
                        No students found.
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
                                    <th className="px-5 py-3 text-center hidden md:table-cell">Status</th>
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
                                        <td className="px-5 py-4 align-middle text-center hidden md:table-cell">
                                            {student.hasAnalysis ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1">
                                                    Analyzed
                                                </span>
                                            ) : student.unanalyzedCount > 0 ? (
                                                <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1">
                                                    {student.unanalyzedCount} pending
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-400 text-xs font-semibold px-2.5 py-1">
                                                    No transcript
                                                </span>
                                            )}
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
