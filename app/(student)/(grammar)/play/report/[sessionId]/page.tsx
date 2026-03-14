'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

export default function StudentReportPage() {
    const router = useRouter()
    const { sessionId } = useParams()
    const [report, setReport] = useState<any>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            setCurrentUser(user)

            const snap = await getDoc(doc(db, 'gameReports', sessionId as string))
            if (!snap.exists()) { router.push('/dashboard'); return }

            const data = snap.data()
            if (!data.players?.[user.uid]) { router.push('/dashboard'); return }

            setReport(data)
            setLoading(false)
        })
        return unsub
    }, [router, sessionId])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
            </div>
        )
    }

    const me = report.players[currentUser.uid]
    const myAnswers = report.answers?.[currentUser.uid] || {}
    const totalPlayers = Object.keys(report.players).length
    const correctCount = Object.values(myAnswers).filter((a: any) => a.correct).length
    const accuracyPct = report.totalQuestions
        ? Math.round((correctCount / report.totalQuestions) * 100)
        : 0

    const formatDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
    })

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-4 pb-10">

            <button
                onClick={() => router.push('/dashboard')}
                className="text-violet-300 text-sm hover:text-white transition-colors mt-2 mb-6 flex items-center gap-1"
            >
                ← Back to Dashboard
            </button>

            <div className="text-center mb-8">
                <p className="text-violet-400 text-xs font-semibold uppercase tracking-widest mb-1">Game Report</p>
                <h1 className="text-2xl font-extrabold text-white mb-1">{report.quizTitle}</h1>
                <p className="text-violet-400 text-sm">{formatDate(report.playedAt)}</p>
            </div>

            {/* Rank card */}
            <div className={`rounded-3xl p-6 text-center mb-4 shadow-xl
                ${me.rank === 1 ? 'bg-yellow-400' :
                    me.rank === 2 ? 'bg-slate-400' :
                        me.rank === 3 ? 'bg-amber-600' : 'bg-white/10 border border-white/20'}`}>
                <div className="text-5xl mb-2">
                    {me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : `#${me.rank}`}
                </div>
                <p className="text-3xl font-extrabold text-white mb-1">{me.name}</p>
                <p className={`text-sm font-medium ${me.rank === 1 ? 'text-yellow-800' : 'text-white/70'}`}>
                    Rank {me.rank} of {totalPlayers} players
                </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/10 border border-white/20 rounded-2xl px-3 py-4 text-center">
                    <p className="text-2xl font-extrabold text-white">{me.score}</p>
                    <p className="text-xs text-violet-300 mt-0.5">points</p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-2xl px-3 py-4 text-center">
                    <p className="text-2xl font-extrabold text-white">{correctCount}/{report.totalQuestions}</p>
                    <p className="text-xs text-violet-300 mt-0.5">correct</p>
                </div>
                <div className={`rounded-2xl px-3 py-4 text-center
                    ${accuracyPct >= 70 ? 'bg-green-500/20 border border-green-500/30' :
                        accuracyPct >= 40 ? 'bg-yellow-500/20 border border-yellow-500/30' :
                            'bg-red-500/20 border border-red-500/30'}`}>
                    <p className={`text-2xl font-extrabold
                        ${accuracyPct >= 70 ? 'text-green-400' :
                            accuracyPct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {accuracyPct}%
                    </p>
                    <p className="text-xs text-violet-300 mt-0.5">accuracy</p>
                </div>
            </div>

            {/* Per-question breakdown */}
            <h2 className="text-white font-bold text-base mb-3">Your Answers</h2>
            <div className="space-y-3">
                {report.questions.map((q: any, qi: number) => {
                    const myAns = myAnswers[qi]
                    const chosenAnswer = myAns ? q.answers.find((a: any) => a.id === myAns.answerId) : null
                    const correctAnswer = q.answers.find((a: any) => a.isCorrect)

                    return (
                        <div key={qi}
                            className={`rounded-2xl px-4 py-4 border
                                ${!myAns ? 'bg-white/5 border-white/10' :
                                    myAns.correct ? 'bg-green-500/10 border-green-500/30' :
                                        'bg-red-500/10 border-red-500/30'}`}>

                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1">
                                    <span className="text-xs font-semibold text-violet-400 uppercase">Q{qi + 1}</span>
                                    <p className="text-white font-medium text-sm mt-0.5 leading-snug">{q.text}</p>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0
                                    ${!myAns ? 'bg-slate-600 text-slate-300' :
                                        myAns.correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    {!myAns ? '–' : myAns.correct ? '✓' : '✗'}
                                </div>
                            </div>

                            {myAns && !myAns.correct && chosenAnswer && (
                                <p className="text-red-300 text-xs mb-1">
                                    Your answer: <span className="font-semibold">{chosenAnswer.text}</span>
                                </p>
                            )}

                            {(!myAns || !myAns.correct) && correctAnswer && (
                                <p className="text-green-300 text-xs">
                                    Correct answer: <span className="font-semibold">{correctAnswer.text}</span>
                                </p>
                            )}

                            {myAns && myAns.points > 0 && (
                                <p className="text-green-400 text-xs font-bold mt-1">+{myAns.points} pts</p>
                            )}

                            {!myAns && (
                                <p className="text-slate-400 text-xs mt-1">Not answered</p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}