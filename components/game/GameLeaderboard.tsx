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

export default function GameLeaderboard({ game, players, leaderboardCountdown }: {
    game: ActiveGame
    players: [string, GamePlayer][]
    leaderboardCountdown: number
}) {
    const sorted = [...players]
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => b.score - a.score)

    const isLast = game.currentQuestion >= game.totalQuestions - 1

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-500 flex flex-col items-center justify-center p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

            <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-6">
                {/* Header */}
                <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-purple-700 text-white px-8 py-4 rounded-full shadow-xl mb-3">
                        <Trophy className="w-6 h-6" />
                        <h1 className="text-2xl font-bold">Leaderboard</h1>
                    </div>
                    <p className="text-white/90 font-semibold">
                        After Q{game.currentQuestion + 1} ·{' '}
                        {isLast ? 'Final results coming...' : `Next question in ${leaderboardCountdown}s`}
                    </p>
                </div>

                {/* Countdown ring */}
                <div className="w-16 h-16 rounded-full border-4 border-white/50 flex items-center justify-center bg-purple-700 shadow-xl">
                    <span className="text-white font-extrabold text-2xl">{leaderboardCountdown}</span>
                </div>

                {/* Player list */}
                <div className="w-full bg-white/95 rounded-3xl shadow-2xl overflow-hidden">
                    <div className="divide-y divide-gray-100">
                        {sorted.map((p, i) => (
                            <div
                                key={p.uid}
                                className={`flex items-center gap-4 px-6 py-4 ${i < 3 ? ROW_COLORS[i] : 'bg-white hover:bg-gray-50'
                                    } transition-colors`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-lg shrink-0 ${i < 3 ? NUM_COLORS[i] : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold truncate">{p.name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`font-extrabold text-xl ${i < 3 ? '' : 'text-purple-600'}`}>
                                        {p.score.toLocaleString()}
                                    </p>
                                    <p className="text-xs opacity-50 font-semibold">pts</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}