'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { getUserProfile, updateUserRole } from '@/lib/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { ShieldCheck, AlertTriangle, LogIn } from 'lucide-react'
import Link from 'next/link'

type PageState = 'loading' | 'no-auth' | 'already-admin' | 'admin-exists' | 'ready' | 'done'

export default function AdminSetupPage() {
    const router = useRouter()
    const [user, authLoading] = useAuthState(auth)
    const [state, setState] = useState<PageState>('loading')
    const [profile, setProfile] = useState<any>(null)
    const [claiming, setClaiming] = useState(false)

    useEffect(() => {
        const check = async () => {
            if (authLoading) return

            if (!user) {
                setState('no-auth')
                return
            }

            // Check if the current user is already admin
            const p = await getUserProfile(user.uid)
            setProfile(p)

            if (p?.role === 'admin') {
                setState('already-admin')
                return
            }

            // Check if any admin exists in the system
            const adminsSnap = await getDocs(
                query(collection(db, 'users'), where('role', '==', 'admin'))
            )

            if (!adminsSnap.empty) {
                setState('admin-exists')
                return
            }

            setState('ready')
        }
        check()
    }, [user, authLoading])

    const handleClaimAdmin = async () => {
        if (!user) return
        setClaiming(true)
        await updateUserRole(user.uid, 'admin')
        setState('done')
        setClaiming(false)
        setTimeout(() => router.replace('/admin'), 1500)
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f0f2f5' }}>
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">

                {state === 'loading' && (
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                )}

                {state === 'no-auth' && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <LogIn className="w-7 h-7 text-gray-500" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Sign In Required</h1>
                        <p className="text-sm text-gray-500 mb-6">
                            You need to be signed in to claim admin access.
                        </p>
                        <Link href="/auth/signin"
                            className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                            Sign In
                        </Link>
                    </>
                )}

                {state === 'admin-exists' && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-7 h-7 text-orange-500" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Admin Already Exists</h1>
                        <p className="text-sm text-gray-500 mb-6">
                            This platform already has an administrator. The setup page is disabled.
                            Contact the admin to get access.
                        </p>
                        <Link href="/auth/signin"
                            className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                            Go to Sign In
                        </Link>
                    </>
                )}

                {state === 'already-admin' && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck className="w-7 h-7 text-indigo-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re Already an Admin</h1>
                        <p className="text-sm text-gray-500 mb-6">
                            Your account already has admin access.
                        </p>
                        <Link href="/admin"
                            className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                            Go to Admin Panel
                        </Link>
                    </>
                )}

                {state === 'ready' && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck className="w-7 h-7 text-indigo-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Admin Setup</h1>
                        <p className="text-sm text-gray-500 mb-2">
                            No administrator exists yet. Claim admin access for your account:
                        </p>
                        <div className="bg-gray-50 rounded-xl p-3 mb-6 text-left">
                            <p className="text-sm font-medium text-gray-800">{profile?.displayName || profile?.name || user?.displayName}</p>
                            <p className="text-xs text-gray-500">{user?.email}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
                            <p className="text-xs text-amber-800">
                                <strong>This page is only available once.</strong> After you claim admin,
                                this setup page will be locked for everyone else.
                            </p>
                        </div>
                        <button
                            onClick={handleClaimAdmin}
                            disabled={claiming}
                            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {claiming ? (
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ShieldCheck className="w-4 h-4" />
                            )}
                            Claim Admin Access
                        </button>
                    </>
                )}

                {state === 'done' && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck className="w-7 h-7 text-green-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Admin Access Granted!</h1>
                        <p className="text-sm text-gray-500">Redirecting to admin panel...</p>
                    </>
                )}

            </div>
        </div>
    )
}
