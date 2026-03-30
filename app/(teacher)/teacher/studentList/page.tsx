'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/firebase'
import { getUserProfile } from '@/lib/auth'
import { getStudentsByClassIds, StudentProfile } from '@/lib/groupService'
import TeacherLayout from '@/components/TeacherLayout'

const ACCESS_MODE_LABELS: Record<string, string> = {
    both: 'Writing & Grammar',
    writing: 'Writing',
    grammar: 'Grammar',
    speaking: 'Speaking',
}

const ACCESS_MODE_COLORS: Record<string, string> = {
    both: 'bg-teal-50 text-teal-700 border-teal-100',
    writing: 'bg-blue-50 text-blue-700 border-blue-100',
    grammar: 'bg-violet-50 text-violet-700 border-violet-100',
    speaking: 'bg-amber-50 text-amber-700 border-amber-100',
}

const AVATAR_COLORS = [
    { bg: '#E6F1FB', fg: '#0C447C' },
    { bg: '#E1F5EE', fg: '#085041' },
    { bg: '#FAEEDA', fg: '#633806' },
    { bg: '#EEEDFE', fg: '#3C3489' },
    { bg: '#FAECE7', fg: '#712B13' },
    { bg: '#FBEAF0', fg: '#72243E' },
    { bg: '#EAF3DE', fg: '#27500A' },
]

function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

const PER_PAGE = 15

export default function StudentListPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [students, setStudents] = useState<StudentProfile[]>([])
    const [search, setSearch] = useState('')
    const [groupFilter, setGroupFilter] = useState('')
    const [modeFilter, setModeFilter] = useState('')
    const [page, setPage] = useState(1)

    useEffect(() => {
        const load = async () => {
            if (!auth.currentUser) { router.push('/'); return }
            try {
                const profile = await getUserProfile(auth.currentUser.uid)
                const classIds: string[] = (profile as any)?.classIds ?? []
                const data = classIds.length > 0 ? await getStudentsByClassIds(classIds) : []
                // Sort by group then name
                data.sort((a, b) => {
                    const g = (a.groupName || '').localeCompare(b.groupName || '')
                    return g !== 0 ? g : (a.name || '').localeCompare(b.name || '')
                })
                setStudents(data)
            } catch (err) {
                console.error('Failed to load students:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [router])

    const groups = useMemo(() =>
        Array.from(new Set(students.map(s => s.groupName).filter((g): g is string => !!g && g.trim() !== '')))
    , [students])

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return students.filter(s => {
            const name = (s.displayName || s.name || '').toLowerCase()
            const email = (s.email || '').toLowerCase()
            if (q && !name.includes(q) && !email.includes(q)) return false
            if (groupFilter && s.groupName !== groupFilter) return false
            if (modeFilter && s.accessMode !== modeFilter) return false
            return true
        })
    }, [students, search, groupFilter, modeFilter])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
    const safePage = Math.min(page, totalPages)
    const slice = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

    function resetPage() { setPage(1) }

    const totalStudents = students.length
    const groupCount = groups.length

    return (
        <TeacherLayout title="Students">
            <div className="p-6 max-w-screen-xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 mb-0.5">Students</h1>
                    <p className="text-slate-400 text-sm">All students assigned to your classes</p>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100" style={{ borderLeft: '4px solid #3b82f6' }}>
                        <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{totalStudents}</div>
                        <div className="text-slate-500 text-sm mt-1">Total Students</div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100" style={{ borderLeft: '4px solid #8b5cf6' }}>
                        <div className="text-3xl font-bold" style={{ color: '#8b5cf6' }}>{groupCount}</div>
                        <div className="text-slate-500 text-sm mt-1">Groups</div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100" style={{ borderLeft: '4px solid #10b981' }}>
                        <div className="text-3xl font-bold" style={{ color: '#10b981' }}>{filtered.length}</div>
                        <div className="text-slate-500 text-sm mt-1">Showing</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <input
                        type="text"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); resetPage() }}
                        className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-colors"
                    />
                    <select
                        value={groupFilter}
                        onChange={e => { setGroupFilter(e.target.value); resetPage() }}
                        className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-teal-500 transition-colors"
                    >
                        <option value="">All Groups</option>
                        {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select
                        value={modeFilter}
                        onChange={e => { setModeFilter(e.target.value); resetPage() }}
                        className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-teal-500 transition-colors"
                    >
                        <option value="">All Access Modes</option>
                        {Object.entries(ACCESS_MODE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">#</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Student</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Group</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Access</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {slice.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-14 text-center text-slate-400 text-sm">
                                                    {totalStudents === 0
                                                        ? 'No students are assigned to your classes yet.'
                                                        : 'No students match the selected filters.'}
                                                </td>
                                            </tr>
                                        ) : slice.map((student, idx) => {
                                            const displayName = student.displayName || student.name || 'Unknown'
                                            const { bg, fg } = avatarColor(displayName)
                                            return (
                                                <tr key={student.uid} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-3.5 text-slate-300 text-sm">
                                                        {(safePage - 1) * PER_PAGE + idx + 1}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                                                                style={{ background: bg, color: fg }}
                                                            >
                                                                {getInitials(displayName)}
                                                            </div>
                                                            <span className="font-medium text-slate-800">{displayName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-400 text-sm">{student.email || '—'}</td>
                                                    <td className="px-5 py-3.5">
                                                        {student.groupName ? (
                                                            <span className="bg-violet-50 text-violet-600 border border-violet-100 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                                                {student.groupName}
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`border px-2.5 py-0.5 rounded-full text-xs font-medium ${ACCESS_MODE_COLORS[student.accessMode] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                            {ACCESS_MODE_LABELS[student.accessMode] || student.accessMode}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right">
                                                        <Link
                                                            href={`/teacher/${student.uid}`}
                                                            className="text-teal-600 hover:text-teal-700 text-sm font-medium transition-colors"
                                                        >
                                                            View →
                                                        </Link>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {filtered.length > PER_PAGE && (
                                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
                                    <p className="text-xs text-slate-400">
                                        Showing {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)} of {filtered.length} students
                                    </p>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={safePage === 1}
                                            className="h-8 px-3 flex items-center justify-center rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <span className="h-8 px-3 flex items-center text-xs text-slate-500 font-medium">
                                            Page {safePage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={safePage === totalPages}
                                            className="h-8 px-3 flex items-center justify-center rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </TeacherLayout>
    )
}
