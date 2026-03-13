import { rtdb } from './firebase'
import { ref, set, update, onValue, off, get, remove, serverTimestamp } from 'firebase/database'

export type GameStatus = 'lobby' | 'question' | 'leaderboard' | 'ended'

export interface GamePlayer {
    name: string
    score: number
    answered: boolean
    joinedAt: number
}

export interface ActiveGame {
    sessionId: string
    quizId: string
    quizTitle: string
    hostId: string
    status: GameStatus
    currentQuestion: number
    totalQuestions: number
    questionStartedAt: number | null
    players: Record<string, GamePlayer>
}

// Teacher: launch a new game
export async function createGame(quizId: string, quizTitle: string, totalQuestions: number, hostId: string) {
    const sessionId = Math.random().toString(36).slice(2, 10)
    await set(ref(rtdb, 'activeGame'), {
        sessionId,
        quizId,
        quizTitle,
        hostId,
        status: 'lobby',
        currentQuestion: 0,
        totalQuestions,
        questionStartedAt: null,
        players: {}
    })
    return sessionId
}

// Student: join the active game
export async function joinGame(uid: string, name: string) {
    await update(ref(rtdb, `activeGame/players/${uid}`), {
        name,
        score: 0,
        answered: false,
        joinedAt: Date.now()
    })
}

// Teacher: start game / move to next question
export async function goToQuestion(questionIndex: number) {
    // Reset all players' answered flag
    const snap = await get(ref(rtdb, 'activeGame/players'))
    const players = snap.val() || {}
    const resetPlayers: Record<string, any> = {}
    Object.keys(players).forEach(uid => {
        resetPlayers[`activeGame/players/${uid}/answered`] = false
    })
    await update(ref(rtdb), {
        ...resetPlayers,
        'activeGame/status': 'question',
        'activeGame/currentQuestion': questionIndex,
        'activeGame/questionStartedAt': Date.now()
    })
}

// Student: submit an answer
export async function submitAnswer(
    uid: string,
    questionIndex: number,
    answerId: number,
    correct: boolean,
    timeMs: number,
    timeLimitMs: number
) {
    const points = correct ? Math.round(1000 * (1 - (timeMs / timeLimitMs) * 0.5)) : 0

    // Get current score first
    const snap = await get(ref(rtdb, `activeGame/players/${uid}/score`))
    const currentScore = snap.val() || 0

    await update(ref(rtdb), {
        [`activeGame/players/${uid}/answered`]: true,
        [`activeGame/players/${uid}/score`]: currentScore + points,
        [`activeGame/answers/${uid}`]: {
            questionIndex,
            answerId,
            correct,
            timeMs,
            points
        }
    })

    return points
}
// Teacher: show leaderboard between questions
export async function showLeaderboard() {
    await update(ref(rtdb, 'activeGame'), { status: 'leaderboard' })
}

// Teacher: end game
export async function endGame() {
    await update(ref(rtdb, 'activeGame'), { status: 'ended' })
}

// Teacher: fully clear game (after session is over)
export async function clearGame() {
    await remove(ref(rtdb, 'activeGame'))
    await remove(ref(rtdb, 'activeGame/answers'))
}

// Listen to the entire active game
export function onActiveGame(callback: (game: ActiveGame | null) => void) {
    const r = ref(rtdb, 'activeGame')
    onValue(r, snap => callback(snap.exists() ? snap.val() : null))
    return () => off(r)
}

// Listen to players only (for lobby)
export function onPlayers(callback: (players: Record<string, GamePlayer>) => void) {
    const r = ref(rtdb, 'activeGame/players')
    onValue(r, snap => callback(snap.val() || {}))
    return () => off(r)
}