'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clearGame } from '@/lib/gameService'
import { Trophy, RotateCcw, FileBarChart2 } from 'lucide-react'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'
import confetti from 'canvas-confetti'

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

export default function GameEnded({
    players,
    reportSessionId,
    game
}: {
    players: [string, GamePlayer][]
    reportSessionId: string | null
    game: ActiveGame
}) {
    const router = useRouter()
    const isTeamMode = game.participation === 'team'

    // ── Sort players (solo) ────────────────────────────────────────────────────
    const sorted = [...players]
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => b.score - a.score)
    const winner = sorted[0]

    // ── Sort teams (team mode) ─────────────────────────────────────────────────
    const sortedTeams = Object.entries(game.teams || {})
        .map(([id, t]: any) => ({ id, ...t }))
        .sort((a: any, b: any) => b.score - a.score)
    const gold = sortedTeams[0]
    const silver = sortedTeams[1]
    const bronze = sortedTeams[2]

    // ── Confetti ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const end = Date.now() + 4000
        const frame = () => {
            confetti({ particleCount: 3, angle: 60, spread: 60, origin: { x: 0 }, colors: ['#7c3aed', '#06b6d4', '#f97316'] })
            confetti({ particleCount: 3, angle: 120, spread: 60, origin: { x: 1 }, colors: ['#7c3aed', '#22c55e', '#06b6d4'] })
            if (Date.now() < end) requestAnimationFrame(frame)
        }
        frame()
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6 text-white">

            {/* Header */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mb-3 shadow-lg">
                    <Trophy className="w-8 h-8 text-yellow-900" />
                </div>
                <h2 className="text-3xl font-extrabold">Game Over!</h2>
                <p className="text-violet-300 text-sm mt-1">
                    {isTeamMode ? 'Team Results' : 'Final Results'}
                </p>
            </div>

            {/* ── TEAM MODE podium ──────────────────────────────────────────── */}
            {isTeamMode ? (
                <div className="w-full max-w-2xl mb-6">

                    {/* Podium */}
                    <div className="flex items-end justify-center gap-3 mb-6">

                        {/* Silver — 2nd */}
                        {silver && (
                            <div className="flex-1 max-w-[160px] bg-slate-300 text-slate-800 rounded-t-2xl p-4 text-center">
                                <p className="text-2xl mb-1">🥈</p>
                                <p className="font-extrabold text-sm truncate">{silver.name}</p>
                                <p className="text-xs opacity-70 mb-1">
                                    {Object.keys(silver.members || {}).length} members
                                </p>
                                <p className="font-black text-lg">{silver.score?.toLocaleString()}</p>
                                <p className="text-xs opacity-60">pts</p>
                            </div>
                        )}

                        {/* Gold — 1st (taller) */}
                        {gold && (
                            <div className="flex-1 max-w-[180px] bg-amber-400 text-amber-900 rounded-t-2xl p-4 text-center -translate-y-4 shadow-xl">
                                <p className="text-3xl mb-1">🏆</p>
                                <p className="font-extrabold text-base truncate">{gold.name}</p>
                                <p className="text-xs opacity-70 mb-1">
                                    {Object.keys(gold.members || {}).length} members
                                </p>
                                <p className="font-black text-2xl">{gold.score?.toLocaleString()}</p>
                                <p className="text-xs opacity-60">pts</p>
                            </div>
                        )}

                        {/* Bronze — 3rd */}
                        {bronze && (
                            <div className="flex-1 max-w-[160px] bg-orange-300 text-orange-900 rounded-t-2xl p-4 text-center">
                                <p className="text-2xl mb-1">🥉</p>
                                <p className="font-extrabold text-sm truncate">{bronze.name}</p>
                                <p className="text-xs opacity-70 mb-1">
                                    {Object.keys(bronze.members || {}).length} members
                                </p>
                                <p className="font-black text-lg">{bronze.score?.toLocaleString()}</p>
                                <p className="text-xs opacity-60">pts</p>
                            </div>
                        )}
                    </div>

                    {/* All teams list (4th place and below) */}
                    {sortedTeams.length > 3 && (
                        <div className="space-y-2 w-full max-w-md mx-auto">
                            <p className="text-white/50 text-xs text-center uppercase tracking-wider mb-2">Other Teams</p>
                            {sortedTeams.slice(3).map((team: any, i: number) => (
                                <div key={team.id} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold">
                                        {i + 4}
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className={`w-2.5 h-2.5 rounded-full ${team.color || 'bg-violet-400'}`} />
                                        <span className="text-sm font-bold">{team.name}</span>
                                    </div>
                                    <span className="text-sm font-bold">{team.score?.toLocaleString()} pts</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            ) : (
                /* ── SOLO MODE (unchanged) ──────────────────────────────────────── */
                <div className="w-full max-w-md mb-6">
                    {winner && (
                        <div className="bg-yellow-400 text-yellow-900 rounded-2xl p-5 text-center mb-4 shadow-xl">
                            <div className="w-14 h-14 rounded-full bg-yellow-600 text-white flex items-center justify-center text-2xl font-black mx-auto mb-2">
                                {winner.name.charAt(0)}
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider opacity-70">🏆 Winner</p>
                            <p className="text-xl font-extrabold">{winner.name}</p>
                            <p className="text-lg font-black">{winner.score.toLocaleString()} pts</p>
                        </div>
                    )}

                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2 text-center">
                        Final Rankings
                    </h3>
                    <div className="space-y-2">
                        {sorted.map((p, i) => (
                            <div
                                key={p.uid}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold ${ROW_COLORS[i] || 'bg-white/10 text-white'}`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-extrabold ${NUM_COLORS[i] || 'bg-white/20 text-white'}`}>
                                    {i + 1}
                                </div>
                                <span className="flex-1 text-sm">{p.name}</span>
                                <span className="text-sm font-extrabold">{p.score.toLocaleString()} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 mt-2">
                {reportSessionId && (
                    <button
                        onClick={() => router.push(`/teacher/game/reports/${reportSessionId}`)}
                        className="flex items-center gap-2 bg-purple-700 text-white font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-all shadow-xl"
                    >
                        <FileBarChart2 size={18} /> View Report
                    </button>
                )}
                <button
                    onClick={async () => { await clearGame(); router.push('/teacher/game') }}
                    className="flex items-center gap-2 bg-white text-purple-700 font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-all shadow-xl"
                >
                    <RotateCcw size={18} /> Done
                </button>
            </div>
        </div>
    )
}
