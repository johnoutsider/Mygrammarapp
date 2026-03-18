'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import IELTSRubric from '@/components/teacher/essay/IELTSRubric'
import { onActiveGame, joinGame } from '@/lib/gameService'
import type { ActiveGame } from '@/lib/gameService'
import { useAccessMode } from '@/hooks/useAccessMode'
import { getVisibleGroups } from '@/lib/accessControl'

export default function Dashboard() {
    const router = useRouter()
    const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [userName, setUserName] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [pastReports, setPastReports] = useState<any[]>([])
    const [totalGamesPlayed, setTotalGamesPlayed] = useState(0) // ✅ FIX 1: separate total count
    const [accuracy, setAccuracy] = useState<number>(0)
    const [stats, setStats] = useState({
        submittedEssays: 0,
        reviewsCompleted: 0,
        reviewsPending: 0,
    })

    const { accessMode, loading: accessLoading } = useAccessMode()
    const { showWriting, showGrammar, showSpeaking } = getVisibleGroups(accessMode)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }

            try {
                const { getUserProfile } = await import('@/lib/auth')
                const profile = await getUserProfile(user.uid)
                if (profile?.role === 'teacher') { router.replace('/teacher'); return }

                setUserName(profile?.displayName || profile?.name || '')

                const essaysQuery = query(collection(db, 'essays'), where('studentId', '==', user.uid))
                const essaysSnapshot = await getDocs(essaysQuery)

                const reviewsQuery = query(collection(db, 'reviews'), where('reviewerId', '==', user.uid))
                const reviewsSnapshot = await getDocs(reviewsQuery)

                const assignedQuery = query(collection(db, 'essays'), where('peerReviewIds', 'array-contains', user.uid))
                const assignedSnapshot = await getDocs(assignedQuery)

                setStats({
                    submittedEssays: essaysSnapshot.size,
                    reviewsCompleted: reviewsSnapshot.size,
                    reviewsPending: assignedSnapshot.size - reviewsSnapshot.size,
                })

                // Fetch ALL game reports
                const reportsSnap = await getDocs(
                    query(
                        collection(db, 'gameReports'),
                        where('playerIds', 'array-contains', user.uid),
                        orderBy('playedAt', 'desc')
                    )
                )
                const allMyReports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }))



                // ✅ FIX 1: store total count separately before slicing
                setTotalGamesPlayed(allMyReports.length)

                // Accuracy calculation
                let totalCorrect = 0
                let totalAnswered = 0
                allMyReports.forEach((r: any) => {
                    const userAnswers = r.answers?.[user.uid] || {}
                    Object.values(userAnswers).forEach((a: any) => {
                        totalAnswered++
                        if (a.correct) totalCorrect++
                    })
                })
                const computedAccuracy = totalAnswered > 0
                    ? Math.round((totalCorrect / totalAnswered) * 100)
                    : 0
                setAccuracy(computedAccuracy)

                // Keep only 5 most recent for the Recent Games list
                setPastReports(allMyReports.slice(0, 5))

            } catch (error) {
                console.error('Error fetching dashboard data:', error)
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

    if (loading || accessLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        )
    }

    const welcomeSubtitle = accessMode === 'both'
        ? "Here's your writing and grammar overview"
        : accessMode === 'writing'
            ? "Here's your writing progress"
            : accessMode === 'grammar'
                ? "Here's your grammar game progress"
                : "Here's your speaking practice space"

    const accuracyColor = accuracy >= 70
        ? { bar: 'bg-emerald-500', text: 'text-emerald-600', label: '🔥 Great' }
        : accuracy >= 40
            ? { bar: 'bg-amber-400', text: 'text-amber-600', label: '📈 Getting there' }
            : { bar: 'bg-red-400', text: 'text-red-500', label: '💪 Keep practising' }

    return (
        <StudentLayout title="Dashboard">
            <main className="container mx-auto px-4 py-8">

                {/* Welcome */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">
                        Welcome Back{userName ? `, ${userName.split(' ')[0]}` : ''}!
                    </h1>
                    <p className="text-slate-500">{welcomeSubtitle}</p>
                </div>

                {/* Live game banner */}
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

                {/* ── Stats Cards ── */}
                {(showWriting || showGrammar || showSpeaking) && (
                    <div className={`grid gap-4 md:gap-6 mb-8 ${showWriting && showGrammar
                        ? 'grid-cols-1 sm:grid-cols-3'
                        : showSpeaking
                            ? 'grid-cols-1'
                        : 'grid-cols-1 sm:grid-cols-2'
                        }`}>

                        {showWriting && (
                            <>
                                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                    <div className="text-4xl mb-3">📝</div>
                                    <div className="text-3xl font-bold text-slate-900 mb-1">{stats.submittedEssays}</div>
                                    <div className="text-slate-700 font-medium">Essays Submitted</div>
                                </div>
                                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                    <div className="text-4xl mb-3">✅</div>
                                    <div className="text-3xl font-bold text-slate-900 mb-1">{stats.reviewsCompleted}</div>
                                    <div className="text-slate-700 font-medium">Reviews Completed</div>
                                </div>
                                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                    <div className="text-4xl mb-3">⏳</div>
                                    <div className="text-3xl font-bold text-slate-900 mb-1">
                                        {Math.max(0, stats.reviewsPending)}
                                    </div>
                                    <div className="text-slate-700 font-medium">Pending Reviews</div>
                                </div>
                            </>
                        )}

                        {showGrammar && (
                            <>
                                {/* ✅ FIX 1: use totalGamesPlayed instead of pastReports.length */}
                                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                    <div className="text-4xl mb-3">🎮</div>
                                    <div className="text-3xl font-bold text-slate-900 mb-1">{totalGamesPlayed}</div>
                                    <div className="text-slate-700 font-medium">Games Played</div>
                                </div>

                                {/* Accuracy card */}
                                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="text-4xl">🎯</div>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 ${accuracyColor.text}`}>
                                            {accuracyColor.label}
                                        </span>
                                    </div>
                                    <div className={`text-3xl font-bold mb-0.5 ${accuracyColor.text}`}>
                                        {accuracy}%
                                    </div>
                                    <div className="text-slate-700 font-medium mb-3">Accuracy</div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className={`h-2.5 rounded-full transition-all duration-700 ${accuracyColor.bar}`}
                                            style={{ width: `${accuracy}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                                        <span>0%</span>
                                        <span>50%</span>
                                        <span>100%</span>
                                    </div>
                                    {totalGamesPlayed === 0 && (
                                        <p className="text-xs text-slate-400 mt-2">Play a game to see your accuracy</p>
                                    )}
                                </div>
                            </>
                        )}

                        {showSpeaking && (
                            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                <div className="text-4xl mb-3">🎤</div>
                                <div className="text-2xl font-bold text-slate-900 mb-1">Speaking Class</div>
                                <div className="text-slate-700 font-medium">Camera, microphone, transcript, and warning monitor</div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Quick Actions ── */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
                    <h2 className="text-2xl font-semibold text-slate-900 mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {showWriting && (
                            <>
                                <Link href="/submit-essay"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">✍️</div>
                                    <h3 className="text-xl font-bold mb-1">Submit New Essay</h3>
                                    <p className="text-slate-600 text-sm">Upload your essay and get AI feedback</p>
                                </Link>
                                <Link href="/review-peers"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-green-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">🤝</div>
                                    <h3 className="text-xl font-bold mb-1">Review Peers</h3>
                                    <p className="text-slate-600 text-sm">Help classmates by reviewing their essays</p>
                                </Link>
                                <Link href="/my-essays"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-purple-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">📊</div>
                                    <h3 className="text-xl font-bold mb-1">View My Essays</h3>
                                    <p className="text-slate-600 text-sm">See your submissions and feedback</p>
                                </Link>
                                <Link href="/progress/writing"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-orange-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">📈</div>
                                    <h3 className="text-xl font-bold mb-1">Writing Progress</h3>
                                    <p className="text-slate-600 text-sm">Monitor your writing improvement over time</p>
                                </Link>
                            </>
                        )}

                        {/* ✅ FIX 2: replaced teacher-only links with student-appropriate ones */}
                        {showGrammar && (
                            <>
                                <Link href="/reports"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-violet-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">📊</div>
                                    <h3 className="text-xl font-bold mb-1">My Game Reports</h3>
                                    <p className="text-slate-600 text-sm">View all your past game results</p>
                                </Link>
                                <Link href="/progress/grammar"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-orange-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">📈</div>
                                    <h3 className="text-xl font-bold mb-1">Grammar Progress</h3>
                                    <p className="text-slate-600 text-sm">Track your game scores and streaks</p>
                                </Link>
                            </>
                        )}

                        {showSpeaking && (
                            <>
                                <Link href="/speaking-practice"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-amber-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">🎤</div>
                                    <h3 className="text-xl font-bold mb-1">Start Speaking Practice</h3>
                                    <p className="text-slate-600 text-sm">Read the active question, prepare, and move into the timed speaking session.</p>
                                </Link>
                                <Link href="/speaking-log"
                                    className="bg-white border border-slate-200 text-slate-900 p-6 rounded-lg hover:border-sky-500 hover:shadow-md transition-all text-left flex flex-col justify-center">
                                    <div className="text-3xl mb-2">🗂️</div>
                                    <h3 className="text-xl font-bold mb-1">My Speaking Log</h3>
                                    <p className="text-slate-600 text-sm">Review the questions you answered and the transcript captured for each response.</p>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Recent Games ── */}
                {showGrammar && pastReports.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <h2 className="text-2xl font-semibold text-slate-900 mb-4">🎮 Recent Games</h2>
                        <div className="space-y-2">
                            {pastReports.map((r: any) => {
                                const me = r.players[currentUser?.uid]
                                const gameAnswers = Object.values(r.answers?.[currentUser?.uid] || {}) as any[]
                                const gameCorrect = gameAnswers.filter((a: any) => a.correct).length
                                const gameAccuracy = gameAnswers.length > 0
                                    ? Math.round((gameCorrect / gameAnswers.length) * 100)
                                    : null

                                return (
                                    <div
                                        key={r.id}
                                        onClick={() => router.push(`/reports`)}
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
                                            {gameAccuracy !== null && (
                                                <div>
                                                    <p className={`font-bold text-sm ${gameAccuracy >= 70 ? 'text-emerald-500' : gameAccuracy >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                                                        {gameAccuracy}%
                                                    </p>
                                                    <p className="text-xs text-slate-400">accuracy</p>
                                                </div>
                                            )}
                                            <span className="text-slate-300 text-lg">→</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ✅ Link to full reports page */}
                        {totalGamesPlayed > 5 && (
                            <div className="mt-4 text-center">
                                <Link href="/reports" className="text-sm text-violet-600 hover:underline font-medium">
                                    View all {totalGamesPlayed} games →
                                </Link>
                            </div>
                        )}
                    </div>
                )}

            </main>

            {showWriting && <IELTSRubric />}
        </StudentLayout>
    )
}
