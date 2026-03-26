'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { signOut, getUserProfile } from '@/lib/auth'
import { ShieldOff } from 'lucide-react'

export default function SuspendedPage() {
    const router = useRouter()
    const [user, loading] = useAuthState(auth)
    const [reason, setReason] = useState<string | null>(null)

    useEffect(() => {
        if (!loading && !user) router.replace('/auth/signin')
        if (user) {
            getUserProfile(user.uid).then(p => {
                setReason(p?.suspendedReason || null)
            })
        }
    }, [user, loading, router])

    const handleSignOut = async () => {
        await signOut()
        router.replace('/')
    }

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f2f5' }}>
            <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ backgroundColor: '#fee2e2' }}>
                    <ShieldOff className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h1>
                <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    Your teacher account has been suspended. Please contact the platform
                    administrator to resolve this issue.
                </p>
                {reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                        <p className="text-sm text-red-800 font-medium mb-1">Reason</p>
                        <p className="text-xs text-red-700">{reason}</p>
                    </div>
                )}
                <button
                    onClick={handleSignOut}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    Sign Out
                </button>
            </div>
        </div>
    )
}
