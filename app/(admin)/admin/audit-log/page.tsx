'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { getAuditLog, type AuditEntry } from '@/lib/adminService'
import { CheckCircle, XCircle, AlertTriangle, ScrollText } from 'lucide-react'

const ACTION_LABELS: Record<string, string> = {
    teacher_approved: 'Approved teacher',
    teacher_rejected: 'Rejected teacher',
    teacher_suspended: 'Suspended teacher',
    teacher_unsuspended: 'Unsuspended teacher',
    teacher_removed: 'Removed teacher role from',
    permissions_changed: 'Changed permissions for',
    role_changed: 'Changed role of',
    platform_settings_updated: 'Updated platform settings',
}

const ACTION_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    teacher_approved: { color: '#059669', bg: '#d1fae5', icon: <CheckCircle className="w-4 h-4" /> },
    teacher_unsuspended: { color: '#059669', bg: '#d1fae5', icon: <CheckCircle className="w-4 h-4" /> },
    teacher_rejected: { color: '#dc2626', bg: '#fee2e2', icon: <XCircle className="w-4 h-4" /> },
    teacher_suspended: { color: '#dc2626', bg: '#fee2e2', icon: <XCircle className="w-4 h-4" /> },
    teacher_removed: { color: '#ea580c', bg: '#fff7ed', icon: <AlertTriangle className="w-4 h-4" /> },
    permissions_changed: { color: '#2563eb', bg: '#eff6ff', icon: <AlertTriangle className="w-4 h-4" /> },
    platform_settings_updated: { color: '#7c3aed', bg: '#f5f3ff', icon: <AlertTriangle className="w-4 h-4" /> },
}

export default function AuditLogPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getAuditLog(100).then(data => {
            setEntries(data)
            setLoading(false)
        })
    }, [])

    return (
        <AdminLayout title="Audit Log">
            <div className="p-6 max-w-4xl mx-auto space-y-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
                    <p className="text-sm text-gray-500 mt-0.5">History of all admin actions on the platform</p>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse h-16" />
                        ))}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="font-semibold text-gray-700">No audit entries yet</p>
                        <p className="text-sm text-gray-400 mt-1">Admin actions will appear here.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <ul className="divide-y divide-gray-50">
                            {entries.map(entry => {
                                const style = ACTION_STYLE[entry.action] || { color: '#6b7280', bg: '#f3f4f6', icon: <AlertTriangle className="w-4 h-4" /> }
                                return (
                                    <li key={entry.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                            style={{ backgroundColor: style.bg, color: style.color }}>
                                            {style.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800">
                                                <span className="font-semibold">{entry.performedByName || 'Admin'}</span>
                                                {' '}{ACTION_LABELS[entry.action] || entry.action}
                                                {entry.targetUserName && entry.action !== 'platform_settings_updated' && (
                                                    <> <span className="font-semibold">{entry.targetUserName}</span></>
                                                )}
                                                {entry.targetUserEmail && (
                                                    <span className="text-gray-400"> ({entry.targetUserEmail})</span>
                                                )}
                                            </p>
                                            {entry.details?.reason && (
                                                <p className="text-xs text-gray-500 mt-0.5">Reason: {entry.details.reason}</p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {entry.timestamp.toLocaleString()}
                                            </p>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
