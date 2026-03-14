'use client'

import type { ActiveGame } from '@/lib/gameService'

export default function StudentLeaderboard({ game, currentUserId }: {
    game: ActiveGame
    currentUserId: string
}) {
    const sorted = Object.entries(game.players || {})
        .map(([uid, p]: any) => ({ uid, ...p }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6">
            <h2 className="text-3xl font-extrabold text-white mb-8">🏆 Leaderboard</h2>
            <div className="w-full max-w-sm space-y-3">
                {sorted.map((p: any, i) => (
                    <div key={p.uid}
                        className={`flex items-center justify-between px-5 py-3 rounded-xl font-bold
                            ${p.uid === currentUserId ? 'ring-2 ring-white' : ''}
                            ${i === 0 ? 'bg-yellow-500 text-yellow-900' :
                                i === 1 ? 'bg-slate-400 text-slate-900' :
                                    i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white'}`}>
                        <span>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}
                            {p.uid === currentUserId && (
                                <span className="ml-2 text-xs font-semibold opacity-70">(you)</span>
                            )}
                        </span>
                        <span>{p.score} pts</span>
                    </div>
                ))}
            </div>
            <p className="text-violet-300 mt-8 text-sm animate-pulse">Next question coming up...</p>
        </div>
    )
}