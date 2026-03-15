'use client'

import { Trophy } from 'lucide-react'
import type { ActiveGame } from '@/lib/gameService'

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

export default function StudentLeaderboard({
    game,
    currentUserId
}: {
    game: ActiveGame
    currentUserId: string
}) {
    const isTeamMode = game.participation === 'team'
    const isLast = game.currentQuestion >= game.totalQuestions - 1

    // ── Solo: sort players ─────────────────────────────────────────────────────
    const sortedPlayers = Object.entries(game.players || {})
        .map(([uid, p]: any) => ({ uid, ...p }))
        .sort((a: any, b: any) => b.score - a.score)

    // ── Team: sort teams, find my team ─────────────────────────────────────────
    const sortedTeams = Object.entries(game.teams || {})
        .map(([id, t]: any) => ({ id, ...t }))
        .sort((a: any, b: any) => b.score - a.score)

    const myTeam = sortedTeams.find((t: any) =>
        t.members && t.members[currentUserId] !== undefined
    )

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
                    {isLast ? 'Final results coming...' : 'Next question coming up...'}
                </p>

                {/* My team badge in team mode */}
                {isTeamMode && myTeam && (
                    <div className="mt-3 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-semibold flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${myTeam.color || 'bg-violet-400'}`} />
                        Your team: <span className="text-white font-extrabold">{myTeam.name}</span>
                        <span className="text-white/60 font-normal">· {myTeam.score?.toLocaleString()} pts</span>
                    </div>
                )}
            </div>

            {/* ── TEAM MODE list ─────────────────────────────────────────────── */}
            {isTeamMode ? (
                <div className="w-full max-w-md space-y-2">
                    {sortedTeams.map((team: any, i: number) => {
                        const isMyTeam = team.id === myTeam?.id
                        const rowColor = isMyTeam
                            ? 'bg-violet-500 text-white ring-2 ring-white'
                            : ROW_COLORS[i] || 'bg-white/10 text-white'
                        const numColor = isMyTeam
                            ? 'bg-violet-800 text-white'
                            : NUM_COLORS[i] || 'bg-white/20 text-white'

                        // Count members
                        const memberCount = Object.keys(team.members || {}).length

                        return (
                            <div
                                key={team.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${rowColor} ${isMyTeam ? 'scale-105' : ''}`}
                            >
                                {/* Rank */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${numColor}`}>
                                    {i + 1}
                                </div>

                                {/* Team info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-extrabold truncate">{team.name}</span>
                                        {isMyTeam && (
                                            <span className="text-xs opacity-70 font-normal">(your team)</span>
                                        )}
                                    </div>
                                    <p className="text-xs opacity-60 font-normal">
                                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                                    </p>
                                </div>

                                {/* Score */}
                                <div className="text-right">
                                    <span className="font-extrabold text-sm">{team.score?.toLocaleString()}</span>
                                    <span className="text-xs opacity-60 font-normal ml-1">pts</span>
                                </div>
                            </div>
                        )
                    })}

                    {sortedTeams.length === 0 && (
                        <p className="text-white/40 text-center text-sm">No teams yet...</p>
                    )}
                </div>

            ) : (
                /* ── SOLO MODE list ──────────────────────────────────────────────── */
                <div className="w-full max-w-md space-y-2">
                    {sortedPlayers.map((p: any, i: number) => {
                        const isMe = p.uid === currentUserId
                        const rowColor = isMe
                            ? 'bg-violet-500 text-white ring-2 ring-white'
                            : ROW_COLORS[i] || 'bg-white/10 text-white'
                        const numColor = isMe
                            ? 'bg-violet-800 text-white'
                            : NUM_COLORS[i] || 'bg-white/20 text-white'

                        return (
                            <div
                                key={p.uid}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${rowColor} ${isMe ? 'scale-105' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${numColor}`}>
                                    {i + 1}
                                </div>
                                <span className="flex-1 text-sm">
                                    {p.name}
                                    {isMe && (
                                        <span className="ml-2 text-xs opacity-70 font-normal">(you)</span>
                                    )}
                                </span>
                                <div className="text-right">
                                    <span className="font-extrabold text-sm">{p.score?.toLocaleString()}</span>
                                    <span className="text-xs opacity-60 font-normal ml-1">pts</span>
                                </div>
                            </div>
                        )
                    })}

                    {sortedPlayers.length === 0 && (
                        <p className="text-white/40 text-center text-sm">No players yet...</p>
                    )}
                </div>
            )}

            {/* Waiting pulse */}
            {!isLast && (
                <p className="text-violet-300 text-sm mt-8 animate-pulse">
                    Next question coming up...
                </p>
            )}
        </div>
    )
}
