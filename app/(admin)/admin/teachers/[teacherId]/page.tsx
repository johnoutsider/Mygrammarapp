'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import {
    getTeacherById, approveTeacher, rejectTeacher, suspendTeacher,
    unsuspendTeacher, removeTeacher, updateTeacherPermissions, getTeacherStats
} from '@/lib/adminService'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { getUserProfile, type UserProfile, type TeacherPermissions, DEFAULT_TEACHER_PERMISSIONS } from '@/lib/auth'
import { getTeacherClasses } from '@/lib/classService'
import {
    ArrowLeft, CheckCircle, XCircle, ShieldOff, ShieldCheck,
    UserX, Save, Building2, Users, AlertTriangle
} from 'lucide-react'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    approved: { label: 'Approved', color: '#059669', bg: '#d1fae5' },
    pending: { label: 'Pending', color: '#d97706', bg: '#fef3c7' },
    suspended: { label: 'Suspended', color: '#dc2626', bg: '#fee2e2' },
    rejected: { label: 'Rejected', color: '#6b7280', bg: '#f3f4f6' },
}

const PERMISSION_LABELS: { key: keyof TeacherPermissions; label: string; desc: string }[] = [
    { key: 'canCreateClasses', label: 'Create Classes', desc: 'Can create and manage classes' },
    { key: 'canDeleteStudents', label: 'Delete Students', desc: 'Can remove student accounts' },
    { key: 'canUseAITools', label: 'AI Tools', desc: 'Access to AI assistant, EVA, and analysis' },
    { key: 'canHostGames', label: 'Host Games', desc: 'Can host live grammar games' },
    { key: 'canManageSpeaking', label: 'Speaking Module', desc: 'Can create and manage speaking assignments' },
]

export default function TeacherDetailPage() {
    const params = useParams()
    const router = useRouter()
    const teacherId = params.teacherId as string
    const [user] = useAuthState(auth)
    const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null)
    const [teacher, setTeacher] = useState<UserProfile | null>(null)
    const [classes, setClasses] = useState<any[]>([])
    const [stats, setStats] = useState<{ classCount: number; studentCount: number } | null>(null)
    const [loading, setLoading] = useState(true)
    const [permissions, setPermissions] = useState<TeacherPermissions>(DEFAULT_TEACHER_PERMISSIONS)
    const [permsSaving, setPermsSaving] = useState(false)
    const [permsSaved, setPermsSaved] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [suspendReason, setSuspendReason] = useState('')
    const [showSuspendForm, setShowSuspendForm] = useState(false)

    useEffect(() => {
        if (user?.uid) getUserProfile(user.uid).then(setAdminProfile)
    }, [user])

    const loadTeacher = async () => {
        setLoading(true)
        const [t, teacherStats] = await Promise.all([
            getTeacherById(teacherId),
            getTeacherStats(teacherId),
        ])
        setTeacher(t)
        setStats(teacherStats)
        if (t) {
            setPermissions(t.permissions || DEFAULT_TEACHER_PERMISSIONS)
            const teacherClasses = await getTeacherClasses(teacherId)
            setClasses(teacherClasses)
        }
        setLoading(false)
    }

    useEffect(() => { loadTeacher() }, [teacherId])

    const adminName = adminProfile?.displayName || adminProfile?.name

    const handleApprove = async () => {
        if (!adminProfile) return
        setProcessing(true)
        await approveTeacher(teacherId, adminProfile.uid, adminName)
        setProcessing(false)
        loadTeacher()
    }

    const handleReject = async () => {
        if (!adminProfile || !confirm('Reject this teacher request?')) return
        setProcessing(true)
        await rejectTeacher(teacherId, adminProfile.uid, undefined, adminName)
        setProcessing(false)
        loadTeacher()
    }

    const handleSuspend = async () => {
        if (!adminProfile || !suspendReason.trim()) return
        setProcessing(true)
        await suspendTeacher(teacherId, adminProfile.uid, suspendReason, adminName)
        setShowSuspendForm(false)
        setSuspendReason('')
        setProcessing(false)
        loadTeacher()
    }

    const handleUnsuspend = async () => {
        if (!adminProfile) return
        setProcessing(true)
        await unsuspendTeacher(teacherId, adminProfile.uid, adminName)
        setProcessing(false)
        loadTeacher()
    }

    const handleRemove = async () => {
        if (!adminProfile || !confirm('Demote this teacher to student? This removes their teacher access permanently.')) return
        setProcessing(true)
        await removeTeacher(teacherId, adminProfile.uid, adminName)
        setProcessing(false)
        router.push('/admin/teachers')
    }

    const handleSavePermissions = async () => {
        if (!adminProfile) return
        setPermsSaving(true)
        await updateTeacherPermissions(teacherId, permissions, adminProfile.uid, adminName)
        setPermsSaving(false)
        setPermsSaved(true)
        setTimeout(() => setPermsSaved(false), 2000)
    }

    const togglePerm = (key: keyof TeacherPermissions) => {
        if (typeof permissions[key] === 'boolean') {
            setPermissions(p => ({ ...p, [key]: !p[key] }))
        }
    }

    if (loading) {
        return (
            <AdminLayout title="Teacher Detail">
                <div className="p-6 flex justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full" />
                </div>
            </AdminLayout>
        )
    }

    if (!teacher) {
        return (
            <AdminLayout title="Teacher Detail">
                <div className="p-6 text-center text-gray-500">Teacher not found.</div>
            </AdminLayout>
        )
    }

    const badge = STATUS_BADGE[teacher.status || 'pending']
    const createdAt = teacher.createdAt ? new Date(teacher.createdAt as any).toLocaleDateString() : '—'

    return (
        <AdminLayout title={teacher.displayName || teacher.name}>
            <div className="p-6 max-w-3xl mx-auto space-y-5">

                {/* Back */}
                <button onClick={() => router.back()}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Teachers
                </button>

                {/* Profile card */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                            {(teacher.displayName || teacher.name || 'T')[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">{teacher.displayName || teacher.name}</h1>
                                    <p className="text-gray-500 text-sm">{teacher.email}</p>
                                    <p className="text-xs text-gray-400 mt-1">Joined {createdAt}</p>
                                </div>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                                    style={{ color: badge?.color, backgroundColor: badge?.bg }}>
                                    {badge?.label || teacher.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-gray-900">{stats?.classCount ?? '—'}</div>
                                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-0.5">
                                        <Building2 className="w-3 h-3" /> Classes
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-gray-900">{stats?.studentCount ?? '—'}</div>
                                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-0.5">
                                        <Users className="w-3 h-3" /> Students
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Actions</h2>

                    {teacher.status === 'pending' && (
                        <div className="flex gap-3">
                            <button onClick={handleApprove} disabled={processing}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                                <CheckCircle className="w-4 h-4" /> Approve Teacher
                            </button>
                            <button onClick={handleReject} disabled={processing}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40 transition-colors">
                                <XCircle className="w-4 h-4" /> Reject
                            </button>
                        </div>
                    )}

                    {teacher.status === 'approved' && (
                        <div className="space-y-3">
                            {!showSuspendForm ? (
                                <button onClick={() => setShowSuspendForm(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors">
                                    <ShieldOff className="w-4 h-4" /> Suspend Teacher
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                                        placeholder="Reason for suspension (required)..."
                                        rows={2}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={handleSuspend} disabled={!suspendReason.trim() || processing}
                                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40">
                                            Confirm Suspend
                                        </button>
                                        <button onClick={() => { setShowSuspendForm(false); setSuspendReason('') }}
                                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {teacher.status === 'suspended' && (
                        <div className="space-y-3">
                            {teacher.suspendedReason && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-xs font-medium text-red-700">Suspension reason:</p>
                                    <p className="text-sm text-red-600 mt-0.5">{teacher.suspendedReason}</p>
                                </div>
                            )}
                            <button onClick={handleUnsuspend} disabled={processing}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-green-700 border border-green-200 hover:bg-green-50 disabled:opacity-40 transition-colors">
                                <ShieldCheck className="w-4 h-4" /> Unsuspend Teacher
                            </button>
                        </div>
                    )}

                    <div className="pt-3 mt-3 border-t border-gray-100">
                        <button onClick={handleRemove} disabled={processing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors">
                            <UserX className="w-4 h-4" /> Remove Teacher Role
                        </button>
                    </div>
                </div>

                {/* Permissions */}
                {teacher.status === 'approved' && (
                    <div className="bg-white rounded-xl shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Permissions</h2>
                            <button onClick={handleSavePermissions} disabled={permsSaving}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                                {permsSaved
                                    ? <><CheckCircle className="w-4 h-4" /> Saved</>
                                    : permsSaving
                                        ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        : <><Save className="w-4 h-4" /> Save</>
                                }
                            </button>
                        </div>
                        <div className="space-y-3">
                            {PERMISSION_LABELS.map(({ key, label, desc }) => (
                                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{label}</p>
                                        <p className="text-xs text-gray-400">{desc}</p>
                                    </div>
                                    <button onClick={() => togglePerm(key)}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${permissions[key] ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permissions[key] ? 'translate-x-5' : ''}`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Classes */}
                {classes.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-5">
                        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Classes ({classes.length})</h2>
                        <div className="space-y-2">
                            {classes.map(cls => (
                                <div key={cls.id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                                    <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{cls.name}</p>
                                        <p className="text-xs text-gray-400 capitalize">{cls.subject} access</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
