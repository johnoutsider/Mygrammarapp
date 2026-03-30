'use client'

import type { ActiveGame, GamePlayer } from '@/lib/gameService'

// Row colours — match Figma: bright-yellow → pale-yellow → white → light-purple
const ROW_COLORS = [
    'bg-[#ffea00] text-[#1a1a33]',
    'bg-[#fff267] text-[#1a1a33]',
    'bg-[#fff7a1] text-[#1a1a33]',
    'bg-white text-[#1a1a33]',
]
const DEFAULT_ROW = 'bg-[#e8def8] text-[#1a1a33]'

// All rank badges use the same peach colour from Figma
const BADGE_CLASS = 'bg-[rgba(239,166,93,0.77)] text-white'

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

    const sorted = [...players]
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => b.score - a.score)

    const sortedTeams = Object.entries(game.teams || {})
        .map(([id, t]: any) => ({ id, ...t }))
        .sort((a: any, b: any) => b.score - a.score)

    const rowClass = (i: number) => ROW_COLORS[i] ?? DEFAULT_ROW

    return (
        <div className="min-h-screen bg-[#0aaecc] flex flex-col items-center justify-center p-6">

            {/* Header */}
            <div className="flex flex-col items-center mb-6">
                <h2
                    className="text-4xl text-white mb-1 tracking-wide"
                    style={{ fontFamily: 'var(--font-irish-grover, serif)' }}
                >
                    {isTeamMode ? 'Team Standings' : 'Leaderboard'}
                </h2>
                <p className="text-[#1a1a33] text-sm">
                    After Q{game.currentQuestion + 1} ·{' '}
                    {isLast ? 'Final results coming...' : `Next question in ${leaderboardCountdown}s`}
                </p>
            </div>

            {/* Countdown ring */}
            {!isLast && (
                <div className="relative w-16 h-16 mb-6">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="5" />
                        <circle
                            cx="32" cy="32" r="26" fill="none"
                            stroke="#00d084" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 26}`}
                            strokeDashoffset={`${2 * Math.PI * 26 * (1 - leaderboardCountdown / 3)}`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-black text-lg text-white">
                        {leaderboardCountdown}
                    </div>
                </div>
            )}

            {/* Card container + list */}
            <div className="w-full max-w-md bg-[#6750a4] rounded-2xl p-4 shadow-xl">

                {/* ── TEAM MODE ──────────────────────────────────────────────────── */}
                {isTeamMode ? (
                    <div className="space-y-3">
                        {sortedTeams.map((team: any, i: number) => (
                            <div
                                key={team.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] ${rowClass(i)}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${BADGE_CLASS}`}>
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
                    /* ── SOLO MODE ──────────────────────────────────────────────────── */
                    <div className="space-y-3">
                        {sorted.map((p, i) => (
                            <div
                                key={p.uid}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] ${rowClass(i)}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${BADGE_CLASS}`}>
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
        </div>
    )
}
