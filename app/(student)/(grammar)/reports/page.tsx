'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, getDocs, orderBy } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import type { GameReport } from '@/lib/gameService'

export default function MyReports() {
    const router = useRouter()
    const [reports, setReports] = useState<GameReport[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }

            try {
                const snap = await getDocs(
                    query(collection(db, 'gameReports'), orderBy('playedAt', 'desc'))
                )

                const data = snap.docs
                    .filter(d => {
                        const report = d.data()
                        return (
                            report.players?.[user.uid] ||
                            report.playerIds?.includes(user.uid)
                        )
                    })
                    .map(d => ({ id: d.id, ...d.data() } as unknown as GameReport))

                setReports(data)
            } catch (err) {
                console.error('Error fetching reports:', err)
            } finally {
                setLoading(false)
            }
        })

        return () => unsubscribe()
    }, [router])

    if (loading) {
        return (
            <StudentLayout title="My Reports">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="My Reports">
            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">📊 My Game Reports</h1>
                <p className="text-gray-500 mb-6">
                    {reports.length > 0
                        ? `${reports.length} game${reports.length > 1 ? 's' : ''} played so far`
                        : 'All grammar games you\'ve played so far'}
                </p>

                {reports.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4">🎮</div>
                        <p className="text-lg font-semibold text-gray-900">No games played yet</p>
                        <p className="mt-1 text-sm text-gray-500">
                            Join an active game session to see your results here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reports.map((report) => {
                            const uid = auth.currentUser?.uid!
                            const me = report.players?.[uid]
                            const totalPlayers = Object.keys(report.players || {}).length
                            const myAnswers = Object.values(report.answers?.[uid] || {}) as any[]
                            const correctCount = myAnswers.filter((a: any) => a.correct).length
                            const accuracy = myAnswers.length > 0
                                ? Math.round((correctCount / myAnswers.length) * 100)
                                : 0
                            const date = new Date(report.playedAt).toLocaleDateString([], {
                                year: 'numeric', month: 'short', day: 'numeric',
                            })
                            const time = new Date(report.playedAt).toLocaleTimeString([], {
                                hour: '2-digit', minute: '2-digit',
                            })

                            // Accuracy color
                            const accColor = accuracy >= 70
                                ? 'text-emerald-600'
                                : accuracy >= 40
                                    ? 'text-amber-500'
                                    : 'text-red-500'

                            // ✅ Use report.id (Firestore doc ID) for navigation
                            const reportId = (report as any).id || report.sessionId

                            return (
                                <div
                                    key={report.sessionId}
                                    onClick={() => router.push(`/reports/${reportId}`)}
                                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-violet-400 hover:shadow-md cursor-pointer transition-all group"
                                >
                                    {/* Header row */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-gray-900 font-semibold text-lg group-hover:text-violet-700 transition-colors">
                                                {report.quizTitle}
                                            </h2>
                                            <p className="text-gray-400 text-sm">{date} at {time}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">
                                                {me?.rank === 1 ? '🥇'
                                                    : me?.rank === 2 ? '🥈'
                                                        : me?.rank === 3 ? '🥉'
                                                            : me?.rank ? `#${me.rank}` : ''}
                                            </span>
                                            {/* Arrow indicator */}
                                            <span className="text-gray-300 group-hover:text-violet-400 text-lg transition-colors">→</span>
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="grid grid-cols-4 gap-3 text-center mb-4">
                                        <div className="bg-gray-50 rounded-xl py-3 border border-gray-100">
                                            <p className="text-xl font-bold text-violet-600">{me?.score ?? 0}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Points</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl py-3 border border-gray-100">
                                            <p className={`text-xl font-bold ${accColor}`}>{accuracy}%</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Accuracy</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl py-3 border border-gray-100">
                                            <p className="text-xl font-bold text-gray-900">
                                                {correctCount}/{report.totalQuestions}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">Correct</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl py-3 border border-gray-100">
                                            <p className="text-xl font-bold text-gray-900">{totalPlayers}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Players</p>
                                        </div>
                                    </div>

                                    {/* Per-question pills */}
                                    <div className="flex flex-wrap gap-2">
                                        {report.questions?.map((q, idx) => {
                                            const ans = (report.answers?.[uid] as any)?.[idx]
                                            const wasCorrect = ans?.correct
                                            return (
                                                <span
                                                    key={idx}
                                                    title={q.text}
                                                    className={`text-xs px-2 py-1 rounded-full font-medium
                                                        ${wasCorrect
                                                            ? 'bg-green-100 text-green-600'
                                                            : ans
                                                                ? 'bg-red-100 text-red-500'
                                                                : 'bg-gray-100 text-gray-400'
                                                        }`}>
                                                    Q{idx + 1} {wasCorrect ? '✓' : ans ? '✗' : '–'}
                                                </span>
                                            )
                                        })}
                                    </div>

                                    {/* Tap to view hint */}
                                    <p className="text-xs text-gray-300 mt-3 text-right group-hover:text-violet-400 transition-colors">
                                        Tap to view full report →
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </StudentLayout>
    )
}
