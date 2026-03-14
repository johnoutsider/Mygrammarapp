'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
    onActiveGame, goToQuestion, revealAnswer, showLeaderboard,
    endGame, clearGame, saveGameReport
} from '@/lib/gameService'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

const QUIZ_STYLES = [
    { bg: 'bg-red-500', text: 'text-red-500', light: 'bg-red-50', shape: '▲' },
    { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50', shape: '◆' },
    { bg: 'bg-yellow-400', text: 'text-yellow-500', light: 'bg-yellow-50', shape: '●' },
    { bg: 'bg-green-600', text: 'text-green-600', light: 'bg-green-50', shape: '■' },
]

const TF_STYLES = [
    { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-50', shape: '✓' },
    { bg: 'bg-red-500', text: 'text-red-500', light: 'bg-red-50', shape: '✗' },
]

export default function HostPage() {
    const router = useRouter()
    const [game, setGame] = useState<ActiveGame | null>(null)
    const [quizQuestions, setQuizQuestions] = useState<any[]>([])
    const [timeLeft, setTimeLeft] = useState(0)
    const [answeredCount, setAnsweredCount] = useState(0)
    const [revealCountdown, setRevealCountdown] = useState(3)
    const [leaderboardCountdown, setLeaderboardCountdown] = useState(3)
    const [reportSessionId, setReportSessionId] = useState<string | null>(null)

    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const revealIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const leaderboardIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const revealFiredRef = useRef(false)
    const gameRef = useRef<ActiveGame | null>(null)
    const quizQuestionsRef = useRef<any[]>([])

    useEffect(() => { gameRef.current = game }, [game])
    useEffect(() => { quizQuestionsRef.current = quizQuestions }, [quizQuestions])

    // Auth guard
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(user.uid)
            if (profile?.role !== 'teacher') { router.push('/dashboard'); return }
        })
        return unsub
    }, [router])

    // Listen to RTDB game
    useEffect(() => {
        const unsub = onActiveGame((g) => {
            setGame(g)
            if (!g) { router.push('/teacher/game'); return }
            const total = Object.values(g.players || {}) as GamePlayer[]
            setAnsweredCount(total.filter(p => p.answered).length)
        })
        return unsub
    }, [router])

    // Load quiz questions
    useEffect(() => {
        if (!game?.quizId || quizQuestions.length > 0) return
        const load = async () => {
            const { db } = await import('@/lib/firebase')
            const { doc, getDoc } = await import('firebase/firestore')
            const snap = await getDoc(doc(db, 'quizzes', game.quizId))
            if (snap.exists()) setQuizQuestions(snap.data().questions || [])
        }
        load()
    }, [game?.quizId])

    // ── SYNCED TIMER — auto-reveals when it hits 0 ──
    useEffect(() => {
        if (!game || game.status !== 'question') {
            if (timerRef.current) clearInterval(timerRef.current)
            return
        }

        const currentQ = quizQuestions[game.currentQuestion]
        const timeLimitSec = currentQ?.timeLimit || 20
        const startedAt = game.questionStartedAt || Date.now()
        revealFiredRef.current = false

        const tick = () => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            const remaining = Math.max(0, timeLimitSec - elapsed)
            setTimeLeft(remaining)
            if (remaining === 0) {
                if (timerRef.current) clearInterval(timerRef.current)
                if (!revealFiredRef.current) {
                    revealFiredRef.current = true
                    revealAnswer()
                }
            }
        }

        tick()
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(tick, 500)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [game?.currentQuestion, game?.status, game?.questionStartedAt, quizQuestions])

    // ── AUTO-FLOW: revealing → leaderboard after 3s ──
    useEffect(() => {
        if (!game || game.status !== 'revealing') {
            if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
            return
        }

        const startedAt = (game as any).revealedAt || Date.now()
        const DURATION = 3000

        const tick = () => {
            const elapsed = Date.now() - startedAt
            const remaining = Math.max(0, Math.ceil((DURATION - elapsed) / 1000))
            setRevealCountdown(remaining)
            if (elapsed >= DURATION) {
                if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
                showLeaderboard()
            }
        }

        tick()
        if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
        revealIntervalRef.current = setInterval(tick, 200)
        return () => { if (revealIntervalRef.current) clearInterval(revealIntervalRef.current) }
    }, [game?.status, game?.currentQuestion])

    // ── AUTO-FLOW: leaderboard → next question after 3s ──
    useEffect(() => {
        if (!game || game.status !== 'leaderboard') {
            if (leaderboardIntervalRef.current) clearInterval(leaderboardIntervalRef.current)
            return
        }

        const startedAt = Date.now()
        const DURATION = 3000
        let fired = false

        const tick = async () => {
            const elapsed = Date.now() - startedAt
            const remaining = Math.max(0, Math.ceil((DURATION - elapsed) / 1000))
            setLeaderboardCountdown(remaining)
            if (elapsed >= DURATION && !fired) {
                fired = true
                if (leaderboardIntervalRef.current) clearInterval(leaderboardIntervalRef.current)
                const g = gameRef.current
                if (!g) return
                const isLast = g.currentQuestion >= g.totalQuestions - 1
                if (isLast) {
                    const sessionId = await saveGameReport(quizQuestionsRef.current)
                    setReportSessionId(sessionId)
                    endGame()
                } else {
                    goToQuestion(g.currentQuestion + 1)
                }
            }
        }

        tick()
        if (leaderboardIntervalRef.current) clearInterval(leaderboardIntervalRef.current)
        leaderboardIntervalRef.current = setInterval(tick, 200)
        return () => { if (leaderboardIntervalRef.current) clearInterval(leaderboardIntervalRef.current) }
    }, [game?.status, game?.currentQuestion])

    const handleStart = () => goToQuestion(0)

    const handleEndEarly = async () => {
        if (!confirm('End the game now?')) return
        if (timerRef.current) clearInterval(timerRef.current)
        if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
        if (leaderboardIntervalRef.current) clearInterval(leaderboardIntervalRef.current)
        await endGame()
        await clearGame()
        router.push('/teacher/game')
    }

    if (!game) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
            </div>
        )
    }

    const players = Object.entries(game.players || {}) as [string, GamePlayer][]
    const playerCount = players.length
    const currentQ = quizQuestions[game.currentQuestion]
    const timeLimitSec = currentQ?.timeLimit || 20
    const timerPct = (timeLeft / timeLimitSec) * 100
    const styles = currentQ?.type === 'true_or_false' ? TF_STYLES : QUIZ_STYLES
    const answers = currentQ?.answers || []

    // ── LOBBY ──
    if (game.status === 'lobby') {
        const sorted = [...players].sort((a, b) => a[1].joinedAt - b[1].joinedAt)
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <p className="text-violet-300 text-sm font-semibold uppercase tracking-widest mb-2">
                        Waiting Room
                    </p>
                    <h1 className="text-5xl font-extrabold text-white mb-1 text-center">
                        {game.quizTitle}
                    </h1>
                    <p className="text-violet-300 mb-10">{game.totalQuestions} questions</p>
                    <div className="w-full max-w-3xl mb-10">
                        {playerCount === 0 ? (
                            <p className="text-center text-violet-400 animate-pulse">
                                Waiting for students to join...
                            </p>
                        ) : (
                            <>
                                <p className="text-center text-violet-300 text-sm mb-4">
                                    👥 {playerCount} player{playerCount !== 1 ? 's' : ''} joined
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {sorted.map(([uid, p]) => (
                                        <span key={uid}
                                            className="bg-white/15 text-white font-semibold px-4 py-2 rounded-full text-sm border border-white/20">
                                            {p.name}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={handleStart}
                        disabled={playerCount === 0}
                        className={`px-12 py-4 rounded-2xl font-extrabold text-xl shadow-xl transition-all
                            ${playerCount > 0
                                ? 'bg-white text-violet-700 hover:scale-105 hover:shadow-2xl'
                                : 'bg-white/20 text-white/40 cursor-not-allowed'}`}
                    >
                        {playerCount === 0 ? 'Waiting for players...' : `▶ Start Game (${playerCount} players)`}
                    </button>
                </div>
            </div>
        )
    }

    // ── LEADERBOARD ──
    if (game.status === 'leaderboard') {
        const sorted = [...players]
            .map(([uid, p]) => ({ uid, ...p }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
        const isLast = game.currentQuestion >= game.totalQuestions - 1
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-8">
                <h2 className="text-4xl font-extrabold text-white mb-1">🏆 Leaderboard</h2>
                <p className="text-violet-300 text-sm mb-4">
                    After Q{game.currentQuestion + 1} · {isLast ? 'Saving results...' : `Next question in ${leaderboardCountdown}s`}
                </p>
                <div className="mb-6 w-14 h-14 rounded-full border-4 border-violet-400 flex items-center justify-center">
                    <span className="text-white font-extrabold text-xl">{leaderboardCountdown}</span>
                </div>
                <div className="w-full max-w-md space-y-3">
                    {sorted.map((p, i) => (
                        <div key={p.uid}
                            className={`flex items-center justify-between px-6 py-4 rounded-2xl font-bold text-lg
                                ${i === 0 ? 'bg-yellow-400 text-yellow-900 scale-105 shadow-xl' :
                                    i === 1 ? 'bg-slate-300 text-slate-800' :
                                        i === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-white'}`}>
                            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}</span>
                            <span>{p.score} pts</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // ── ENDED ──
    if (game.status === 'ended') {
        const sorted = [...players]
            .map(([uid, p]) => ({ uid, ...p }))
            .sort((a, b) => b.score - a.score)
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-8">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-4xl font-extrabold text-white mb-8">Final Results</h2>
                <div className="w-full max-w-md space-y-3 mb-10">
                    {sorted.map((p, i) => (
                        <div key={p.uid}
                            className={`flex items-center justify-between px-6 py-4 rounded-2xl font-bold text-lg
                                ${i === 0 ? 'bg-yellow-400 text-yellow-900 scale-105 shadow-xl' :
                                    i === 1 ? 'bg-slate-300 text-slate-800' :
                                        i === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-white'}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                                </span>
                                <span>{p.name}</span>
                            </div>
                            <span>{p.score} pts</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    {reportSessionId && (
                        <button
                            onClick={() => router.push(`/teacher/game/reports/${reportSessionId}`)}
                            className="bg-violet-500 hover:bg-violet-400 text-white font-bold px-8 py-3 rounded-2xl transition-transform hover:scale-105 shadow-lg"
                        >
                            📊 View Report
                        </button>
                    )}
                    <button
                        onClick={async () => { await clearGame(); router.push('/teacher/game') }}
                        className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-2xl hover:scale-105 transition-transform shadow-lg"
                    >
                        Done
                    </button>
                </div>
            </div>
        )
    }

    // ── REVEALING ──
    if (game.status === 'revealing') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col">
                <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                    <span className="text-slate-300 font-semibold text-sm">
                        Q {game.currentQuestion + 1} / {game.totalQuestions}
                    </span>
                    <span className="text-white font-bold">{game.quizTitle}</span>
                    <button onClick={handleEndEarly} className="text-red-400 hover:text-red-300 text-sm font-semibold">
                        End Game
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                    <div className="mb-4 flex items-center gap-3 bg-white/10 px-5 py-2 rounded-full">
                        <span className="text-white/60 text-sm">Leaderboard in</span>
                        <span className="text-white font-extrabold text-xl w-6 text-center">{revealCountdown}</span>
                        <span className="text-white/60 text-sm">seconds</span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-extrabold text-white text-center leading-tight mb-8 max-w-3xl">
                        {currentQ?.text || ''}
                    </h2>

                    <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
                        {answers.map((ans: any, i: number) => {
                            const s = styles[i] || QUIZ_STYLES[i]
                            const isCorrect = ans.isCorrect
                            return (
                                <div key={ans.id}
                                    className={`rounded-2xl px-5 py-5 flex items-center gap-4 transition-all duration-500
                                        ${isCorrect
                                            ? 'bg-green-500 ring-4 ring-white scale-[1.02] shadow-xl'
                                            : s.bg + ' opacity-30'}`}>
                                    <span className="text-white text-3xl font-bold">{s.shape}</span>
                                    <span className="text-white font-bold text-lg leading-snug flex-1">{ans.text}</span>
                                    {isCorrect && <span className="text-white text-2xl font-extrabold ml-auto">✓</span>}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="bg-slate-800 border-t border-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            {players.map(([uid, p]) => (
                                <div key={uid}
                                    className={`w-3 h-3 rounded-full ${p.answered ? 'bg-green-400' : 'bg-slate-600'}`}
                                    title={p.name}
                                />
                            ))}
                        </div>
                        <span className="text-slate-300 text-sm font-medium">
                            {answeredCount} / {playerCount} answered
                        </span>
                    </div>
                    <span className="text-violet-300 text-sm font-semibold animate-pulse">
                        ⏳ Leaderboard in {revealCountdown}s...
                    </span>
                </div>
            </div>
        )
    }

    // ── ACTIVE QUESTION ──
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">

            <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                <span className="text-slate-300 font-semibold text-sm">
                    Q {game.currentQuestion + 1} / {game.totalQuestions}
                </span>
                <span className="text-white font-bold">{game.quizTitle}</span>
                <button onClick={handleEndEarly} className="text-red-400 hover:text-red-300 text-sm font-semibold">
                    End Game
                </button>
            </div>

            <div className="h-2 bg-slate-700">
                <div
                    className={`h-full transition-all duration-500 ${timerPct > 50 ? 'bg-green-400' :
                        timerPct > 25 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${timerPct}%` }}
                />
            </div>

            <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-center px-8 py-10 flex-1">
                    <div className="max-w-4xl w-full text-center">
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full font-extrabold text-2xl mb-6
                            ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' :
                                timeLeft <= 10 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/10 text-white'}`}>
                            {timeLeft}
                        </div>

                        {currentQ ? (
                            <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
                                {currentQ.text}
                            </h2>
                        ) : (
                            <div className="animate-pulse h-12 bg-white/10 rounded-xl w-3/4 mx-auto" />
                        )}

                        {currentQ?.topicName && (
                            <span className="inline-block bg-white/10 text-violet-300 text-sm px-3 py-1 rounded-full mt-2">
                                {currentQ.topicName}{currentQ.subtopic ? ` · ${currentQ.subtopic}` : ''}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 px-6 pb-4">
                    {answers.map((ans: any, i: number) => {
                        const s = styles[i] || QUIZ_STYLES[i]
                        return (
                            <div key={ans.id}
                                className={`${s.bg} rounded-2xl px-5 py-4 flex items-center gap-4`}>
                                <span className="text-white text-3xl font-bold">{s.shape}</span>
                                <span className="text-white font-bold text-lg leading-snug">{ans.text}</span>
                            </div>
                        )
                    })}
                </div>

                <div className="bg-slate-800 border-t border-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            {players.map(([uid, p]) => (
                                <div key={uid}
                                    className={`w-3 h-3 rounded-full transition-colors ${p.answered ? 'bg-green-400' : 'bg-slate-600'}`}
                                    title={p.name}
                                />
                            ))}
                        </div>
                        <span className="text-slate-300 text-sm font-medium">
                            {answeredCount} / {playerCount} answered
                        </span>
                    </div>
                    <span className="text-slate-500 text-sm">Auto-reveals when timer ends</span>
                </div>
            </div>
        </div>
    )
}