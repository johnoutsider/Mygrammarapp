'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { rtdb } from '@/lib/firebase'
import { ref, onValue, off } from 'firebase/database'
import { onAuthStateChanged } from 'firebase/auth'
import {
    onActiveGame, goToQuestion, revealAnswer, showLeaderboard,
    endGame, clearGame, saveGameReport
} from '@/lib/gameService'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'
import {
    startBackgroundMusic, stopBackgroundMusic,
    playCorrectSound, setSoundMuted, cleanupSounds, unlockAudio
} from '@/lib/sounds'

// ── Components ─────────────────────────────────────────────────────────────────
import GameLobby from '@/components/game/GameLobby'
import ActiveQuestion from '@/components/game/ActiveQuestion'
import RevealScreen from '@/components/game/RevealScreen'
import GameLeaderboard from '@/components/game/GameLeaderboard'
import GameEnded from '@/components/game/GameEnded'

export default function HostPage() {
    const router = useRouter()

    // ── State ──────────────────────────────────────────────────────────────────
    const [game, setGame] = useState<ActiveGame | null>(null)
    const [quizQuestions, setQuizQuestions] = useState<any[]>([])
    const [timeLeft, setTimeLeft] = useState(0)
    const [answeredCount, setAnsweredCount] = useState(0)
    const [revealCountdown, setRevealCountdown] = useState(5)
    const [leaderboardCountdown, setLeaderboardCountdown] = useState(3)
    const [reportSessionId, setReportSessionId] = useState<string | null>(null)
    const [muted, setMuted] = useState(false)
    const [answerVotes, setAnswerVotes] = useState<Record<number, number>>({})

    // ── Refs ───────────────────────────────────────────────────────────────────
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const revealIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const leaderboardIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const revealFiredRef = useRef(false)
    const correctSoundFiredRef = useRef(false)
    const gameRef = useRef<ActiveGame | null>(null)
    const quizQuestionsRef = useRef<any[]>([])
    const prevStatusRef = useRef<string | null>(null)

    useEffect(() => { gameRef.current = game }, [game])
    useEffect(() => { quizQuestionsRef.current = quizQuestions }, [quizQuestions])
    useEffect(() => { return () => { cleanupSounds() } }, [])

    // ── Auth guard ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(user.uid)
            if (profile?.role !== 'teacher') { router.push('/dashboard'); return }
        })
        return unsub
    }, [router])

    // ── Listen to game ─────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onActiveGame((g) => {
            setGame(g)
            if (!g) { router.push('/teacher/game'); return }
            const total = Object.values(g.players || {}) as GamePlayer[]
            setAnsweredCount(total.filter(p => p.answered).length)
        })
        return unsub
    }, [router])

    // ── Load quiz questions ────────────────────────────────────────────────────
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

    // ── Listen to answer votes ─────────────────────────────────────────────────
    useEffect(() => {
        if (!game || game.status !== 'revealing') { setAnswerVotes({}); return }
        const questionIndex = game.currentQuestion
        const answersRef = ref(rtdb, 'activeGame/answers')
        onValue(answersRef, (snap) => {
            const raw = snap.val() || {}
            const counts: Record<number, number> = {}
            Object.values(raw).forEach((playerAnswers: any) => {
                const entry = playerAnswers?.[questionIndex]
                if (entry?.answerId !== undefined) {
                    counts[entry.answerId] = (counts[entry.answerId] || 0) + 1
                }
            })
            setAnswerVotes(counts)
        })
        return () => off(answersRef)
    }, [game?.status, game?.currentQuestion])

    // ── Sound control ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!game) return
        const prev = prevStatusRef.current
        const curr = game.status
        if (curr === 'question' && prev !== 'question') {
            correctSoundFiredRef.current = false
            startBackgroundMusic()
        }
        if (curr === 'revealing' && prev !== 'revealing') {
            stopBackgroundMusic()
            if (!correctSoundFiredRef.current) {
                correctSoundFiredRef.current = true
                playCorrectSound()
            }
        }
        if (['leaderboard', 'ended', 'lobby'].includes(curr)) stopBackgroundMusic()
        prevStatusRef.current = curr
    }, [game?.status, game?.currentQuestion])

    // ── Synced timer ───────────────────────────────────────────────────────────
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
                if (!revealFiredRef.current) { revealFiredRef.current = true; revealAnswer() }
            }
        }
        tick()
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(tick, 500)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [game?.currentQuestion, game?.status, game?.questionStartedAt, quizQuestions])

    // ── Auto-advance when ALL players answered ───────────────────────────────────
    useEffect(() => {
        if (!game || game.status !== 'question') return
        const playerCount = Object.keys(game.players || {}).length
        if (playerCount === 0) return
        if (answeredCount >= playerCount && !revealFiredRef.current) {
            revealFiredRef.current = true
            if (timerRef.current) clearInterval(timerRef.current)
            revealAnswer()
        }
    }, [answeredCount, game?.status, game?.currentQuestion])



    // ── Auto-flow: revealing → leaderboard ────────────────────────────────────
    useEffect(() => {
        if (!game || game.status !== 'revealing') {
            if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
            return
        }
        const startedAt = (game as any).revealedAt || Date.now()
        const DURATION = 5000
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

    // ── Auto-flow: leaderboard → next question ────────────────────────────────
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

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleStart = () => { unlockAudio(); goToQuestion(0) }

    const handleMuteToggle = () => {
        const newMuted = !muted
        setMuted(newMuted)
        setSoundMuted(newMuted)
    }

    const handleEndEarly = async () => {
        if (!confirm('End the game now?')) return
        if (timerRef.current) clearInterval(timerRef.current)
        if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
        if (leaderboardIntervalRef.current) clearInterval(leaderboardIntervalRef.current)
        stopBackgroundMusic()
        await endGame()
        await clearGame()
        router.push('/teacher/game')
    }

    // ── Loading ────────────────────────────────────────────────────────────────
    if (!game) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
            </div>
        )
    }

    const players = Object.entries(game.players || {}) as [string, GamePlayer][]
    const currentQ = quizQuestions[game.currentQuestion]
    const timeLimitSec = currentQ?.timeLimit || 20

    // ── Render correct screen based on game status ─────────────────────────────
    if (game.status === 'lobby') {
        return <GameLobby game={game} players={players} onStart={handleStart} />
    }

    if (game.status === 'leaderboard') {
        return <GameLeaderboard game={game} players={players} leaderboardCountdown={leaderboardCountdown} />
    }

    if (game.status === 'ended') {
        return <GameEnded players={players} reportSessionId={reportSessionId} game={game} />
    }
    if (game.status === 'revealing') {
        return (
            <RevealScreen
                game={game}
                currentQ={currentQ}
                players={players}
                answeredCount={answeredCount}
                answerVotes={answerVotes}
                revealCountdown={revealCountdown}
                muted={muted}
                onMuteToggle={handleMuteToggle}
                onEndEarly={handleEndEarly}
            />
        )
    }

    return (
        <ActiveQuestion
            game={game}
            currentQ={currentQ}
            timeLeft={timeLeft}
            timeLimitSec={timeLimitSec}
            players={players}
            answeredCount={answeredCount}
            muted={muted}
            onMuteToggle={handleMuteToggle}
            onEndEarly={handleEndEarly}
        />
    )
}
