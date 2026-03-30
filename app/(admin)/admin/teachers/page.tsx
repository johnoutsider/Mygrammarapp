'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { getTeachers, suspendTeacher, unsuspendTeacher, removeTeacher } from '@/lib/adminService'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { getUserProfile, type UserProfile } from '@/lib/auth'
import Link from 'next/link'
import {
    Search, ChevronDown, CheckCircle, XCircle, Clock,
    AlertTriangle, MoreVertical, UserX, ShieldOff, ShieldCheck,
    Eye
} from 'lucide-react'

type StatusFilter = 'all' | 'approved' | 'pending' | 'suspended' | 'rejected'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    approved: { label: 'Approved', color: '#059669', bg: '#d1fae5' },
    pending: { label: 'Pending', color: '#d97706', bg: '#fef3c7' },
    suspended: { label: 'Suspended', color: '#dc2626', bg: '#fee2e2' },
    rejected: { label: 'Rejected', color: '#6b7280', bg: '#f3f4f6' },
}

function TeachersPageInner() {
    const searchParams = useSearchParams()
    const [user] = useAuthState(auth)
    const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null)
    const [teachers, setTeachers] = useState<UserProfile[]>([])
    const [filtered, setFiltered] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(
        (searchParams.get('status') as StatusFilter) || 'all'
    )
    const [actionMenu, setActionMenu] = useState<string | null>(null)
    const [suspendModal, setSuspendModal] = useState<{ uid: string; name: string } | null>(null)
    const [suspendReason, setSuspendReason] = useState('')
    const [processing, setProcessing] = useState<string | null>(null)

    useEffect(() => {
        if (user?.uid) {
            getUserProfile(user.uid).then(setAdminProfile)
        }
    }, [user])

    const loadTeachers = async () => {
        setLoading(true)
        const data = await getTeachers()
        setTeachers(data)
        setLoading(false)
    }

    useEffect(() => { loadTeachers() }, [])

    useEffect(() => {
        let result = teachers
        if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter)
        if (search.trim()) {
            const q = search.toLowerCase()
            result = result.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.email.toLowerCase().includes(q)
            )
        }
        setFiltered(result)
    }, [teachers, statusFilter, search])

    const handleSuspend = async () => {
        if (!suspendModal || !adminProfile || !suspendReason.trim()) return
        setProcessing(suspendModal.uid)
        await suspendTeacher(suspendModal.uid, adminProfile.uid, suspendReason, adminProfile.displayName || adminProfile.name)
        setSuspendModal(null)
        setSuspendReason('')
        setProcessing(null)
        loadTeachers()
    }

    const handleUnsuspend = async (teacherId: string) => {
        if (!adminProfile) return
        setProcessing(teacherId)
        await unsuspendTeacher(teacherId, adminProfile.uid, adminProfile.displayName || adminProfile.name)
        setProcessing(null)
        loadTeachers()
    }

    const handleRemove = async (teacherId: string) => {
        if (!adminProfile || !confirm('Demote this teacher to student? This cannot be undone easily.')) return
        setProcessing(teacherId)
        await removeTeacher(teacherId, adminProfile.uid, adminProfile.displayName || adminProfile.name)
        setProcessing(null)
        loadTeachers()
    }

    const tabs: { key: StatusFilter; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'approved', label: 'Approved' },
        { key: 'pending', label: 'Pending' },
        { key: 'suspended', label: 'Suspended' },
        { key: 'rejected', label: 'Rejected' },
    ]

    return (
        <AdminLayout title="Teachers">
            <div className="p-6 max-w-6xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
                        <p className="text-sm text-gray-500 mt-0.5">{teachers.length} total teachers on the platform</p>
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                    {tabs.map(tab => (
                        <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                            {tab.label}
                            {tab.key !== 'all' && (
                                <span className="ml-1.5 text-xs text-gray-400">
                                    ({teachers.filter(t => t.status === tab.key).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-sm">No teachers found</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Teacher</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Joined</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(teacher => {
                                    const badge = STATUS_BADGE[teacher.status || 'pending']
                                    const isProcessing = processing === teacher.uid
                                    return (
                                        <tr key={teacher.uid} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                                                        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                                                        {(teacher.displayName || teacher.name || 'T')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{teacher.displayName || teacher.name}</div>
                                                        <div className="text-xs text-gray-400">{teacher.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                                    style={{ color: badge?.color, backgroundColor: badge?.bg }}>
                                                    {badge?.label || teacher.status || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-gray-400 text-xs hidden md:table-cell">
                                                {teacher.createdAt
                                                    ? new Date(teacher.createdAt as any).toLocaleDateString()
                                                    : '—'}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link href={`/admin/teachers/${teacher.uid}`}
                                                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors">
                                                        <Eye className="w-4 h-4" />
                                                    </Link>
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setActionMenu(actionMenu === teacher.uid ? null : teacher.uid)}
                                                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                                            disabled={isProcessing}
                                                        >
                                                            {isProcessing
                                                                ? <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                                                                : <MoreVertical className="w-4 h-4" />
                                                            }
                                                        </button>
                                                        {actionMenu === teacher.uid && (
                                                            <div className="absolute right-0 top-8 z-10 bg-white rounded-lg shadow-lg border border-gray-100 py-1 w-44"
                                                                onMouseLeave={() => setActionMenu(null)}>
                                                                <Link href={`/admin/teachers/${teacher.uid}`}
                                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                                    <Eye className="w-4 h-4" /> View Details
                                                                </Link>
                                                                {teacher.status === 'suspended' ? (
                                                                    <button onClick={() => { setActionMenu(null); handleUnsuspend(teacher.uid) }}
                                                                        className="flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50 w-full text-left">
                                                                        <ShieldCheck className="w-4 h-4" /> Unsuspend
                                                                    </button>
                                                                ) : teacher.status === 'approved' ? (
                                                                    <button onClick={() => { setActionMenu(null); setSuspendModal({ uid: teacher.uid, name: teacher.displayName || teacher.name }) }}
                                                                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                                                                        <ShieldOff className="w-4 h-4" /> Suspend
                                                                    </button>
                                                                ) : null}
                                                                <button onClick={() => { setActionMenu(null); handleRemove(teacher.uid) }}
                                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                                                                    <UserX className="w-4 h-4" /> Remove Teacher
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Suspend modal */}
            {suspendModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Suspend Teacher</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Suspending <strong>{suspendModal.name}</strong> will prevent them from accessing the platform.
                        </p>
                        <textarea
                            value={suspendReason}
                            onChange={e => setSuspendReason(e.target.value)}
                            placeholder="Reason for suspension (required)..."
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setSuspendModal(null); setSuspendReason('') }}
                                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleSuspend}
                                disabled={!suspendReason.trim()}
                                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-40">
                                Suspend
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}

export default function TeachersPage() {
    return (
        <Suspense fallback={<AdminLayout title="Teachers"><div className="p-10 text-center text-gray-400 text-sm">Loading...</div></AdminLayout>}>
            <TeachersPageInner />
        </Suspense>
    )
}
