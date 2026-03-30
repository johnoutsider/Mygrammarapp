'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import TeacherLayout from '@/components/TeacherLayout'
import { listSpeakingResponsesByStudentIds, TeacherSpeakingResponse } from '@/lib/speakingService'
import { auth } from '@/lib/firebase'
import { getUserProfile } from '@/lib/auth'

const SESSION_WINDOW_MS = 30 * 60 * 1000

interface SessionGroup {
    id: string
    assignmentId: string
    partLabel: string
    createdAt: string
    responses: TeacherSpeakingResponse[]
    totalWarnings: number
    hasAnalysis: boolean
    allSent: boolean
}

interface GuidedSession {
    id: string
    topicTitle: string
    completedAt: string
    questionCount: number
}

interface StudentMeta {
    name: string
    group: string
}

interface MergedSession {
    id: string
    type: 'test' | 'guided'
    topic: string
    date: string
    questions: number
    warnings: number | null
    status: 'Analyzed' | 'Pending' | 'Not Sent' | 'Completed'
}

function groupIntoSessions(responses: TeacherSpeakingResponse[]): SessionGroup[] {
    const sorted = responses.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const groups: SessionGroup[] = []

    for (const response of sorted) {
        const responseTime = new Date(response.createdAt).getTime()
        const existing = groups.find(group =>
            group.assignmentId === response.assignmentId &&
            Math.abs(new Date(group.responses[group.responses.length - 1].createdAt).getTime() - responseTime) < SESSION_WINDOW_MS,
        )

        if (existing) {
            existing.responses.push(response)
            existing.totalWarnings += response.warningCount
            if (response.aiAnalysis) existing.hasAnalysis = true
            if (!response.sentForAnalysis) existing.allSent = false
        } else {
            groups.push({
                id: response.id,
                assignmentId: response.assignmentId,
                partLabel: response.partLabel,
                createdAt: response.createdAt,
                responses: [response],
                totalWarnings: response.warningCount,
                hasAnalysis: Boolean(response.aiAnalysis),
                allSent: Boolean(response.sentForAnalysis),
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

async function fetchGuidedSessions(teacherId: string, studentId: string) {
    const response = await fetch(`/api/speaking/guided/teacher/students/${studentId}/submissions?teacherId=${encodeURIComponent(teacherId)}`)
    const data = await response.json()
    if (!response.ok) {
        throw new Error(data.error || 'Failed to load guided sessions.')
    }

    return (data.submissions || []) as GuidedSession[]
}

export default function TeacherStudentSessionsPage() {
    const params = useParams<{ studentId: string }>()
    const router = useRouter()
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [responses, setResponses] = useState<TeacherSpeakingResponse[]>([])
    const [guidedSessions, setGuidedSessions] = useState<GuidedSession[]>([])
    const [studentMeta, setStudentMeta] = useState<StudentMeta>({ name: 'Student', group: '' })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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
                const teacherProfile = await getUserProfile(teacherId)
                const teacherClassIds: string[] = (teacherProfile as any)?.classIds ?? []
                const { verifyStudentOwnership } = await import('@/lib/accessControl')
                if (teacherClassIds.length > 0 && !(await verifyStudentOwnership(teacherClassIds, params.studentId))) {
                    setError('Student not in your classes.')
                    setLoading(false)
                    return
                }

                const [typeAResponses, guided, studentProfile] = await Promise.all([
                    listSpeakingResponsesByStudentIds([params.studentId], { onlySent: true }),
                    fetchGuidedSessions(teacherId, params.studentId),
                    getUserProfile(params.studentId),
                ])

                setResponses(typeAResponses)
                setGuidedSessions(guided)
                setStudentMeta({
                    name: typeAResponses[0]?.studentName || studentProfile?.displayName || studentProfile?.name || 'Student',
                    group: typeAResponses[0]?.studentGroup || studentProfile?.groupName || studentProfile?.profileGroupName || '',
                })
                setError(null)
            } catch (err) {
                console.error(err)
                setError('Failed to load student sessions.')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [params.studentId, teacherId])

    const mergedSessions = useMemo<MergedSession[]>(() => {
        const testSessions = groupIntoSessions(responses).map(session => ({
            id: session.id,
            type: 'test' as const,
            topic: session.partLabel || 'Speaking Test',
            date: session.createdAt,
            questions: session.responses.length,
            warnings: session.totalWarnings,
            status: session.hasAnalysis ? 'Analyzed' as const : session.allSent ? 'Pending' as const : 'Not Sent' as const,
        }))

        const guided = guidedSessions.map(session => ({
            id: session.id,
            type: 'guided' as const,
            topic: session.topicTitle || 'Guided Practice',
            date: session.completedAt,
            questions: session.questionCount,
            warnings: null,
            status: 'Completed' as const,
        }))

        return [...testSessions, ...guided].sort((left, right) => right.date.localeCompare(left.date))
    }, [guidedSessions, responses])

    return (
        <TeacherLayout title="Student Sessions">
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                <div>
                    <button
                        onClick={() => router.push('/teacher/speaking/logs')}
                        className="text-sm text-[#1a9aaa] hover:underline mb-2 inline-block"
                    >
                        &larr; Back to Students
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">{studentMeta.name}</h1>
                    {studentMeta.group && (
                        <p className="text-sm text-slate-500 mt-0.5">{studentMeta.group}</p>
                    )}
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {loading ? (
                    <div className="min-h-[30vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                    </div>
                ) : mergedSessions.length === 0 ? (
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
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Type</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Questions</th>
                                    <th className="px-5 py-3 text-left hidden md:table-cell">Warnings</th>
                                    <th className="px-5 py-3 text-center hidden md:table-cell">Status</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {mergedSessions.map(session => (
                                    <tr key={`${session.type}-${session.id}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 align-middle">
                                            <div className="font-semibold text-slate-900">{session.topic}</div>
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell text-xs text-slate-500 whitespace-nowrap">
                                            {formatDate(session.date)}
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${session.type === 'test' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                                                {session.type === 'test' ? 'Speaking Test' : 'Guided Practice'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell">
                                            <span className="text-xs text-slate-600 font-medium">
                                                {session.questions} question{session.questions !== 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-middle hidden md:table-cell">
                                            {session.warnings === null ? (
                                                <span className="text-xs font-semibold text-slate-400">—</span>
                                            ) : (
                                                <span className={`text-xs font-semibold ${session.warnings > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                    {session.warnings}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 align-middle text-center hidden md:table-cell">
                                            {session.status === 'Analyzed' ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1">
                                                    Analyzed
                                                </span>
                                            ) : session.status === 'Completed' ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1">
                                                    Completed
                                                </span>
                                            ) : session.status === 'Pending' ? (
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
                                                onClick={() => router.push(
                                                    session.type === 'test'
                                                        ? `/teacher/speaking/logs/${params.studentId}/${session.id}`
                                                        : `/teacher/speaking/logs/${params.studentId}/guided-${session.id}`,
                                                )}
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

