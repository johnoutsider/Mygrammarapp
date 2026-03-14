'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { onActiveGame, submitAnswer } from '@/lib/gameService'
import type { ActiveGame } from '@/lib/gameService'

const SHAPES = [
    { bg: 'bg-red-500', hover: 'hover:bg-red-400', shape: '▲' },
    { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', shape: '◆' },
    { bg: 'bg-yellow-400', hover: 'hover:bg-yellow-300', shape: '●' },
    { bg: 'bg-green-600', hover: 'hover:bg-green-500', shape: '■' },
]

const TF_SHAPES = [
    { bg: 'bg-blue-500', hover: 'hover:bg-blue-400', shape: '✓' },
    { bg: 'bg-red-500', hover: 'hover:bg-red-400', shape: '✗' },
]

export default function PlayGame() {
    const router = useRouter()
    const [game, setGame] = useState<ActiveGame | null>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [answered, setAnswered] = useState(false)
    const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null)
    const [pointsEarned, setPointsEarned] = useState<number | null>(null)
    const [timeLeft, setTimeLeft] = useState<number>(20)
    const [quizQuestions, setQuizQuestions] = useState<any[]>([])
    const [questionsLoaded, setQuestionsLoaded] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const prevQuestionRef = useRef<number>(-1)

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) { router.push('/'); return }
            setCurrentUser(user)
        })
        return unsub
    }, [router])

    // Load quiz questions
    useEffect(() => {
        if (!game?.quizId) return
        setQuestionsLoaded(false)
        const loadQuiz = async () => {
            const { db } = await import('@/lib/firebase')
            const { doc, getDoc } = await import('firebase/firestore')
            const snap = await getDoc(doc(db, 'quizzes', game.quizId))
            if (snap.exists()) {
                setQuizQuestions(snap.data().questions || [])
                setQuestionsLoaded(true)
            }
        }
        loadQuiz()
    }, [game?.quizId])

    // Listen to game state
    useEffect(() => {
        const unsub = onActiveGame((g) => {
            setGame(g)
            if (!g || g.status === 'ended') { router.push('/dashboard'); return }
            if (g.status === 'question' && g.currentQuestion !== prevQuestionRef.current) {
                prevQuestionRef.current = g.currentQuestion
                setAnswered(false)
                setSelectedAnswerId(null)
                setPointsEarned(null)
            }
        })
        return unsub
    }, [router])

    // Synced timer
    useEffect(() => {
        if (!game || game.status !== 'question' || answered || !questionsLoaded) {
            if (timerRef.current) clearInterval(timerRef.current)
            return
        }
        const currentQ = quizQuestions[game.currentQuestion]
        const timeLimitSec = currentQ?.timeLimit || 20
        const startedAt = game.questionStartedAt || Date.now()

        const tick = () => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            const remaining = Math.max(0, timeLimitSec - elapsed)
            setTimeLeft(remaining)
            if (remaining === 0 && timerRef.current) clearInterval(timerRef.current)
        }
        tick()
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(tick, 500)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [game?.currentQuestion, game?.status, game?.questionStartedAt, answered, questionsLoaded, quizQuestions])

    const handleAnswer = async (answerId: number) => {
        if (answered || !currentUser || !game || game.status !== 'question' || timeLeft === 0) return
        if (timerRef.current) clearInterval(timerRef.current)

        const currentQ = quizQuestions[game.currentQuestion]
        const timeLimitMs = (currentQ?.timeLimit || 20) * 1000
        const timeMs = Date.now() - (game.questionStartedAt || Date.now())
        const isCorrect = currentQ?.answers?.find((a: any) => a.id === answerId)?.isCorrect || false

        setAnswered(true)
        setSelectedAnswerId(answerId)

        const pts = await submitAnswer(
            currentUser.uid, game.currentQuestion,
            answerId, isCorrect, timeMs, timeLimitMs
        )
        setPointsEarned(pts)
    }

    // ── Lobby ──
    if (!game || game.status === 'lobby') {
        return (
            <div className="min-h-screen bg-indigo-900 flex items-center justify-center">
                <p className="text-white text-lg">Waiting for game to start...</p>
            </div>
        )
    }

    // ── Leaderboard ──
    if (game.status === 'leaderboard') {
        const sorted = Object.entries(game.players || {})
            .map(([uid, p]: any) => ({ uid, ...p }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6">
                <h2 className="text-3xl font-extrabold text-white mb-8">🏆 Leaderboard</h2>
                <div className="w-full max-w-sm space-y-3">
                    {sorted.map((p: any, i) => (
                        <div key={p.uid}
                            className={`flex items-center justify-between px-5 py-3 rounded-xl font-bold text-white
                            ${i === 0 ? 'bg-yellow-500 text-yellow-900' :
                                    i === 1 ? 'bg-slate-400 text-slate-900' :
                                        i === 2 ? 'bg-amber-700' : 'bg-white/10'}`}>
                            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}</span>
                            <span>{p.score} pts</span>
                        </div>
                    ))}
                </div>
                <p className="text-violet-300 mt-8 text-sm animate-pulse">Next question coming up...</p>
            </div>
        )
    }

    // ── Game ended ──
    if (game.status === 'ended') {
        const sorted = Object.entries(game.players || {})
            .map(([uid, p]: any) => ({ uid, ...p }))
            .sort((a: any, b: any) => b.score - a.score)
        const myRank = sorted.findIndex((p: any) => p.uid === currentUser?.uid) + 1
        const myScore = (game.players as any)?.[currentUser?.uid]?.score || 0

        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-extrabold mb-2">Game Over!</h2>
                <p className="text-violet-300 mb-6">You finished #{myRank} with {myScore} points</p>
                <div className="w-full max-w-sm space-y-3 mb-8">
                    {sorted.slice(0, 5).map((p: any, i) => (
                        <div key={p.uid}
                            className={`flex items-center justify-between px-5 py-3 rounded-xl font-bold
                            ${p.uid === currentUser?.uid ? 'bg-violet-500 ring-2 ring-white' :
                                    i === 0 ? 'bg-yellow-500 text-yellow-900' : 'bg-white/10'}`}>
                            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}</span>
                            <span>{p.score} pts</span>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform"
                >
                    Back to Dashboard
                </button>
            </div>
        )
    }

    // ── Loading ──
    if (!questionsLoaded) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
                    <p className="text-white/60 text-sm">Loading question...</p>
                </div>
            </div>
        )
    }

    const currentQ = quizQuestions[game.currentQuestion]
    const timeLimitSec = currentQ?.timeLimit || 20
    const timerPct = (timeLeft / timeLimitSec) * 100
    const isTF = currentQ?.type === 'true_or_false'
    const answers = currentQ?.answers || []
    const styles = isTF ? TF_SHAPES : SHAPES

    // ── REVEALING — teacher revealed the answer ──
    if (game.status === 'revealing') {
        const wasCorrect = pointsEarned !== null && pointsEarned > 0
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col">

                {/* Header */}
                <div className="px-4 pt-5 pb-3 flex items-center justify-between">
                    <span className="text-white/60 text-xs">
                        Q {game.currentQuestion + 1}/{game.totalQuestions}
                    </span>
                    <span className={`text-sm font-bold px-3 py-1 rounded-lg
                        ${!answered ? 'bg-orange-500/20 text-orange-400' :
                            wasCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {!answered ? "⏰ Time's up" : wasCorrect ? '✓ Correct' : '✗ Wrong'}
                    </span>
                    <span className="text-white/60 text-xs">
                        {(game.players as any)?.[currentUser?.uid]?.score || 0} pts
                    </span>
                </div>

                {/* Question */}
                <div className="px-4 pb-3 flex items-center justify-center">
                    <h2 className="text-lg font-bold text-white text-center leading-snug max-w-sm">
                        {currentQ?.text || ''}
                    </h2>
                </div>

                {/* Points banner */}
                {answered && wasCorrect && pointsEarned && (
                    <div className="mx-4 mb-3 bg-green-500/20 text-green-300 rounded-xl p-2 text-center font-bold">
                        +{pointsEarned} points!
                    </div>
                )}

                {/* Answer tiles — correct green, wrong dimmed */}
                <div className="flex-1 grid grid-cols-2 gap-3 p-3 pb-4">
                    {answers.map((ans: any, i: number) => {
                        const style = styles[i] || SHAPES[i]
                        const isCorrect = ans.isCorrect
                        const isSelected = selectedAnswerId === ans.id
                        return (
                            <div key={ans.id}
                                className={`rounded-2xl flex flex-col items-center justify-center gap-2
                                    min-h-[110px] px-3 py-4 transition-all duration-500
                                    ${isCorrect
                                        ? 'bg-green-500 ring-4 ring-white scale-[1.02] shadow-xl'
                                        : isSelected
                                            ? style.bg + ' opacity-40'
                                            : style.bg + ' opacity-20'}`}>
                                <span className="text-2xl text-white">{style.shape}</span>
                                <span className="text-sm font-semibold text-white text-center leading-tight px-1">
                                    {ans.text}
                                </span>
                                {isCorrect && (
                                    <span className="text-white font-bold text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                        ✓ Correct
                                    </span>
                                )}
                                {isSelected && !isCorrect && (
                                    <span className="text-white font-bold text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                        ✗ Your answer
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Waiting for next */}
                <div className="pb-6 flex justify-center">
                    <div className="flex items-center gap-3 bg-white/10 px-5 py-3 rounded-2xl">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
                        </span>
                        <span className="text-violet-300 text-sm">Waiting for next question...</span>
                    </div>
                </div>
            </div>
        )
    }

    // ── Answered — waiting for teacher to reveal ──
    if (answered) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-violet-600 flex items-center justify-center text-5xl mb-5 shadow-xl">
                    ✓
                </div>
                <h2 className="text-3xl font-extrabold text-white mb-2">Answer Submitted!</h2>
                <p className="text-slate-400 text-sm mb-10">
                    Waiting for teacher to reveal the answer...
                </p>
                <div className="bg-violet-900/60 border border-violet-500/40 rounded-2xl px-6 py-5 mb-6 w-full max-w-xs">
                    <p className="text-violet-200 font-bold text-lg mb-1">✅ Answer Accepted</p>
                    <p className="text-violet-400 text-sm">Your response has been recorded</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
                    </span>
                    <span className="text-violet-400 text-sm">Waiting for teacher to reveal...</span>
                </div>
            </div>
        )
    }

    // ── Active question ──
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">

            <div className="px-4 pt-5 pb-2 flex items-center justify-between">
                <span className="text-white/60 text-xs font-medium">
                    Q {game.currentQuestion + 1}/{game.totalQuestions}
                </span>
                <div className={`text-xl font-extrabold px-3 py-1 rounded-lg
                    ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' :
                        timeLeft <= 10 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/10 text-white'}`}>
                    {timeLeft}s
                </div>
                <span className="text-white/60 text-xs font-medium">
                    {(game.players as any)?.[currentUser?.uid]?.score || 0} pts
                </span>
            </div>

            <div className="h-1.5 bg-white/10 mx-4 rounded-full overflow-hidden mt-1">
                <div
                    className={`h-full rounded-full transition-all duration-500
                        ${timerPct > 50 ? 'bg-green-400' : timerPct > 25 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${timerPct}%` }}
                />
            </div>

            <div className="px-4 pt-4 pb-3 flex items-center justify-center">
                <h2 className="text-lg font-bold text-white text-center leading-snug max-w-sm">
                    {currentQ?.text || ''}
                </h2>
            </div>

            {timeLeft === 0 && (
                <div className="mx-4 mb-2 bg-orange-500/20 text-orange-300 rounded-xl p-2 text-center font-semibold text-sm">
                    ⏰ Time&apos;s up!
                </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-3 p-3 pb-6">
                {answers.map((ans: any, i: number) => {
                    const style = styles[i] || SHAPES[i]
                    return (
                        <button
                            key={ans.id}
                            onClick={() => handleAnswer(ans.id)}
                            disabled={timeLeft === 0}
                            className={`
                                ${style.bg} ${timeLeft > 0 ? style.hover : 'opacity-50'}
                                rounded-2xl flex flex-col items-center justify-center gap-2
                                text-white font-bold shadow-lg
                                transition-all duration-150 active:scale-95
                                min-h-[110px] px-3 py-4 disabled:cursor-not-allowed
                            `}
                        >
                            <span className="text-2xl">{style.shape}</span>
                            <span className="text-sm font-semibold text-center leading-tight px-1">
                                {ans.text}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}