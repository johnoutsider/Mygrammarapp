'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import type { GameReport } from '@/lib/gameService'

type FilterType = 'all' | 'incorrect'

export default function ReportDetail() {
    const router = useRouter()
    const params = useParams()
    const sessionId = params.id as string

    const [report, setReport] = useState<GameReport | null>(null)
    const [uid, setUid] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set())

    const toggleQuestion = (idx: number) => {
        setExpandedQuestions(prev => {
            const next = new Set(prev)
            next.has(idx) ? next.delete(idx) : next.add(idx)
            return next
        })
    }


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            setUid(user.uid)

            try {
                const snap = await getDoc(doc(db, 'gameReports', sessionId))
                if (snap.exists()) {
                    setReport({ id: snap.id, ...snap.data() } as unknown as GameReport)
                } else {
                    router.push('/reports')
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        })
        return () => unsubscribe()
    }, [router, sessionId])

    if (loading) {
        return (
            <StudentLayout title="Report Detail">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
                </div>
            </StudentLayout>
        )
    }

    if (!report) return null

    const me = report.players?.[uid]
    const myAnswers = report.answers?.[uid] || {}
    const totalAnswered = Object.keys(myAnswers).length
    const correctCount = Object.values(myAnswers).filter((a: any) => a.correct).length
    const incorrectCount = totalAnswered - correctCount
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0
    const date = new Date(report.playedAt).toLocaleDateString([], {
        year: 'numeric', month: 'long', day: 'numeric'
    })

    // Donut chart via SVG
    const radius = 54
    const circumference = 2 * Math.PI * radius
    const strokeDash = (accuracy / 100) * circumference

    const filteredQuestions = report.questions?.map((q, idx) => ({ q, idx }))
        .filter(({ idx }) => {
            if (filter === 'incorrect') {
                return myAnswers[idx] && !myAnswers[idx].correct
            }
            return true
        })

    const rankEmoji = me?.rank === 1 ? '🥇' : me?.rank === 2 ? '🥈' : me?.rank === 3 ? '🥉' : null

    return (
        <StudentLayout title="Game Report">
            <div className="max-w-2xl mx-auto px-4 py-8">

                {/* Back button */}
                <button
                    onClick={() => router.push('/reports')}
                    className="mb-6 text-sm text-gray-500 hover:text-violet-600 flex items-center gap-1 transition-colors">
                    ← Back to Reports
                </button>

                {/* Header Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">

                        {/* Donut Chart */}
                        <div className="relative flex-shrink-0">
                            <svg width="140" height="140" viewBox="0 0 140 140">
                                {/* Background circle */}
                                <circle cx="70" cy="70" r={radius}
                                    fill="none" stroke="#fee2e2" strokeWidth="16" />
                                {/* Foreground arc */}
                                <circle cx="70" cy="70" r={radius}
                                    fill="none" stroke="#22c55e" strokeWidth="16"
                                    strokeDasharray={`${strokeDash} ${circumference}`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 70 70)" />
                                <text x="70" y="65" textAnchor="middle"
                                    className="text-2xl font-bold" fill="#111827"
                                    style={{ fontSize: '22px', fontWeight: 700 }}>
                                    {accuracy}%
                                </text>
                                <text x="70" y="85" textAnchor="middle"
                                    fill="#6b7280" style={{ fontSize: '12px' }}>
                                    Correct
                                </text>
                            </svg>
                        </div>

                        {/* Player Info & Stats */}
                        <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-2xl font-bold text-gray-900">{me?.name || 'You'}</h1>
                                {rankEmoji && <span className="text-2xl">{rankEmoji}</span>}
                            </div>
                            {me?.rank && (
                                <span className="inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                                    🏆 {me.rank === 1 ? '1st' : me.rank === 2 ? '2nd' : me.rank === 3 ? '3rd' : `${me.rank}th`} place
                                </span>
                            )}
                            <p className="text-xs text-gray-400 mb-4">{date} · {report.quizTitle}</p>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                                    <span className="w-7 h-7 flex items-center justify-center bg-green-100 rounded-full text-green-600 font-bold text-sm">✓</span>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900">{correctCount}</p>
                                        <p className="text-xs text-gray-400">Correct Answers</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                                    <span className="w-7 h-7 flex items-center justify-center bg-red-100 rounded-full text-red-500 font-bold text-sm">✗</span>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900">{incorrectCount}</p>
                                        <p className="text-xs text-gray-400">Incorrect Answers</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                                    <span className="w-7 h-7 flex items-center justify-center bg-blue-100 rounded-full text-blue-500 font-bold text-sm">?</span>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900">{report.totalQuestions}</p>
                                        <p className="text-xs text-gray-400">Total Questions</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                                    <span className="w-7 h-7 flex items-center justify-center bg-violet-100 rounded-full text-violet-600 font-bold text-sm">★</span>
                                    <div>
                                        <p className="text-xl font-bold text-gray-900">{me?.score ?? 0}</p>
                                        <p className="text-xs text-gray-400">Total Points</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Question Breakdown */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    {/* Filter bar */}
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-semibold text-gray-900">Question Breakdown</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all
                  ${filter === 'all'
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                All answers
                            </button>
                            <button
                                onClick={() => setFilter('incorrect')}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all
                  ${filter === 'incorrect'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                Incorrect %
                            </button>
                        </div>
                    </div>

                    {/* Questions list */}
                    <div className="space-y-3">
                        {filteredQuestions?.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <p className="text-3xl mb-2">🎉</p>
                                <p className="font-medium text-gray-700">No incorrect answers!</p>
                                <p className="text-sm">You got everything right.</p>
                            </div>
                        ) : (
                            filteredQuestions?.map(({ q, idx }) => {
                                const ans = myAnswers[idx] as any
                                const isCorrect = ans?.correct
                                const notAnswered = !ans
                                const isExpanded = expandedQuestions.has(idx)
                                const correctAnswer = q.answers?.find((a: any) => a.isCorrect)
                                const chosenAnswer = q.answers?.find((a: any) => a.id === ans?.answerId)

                                return (
                                    <div key={idx}
                                        className={`rounded-xl border transition-all
                    ${isCorrect
                                                ? 'bg-green-50 border-green-200'
                                                : notAnswered
                                                    ? 'bg-gray-50 border-gray-200'
                                                    : 'bg-red-50 border-red-200'}`}>

                                        {/* Question row — always visible */}
                                        <div className="p-4 flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold text-gray-400 mb-1">Question {idx + 1}</p>
                                                <p className="text-gray-900 font-medium text-sm">{q.text}</p>

                                                {/* Correct answer hint for wrong answers */}
                                                {!isCorrect && !notAnswered && correctAnswer && (
                                                    <p className="text-xs text-green-600 mt-2 font-medium">
                                                        ✓ Correct: {correctAnswer.text}
                                                    </p>
                                                )}
                                                {!isCorrect && !notAnswered && chosenAnswer && (
                                                    <p className="text-xs text-red-500 mt-0.5 font-medium">
                                                        ✗ Your answer: {chosenAnswer.text}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                                {/* Result badge */}
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-4
                            ${isCorrect
                                                        ? 'border-green-400 text-green-600 bg-white'
                                                        : notAnswered
                                                            ? 'border-gray-300 text-gray-400 bg-white'
                                                            : 'border-red-400 text-red-500 bg-white'}`}>
                                                    {isCorrect ? '✓' : notAnswered ? '–' : '✗'}
                                                </div>
                                                <p className="text-[10px] text-gray-400">
                                                    {isCorrect ? `+${ans?.points ?? 0}pts` : '0pts'}
                                                </p>

                                                {/* Expand toggle button */}
                                                {q.answers?.length > 0 && (
                                                    <button
                                                        onClick={() => toggleQuestion(idx)}
                                                        className="text-[10px] text-violet-500 hover:text-violet-700 font-semibold underline transition-colors">
                                                        {isExpanded ? 'Hide' : 'Options'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded answer options */}
                                        {isExpanded && q.answers?.length > 0 && (
                                            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {q.answers.map((option: any, optIdx: number) => {
                                                    const isChosen = option.id === ans?.answerId
                                                    const isOptionCorrect = option.isCorrect

                                                    return (
                                                        <div key={optIdx}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
                                        ${isOptionCorrect
                                                                    ? 'bg-green-100 border-green-300 text-green-800'
                                                                    : isChosen && !isOptionCorrect
                                                                        ? 'bg-red-100 border-red-300 text-red-700'
                                                                        : 'bg-white border-gray-200 text-gray-600'}`}>

                                                            {/* Option letter */}
                                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                                        ${isOptionCorrect
                                                                    ? 'bg-green-500 text-white'
                                                                    : isChosen && !isOptionCorrect
                                                                        ? 'bg-red-400 text-white'
                                                                        : 'bg-gray-200 text-gray-600'}`}>
                                                                {String.fromCharCode(65 + optIdx)}
                                                            </span>

                                                            <span className="flex-1">{option.text}</span>

                                                            {/* Indicators */}
                                                            {isOptionCorrect && (
                                                                <span className="text-green-500 text-xs">✓</span>
                                                            )}
                                                            {isChosen && !isOptionCorrect && (
                                                                <span className="text-red-400 text-xs">✗ your answer</span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}

                    </div>
                </div>
            </div>
        </StudentLayout>
    )
}
