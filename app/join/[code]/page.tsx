'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { getClassByInviteCode, joinClassByInvite, type Class } from '@/lib/classService'
import { getUserProfile, signInWithGoogle } from '@/lib/auth'
import { CheckCircle, XCircle, Lock, Users, ArrowRight, GraduationCap } from 'lucide-react'

type PageState =
    | 'loading'
    | 'invalid'
    | 'disabled'
    | 'sign-in'
    | 'already-joined'
    | 'confirm-switch'
    | 'joining'
    | 'done'
    | 'error'

export default function JoinPage() {
    const params = useParams()
    const router = useRouter()
    const code = (params.code as string || '').toUpperCase()

    const [user, authLoading] = useAuthState(auth)
    const [pageState, setPageState] = useState<PageState>('loading')
    const [classInfo, setClassInfo] = useState<Class | null>(null)
    const [currentClassName, setCurrentClassName] = useState<string | null>(null)
    const [signingIn, setSigningIn] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Step 1: validate the code
    useEffect(() => {
        if (!code) { setPageState('invalid'); return }
        getClassByInviteCode(code).then(cls => {
            if (!cls) { setPageState('invalid'); return }
            if (!cls.inviteEnabled) { setPageState('disabled'); return }
            setClassInfo(cls)
            // Don't resolve auth state yet — wait for authLoading
        })
    }, [code])

    // Step 2: once auth state is known and class is loaded, decide what to show
    useEffect(() => {
        if (!classInfo) return
        if (authLoading) return

        if (!user) {
            setPageState('sign-in')
            return
        }

        // User is signed in — check their current class
        getUserProfile(user.uid).then(profile => {
            if (!profile) { setPageState('sign-in'); return }

            // Teacher/admin should not be joining classes
            if (profile.role !== 'student') {
                setPageState('error')
                setErrorMsg('Only students can join classes via invite link.')
                return
            }

            const currentClassId = profile.classId || 'default-class'

            if (currentClassId === classInfo!.id) {
                setPageState('already-joined')
                return
            }

            if (currentClassId === 'default-class') {
                // Auto-join — no confirmation needed
                handleJoin()
                return
            }

            // In a different real class — need confirmation
            import('@/lib/classService').then(({ getClass }) => {
                getClass(currentClassId).then(currentClass => {
                    setCurrentClassName(currentClass?.name || 'your current class')
                    setPageState('confirm-switch')
                })
            })
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classInfo, user, authLoading])

    const handleSignIn = async () => {
        setSigningIn(true)
        const profile = await signInWithGoogle()
        if (!profile) {
            setSigningIn(false)
            return
        }
        // Auth state change will trigger the useEffect above
    }

    const handleJoin = async () => {
        if (!user || !classInfo) return
        setPageState('joining')
        try {
            await joinClassByInvite(user.uid, classInfo.id)
            setPageState('done')
            setTimeout(() => router.replace('/dashboard'), 1800)
        } catch (e) {
            setPageState('error')
            setErrorMsg('Failed to join the class. Please try again.')
        }
    }

    // ── Shared card wrapper ──────────────────────────────────────────────────

    const Card = ({ children }: { children: React.ReactNode }) => (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f0f2f5' }}>
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
                {children}
            </div>
        </div>
    )

    // ── States ───────────────────────────────────────────────────────────────

    if (pageState === 'loading') {
        return (
            <Card>
                <div className="w-10 h-10 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-4">Checking invite code...</p>
            </Card>
        )
    }

    if (pageState === 'invalid') {
        return (
            <Card>
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite Code</h1>
                <p className="text-sm text-gray-500 mb-6">
                    The code <span className="font-mono font-bold text-gray-700">{code}</span> doesn&apos;t match any class.
                    Check the link and try again.
                </p>
                <a href="/auth/signin" className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Go to Sign In
                </a>
            </Card>
        )
    }

    if (pageState === 'disabled') {
        return (
            <Card>
                <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-7 h-7 text-orange-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Invites Paused</h1>
                <p className="text-sm text-gray-500 mb-6">
                    This class is not currently accepting new students. Contact your teacher for access.
                </p>
                <a href="/auth/signin" className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Go to Sign In
                </a>
            </Card>
        )
    }

    if (pageState === 'sign-in') {
        return (
            <Card>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'linear-gradient(135deg, #1a9aaa 0%, #127080 100%)' }}>
                    <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Join Class</h1>
                {classInfo && (
                    <p className="text-sm text-gray-500 mb-1">
                        You&apos;ve been invited to join
                    </p>
                )}
                {classInfo && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6">
                        <p className="font-bold text-gray-900">{classInfo.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">{classInfo.subject} access</p>
                    </div>
                )}
                <button
                    onClick={handleSignIn}
                    disabled={signingIn}
                    className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                    style={{ backgroundColor: '#1a9aaa' }}
                >
                    {signingIn ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    )}
                    Sign in with Google to Join
                </button>
                <p className="text-xs text-gray-400 mt-4">
                    New students will have their account created automatically.
                </p>
            </Card>
        )
    }

    if (pageState === 'already-joined') {
        return (
            <Card>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Already Joined!</h1>
                <p className="text-sm text-gray-500 mb-6">
                    You&apos;re already a member of <strong>{classInfo?.name}</strong>.
                </p>
                <button onClick={() => router.replace('/dashboard')}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: '#1a9aaa' }}>
                    Go to Dashboard
                </button>
            </Card>
        )
    }

    if (pageState === 'confirm-switch') {
        return (
            <Card>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                    <Users className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Switch Class?</h1>
                <p className="text-sm text-gray-500 mb-4">
                    You&apos;re currently in <strong>{currentClassName}</strong>.
                    Joining <strong>{classInfo?.name}</strong> will move you out of your current class.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-left text-xs text-amber-800">
                    Your essays, reviews, and game history will not be deleted.
                </div>
                <div className="flex gap-3">
                    <button onClick={() => router.replace('/dashboard')}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                        Stay
                    </button>
                    <button onClick={handleJoin}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                        style={{ backgroundColor: '#1a9aaa' }}>
                        Switch <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </Card>
        )
    }

    if (pageState === 'joining') {
        return (
            <Card>
                <div className="w-10 h-10 border-2 border-gray-200 border-t-teal-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-4">Joining {classInfo?.name}...</p>
            </Card>
        )
    }

    if (pageState === 'done') {
        return (
            <Card>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Welcome!</h1>
                <p className="text-sm text-gray-500">
                    You&apos;ve joined <strong>{classInfo?.name}</strong>. Redirecting to your dashboard...
                </p>
            </Card>
        )
    }

    // error state
    return (
        <Card>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">{errorMsg || 'An unexpected error occurred.'}</p>
            <a href="/dashboard" className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Go to Dashboard
            </a>
        </Card>
    )
}
