'use client'

import { Trophy } from 'lucide-react'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

const ROW_COLORS = [
    'bg-amber-400 text-amber-900',
    'bg-slate-200 text-slate-700',
    'bg-orange-300 text-orange-900',
]
const NUM_COLORS = [
    'bg-amber-600 text-white',
    'bg-slate-400 text-white',
    'bg-orange-500 text-white',
]

export default function GameLeaderboard({
    game,
    players,
    leaderboardCountdown
}: {
    game: ActiveGame
    players: [string, GamePlayer][]
    leaderboardCountdown: number
}) {
    const isTeamMode = game.participation === 'team'
    const isLast = game.currentQuestion >= game.totalQuestions - 1

    // ── Sort solo players ──────────────────────────────────────────────────────
    const sorted = [...players]
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => b.score - a.score)

    // ── Sort teams ─────────────────────────────────────────────────────────────
    const sortedTeams = Object.entries(game.teams || {})
        .map(([id, t]: any) => ({ id, ...t }))
        .sort((a: any, b: any) => b.score - a.score)

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6 text-white">

            {/* Header */}
            <div className="flex flex-col items-center mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-extrabold">
                        {isTeamMode ? 'Team Standings' : 'Leaderboard'}
                    </h2>
                </div>
                <p className="text-violet-300 text-sm">
                    After Q{game.currentQuestion + 1} ·{' '}
                    {isLast ? 'Final results coming...' : `Next question in ${leaderboardCountdown}s`}
                </p>
            </div>

            {/* Countdown ring */}
            {!isLast && (
                <div className="relative w-16 h-16 mb-6">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                        <circle
                            cx="32" cy="32" r="26" fill="none"
                            stroke="#a78bfa" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 26}`}
                            strokeDashoffset={`${2 * Math.PI * 26 * (1 - leaderboardCountdown / 3)}`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-black text-lg">
                        {leaderboardCountdown}
                    </div>
                </div>
            )}

            {/* ── TEAM MODE list ─────────────────────────────────────────────── */}
            {isTeamMode ? (
                <div className="w-full max-w-md space-y-2">
                    {sortedTeams.map((team: any, i: number) => (
                        <div
                            key={team.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold ${ROW_COLORS[i] || 'bg-white/10 text-white'}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${NUM_COLORS[i] || 'bg-white/20 text-white'}`}>
                                {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${team.color || 'bg-violet-400'}`} />
                                    <span className="text-sm font-extrabold truncate">{team.name}</span>
                                </div>
                                <p className="text-xs opacity-60 font-normal">
                                    {Object.keys(team.members || {}).length} members
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="font-extrabold text-sm">{team.score?.toLocaleString()}</span>
                                <span className="text-xs opacity-60 font-normal ml-1">pts</span>
                            </div>
                        </div>
                    ))}
                    {sortedTeams.length === 0 && (
                        <p className="text-white/40 text-center text-sm">No teams yet...</p>
                    )}
                </div>

            ) : (
                /* ── SOLO MODE list (unchanged) ──────────────────────────────────── */
                <div className="w-full max-w-md space-y-2">
                    {sorted.map((p, i) => (
                        <div
                            key={p.uid}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold ${ROW_COLORS[i] || 'bg-white/10 text-white'}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${NUM_COLORS[i] || 'bg-white/20 text-white'}`}>
                                {i + 1}
                            </div>
                            <span className="flex-1 text-sm">{p.name}</span>
                            <div className="text-right">
                                <span className="font-extrabold text-sm">{p.score.toLocaleString()}</span>
                                <span className="text-xs opacity-60 font-normal ml-1">pts</span>
                            </div>
                        </div>
                    ))}
                    {sorted.length === 0 && (
                        <p className="text-white/40 text-center text-sm">No players yet...</p>
                    )}
                </div>
            )}
        </div>
    )
}
