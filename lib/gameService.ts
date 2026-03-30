import { rtdb } from './firebase'
import { ref, set, update, onValue, off, get, remove } from 'firebase/database'

export type GameStatus = 'lobby' | 'question' | 'revealing' | 'leaderboard' | 'ended'
export type Participation = 'solo' | 'team'

export interface GamePlayer {
    name: string
    score: number
    answered: boolean
    joinedAt: number
}

export interface GameTeam {
    name: string
    color: string
    score: number
    members: Record<string, string> // uid → name
}

export interface ActiveGame {
    sessionId: string
    quizId: string
    quizTitle: string
    hostId: string
    classIds: string[]          // teacher's class IDs — only students in these classes can join
    status: GameStatus
    participation: Participation
    currentQuestion: number
    totalQuestions: number
    questionStartedAt: number | null
    revealedAt: number | null
    players: Record<string, GamePlayer>
    teams: Record<string, GameTeam>
}

export interface GameReport {
    sessionId: string
    quizId: string
    quizTitle: string
    hostId: string
    playedAt: number
    totalQuestions: number
    participation: Participation
    playerIds: string[]
    players: Record<string, { name: string; score: number; rank: number }>
    teams: Record<string, { name: string; score: number; rank: number }>
    questions: Array<{ text: string; answers: Array<{ id: number; text: string; isCorrect: boolean }> }>
    answers: Record<string, Record<number, { answerId: number; correct: boolean; points: number }>>
}

// ── Teacher: launch a new game ─────────────────────────────────────────────────
export async function createGame(
    quizId: string,
    quizTitle: string,
    totalQuestions: number,
    hostId: string,
    participation: Participation = 'solo',
    classIds: string[] = []
) {
    const sessionId = Math.random().toString(36).slice(2, 10)
    await set(ref(rtdb, 'activeGame'), {
        sessionId,
        quizId,
        quizTitle,
        hostId,
        classIds,
        participation,
        status: 'lobby',
        currentQuestion: 0,
        totalQuestions,
        questionStartedAt: null,
        revealedAt: null,
        players: {},
        teams: {}
    })
    return sessionId
}

// ── Student: join the active game ──────────────────────────────────────────────
export async function joinGame(uid: string, name: string) {
    await update(ref(rtdb, `activeGame/players/${uid}`), {
        name,
        score: 0,
        answered: false,
        joinedAt: Date.now()
    })
}

// ── Teacher: move to a question ────────────────────────────────────────────────
export async function goToQuestion(questionIndex: number) {
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

// ── Student: submit an answer ──────────────────────────────────────────────────
export async function submitAnswer(
    uid: string,
    questionIndex: number,
    answerId: number,
    correct: boolean,
    timeMs: number,
    timeLimitMs: number
) {
    const points = correct
        ? Math.round(1000 * (1 - (timeMs / timeLimitMs) * 0.5))
        : 0

    // Update player score
    const playerSnap = await get(ref(rtdb, `activeGame/players/${uid}/score`))
    const currentScore = playerSnap.val() || 0

    const updates: Record<string, any> = {
        [`activeGame/players/${uid}/answered`]: true,
        [`activeGame/players/${uid}/score`]: currentScore + points,
        [`activeGame/answers/${uid}/${questionIndex}`]: { answerId, correct, points }
    }

    // If team mode — also update team score
    if (points > 0) {
        const teamsSnap = await get(ref(rtdb, 'activeGame/teams'))
        if (teamsSnap.exists()) {
            const teams = teamsSnap.val()
            const myTeamEntry = Object.entries(teams).find(
                ([_, t]: any) => t.members && t.members[uid] !== undefined
            )
            if (myTeamEntry) {
                const [teamId, teamData]: any = myTeamEntry
                const currentTeamScore = teamData.score || 0
                updates[`activeGame/teams/${teamId}/score`] = currentTeamScore + points
            }
        }
    }

    await update(ref(rtdb), updates)
    return points
}

// ── Teacher: reveal the correct answer ────────────────────────────────────────
export async function revealAnswer() {
    await update(ref(rtdb, 'activeGame'), {
        status: 'revealing',
        revealedAt: Date.now()
    })
}

// ── Teacher: show leaderboard ──────────────────────────────────────────────────
export async function showLeaderboard() {
    await update(ref(rtdb, 'activeGame'), { status: 'leaderboard' })
}

// ── Teacher: end game ──────────────────────────────────────────────────────────
export async function endGame() {
    await update(ref(rtdb, 'activeGame'), { status: 'ended' })
}

// ── Teacher: save game report to Firestore before clearing RTDB ───────────────
export async function saveGameReport(quizQuestions: any[]): Promise<string | null> {
    try {
        const gameSnap = await get(ref(rtdb, 'activeGame'))
        if (!gameSnap.exists()) return null
        const game = gameSnap.val()

        const answersSnap = await get(ref(rtdb, 'activeGame/answers'))
        const rawAnswers = answersSnap.val() || {}

        // Rank individual players
        const sortedPlayers = Object.entries(game.players || {})
            .map(([uid, p]: any) => ({ uid, ...p }))
            .sort((a: any, b: any) => b.score - a.score)

        const rankedPlayers: Record<string, { name: string; score: number; rank: number }> = {}
        sortedPlayers.forEach((p: any, i) => {
            rankedPlayers[p.uid] = { name: p.name, score: p.score, rank: i + 1 }
        })

        // Rank teams (if team mode)
        const sortedTeams = Object.entries(game.teams || {})
            .map(([id, t]: any) => ({ id, ...t }))
            .sort((a: any, b: any) => b.score - a.score)

        const rankedTeams: Record<string, { name: string; score: number; rank: number }> = {}
        sortedTeams.forEach((t: any, i) => {
            rankedTeams[t.id] = { name: t.name, score: t.score, rank: i + 1 }
        })

        // Strip questions to essentials
        const questions = quizQuestions.map(q => ({
            text: q.text,
            answers: (q.answers || []).map((a: any) => ({
                id: a.id,
                text: a.text,
                isCorrect: a.isCorrect
            }))
        }))

        const report: GameReport = {
            sessionId: game.sessionId,
            quizId: game.quizId,
            quizTitle: game.quizTitle,
            hostId: game.hostId,
            playedAt: Date.now(),
            totalQuestions: game.totalQuestions,
            participation: game.participation || 'solo',
            playerIds: Object.keys(rankedPlayers),
            players: rankedPlayers,
            teams: rankedTeams,
            questions,
            answers: rawAnswers
        }

        const { db } = await import('./firebase')
        const { doc, setDoc } = await import('firebase/firestore')
        await setDoc(doc(db, 'gameReports', game.sessionId), report)

        return game.sessionId
    } catch (err) {
        console.error('Failed to save game report:', err)
        return null
    }
}

// ── Teacher: fully clear RTDB after report is saved ───────────────────────────
export async function clearGame() {
    await remove(ref(rtdb, 'activeGame'))
}

// ── Listen to the entire active game ──────────────────────────────────────────
export function onActiveGame(callback: (game: ActiveGame | null) => void) {
    const r = ref(rtdb, 'activeGame')
    onValue(r, snap => callback(snap.exists() ? snap.val() : null))
    return () => off(r)
}

// ── Listen to players only (for lobby) ────────────────────────────────────────
export function onPlayers(callback: (players: Record<string, GamePlayer>) => void) {
    const r = ref(rtdb, 'activeGame/players')
    onValue(r, snap => callback(snap.val() || {}))
    return () => off(r)
}

// ── Listen to teams only ───────────────────────────────────────────────────────
export function onTeams(callback: (teams: Record<string, GameTeam>) => void) {
    const r = ref(rtdb, 'activeGame/teams')
    onValue(r, snap => callback(snap.val() || {}))
    return () => off(r)
}
export function getMyTeam(
    game: ActiveGame,
    uid: string
): (GameTeam & { id: string }) | null {
    if (!game?.teams) return null
    for (const [id, team] of Object.entries(game.teams)) {
        if (team.members?.[uid] !== undefined) {
            return { id, ...team }
        }
    }
    return null
}