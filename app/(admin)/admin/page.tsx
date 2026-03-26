'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { getPlatformStats, getAuditLog, type PlatformStats, type AuditEntry } from '@/lib/adminService'
import { Users, GraduationCap, Building2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const ACTION_LABELS: Record<string, string> = {
    teacher_approved: 'Approved teacher',
    teacher_rejected: 'Rejected teacher',
    teacher_suspended: 'Suspended teacher',
    teacher_unsuspended: 'Unsuspended teacher',
    teacher_removed: 'Removed teacher',
    permissions_changed: 'Changed permissions for',
    role_changed: 'Changed role of',
    platform_settings_updated: 'Updated platform settings',
}

const ACTION_COLORS: Record<string, string> = {
    teacher_approved: 'text-green-600',
    teacher_rejected: 'text-red-600',
    teacher_suspended: 'text-red-500',
    teacher_unsuspended: 'text-green-500',
    teacher_removed: 'text-orange-600',
    permissions_changed: 'text-blue-600',
    platform_settings_updated: 'text-indigo-600',
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            const [s, a] = await Promise.all([getPlatformStats(), getAuditLog(10)])
            setStats(s)
            setRecentActivity(a)
            setLoading(false)
        }
        fetch()
    }, [])

    const statCards = stats ? [
        {
            label: 'Total Teachers',
            value: stats.totalTeachers,
            icon: <Users className="w-6 h-6" />,
            color: '#6366f1',
            bg: '#eef2ff',
            sub: `${stats.approvedTeachers} approved`,
            href: '/admin/teachers',
        },
        {
            label: 'Pending Approvals',
            value: stats.pendingTeachers,
            icon: <Clock className="w-6 h-6" />,
            color: '#f59e0b',
            bg: '#fffbeb',
            sub: 'Awaiting review',
            href: '/admin/teachers/pending',
            urgent: stats.pendingTeachers > 0,
        },
        {
            label: 'Total Students',
            value: stats.totalStudents,
            icon: <GraduationCap className="w-6 h-6" />,
            color: '#10b981',
            bg: '#ecfdf5',
            sub: 'Across all classes',
            href: '/admin/students',
        },
        {
            label: 'Total Classes',
            value: stats.totalClasses,
            icon: <Building2 className="w-6 h-6" />,
            color: '#3b82f6',
            bg: '#eff6ff',
            sub: 'Active classes',
            href: '/admin/classes',
        },
    ] : []

    return (
        <AdminLayout title="Dashboard">
            <div className="p-6 max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Platform overview and quick actions</p>
                </div>

                {/* Stats grid */}
                {loading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-5 shadow-sm animate-pulse h-28" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map(card => (
                            <Link key={card.label} href={card.href}
                                className={`bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${card.urgent ? 'ring-2 ring-amber-400' : ''}`}>
                                {card.urgent && (
                                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                )}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: card.bg, color: card.color }}>
                                        {card.icon}
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-0.5">{card.value}</div>
                                <div className="text-sm font-medium text-gray-700">{card.label}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Suspended teachers warning */}
                {stats && stats.suspendedTeachers > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-orange-800">
                                {stats.suspendedTeachers} teacher{stats.suspendedTeachers > 1 ? 's are' : ' is'} currently suspended.
                            </p>
                        </div>
                        <Link href="/admin/teachers?status=suspended"
                            className="text-xs font-semibold text-orange-700 hover:text-orange-900">
                            View →
                        </Link>
                    </div>
                )}

                {/* Quick actions + Recent activity */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Quick actions */}
                    <div className="bg-white rounded-xl shadow-sm p-5">
                        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Quick Actions</h2>
                        <div className="space-y-2">
                            <Link href="/admin/teachers/pending"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-indigo-50 text-indigo-700 border border-indigo-100">
                                <Clock className="w-4 h-4" />
                                Review Pending Teachers
                                {stats && stats.pendingTeachers > 0 && (
                                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                                        {stats.pendingTeachers}
                                    </span>
                                )}
                            </Link>
                            <Link href="/admin/teachers"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50 text-gray-700 border border-gray-100">
                                <Users className="w-4 h-4" />
                                Manage Teachers
                            </Link>
                            <Link href="/admin/platform"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50 text-gray-700 border border-gray-100">
                                <AlertTriangle className="w-4 h-4" />
                                Platform Settings
                            </Link>
                        </div>
                    </div>

                    {/* Recent activity */}
                    <div className="bg-white rounded-xl shadow-sm p-5 lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Recent Activity</h2>
                            <Link href="/admin/audit-log" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                View all →
                            </Link>
                        </div>
                        {recentActivity.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
                        ) : (
                            <ul className="space-y-3">
                                {recentActivity.map(entry => (
                                    <li key={entry.id} className="flex items-start gap-3">
                                        <div className={`mt-0.5 ${ACTION_COLORS[entry.action] || 'text-gray-400'}`}>
                                            {entry.action.includes('approved') || entry.action.includes('unsuspended')
                                                ? <CheckCircle className="w-4 h-4" />
                                                : entry.action.includes('rejected') || entry.action.includes('suspended') || entry.action.includes('removed')
                                                    ? <XCircle className="w-4 h-4" />
                                                    : <AlertTriangle className="w-4 h-4" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-700">
                                                <span className="font-medium">{entry.performedByName || 'Admin'}</span>
                                                {' '}{ACTION_LABELS[entry.action] || entry.action}{' '}
                                                {entry.targetUserName && (
                                                    <span className="font-medium">{entry.targetUserName}</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {entry.timestamp.toLocaleString()}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
