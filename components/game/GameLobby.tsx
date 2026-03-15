'use client'

import { Users, Zap, Play } from 'lucide-react'
import { motion } from 'motion/react'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

const CARD_GRADIENTS = [
    'from-orange-400 to-orange-500',
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-500',
    'from-red-400 to-red-500',
    'from-purple-400 to-purple-600',
    'from-teal-400 to-teal-500',
    'from-pink-400 to-pink-500',
    'from-indigo-400 to-indigo-600',
]

export default function GameLobby({
    game,
    players,
    onStart
}: {
    game: ActiveGame
    players: [string, GamePlayer][]
    onStart: () => void
}) {
    const isTeamMode = game.participation === 'team'
    const sorted = [...players].sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    const playerCount = players.length

    const sortedTeams = Object.entries(game.teams || {})
        .map(([id, t]: any) => ({ id, ...t }))
        .sort((a: any, b: any) =>
            Object.keys(b.members || {}).length - Object.keys(a.members || {}).length
        )
    const totalTeamPlayers = sortedTeams.reduce(
        (sum, t: any) => sum + Object.keys(t.members || {}).length, 0
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">

            {/* Background blobs */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            {/* Header */}
            <div className="relative z-10 text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-5 py-2 rounded-full font-bold text-base mb-4 backdrop-blur-sm">
                    <Users size={18} />
                    Waiting Room
                </div>
                <h1 className="text-4xl font-black text-white mb-2">{game.quizTitle}</h1>
                <p className="text-violet-300 text-base">{game.totalQuestions} questions</p>
            </div>

            {/* ── TEAM MODE ──────────────────────────────────────────────────── */}
            {isTeamMode ? (
                <div className="relative z-10 w-full max-w-4xl">

                    {/* Team count pill */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-center">
                            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">
                                Teams Ready
                            </p>
                            <p className="text-4xl font-black text-white">{sortedTeams.length}</p>
                            <p className="text-white/50 text-sm mt-1">
                                {totalTeamPlayers} player{totalTeamPlayers !== 1 ? 's' : ''} assigned
                            </p>
                        </div>
                    </div>

                    {/* Team cards grid */}
                    {sortedTeams.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                            {sortedTeams.map((team: any, index: number) => {
                                const memberCount = Object.keys(team.members || {}).length
                                const memberNames = Object.values(team.members || {}) as string[]
                                return (
                                    <motion.div
                                        key={team.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} rounded-2xl p-4 text-white shadow-lg`}
                                    >
                                        <div className="font-extrabold text-base mb-1 truncate">
                                            {team.name}
                                        </div>
                                        <div className="text-white/70 text-xs mb-2">
                                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                                        </div>
                                        <div className="space-y-1">
                                            {memberNames.slice(0, 3).map((name, i) => (
                                                <div key={i} className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                                        {(name as string)[0]?.toUpperCase()}
                                                    </div>
                                                    <span className="text-xs truncate opacity-90">{name as string}</span>
                                                </div>
                                            ))}
                                            {memberNames.length > 3 && (
                                                <p className="text-white/50 text-[10px]">
                                                    +{memberNames.length - 3} more
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-white/40 text-center py-8 mb-6">
                            No teams assigned yet...
                        </div>
                    )}

                    {/* Start button */}
                    <div className="flex justify-center">
                        <button
                            onClick={onStart}
                            disabled={sortedTeams.length === 0}
                            className={`flex items-center gap-3 text-lg font-black px-10 py-4 rounded-2xl shadow-2xl transition-all duration-200 ${sortedTeams.length > 0
                                    ? 'bg-white text-purple-700 hover:scale-105 hover:shadow-3xl'
                                    : 'bg-white/30 text-white/50 cursor-not-allowed'
                                }`}
                        >
                            <Play size={22} className="fill-current" />
                            {sortedTeams.length > 0
                                ? `Start Game · ${sortedTeams.length} teams`
                                : 'Assign teams first...'
                            }
                        </button>
                    </div>
                </div>

            ) : (
                /* ── SOLO MODE (unchanged) ────────────────────────────────────────── */
                <div className="relative z-10 w-full max-w-4xl">

                    {/* Player count pill */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-center">
                            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">
                                Players Joined
                            </p>
                            <p className="text-4xl font-black text-white">{playerCount}</p>
                        </div>
                    </div>

                    {/* Player grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
                        {playerCount === 0 ? (
                            <div className="col-span-full text-white/40 text-center py-8">
                                Waiting for students to join...
                            </div>
                        ) : (
                            sorted.map(([uid, p], index) => (
                                <motion.div
                                    key={uid}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} rounded-2xl p-4 text-white text-center shadow-lg`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black mx-auto mb-2">
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="font-bold text-sm truncate">{p.name}</p>
                                    <p className="text-white/60 text-xs mt-1 flex items-center justify-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                        Ready
                                    </p>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {/* Start button */}
                    <div className="flex justify-center">
                        <button
                            onClick={onStart}
                            disabled={playerCount === 0}
                            className={`flex items-center gap-3 text-lg font-black px-10 py-4 rounded-2xl shadow-2xl transition-all duration-200 ${playerCount > 0
                                    ? 'bg-white text-purple-700 hover:scale-105 hover:shadow-3xl'
                                    : 'bg-white/30 text-white/50 cursor-not-allowed'
                                }`}
                        >
                            <Zap size={22} className="fill-current" />
                            {playerCount > 0
                                ? `Start Game · ${playerCount} player${playerCount !== 1 ? 's' : ''}`
                                : 'Waiting for players...'
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
