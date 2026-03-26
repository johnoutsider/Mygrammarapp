'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { signOut } from '@/lib/auth'
import { Clock } from 'lucide-react'

export default function PendingApprovalPage() {
    const router = useRouter()
    const [user, loading] = useAuthState(auth)

    useEffect(() => {
        if (!loading && !user) router.replace('/auth/signin')
    }, [user, loading, router])

    const handleSignOut = async () => {
        await signOut()
        router.replace('/')
    }

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f2f5' }}>
            <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ backgroundColor: '#fff8e1' }}>
                    <Clock className="w-8 h-8" style={{ color: '#f59e0b' }} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Waiting for Approval</h1>
                <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    Your teacher account request has been submitted. An administrator will review
                    your request and approve your access shortly.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm text-amber-800 font-medium mb-1">What happens next?</p>
                    <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                        <li>Admin reviews your account</li>
                        <li>You&apos;ll be approved or contacted</li>
                        <li>Sign in again after approval to access the Teacher Panel</li>
                    </ul>
                </div>
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
