'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useEffect, useState } from 'react'
import {
    LayoutDashboard,
    Users,
    Clock,
    GraduationCap,
    Building2,
    Settings,
    ScrollText,
    LogOut,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Menu,
    ArrowRightLeft,
} from 'lucide-react'

interface AdminLayoutProps {
    children: React.ReactNode
    title?: string
}

const navItems = [
    {
        href: '/admin',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
        exact: true,
    },
    {
        href: '/admin/teachers',
        label: 'Teachers',
        icon: <Users className="w-5 h-5" />,
        badge: 'pending',  // will show pending count
    },
    {
        href: '/admin/teachers/pending',
        label: 'Pending Approvals',
        icon: <Clock className="w-5 h-5" />,
        indent: true,
    },
    {
        href: '/admin/students',
        label: 'Students',
        icon: <GraduationCap className="w-5 h-5" />,
        exact: true,
    },
    {
        href: '/admin/students/assign',
        label: 'Student Assignment',
        icon: <ArrowRightLeft className="w-5 h-5" />,
        indent: true,
    },
    {
        href: '/admin/classes',
        label: 'All Classes',
        icon: <Building2 className="w-5 h-5" />,
    },
    {
        href: '/admin/platform',
        label: 'Platform Settings',
        icon: <Settings className="w-5 h-5" />,
    },
    {
        href: '/admin/audit-log',
        label: 'Audit Log',
        icon: <ScrollText className="w-5 h-5" />,
    },
]

export default function AdminLayout({ children, title = 'Admin Panel' }: AdminLayoutProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [user] = useAuthState(auth)
    const [userProfile, setUserProfile] = useState<any>(null)
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.uid) return
            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(user.uid)
            if (!profile || profile.role !== 'admin') {
                router.replace('/')
                return
            }
            setUserProfile(profile)
        }
        fetchProfile()
    }, [user, router])

    useEffect(() => {
        const fetchPending = async () => {
            const { getPendingTeachers } = await import('@/lib/adminService')
            const pending = await getPendingTeachers()
            setPendingCount(pending.length)
        }
        fetchPending()
    }, [])

    useEffect(() => { setMobileOpen(false) }, [pathname])

    const handleSignOut = async () => {
        const { signOut } = await import('@/lib/auth')
        await signOut()
        router.push('/')
    }

    const isActive = (href: string, exact = false) => {
        if (exact) return pathname === href
        return pathname.startsWith(href)
    }

    const initials = (userProfile?.displayName || userProfile?.name || 'A')
        .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

    return (
        <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileOpen(false)} />
            )}

            {/* ── Sidebar ── */}
            <aside
                className={`
                    fixed md:static inset-y-0 left-0 z-30 flex flex-col flex-shrink-0
                    transition-all duration-300 ease-in-out shadow-xl md:shadow-none
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${collapsed ? 'md:w-[72px]' : 'w-64'}
                `}
                style={{ backgroundColor: '#0f1923', borderRight: '1px solid rgba(255,255,255,0.07)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', minHeight: '64px' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden">
                            <div className="text-white font-bold text-sm leading-tight truncate">Peer Feedback</div>
                            <div className="text-xs font-medium" style={{ color: '#6b7280' }}>Admin Panel</div>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(c => !c)}
                        className="hidden md:flex ml-auto p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-white shrink-0"
                    >
                        {collapsed
                            ? <ChevronRight className="w-4 h-4" />
                            : <ChevronLeft className="w-4 h-4" />
                        }
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
                    <ul className="space-y-0.5 px-2">
                        {navItems.map(({ href, label, icon, exact, badge, indent }) => {
                            const active = isActive(href, exact)
                            const showBadge = badge === 'pending' && pendingCount > 0

                            return (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        title={collapsed ? label : undefined}
                                        className={`
                                            flex items-center gap-3 rounded-lg transition-all duration-150 group relative
                                            ${indent && !collapsed ? 'ml-3 pl-2 text-xs py-2' : 'py-2.5'}
                                            px-3
                                            ${active ? 'text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/8'}
                                        `}
                                        style={active ? {
                                            background: 'linear-gradient(90deg, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.10) 100%)',
                                            borderLeft: '3px solid #6366f1',
                                            paddingLeft: indent && !collapsed ? '5px' : '9px',
                                        } : { borderLeft: '3px solid transparent' }}
                                    >
                                        <span className={`shrink-0 ${active ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                            {icon}
                                        </span>
                                        {!collapsed && (
                                            <span className="flex-1 truncate">{label}</span>
                                        )}
                                        {!collapsed && showBadge && (
                                            <span className="ml-auto px-2 py-0.5 text-xs font-bold text-white rounded-full"
                                                style={{ backgroundColor: '#ef4444' }}>
                                                {pendingCount}
                                            </span>
                                        )}
                                        {collapsed && (
                                            <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                                                style={{ background: '#6366f1' }}>
                                                {label}
                                                {showBadge && ` (${pendingCount})`}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                {/* Sign out */}
                <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <button
                        onClick={handleSignOut}
                        title={collapsed ? 'Sign Out' : undefined}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 group"
                        style={{ borderLeft: '3px solid transparent' }}
                    >
                        <LogOut className="w-5 h-5 shrink-0" />
                        {!collapsed && <span className="text-sm">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* ── Main content ── */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between px-5 h-16 shrink-0 shadow-md z-10"
                    style={{ backgroundColor: '#6366f1', minHeight: '64px' }}>
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                            onClick={() => setMobileOpen(o => !o)}>
                            <Menu className="w-5 h-5" />
                        </button>
                        <nav className="flex items-center gap-1.5 text-sm">
                            <Link href="/admin" className="text-white/70 hover:text-white transition-colors font-medium">Admin</Link>
                            {title !== 'Admin Panel' && (
                                <>
                                    <span className="text-white/40">/</span>
                                    <span className="text-white font-semibold">{title}</span>
                                </>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        {userProfile && (
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-white text-sm font-semibold leading-tight">
                                    {userProfile.displayName || userProfile.name || 'Admin'}
                                </span>
                                <span className="text-white/60 text-xs">Administrator</span>
                            </div>
                        )}
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-md"
                            style={{ background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                            {initials}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#f0f2f5' }}>
                    {children}
                </main>
            </div>
        </div>
    )
}
