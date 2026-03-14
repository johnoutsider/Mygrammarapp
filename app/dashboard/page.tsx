'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import IELTSRubric from '@/components/IELTSRubric'
import { onActiveGame, joinGame } from '@/lib/gameService'
import type { ActiveGame } from '@/lib/gameService'

export default function Dashboard() {
    const router = useRouter()
    const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [pastReports, setPastReports] = useState<any[]>([])
    const [stats, setStats] = useState({
        submittedEssays: 0,
        reviewsCompleted: 0,
        reviewsPending: 0,
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/')
                return
            }

            try {
                const { getUserProfile } = await import('@/lib/auth')
                const profile = await getUserProfile(user.uid)
                if (profile?.role === 'teacher') {
                    router.replace('/teacher')
                    return
                }

                const essaysQuery = query(
                    collection(db, 'essays'),
                    where('studentId', '==', user.uid)
                )
                const essaysSnapshot = await getDocs(essaysQuery)

                const reviewsQuery = query(
                    collection(db, 'reviews'),
                    where('reviewerId', '==', user.uid)
                )
                const reviewsSnapshot = await getDocs(reviewsQuery)

                const assignedQuery = query(
                    collection(db, 'essays'),
                    where('peerReviewIds', 'array-contains', user.uid)
                )
                const assignedSnapshot = await getDocs(assignedQuery)

                setStats({
                    submittedEssays: essaysSnapshot.size,
                    reviewsCompleted: reviewsSnapshot.size,
                    reviewsPending: assignedSnapshot.size - reviewsSnapshot.size,
                })

                // Fetch past game reports
                const reportsSnap = await getDocs(
                    query(collection(db, 'gameReports'), orderBy('playedAt', 'desc'))
                )
                const myReports = reportsSnap.docs
                    .filter(d => d.data().players?.[user.uid])
                    .slice(0, 5)
                    .map(d => ({ id: d.id, ...d.data() }))
                setPastReports(myReports)

            } catch (error) {
                console.error('Error fetching stats:', error)
            }

            setLoading(false)
            setCurrentUser(user)
        })

        return () => unsubscribe()
    }, [router])

    useEffect(() => {
        const unsub = onActiveGame(setActiveGame)
        return unsub
    }, [])

    const handleJoin = async () => {
        if (!activeGame || !currentUser) return
        const profile = await import('@/lib/auth').then(m => m.getUserProfile(currentUser.uid))
        await joinGame(currentUser.uid, profile?.name || currentUser.displayName || 'Student')
        router.push('/play')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    return (
        <StudentLayout title="Dashboard">
            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">Welcome Back!</h1>
                    <p className="text-slate-500">Here&apos;s your writing progress</p>
                </div>

                {/* Game banner */}
                {activeGame && activeGame.status === 'lobby' && (
                    <div className="mb-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-lg flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium opacity-80">🎮 Game is Live!</p>
                            <p className="text-xl font-bold">{activeGame.quizTitle}</p>
                            <p className="text-sm opacity-70 mt-0.5">
                                {Object.keys(activeGame.players || {}).length} players in lobby
                            </p>
                        </div>
                        <button
                            onClick={handleJoin}
                            className="bg-white text-violet-700 font-bold px-6 py-3 rounded-xl shadow hover:scale-105 transition-transform"
                        >
                            Join Game →
                        </button>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="text-5xl mb-3">📝</div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{stats.submittedEssays}</div>
                        <div className="text-slate-700 font-medium">Essays Submitted</div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="text-5xl mb-3">✅</div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{stats.reviewsCompleted}</div>
                        <div className="text-slate-700 font-medium">Reviews Completed</div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="text-5xl mb-3">⏳</div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{stats.reviewsPending}</div>
                        <div className="text-slate-700 font-medium">Pending Reviews</div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white backdrop-blur-sm rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
                    <h2 className="text-2xl font-semibold text-slate-900 mb-4">Quick Actions</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link
                            href="/submit-essay"
                            className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col justify-center block"
                        >
                            <div className="text-3xl mb-2">✍️</div>
                            <h3 className="text-xl font-bold mb-1">Submit New Essay</h3>
                            <p className="text-slate-600 font-medium text-sm">Upload your essay and get AI feedback</p>
                        </Link>

                        <Link
                            href="/review"
                            className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-green-500 hover:shadow-md transition-all text-left flex flex-col justify-center block"
                        >
                            <div className="text-3xl mb-2">🤝</div>
                            <h3 className="text-xl font-bold mb-1">Review Peers</h3>
                            <p className="text-slate-600 font-medium text-sm">Help your classmates by reviewing their essays</p>
                        </Link>

                        <Link
                            href="/my-essays"
                            className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-purple-500 hover:shadow-md transition-all text-left flex flex-col justify-center block"
                        >
                            <div className="text-3xl mb-2">📊</div>
                            <h3 className="text-xl font-bold mb-1">View My Essays</h3>
                            <p className="text-slate-600 font-medium text-sm">See your submissions and feedback</p>
                        </Link>

                        <Link
                            href="/progress"
                            className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-orange-500 hover:shadow-md transition-all text-left flex flex-col justify-center block"
                        >
                            <div className="text-3xl mb-2">📈</div>
                            <h3 className="text-xl font-bold mb-1">Track Progress</h3>
                            <p className="text-slate-600 font-medium text-sm">Monitor your improvement over time</p>
                        </Link>
                    </div>
                </div>

                {/* Recent Games */}
                {pastReports.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <h2 className="text-2xl font-semibold text-slate-900 mb-4">🎮 Recent Games</h2>
                        <div className="space-y-2">
                            {pastReports.map((r: any) => {
                                const me = r.players[currentUser?.uid]
                                return (
                                    <div
                                        key={r.id}
                                        onClick={() => router.push(`/play/report/${r.id}`)}
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between hover:border-violet-300 hover:shadow-sm cursor-pointer transition-all"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-800">{r.quizTitle}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {new Date(r.playedAt).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 text-right">
                                            <div>
                                                <p className="font-bold text-violet-600">{me?.score || 0} pts</p>
                                                <p className="text-xs text-slate-400">Rank #{me?.rank}</p>
                                            </div>
                                            <span className="text-slate-300 text-lg">→</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

            </main>

            <IELTSRubric />
        </StudentLayout>
    )
}