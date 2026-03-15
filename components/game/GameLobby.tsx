'use client'

import { Users, Zap } from 'lucide-react'
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

export default function GameLobby({ game, players, onStart }: {
    game: ActiveGame
    players: [string, GamePlayer][]
    onStart: () => void
}) {
    const sorted = [...players].sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    const playerCount = players.length

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-500 flex flex-col relative overflow-hidden">
            {/* Blobs */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

            <div className="relative z-10 flex flex-col items-center flex-1 px-4 py-8">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-3 bg-purple-700 text-white px-8 py-4 rounded-full shadow-xl mb-3">
                        <Users className="w-6 h-6" />
                        <h1 className="text-2xl font-bold">Waiting Room</h1>
                    </div>
                    <p className="text-white font-bold text-xl">{game.quizTitle}</p>
                    <p className="text-white/70 text-sm mt-1">{game.totalQuestions} questions</p>
                </div>

                {/* Player count pill */}
                <div className="bg-white/20 backdrop-blur border border-white/30 rounded-2xl px-8 py-4 mb-6 text-center">
                    <span className="text-white/70 text-xs font-bold uppercase tracking-widest block mb-1">
                        Players Joined
                    </span>
                    <span className="text-white font-extrabold text-5xl leading-none">{playerCount}</span>
                </div>

                {/* Player grid */}
                <div className="w-full max-w-4xl bg-white/95 rounded-3xl shadow-2xl p-6 mb-8 flex-1">
                    {playerCount === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                <Users className="w-10 h-10 text-gray-300" />
                            </div>
                            <p className="text-xl text-gray-400 font-semibold animate-pulse">
                                Waiting for students to join...
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {sorted.map(([uid, p], index) => (
                                <div key={uid} className="flex flex-col items-center gap-2 bg-gray-50 rounded-2xl p-4 shadow-sm">
                                    <div className={`w-14 h-14 bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} rounded-2xl flex items-center justify-center text-2xl shadow-md`}>
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="font-bold text-gray-800 text-sm text-center truncate w-full">{p.name}</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                        <span className="text-xs text-green-600 font-semibold">Ready</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Start button */}
                <button
                    onClick={onStart}
                    disabled={playerCount === 0}
                    className={`flex items-center gap-3 px-14 py-5 rounded-full text-xl font-bold shadow-2xl transition-all ${playerCount > 0
                            ? 'bg-white text-purple-700 hover:scale-105 hover:shadow-3xl'
                            : 'bg-white/30 text-white/50 cursor-not-allowed'
                        }`}
                >
                    <Zap className="w-6 h-6" />
                    {playerCount > 0
                        ? `Start Game · ${playerCount} player${playerCount !== 1 ? 's' : ''}`
                        : 'Waiting for players...'}
                </button>
            </div>
        </div>
    )
}