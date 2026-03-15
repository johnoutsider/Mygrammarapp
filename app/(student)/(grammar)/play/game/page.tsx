'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { onActiveGame, submitAnswer, joinGame } from '@/lib/gameService'
import type { ActiveGame } from '@/lib/gameService'

// ── Components ─────────────────────────────────────────────────────────────────
import StudentLobby from '@/components/student/screens/StudentLobby'
import StudentQuestion from '@/components/student/screens/StudentQuestion'
import StudentAnswered from '@/components/student/screens/StudentAnswered'
import StudentRevealing from '@/components/student/screens/StudentRevealing'
import StudentLeaderboard from '@/components/student/screens/StudentLeaderboard'
import StudentGameEnded from '@/components/student/screens/StudentGameEnded'
import StudentGetReady from '@/components/student/screens/StudentGetReady'

export default function PlayGame() {
    const router = useRouter()

    // ── State ──────────────────────────────────────────────────────────────────
    const [game, setGame] = useState<ActiveGame | null>(null)
    const [endedGame, setEndedGame] = useState<ActiveGame | null>(null)
    const [noGame, setNoGame] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [answered, setAnswered] = useState(false)
    const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null)
    const [pointsEarned, setPointsEarned] = useState<number | null>(null)
    const [timeLeft, setTimeLeft] = useState<number>(20)
    const [quizQuestions, setQuizQuestions] = useState<any[]>([])
    const [questionsLoaded, setQuestionsLoaded] = useState(false)

    // ── Refs ───────────────────────────────────────────────────────────────────
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const prevQuestionRef = useRef<number>(-1)

    // ── Auth ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) { router.push('/'); return }
            setCurrentUser(user)
        })
        return unsub
    }, [router])
    useEffect(() => {
        if (!currentUser || !game || game.status !== 'lobby') return
        const name = currentUser.displayName
            || currentUser.email?.split('@')[0]
            || 'Student'
        joinGame(currentUser.uid, name)
    }, [game?.status, currentUser?.uid])

    // ── Load quiz questions ────────────────────────────────────────────────────
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

    // ── Listen to game state ───────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onActiveGame((g) => {
            if (g?.status === 'ended') {
                setEndedGame(g)       // save snapshot before Firestore deletes it
            }
            if (!g) {
                setNoGame(true)       // no active game — stop spinning
            }
            setGame(g)
            if (!g || g.status === 'ended') return
            if (g.status === 'question' && g.currentQuestion !== prevQuestionRef.current) {
                prevQuestionRef.current = g.currentQuestion
                setAnswered(false)
                setSelectedAnswerId(null)
                setPointsEarned(null)
            }
        })
        return unsub
    }, [router])

    // ── Synced timer ───────────────────────────────────────────────────────────
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

    // ── Answer handler ─────────────────────────────────────────────────────────
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

    // ── Guard: show Game Over screen (even after Firestore doc is deleted) ─────
    if (endedGame && currentUser) {
        return <StudentGameEnded game={endedGame} currentUserId={currentUser.uid} />
    }

    // ── Guard: no active game → go back to dashboard ──────────────────────────
    if (noGame) {
        router.push('/dashboard')
        return null
    }

    // ── Guard: still loading auth or game ─────────────────────────────────────
    if (!game || !currentUser) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
            </div>
        )
    }

    const currentQ = quizQuestions[game.currentQuestion]
    const timeLimitSec = currentQ?.timeLimit || 20

    // ── Render correct screen based on game status ─────────────────────────────
    if (game.status === 'lobby') {
        if (game.participation === 'team') {
            return <StudentGetReady game={game} currentUserId={currentUser.uid} />
        }
        return <StudentLobby />
    }

    if (game.status === 'leaderboard') {
        return <StudentLeaderboard game={game} currentUserId={currentUser.uid} />
    }

    if (game.status === 'ended') {
        return <StudentGameEnded game={game} currentUserId={currentUser.uid} />
    }

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

    if (game.status === 'revealing') {
        return (
            <StudentRevealing
                game={game}
                currentQ={currentQ}
                currentUserId={currentUser.uid}
                selectedAnswerId={selectedAnswerId}
                pointsEarned={pointsEarned}
                answered={answered}
            />
        )
    }

    if (answered) {
        return <StudentAnswered />
    }

    return (
        <StudentQuestion
            game={game}
            currentQ={currentQ}
            timeLeft={timeLeft}
            timeLimitSec={timeLimitSec}
            currentUserId={currentUser.uid}
            onAnswer={handleAnswer}
        />
    )
}
