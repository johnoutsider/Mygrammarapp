'use client'

import type { ActiveGame, GamePlayer } from '@/lib/gameService'

export default function GameLeaderboard({ game, players, leaderboardCountdown }: {
    game: ActiveGame
    players: [string, GamePlayer][]
    leaderboardCountdown: number
}) {
    const sorted = [...players]
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
    const isLast = game.currentQuestion >= game.totalQuestions - 1

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-8">
            <h2 className="text-4xl font-extrabold text-white mb-1">🏆 Leaderboard</h2>
            <p className="text-violet-300 text-sm mb-4">
                After Q{game.currentQuestion + 1} · {isLast ? 'Saving results...' : `Next question in ${leaderboardCountdown}s`}
            </p>
            <div className="mb-6 w-14 h-14 rounded-full border-4 border-violet-400 flex items-center justify-center">
                <span className="text-white font-extrabold text-xl">{leaderboardCountdown}</span>
            </div>
            <div className="w-full max-w-md space-y-3">
                {sorted.map((p, i) => (
                    <div key={p.uid}
                        className={`flex items-center justify-between px-6 py-4 rounded-2xl font-bold text-lg
                            ${i === 0 ? 'bg-yellow-400 text-yellow-900 scale-105 shadow-xl' :
                                i === 1 ? 'bg-slate-300 text-slate-800' :
                                    i === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-white'}`}>
                        <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}</span>
                        <span>{p.score} pts</span>
                    </div>
                ))}
            </div>
        </div>
    )
}