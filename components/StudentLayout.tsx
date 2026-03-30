'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useEffect, useState } from 'react'
import { useAccessMode } from '@/hooks/useAccessMode'
import { getVisibleGroups } from '@/lib/accessControl'

interface StudentLayoutProps {
    children: React.ReactNode
    title?: string
}

// ── Nav group definitions ────────────────────────────────────────────────────

const writingLinks = [
    {
        href: '/submit-essay', label: 'Submit Essay', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/my-essays', label: 'My Essays', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/review-peers', label: 'Review Peers', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/my-reviews', label: 'My Reviews', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M7 8h10M7 12h6m-6 4h10M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/discussions', label: 'Discussions', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/rubric', label: 'Rubric', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/progress/writing', label: 'Writing Progress', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
]

const grammarLinks = [
    {
        href: '/quiz-create', label: 'Create Quiz', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/question-pool', label: 'Question Pool', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/review-peers', label: 'Peer Review', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/my-questions', label: 'My Questions', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    // BEFORE


    // AFTER
    {
        href: '/reports',
        label: 'My Reports',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 17v-2m3 2v-4m3 4v-6M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
        )
    },

    {
        href: '/progress/grammar', label: 'Grammar Progress', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
]

const speakingLinks = [
    {
        href: '/student/speaking', label: 'Guided Speaking', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8.5 11.5l2.25 2.25 4.75-4.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/student/speaking/results', label: 'My Results', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M5 19V9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 19V5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 19v-7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/speaking-practice', label: 'Speaking Practice', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 11a7 7 0 01-14 0M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    {
        href: '/speaking-log', label: 'Speaking Log', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M8 7h8M8 12h8M8 17h5" strokeLinecap="round" />
                <path d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
]

// Always-visible standalone links
const standaloneLinks = [
    {
        href: '/dashboard', label: 'Dashboard', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
        )
    },
    {
        href: '/messages', label: 'Messages', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function StudentLayout({ children, title = 'Dashboard' }: StudentLayoutProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [user] = useAuthState(auth)
    const [userProfile, setUserProfile] = useState<any>(null)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

    // Access mode from Firestore (real-time)
    const { accessMode, loading: accessLoading } = useAccessMode()
    const { showWriting, showGrammar, showSpeaking } = getVisibleGroups(accessMode)

    // Track which groups are open
    const [openGroups, setOpenGroups] = useState({ writing: true, grammar: true, speaking: true })

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard'
        if (href === '/student/speaking') {
            return pathname === href || /^\/student\/speaking\/[^/]+$/.test(pathname)
        }
        return pathname === href || pathname.startsWith(`${href}/`)
    }

    // Auto-expand the group containing the active page
    useEffect(() => {
        const writingActive = writingLinks.some(l => isActive(l.href))
        const grammarActive = grammarLinks.some(l => isActive(l.href))
        const speakingActive = speakingLinks.some(l => isActive(l.href))
        if (writingActive) setOpenGroups(prev => ({ ...prev, writing: true }))
        if (grammarActive) setOpenGroups(prev => ({ ...prev, grammar: true }))
        if (speakingActive) setOpenGroups(prev => ({ ...prev, speaking: true }))
    }, [pathname])

    const toggleGroup = (key: 'writing' | 'grammar' | 'speaking') => {
        if (sidebarCollapsed) return
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
    }

    useEffect(() => {
        const fetchProfile = async () => {
            if (user?.uid) {
                const { getUserProfile } = await import('@/lib/auth')
                const profile = await getUserProfile(user.uid)
                setUserProfile(profile)
            }
        }
        fetchProfile()
    }, [user])

    useEffect(() => { setMobileSidebarOpen(false) }, [pathname])

    const handleSignOut = async () => {
        const { signOut } = await import('@/lib/auth')
        await signOut()
        router.push('/')
    }

    const initials = (userProfile?.displayName || userProfile?.name || 'S')
        .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

    return (
        <div className="flex h-screen overflow-hidden text-slate-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

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
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1a9aaa 0%, #127080 100%)' }}>
                        🎓
                    </div>
                    {!sidebarCollapsed && (
                        <div className="overflow-hidden">
                            <div className="text-white font-bold text-sm leading-tight truncate">Peer Feedback</div>
                            <div className="text-xs font-medium" style={{ color: '#6b8ca8' }}>Student Portal</div>
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
                    <button className="md:hidden ml-auto text-gray-400 hover:text-white p-1" onClick={() => setMobileSidebarOpen(false)}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
                    <ul className="space-y-0.5 px-2">

                        {/* Dashboard + Messages — always visible */}
                        {standaloneLinks.map(({ href, label, icon }) => (
                            <li key={href}>
                                <NavLink href={href} label={label} icon={icon} active={isActive(href)} collapsed={sidebarCollapsed} />
                            </li>
                        ))}

                        {/* ── Writing Group ── */}
                        {showWriting && !accessLoading && (
                            <li className="mt-1">
                                <button
                                    onClick={() => toggleGroup('writing')}
                                    title={sidebarCollapsed ? 'Writing' : undefined}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                        transition-all duration-150 group relative
                                        ${writingLinks.some(l => isActive(l.href))
                                            ? 'text-white'
                                            : 'text-gray-400 hover:text-white hover:bg-white/8'}
                                    `}
                                    style={writingLinks.some(l => isActive(l.href)) ? {
                                        background: 'rgba(26,154,170,0.12)',
                                        borderLeft: '3px solid #1a9aaa',
                                        paddingLeft: '9px'
                                    } : { borderLeft: '3px solid transparent' }}
                                >
                                    <span className={`shrink-0 ${writingLinks.some(l => isActive(l.href)) ? 'text-[#1a9aaa]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                                            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M17.586 3.586a2 2 0 112.828 2.828L12 15l-4 1 1-4 8.586-8.414z" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="text-sm font-semibold flex-1 text-left">Writing</span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                                                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${openGroups.writing ? 'rotate-180' : ''}`}>
                                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </>
                                    )}
                                    {sidebarCollapsed && (
                                        <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                                            style={{ background: '#1a9aaa' }}>Writing</span>
                                    )}
                                </button>
                                {!sidebarCollapsed && openGroups.writing && (
                                    <ul className="mt-0.5 ml-3 pl-3 space-y-0.5 border-l border-white/10">
                                        {writingLinks.map(({ href, label, icon }) => (
                                            <li key={href}>
                                                <NavLink href={href} label={label} icon={icon} active={isActive(href)} collapsed={false} small />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        )}

                        {/* ── Grammar Group ── */}
                        {showGrammar && !accessLoading && (
                            <li className="mt-1">
                                <button
                                    onClick={() => toggleGroup('grammar')}
                                    title={sidebarCollapsed ? 'Grammar' : undefined}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                        transition-all duration-150 group relative
                                        ${grammarLinks.some(l => isActive(l.href))
                                            ? 'text-white'
                                            : 'text-gray-400 hover:text-white hover:bg-white/8'}
                                    `}
                                    style={grammarLinks.some(l => isActive(l.href)) ? {
                                        background: 'rgba(26,154,170,0.12)',
                                        borderLeft: '3px solid #1a9aaa',
                                        paddingLeft: '9px'
                                    } : { borderLeft: '3px solid transparent' }}
                                >
                                    <span className={`shrink-0 ${grammarLinks.some(l => isActive(l.href)) ? 'text-[#1a9aaa]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                                            <path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="text-sm font-semibold flex-1 text-left">Grammar</span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                                                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${openGroups.grammar ? 'rotate-180' : ''}`}>
                                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </>
                                    )}
                                    {sidebarCollapsed && (
                                        <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                                            style={{ background: '#1a9aaa' }}>Grammar</span>
                                    )}
                                </button>
                                {!sidebarCollapsed && openGroups.grammar && (
                                    <ul className="mt-0.5 ml-3 pl-3 space-y-0.5 border-l border-white/10">
                                        {grammarLinks.map(({ href, label, icon }) => (
                                            <li key={href}>
                                                <NavLink href={href} label={label} icon={icon} active={isActive(href)} collapsed={false} small />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        )}

                        {/* Speaking Group */}
                        {showSpeaking && !accessLoading && (
                            <li className="mt-1">
                                <button
                                    onClick={() => toggleGroup('speaking')}
                                    title={sidebarCollapsed ? 'Speaking' : undefined}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                        transition-all duration-150 group relative
                                        ${speakingLinks.some(l => isActive(l.href))
                                            ? 'text-white'
                                            : 'text-gray-400 hover:text-white hover:bg-white/8'}
                                    `}
                                    style={speakingLinks.some(l => isActive(l.href)) ? {
                                        background: 'rgba(26,154,170,0.12)',
                                        borderLeft: '3px solid #1a9aaa',
                                        paddingLeft: '9px'
                                    } : { borderLeft: '3px solid transparent' }}
                                >
                                    <span className={`shrink-0 ${speakingLinks.some(l => isActive(l.href)) ? 'text-[#1a9aaa]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                                            <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M19 11a7 7 0 01-14 0M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="text-sm font-semibold flex-1 text-left">Speaking</span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                                                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${openGroups.speaking ? 'rotate-180' : ''}`}>
                                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </>
                                    )}
                                    {sidebarCollapsed && (
                                        <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                                            style={{ background: '#1a9aaa' }}>Speaking</span>
                                    )}
                                </button>
                                {!sidebarCollapsed && openGroups.speaking && (
                                    <ul className="mt-0.5 ml-3 pl-3 space-y-0.5 border-l border-white/10">
                                        {speakingLinks.map(({ href, label, icon }) => (
                                            <li key={href}>
                                                <NavLink href={href} label={label} icon={icon} active={isActive(href)} collapsed={false} small />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        )}

                        {/* Loading shimmer while accessMode is being fetched */}
                        {accessLoading && !sidebarCollapsed && (
                            <li className="mt-1 px-3 space-y-2">
                                <div className="h-9 bg-white/5 rounded-lg animate-pulse" />
                                <div className="h-9 bg-white/5 rounded-lg animate-pulse" />
                            </li>
                        )}

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
                            <Link href="/dashboard" className="text-white/70 hover:text-white transition-colors font-medium">Home</Link>
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
                                    {userProfile.displayName || userProfile.name || 'Student'}
                                </span>
                                <span className="text-white/60 text-xs">Student</span>
                            </Link>
                        )}
                        <Link href="/profile"
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-md hover:scale-105 transition-transform"
                            style={{ background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                            {initials}
                        </Link>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto relative" style={{ backgroundColor: '#f0f2f5' }}>
                    <div className="absolute inset-0 max-w-7xl mx-auto w-full">
                        {children}
                    </div>
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
                flex items-center gap-3 px-3 rounded-lg transition-all duration-150 group relative
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
