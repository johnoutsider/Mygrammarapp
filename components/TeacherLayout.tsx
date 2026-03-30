'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useEffect, useState } from 'react'
import { Gamepad2, BarChart2, BookOpen } from 'lucide-react'


interface TeacherLayoutProps {
    children: React.ReactNode
    title?: string
}

// ── Nav group definitions ───────────────────────────────────────────────────

const navGroups = [
    {
        key: 'writing',
        label: 'Writing',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17.586 3.586a2 2 0 112.828 2.828L12 15l-4 1 1-4 8.586-8.414z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        links: [
            {
                href: '/teacher/reviews', label: 'Reviews', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },
            {
                href: '/teacher/essay-approvals', label: 'Essay Approvals', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M9 12l2 2 4-4m-7 4h10a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },
            {
                href: '/teacher/topics', label: 'Essay Topics', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M7 7h10M7 12h10M7 17h6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },
            {
                href: '/teacher/scheduler', label: 'Scheduler', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },
             {
                href: '/teacher/eva-settings', label: 'EVA Settings', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M12 2a5 5 0 015 5v.5a5 5 0 01-10 0V7a5 5 0 015-5z" />
                        <path d="M2 20a10 10 0 0120 0" strokeLinecap="round" />
                    </svg>
                )
            },
            {
                href: '/teacher/logs', label: 'AI Logs', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                )
            },
        ]
    },
    {
        key: 'grammar',
        label: 'Grammar',
        icon: <Gamepad2 className="w-5 h-5" />,
        links: [
            {
                href: '/teacher/topics', label: 'Topics', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M7 7h10M7 12h10M7 17h6" strokeLinecap="round" />
                        <circle cx="19" cy="17" r="3" />
                    </svg>
                )
            },
            { href: '/teacher/my-quizzes', label: 'My Quizzes', icon: <BookOpen size={16} /> },
            {
                href: '/teacher/approvals', label: 'Question Approvals', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },

            {
                href: '/teacher/question-pool', label: 'Question Pool', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },
            { href: '/teacher/game', label: 'Live Game', icon: <Gamepad2 className="w-4 h-4" />, permKey: 'canHostGames' },
            { href: '/teacher/game/reports', label: 'Reports', icon: <BarChart2 className="w-4 h-4" /> },
        ]
    },
    {
        key: 'speaking',
        label: 'Speaking',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 11a7 7 0 01-14 0M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        links: [
            {
                href: '/teacher/speaking/topics', label: 'Topics', permKey: 'canManageSpeaking', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                        <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                        <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                    </svg>
                )
            },
            {
                href: '/teacher/speaking', label: 'Speaking Setup', permKey: 'canManageSpeaking', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 11a7 7 0 01-14 0M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },
            {
                href: '/teacher/speaking/logs', label: 'Student Logs', permKey: 'canManageSpeaking', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                        <path d="M9 12h6M9 16h4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            },
            
        ]
    },
    {
        key: 'tools',
        label: 'Tools',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        ),
        links: [
            {
                href: '/teacher/assistant', label: 'Teacher Assistant', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M9 9a3 3 0 116 0c0 2-3 3-3 3" strokeLinecap="round" />
                        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                    </svg>
                )
            },
           
            {
                href: '/teacher/scheduler', label: 'Task Scheduler', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                        <circle cx="12" cy="16" r="2" />
                        <path d="M12 14v-2" strokeLinecap="round" />
                    </svg>
                )
            },
        ]
    },
]

// Standalone links (not in a group)
const standaloneLinks = [
    {
        href: '/teacher',
        label: 'Dashboard',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
        )
    },
    {
        href: '/teacher/studentList',
        label: 'Students',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/teacher/messages',
        label: 'Messages',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
        )
    },
]

// Class Management section — standalone for now, expandable later
const classManagementLinks = [
        {
        href: '/teacher/class-management',
        label: 'Group Access',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
]

// ── Component ───────────────────────────────────────────────────────────────

export default function TeacherLayout({ children, title = 'Teacher Panel' }: TeacherLayoutProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [user] = useAuthState(auth)
    const [userProfile, setUserProfile] = useState<any>(null)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

    // Track which groups are open — all collapsed by default, active group auto-expands
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        writing: true,
        grammar: false,
        speaking: false,
        tools: false,
    })

    const isActive = (href: string) => {
        if (href === '/teacher') return pathname === '/teacher'
        return pathname.startsWith(href)
    }

    // Auto-expand the group that contains the active page
    useEffect(() => {
        navGroups.forEach(group => {
            const hasActive = group.links.some(l => pathname.startsWith(l.href))
            if (hasActive) {
                setOpenGroups(prev => ({ ...prev, [group.key]: true }))
            }
        })
    }, [pathname])

    const toggleGroup = (key: string) => {
        if (sidebarCollapsed) return // no toggling when collapsed
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
    }

    useEffect(() => {
        const fetchProfile = async () => {
            if (user?.uid) {
                const { getUserProfile } = await import('@/lib/auth')
                const profile = await getUserProfile(user.uid)
                if (!profile) return

                // Redirect if account status is not approved
                if (profile.role === 'teacher') {
                    if (profile.status === 'pending') {
                        router.replace('/pending-approval')
                        return
                    }
                    if (profile.status === 'suspended') {
                        router.replace('/suspended')
                        return
                    }
                }
                // Redirect admin to admin panel
                if (profile.role === 'admin') {
                    router.replace('/admin')
                    return
                }

                setUserProfile(profile)
            }
        }
        fetchProfile()
    }, [user, router])

    useEffect(() => { setMobileSidebarOpen(false) }, [pathname])

    const handleSignOut = async () => {
        const { signOut } = await import('@/lib/auth')
        await signOut()
        router.push('/')
    }

    const initials = (userProfile?.displayName || userProfile?.name || 'T')
        .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

    return (
        <div className="teacher-layout flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* Mobile overlay */}
            {mobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
            )}

            {/* ── Sidebar ── */}
            <aside
                className={`
                    fixed md:static inset-y-0 left-0 z-30 flex flex-col
                    transition-all duration-300 ease-in-out shadow-xl md:shadow-none flex-shrink-0
                    ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${sidebarCollapsed ? 'md:w-[72px]' : 'w-64'}
                `}
                style={{ backgroundColor: '#1a2535', borderRight: '1px solid rgba(255,255,255,0.07)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', minHeight: '64px' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1a9aaa 0%, #127080 100%)' }}>
                        📊
                    </div>
                    {!sidebarCollapsed && (
                        <div className="overflow-hidden">
                            <div className="text-white font-bold text-sm leading-tight truncate">Peer Feedback</div>
                            <div className="text-xs font-medium" style={{ color: '#6b8ca8' }}>Teacher Panel</div>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(c => !c)}
                        className="hidden md:flex ml-auto p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-white shrink-0"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                            {sidebarCollapsed
                                ? <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                                : <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                            }
                        </svg>
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
                    <ul className="space-y-0.5 px-2">

                        {/* Standalone links (Dashboard, Messages) */}
                        {standaloneLinks.map(({ href, label, icon }) => {
                            const active = isActive(href)
                            return (
                                <li key={href}>
                                    <NavLink href={href} label={label} icon={icon} active={active} collapsed={sidebarCollapsed} />
                                </li>
                            )
                        })}

                        {/* Collapsible groups */}
                        {navGroups.map(group => {
                            const groupActive = group.links.some(l => isActive(l.href))
                            const isOpen = openGroups[group.key]

                            return (
                                <li key={group.key} className="mt-1">
                                    {/* Group header button */}
                                    <button
                                        onClick={() => toggleGroup(group.key)}
                                        title={sidebarCollapsed ? group.label : undefined}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                            transition-all duration-150 group relative
                                            ${groupActive ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/8'}
                                        `}
                                        style={groupActive ? {
                                            background: 'rgba(26,154,170,0.12)',
                                            borderLeft: '3px solid #1a9aaa',
                                            paddingLeft: '9px'
                                        } : { borderLeft: '3px solid transparent' }}
                                    >
                                        <span className={`shrink-0 ${groupActive ? 'text-[#1a9aaa]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                            {group.icon}
                                        </span>
                                        {!sidebarCollapsed && (
                                            <>
                                                <span className="text-sm font-semibold flex-1 text-left truncate">{group.label}</span>
                                                <svg
                                                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                                                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                                >
                                                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </>
                                        )}
                                        {/* Tooltip when collapsed */}
                                        {sidebarCollapsed && (
                                            <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                                                style={{ background: '#1a9aaa' }}>
                                                {group.label}
                                            </span>
                                        )}
                                    </button>

                                    {/* Child links */}
                                    {!sidebarCollapsed && isOpen && (
                                        <ul className="mt-0.5 ml-3 pl-3 space-y-0.5 border-l border-white/10">
                                            {group.links
                                                .filter(({ permKey }: any) => {
                                                    if (!permKey) return true
                                                    if (!userProfile?.permissions) return true
                                                    return userProfile.permissions[permKey as keyof typeof userProfile.permissions] !== false
                                                })
                                                .map(({ href, label, icon }: any) => {
                                                    const active = isActive(href)
                                                    return (
                                                        <li key={href}>
                                                            <NavLink href={href} label={label} icon={icon} active={active} collapsed={false} small />
                                                        </li>
                                                    )
                                                })}
                                        </ul>
                                    )}
                                </li>
                            )
                        })}

                        {/* ── Class Management section ── */}
                        <li className="mt-4">
                            {!sidebarCollapsed && (
                                <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-widest"
                                    style={{ color: 'rgba(255,255,255,0.25)' }}>
                                    Class Management
                                </div>
                            )}
                            {sidebarCollapsed && <div className="border-t border-white/10 my-2 mx-1" />}
                            {classManagementLinks.map(({ href, label, icon }) => {
                                const active = isActive(href)
                                return (
                                    <NavLink key={href} href={href} label={label} icon={icon} active={active} collapsed={sidebarCollapsed} small />
                                )
                            })}
                        </li>

                    </ul>
                </nav>

                {/* Sign out */}
                <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <button
                        onClick={handleSignOut}
                        title={sidebarCollapsed ? 'Sign Out' : undefined}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 group"
                        style={{ borderLeft: '3px solid transparent' }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 shrink-0">
                            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {!sidebarCollapsed && <span className="text-sm">Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* ── Right side ── */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between px-5 h-16 shrink-0 shadow-md z-10"
                    style={{ backgroundColor: '#1a9aaa', minHeight: '64px' }}>
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                            onClick={() => setMobileSidebarOpen(o => !o)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                            </svg>
                        </button>
                        <nav className="flex items-center gap-1.5 text-sm">
                            <Link href="/teacher" className="text-white/70 hover:text-white transition-colors font-medium">Home</Link>
                            {title !== 'Dashboard' && (
                                <>
                                    <span className="text-white/40">/</span>
                                    <span className="text-white font-semibold">{title}</span>
                                </>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        {userProfile && (
                            <Link href="/profile" className="hidden sm:flex flex-col items-end hover:opacity-80 transition-opacity">
                                <span className="text-white text-sm font-semibold leading-tight">
                                    {userProfile.displayName || userProfile.name || 'Teacher'}
                                </span>
                                <span className="text-white/60 text-xs">O'qituvchi</span>
                            </Link>
                        )}
                        <Link href="/profile"
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-md hover:scale-105 transition-transform"
                            style={{ background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                            {initials}
                        </Link>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#f0f2f5' }}>
                    {children}
                </main>
            </div>
        </div>
    )
}

// ── Reusable NavLink ─────────────────────────────────────────────────────────

function NavLink({ href, label, icon, active, collapsed, small = false }: {
    href: string
    label: string
    icon: React.ReactNode
    active: boolean
    collapsed: boolean
    small?: boolean
}) {
    return (
        <Link
            href={href}
            title={collapsed ? label : undefined}
            className={`
                flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative
                ${small ? 'py-2' : 'py-2.5'}
                ${active ? 'text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/8'}
            `}
            style={active ? {
                background: 'linear-gradient(90deg, rgba(26,154,170,0.25) 0%, rgba(26,154,170,0.10) 100%)',
                borderLeft: '3px solid #1a9aaa',
                paddingLeft: '9px'
            } : { borderLeft: '3px solid transparent' }}
        >
            <span className={`shrink-0 ${active ? 'text-[#1a9aaa]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                {icon}
            </span>
            {!collapsed && (
                <span className={`truncate ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
            )}
            {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                    style={{ background: '#1a9aaa' }}>
                    {label}
                </span>
            )}
        </Link>
    )
}
