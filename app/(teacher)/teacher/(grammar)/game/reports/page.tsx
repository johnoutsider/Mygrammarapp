'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import TeacherLayout from '@/components/TeacherLayout'

interface ReportSummary {
    sessionId: string
    quizTitle: string
    playedAt: number
    totalQuestions: number
    playerCount: number
    avgScore: number
}

export default function ReportsPage() {
    const router = useRouter()
    const [reports, setReports] = useState<ReportSummary[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(user.uid)
            if (profile?.role !== 'teacher') { router.push('/dashboard'); return }

            const snap = await getDocs(
                query(collection(db, 'gameReports'), orderBy('playedAt', 'desc'))
            )

            const data: ReportSummary[] = snap.docs.map(d => {
                const r = d.data()
                const players = Object.values(r.players || {}) as any[]
                const avgScore = players.length
                    ? Math.round(players.reduce((sum: number, p: any) => sum + p.score, 0) / players.length)
                    : 0
                return {
                    sessionId: r.sessionId,
                    quizTitle: r.quizTitle,
                    playedAt: r.playedAt,
                    totalQuestions: r.totalQuestions,
                    playerCount: players.length,
                    avgScore
                }
            })

            setReports(data)
            setLoading(false)
        })
        return unsub
    }, [router])

    const formatDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
            </div>
        )
    }

    return (
        <TeacherLayout title="Game Reports">
            <div className="max-w-4xl mx-auto px-4 py-8">

                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-slate-900">📊 Game Reports</h1>
                    <p className="text-slate-500 mt-1">All past live game sessions</p>
                </div>

                {reports.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 px-6 py-16 text-center">
                        <div className="text-5xl mb-4">🎮</div>
                        <p className="font-semibold text-slate-700 text-lg">No games played yet</p>
                        <p className="text-slate-400 text-sm mt-1">Reports appear here after a live game ends</p>
                        <button
                            onClick={() => router.push('/teacher/game')}
                            className="mt-6 bg-violet-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-violet-700 transition-colors"
                        >
                            Launch a Game
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map(r => (
                            <div
                                key={r.sessionId}
                                onClick={() => router.push(`/teacher/game/reports/${r.sessionId}`)}
                                className="bg-white rounded-2xl border border-slate-200 px-6 py-5 flex items-center justify-between hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group"
                            >
                                <div>
                                    <p className="font-bold text-slate-800 text-lg group-hover:text-violet-700 transition-colors">
                                        {r.quizTitle}
                                    </p>
                                    <p className="text-sm text-slate-400 mt-0.5">
                                        {formatDate(r.playedAt)} · {r.totalQuestions} questions
                                    </p>
                                </div>
                                <div className="flex items-center gap-6 text-right">
                                    <div>
                                        <p className="text-2xl font-extrabold text-slate-800">{r.playerCount}</p>
                                        <p className="text-xs text-slate-400">players</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-extrabold text-violet-600">{r.avgScore}</p>
                                        <p className="text-xs text-slate-400">avg pts</p>
                                    </div>
                                    <span className="text-slate-300 group-hover:text-violet-400 text-xl transition-colors">→</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}