'use client'

import CircularTimer from './CircularTimer'
import MuteButton from './MuteButton'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

const ANSWER_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500']
const ANSWER_SHAPES = ['▲', '◆', '●', '■']
const TF_COLORS = ['bg-blue-500', 'bg-red-500']
const TF_SHAPES = ['✓', '✗']

export default function ActiveQuestion({
    game, currentQ, timeLeft, timeLimitSec,
    players, answeredCount, muted, onMuteToggle, onEndEarly
}: {
    game: ActiveGame
    currentQ: any
    timeLeft: number
    timeLimitSec: number
    players: [string, GamePlayer][]
    answeredCount: number
    muted: boolean
    onMuteToggle: () => void
    onEndEarly: () => void
}) {
    const isTeamMode = game.participation === 'team'
    const playerCount = players.length
    const timerPct = (timeLeft / timeLimitSec) * 100
    const isTF = currentQ?.type === 'true_or_false'
    const colors = isTF ? TF_COLORS : ANSWER_COLORS
    const shapes = isTF ? TF_SHAPES : ANSWER_SHAPES
    const answers = currentQ?.answers || []

    // ── Solo: individual progress ──────────────────────────────────────────────
    const answeredPct = playerCount > 0 ? (answeredCount / playerCount) * 100 : 0

    // ── Team: compute per-team answered status ─────────────────────────────────
    const teams = Object.entries(game.teams || {}).map(([id, t]: any) => {
        const memberUids = Object.keys(t.members || {})
        const answeredInTeam = memberUids.filter(
            uid => (game.players as any)?.[uid]?.answered === true
        ).length
        return {
            id, name: t.name, color: t.color,
            answered: answeredInTeam,
            total: memberUids.length,
            allDone: answeredInTeam === memberUids.length && memberUids.length > 0
        }
    })
    const teamsAllDone = teams.filter(t => t.allDone).length

    return (
        <div className="min-h-screen bg-[#46178f] flex flex-col">

            {/* Purple top bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#46178f] text-white text-sm font-bold">
                <span className="bg-white/20 px-3 py-1.5 rounded-full text-xs">
                    Q{game.currentQuestion + 1} / {game.totalQuestions}
                </span>
                <span className="text-sm font-bold truncate max-w-[200px]">
                    {isTeamMode ? `👥 Team Mode · ${game.quizTitle}` : game.quizTitle}
                </span>
                <div className="flex items-center gap-2">
                    <MuteButton muted={muted} onToggle={onMuteToggle} />
                    <button
                        onClick={onEndEarly}
                        className="bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                    >
                        End
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/20 w-full">
                <div
                    className={`h-full transition-all duration-500 ${timerPct > 50 ? 'bg-green-400' : timerPct > 25 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                    style={{ width: `${timerPct}%` }}
                />
            </div>

            {/* Timer + Question */}
            <div className="flex flex-col items-center px-4 pt-4 pb-2 gap-3">
                <CircularTimer timeLeft={timeLeft} timeLimitSec={timeLimitSec} />
                <div className="bg-white rounded-2xl shadow-lg px-5 py-4 w-full max-w-2xl text-center">
                    <p className="text-[#1f2d3d] font-bold text-lg leading-snug">
                        {currentQ?.text || ''}
                    </p>
                    {currentQ?.topicName && (
                        <p className="text-gray-400 text-xs mt-2">
                            {currentQ.topicName}{currentQ.subtopic ? ` · ${currentQ.subtopic}` : ''}
                        </p>
                    )}
                </div>
            </div>

            {/* Answer grid */}
            <div className={`grid gap-3 px-4 pb-3 flex-1 ${isTF ? 'grid-cols-2' : 'grid-cols-2'}`}>
                {answers.map((ans: any, i: number) => (
                    <div
                        key={ans.id}
                        className={`${colors[i] || ANSWER_COLORS[i % 4]} rounded-2xl flex flex-col items-center justify-center gap-2 text-white font-bold shadow-lg min-h-[110px] px-4 py-4 opacity-80`}
                    >
                        <span className="text-2xl">{shapes[i]}</span>
                        <span className="text-sm text-center leading-tight">{ans.text}</span>
                    </div>
                ))}
            </div>

            {/* ── Answered bar ──────────────────────────────────────────────────── */}
            {isTeamMode ? (
                /* Team mode — show per-team progress */
                <div className="bg-black/30 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-white/70 text-xs font-bold uppercase tracking-wider">
                            Teams answered
                        </span>
                        <span className="text-white font-extrabold text-sm">
                            {teamsAllDone} / {teams.length} teams complete
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {teams.map(team => (
                            <div key={team.id} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${team.color || 'bg-violet-400'}`} />
                                <span className="text-white text-xs font-semibold truncate flex-1">
                                    {team.name}
                                </span>
                                <span className={`text-xs font-bold ${team.allDone ? 'text-green-400' : 'text-white/50'}`}>
                                    {team.answered}/{team.total}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* Solo mode — original progress bar */
                <div className="bg-black/30 px-4 py-3 flex items-center gap-3">
                    <span className="text-white/70 text-sm font-bold shrink-0">
                        {answeredCount} / {playerCount} answered
                    </span>
                    <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-400 rounded-full transition-all duration-500"
                            style={{ width: `${answeredPct}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
