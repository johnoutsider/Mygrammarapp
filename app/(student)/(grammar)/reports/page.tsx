'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import type { GameReport } from '@/lib/gameService'

export default function MyReports() {
    const router = useRouter()
    const [reports, setReports] = useState<GameReport[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchReports = async () => {
            const user = auth.currentUser
            if (!user) { router.push('/'); return }

            try {
                const snap = await getDocs(
                    query(collection(db, 'gameReports'), orderBy('playedAt', 'desc'))
                )
                // Filter client-side to support both old and new reports
                const data = snap.docs
                    .filter(d => {
                        const report = d.data()
                        return (
                            report.players?.[user.uid] ||          // old reports (no playerIds)
                            report.playerIds?.includes(user.uid)   // new reports (with playerIds)
                        )
                    })
                    .map(d => ({ id: d.id, ...d.data() } as unknown as GameReport))
                setReports(data)
            }
            catch (err) {
                console.error('Error fetching reports:', err)
            } finally {
                setLoading(false)
            }

        }
        fetchReports()
    }, [router])

    if (loading) {
        return (
            <StudentLayout title="My Reports">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="My Reports">
            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">📊 My Game Reports</h1>
                <p className="text-gray-500 mb-6">All grammar games you've played so far</p>

                {reports.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <div className="text-5xl mb-4">🎮</div>
                        <p className="text-lg font-semibold text-gray-900">No games played yet</p>
                        <p className="mt-1 text-sm">Join an active game session to see your results here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reports.map((report) => {
                            const me = report.players?.[auth.currentUser!.uid]
                            const totalPlayers = Object.keys(report.players || {}).length

                            // Count correct answers for this student
                            const myAnswers = Object.values(report.answers?.[auth.currentUser!.uid] || {})
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

                            return (
                                <div key={report.sessionId}
                                    className="bg-gray-100 border border-gray-200 rounded-2xl p-5 hover:border-[#1a9aaa]/40 transition-all">

                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-white  font-semibold text-lg">{report.quizTitle}</h2>
                                            <p className="text-gray-400 text-sm">{date} at {time}</p>
                                        </div>
                                        {me?.rank && (
                                            <span className="text-2xl">
                                                {me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : `#${me.rank}`}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats row */}
                                    <div className="grid grid-cols-4 gap-3 text-center">
                                        <div className="bg-white/5 rounded-xl py-3">
                                            <p className="text-xl font-bold text-[#1a9aaa]">{me?.score ?? 0}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Points</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl py-3">
                                            <p className="text-xl font-bold text-white">{accuracy}%</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Accuracy</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl py-3">
                                            <p className="text-xl font-bold text-white">
                                                {correctCount}/{report.totalQuestions}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">Correct</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl py-3">
                                            <p className="text-xl font-bold text-white">{totalPlayers}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Players</p>
                                        </div>
                                    </div>

                                    {/* Question breakdown */}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {report.questions.map((q, idx) => {
                                            const ans = report.answers?.[auth.currentUser!.uid]?.[idx]
                                            const wasCorrect = ans?.correct
                                            return (
                                                <span key={idx}
                                                    title={q.text}
                                                    className={`text-xs px-2 py-1 rounded-full font-medium
                            ${wasCorrect
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : ans
                                                                ? 'bg-red-500/20 text-red-400'
                                                                : 'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                    Q{idx + 1} {wasCorrect ? '✓' : ans ? '✗' : '–'}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </StudentLayout>
    )
}
