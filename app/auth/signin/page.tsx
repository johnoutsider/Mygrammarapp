'use client'

import { signInWithGoogle, signInWithGoogleAsTeacher } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function GoogleIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    )
}

function routeAfterSignIn(role: string, status?: string, router: ReturnType<typeof useRouter> = undefined as any) {
    if (role === 'admin') return router.push('/admin')
    if (role === 'teacher') {
        if (status === 'pending') return router.push('/pending-approval')
        if (status === 'suspended') return router.push('/suspended')
        return router.push('/teacher')
    }
    router.push('/dashboard')
}

export default function SignIn() {
    const router = useRouter()
    const [loadingStudent, setLoadingStudent] = useState(false)
    const [loadingTeacher, setLoadingTeacher] = useState(false)

    const handleStudentSignIn = async () => {
        setLoadingStudent(true)
        const user = await signInWithGoogle()
        if (user) {
            routeAfterSignIn(user.role, user.status, router)
        } else {
            alert('Sign in failed. Please try again.')
            setLoadingStudent(false)
        }
    }

    const handleTeacherSignIn = async () => {
        setLoadingTeacher(true)
        const user = await signInWithGoogleAsTeacher()
        if (user) {
            routeAfterSignIn(user.role, user.status, router)
        } else {
            alert('Sign in failed. Please try again.')
            setLoadingTeacher(false)
        }
    }

    const isLoading = loadingStudent || loadingTeacher

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f0f2f5' }}>
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #1a9aaa 0%, #127080 100%)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-7 h-7">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Peer Feedback App</h1>
                    <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
                </div>

                {/* Cards */}
                <div className="space-y-3">

                    {/* Student sign-in */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: '#ecfdf5' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={1.8} className="w-5 h-5">
                                    <path d="M12 14a4 4 0 100-8 4 4 0 000 8z" />
                                    <path d="M3 20a9 9 0 0118 0" strokeLinecap="round" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 text-sm">I&apos;m a Student</p>
                                <p className="text-xs text-gray-500 mt-0.5">Submit essays, practice speaking, play grammar games</p>
                            </div>
                        </div>
                        <button
                            onClick={handleStudentSignIn}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            {loadingStudent ? (
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                            ) : (
                                <GoogleIcon />
                            )}
                            Continue with Google
                        </button>
                    </div>

                    {/* Teacher sign-in */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: '#eef2ff' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.8} className="w-5 h-5">
                                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 text-sm">I&apos;m a Teacher</p>
                                <p className="text-xs text-gray-500 mt-0.5">Manage classes, review essays, host games. Requires admin approval.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleTeacherSignIn}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                            style={{ backgroundColor: loadingTeacher ? '#a5b4fc' : '#6366f1' }}
                        >
                            {loadingTeacher ? (
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <GoogleIcon />
                            )}
                            Apply as Teacher
                        </button>
                    </div>

                </div>

                {/* Admin setup link */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    Setting up the platform?{' '}
                    <a href="/admin/setup" className="text-indigo-500 hover:text-indigo-700 font-medium">
                        Admin Setup
                    </a>
                </p>

            </div>
        </div>
    )
}
