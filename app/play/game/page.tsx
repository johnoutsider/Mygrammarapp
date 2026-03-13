'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { onActiveGame, submitAnswer } from '@/lib/gameService'
import type { ActiveGame } from '@/lib/gameService'

const SHAPES = [
    { bg: 'bg-red-500', hover: 'hover:bg-red-400', shape: '▲', label: 'A' },
    { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', shape: '◆', label: 'B' },
    { bg: 'bg-yellow-400', hover: 'hover:bg-yellow-300', shape: '●', label: 'C' },
    { bg: 'bg-green-600', hover: 'hover:bg-green-500', shape: '■', label: 'D' },
]

export default function PlayGame() {
    const router = useRouter()
    const [game, setGame] = useState<ActiveGame | null>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [answered, setAnswered] = useState(false)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [pointsEarned, setPointsEarned] = useState<number | null>(null)
    const [timeLeft, setTimeLeft] = useState<number>(20)
    const [quizQuestions, setQuizQuestions] = useState<any[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const questionStartRef = useRef<number>(Date.now())

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) { router.push('/'); return }
            setCurrentUser(user)
        })
        return unsub
    }, [router])

    // Load quiz questions from Firestore
    useEffect(() => {
        if (!game?.quizId) return
        const loadQuiz = async () => {
            const { db } = await import('@/lib/firebase')
            const { doc, getDoc } = await import('firebase/firestore')
            const snap = await getDoc(doc(db, 'quizzes', game.quizId))
            if (snap.exists()) {
                setQuizQuestions(snap.data().questions || [])
            }
        }
        loadQuiz()
    }, [game?.quizId])

    // Listen to game state
    useEffect(() => {
        const unsub = onActiveGame((g) => {
            setGame(g)

            if (!g || g.status === 'ended') {
                router.push('/dashboard')
                return
            }

            // New question started — reset answered state
            if (g.status === 'question') {
                setAnswered(false)
                setSelectedId(null)
                setPointsEarned(null)
                questionStartRef.current = g.questionStartedAt || Date.now()
            }
        })
        return unsub
    }, [router])

    // Countdown timer
    useEffect(() => {
        if (!game || game.status !== 'question' || answered) return

        const currentQ = quizQuestions[game.currentQuestion]
        const timeLimitSec = currentQ?.timeLimit || 20
        setTimeLeft(timeLimitSec)

        if (timerRef.current) clearInterval(timerRef.current)

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [game?.currentQuestion, game?.status, answered])

    const handleAnswer = async (answerId: number) => {
        if (answered || !currentUser || !game || game.status !== 'question') return

        if (timerRef.current) clearInterval(timerRef.current)

        const currentQ = quizQuestions[game.currentQuestion]
        const timeLimitMs = (currentQ?.timeLimit || 20) * 1000
        const timeMs = Date.now() - questionStartRef.current
        const isCorrect = currentQ?.answers?.find((a: any) => a.id === answerId)?.isCorrect || false

        setAnswered(true)
        setSelectedId(answerId)

        const pts = await submitAnswer(
            currentUser.uid,
            game.currentQuestion,
            answerId,
            isCorrect,
            timeMs,
            timeLimitMs
        )
        setPointsEarned(pts)
    }

    // ── Waiting for game to start ──
    if (!game || game.status === 'lobby') {
        return (
            <div className="min-h-screen bg-indigo-900 flex items-center justify-center">
                <p className="text-white text-lg">Waiting for game to start...</p>
            </div>
        )
    }

    // ── Leaderboard screen ──
    if (game.status === 'leaderboard') {
        const sorted = Object.entries(game.players || {})
            .map(([uid, p]: any) => ({ uid, ...p }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)

        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6">
                <h2 className="text-3xl font-extrabold text-white mb-8">🏆 Leaderboard</h2>
                <div className="w-full max-w-sm space-y-3">
                    {sorted.map((p, i) => (
                        <div key={p.uid}
                            className={`flex items-center justify-between px-5 py-3 rounded-xl font-bold text-white
                            ${i === 0 ? 'bg-yellow-500 text-yellow-900 text-lg' :
                                    i === 1 ? 'bg-slate-400' :
                                        i === 2 ? 'bg-amber-700' : 'bg-white/10'}`}>
                            <span>{i + 1}. {p.name}</span>
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
            .sort((a, b) => b.score - a.score)

        const myRank = sorted.findIndex(p => p.uid === currentUser?.uid) + 1
        const myScore = game.players?.[currentUser?.uid]?.score || 0

        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-extrabold mb-2">Game Over!</h2>
                <p className="text-violet-300 mb-6">You finished #{myRank} with {myScore} points</p>
                <div className="w-full max-w-sm space-y-3 mb-8">
                    {sorted.slice(0, 5).map((p, i) => (
                        <div key={p.uid}
                            className={`flex items-center justify-between px-5 py-3 rounded-xl font-bold
                            ${p.uid === currentUser?.uid ? 'bg-violet-500 ring-2 ring-white' :
                                    i === 0 ? 'bg-yellow-500 text-yellow-900' : 'bg-white/10'}`}>
                            <span>{i + 1}. {p.name}</span>
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

    // ── Active question — shapes only ──
    const currentQ = quizQuestions[game.currentQuestion]
    const timeLimitSec = currentQ?.timeLimit || 20
    const timerPct = (timeLeft / timeLimitSec) * 100
    const answers = currentQ?.type === 'true_or_false'
        ? [{ id: 1, isCorrect: false }, { id: 2, isCorrect: false }]
        : [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">

            {/* Top bar */}
            <div className="px-4 pt-6 pb-2 flex items-center justify-between">
                <span className="text-white/60 text-sm font-medium">
                    Q {game.currentQuestion + 1} / {game.totalQuestions}
                </span>
                <div className={`text-2xl font-extrabold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {timeLeft}s
                </div>
                <span className="text-white/60 text-sm font-medium">
                    {game.players?.[currentUser?.uid]?.score || 0} pts
                </span>
            </div>

            {/* Timer bar */}
            <div className="h-2 bg-white/10 mx-4 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${timerPct > 50 ? 'bg-green-400' :
                            timerPct > 25 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                    style={{ width: `${timerPct}%` }}
                />
            </div>

            {/* Answer result feedback */}
            {answered && (
                <div className={`mx-4 mt-4 rounded-xl p-4 text-center font-bold text-lg
                    ${pointsEarned && pointsEarned > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {pointsEarned && pointsEarned > 0
                        ? `✅ +${pointsEarned} points!`
                        : '❌ Wrong answer'}
                </div>
            )}

            {/* Shapes grid */}
            <div className="flex-1 grid grid-cols-2 gap-4 p-4 mt-2">
                {answers.map((ans, i) => {
                    const style = SHAPES[i]
                    const isSelected = selectedId === ans.id
                    const dimmed = answered && !isSelected

                    return (
                        <button
                            key={ans.id}
                            onClick={() => handleAnswer(ans.id)}
                            disabled={answered || timeLeft === 0}
                            className={`
                                ${style.bg} ${!answered ? style.hover : ''}
                                rounded-2xl flex flex-col items-center justify-center
                                text-white font-bold shadow-lg
                                transition-all duration-150
                                ${isSelected ? 'ring-4 ring-white scale-95' : ''}
                                ${dimmed ? 'opacity-30' : ''}
                                ${answered ? 'cursor-default' : 'active:scale-95'}
                                min-h-[140px]
                            `}
                        >
                            <span className="text-5xl mb-2">{style.shape}</span>
                        </button>
                    )
                })}
            </div>

            {/* Time up message */}
            {timeLeft === 0 && !answered && (
                <div className="mx-4 mb-4 bg-orange-500/20 text-orange-300 rounded-xl p-3 text-center font-semibold">
                    ⏰ Time&apos;s up!
                </div>
            )}
        </div>
    )
}