'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { getPendingTeachers, approveTeacher, rejectTeacher } from '@/lib/adminService'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { getUserProfile, type UserProfile } from '@/lib/auth'
import { CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react'

export default function PendingApprovalsPage() {
    const [user] = useAuthState(auth)
    const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null)
    const [pending, setPending] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)
    const [rejectModal, setRejectModal] = useState<{ uid: string; name: string } | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    useEffect(() => {
        if (user?.uid) getUserProfile(user.uid).then(setAdminProfile)
    }, [user])

    const loadPending = async () => {
        setLoading(true)
        const data = await getPendingTeachers()
        setPending(data)
        setLoading(false)
    }

    useEffect(() => { loadPending() }, [])

    const handleApprove = async (teacherId: string) => {
        if (!adminProfile) return
        setProcessing(teacherId)
        await approveTeacher(teacherId, adminProfile.uid, adminProfile.displayName || adminProfile.name)
        setProcessing(null)
        loadPending()
    }

    const handleReject = async () => {
        if (!rejectModal || !adminProfile) return
        setProcessing(rejectModal.uid)
        await rejectTeacher(rejectModal.uid, adminProfile.uid, rejectReason, adminProfile.displayName || adminProfile.name)
        setRejectModal(null)
        setRejectReason('')
        setProcessing(null)
        loadPending()
    }

    return (
        <AdminLayout title="Pending Approvals">
            <div className="p-6 max-w-3xl mx-auto space-y-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Review and approve teacher account requests</p>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-5 shadow-sm animate-pulse h-24" />
                        ))}
                    </div>
                ) : pending.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <UserCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
                        <p className="font-semibold text-gray-700">All caught up!</p>
                        <p className="text-sm text-gray-400 mt-1">No pending teacher approvals.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pending.map(teacher => {
                            const isProcessing = processing === teacher.uid
                            const joinedDate = teacher.createdAt
                                ? new Date(teacher.createdAt as any).toLocaleDateString()
                                : 'Unknown'

                            return (
                                <div key={teacher.uid} className="bg-white rounded-xl shadow-sm p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                                            {(teacher.displayName || teacher.name || 'T')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-bold text-gray-900">{teacher.displayName || teacher.name}</p>
                                                    <p className="text-sm text-gray-500">{teacher.email}</p>
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="text-xs text-gray-400">Requested on {joinedDate}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        onClick={() => setRejectModal({ uid: teacher.uid, name: teacher.displayName || teacher.name })}
                                                        disabled={isProcessing}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-40"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(teacher.uid)}
                                                        disabled={isProcessing}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
                                                        style={{ backgroundColor: isProcessing ? '#a5b4fc' : '#6366f1' }}
                                                    >
                                                        {isProcessing
                                                            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                            : <CheckCircle className="w-4 h-4" />
                                                        }
                                                        Approve
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Reject modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Teacher Request</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Rejecting <strong>{rejectModal.name}</strong>. Optionally provide a reason.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason (optional)..."
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setRejectModal(null); setRejectReason('') }}
                                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleReject}
                                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600">
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
