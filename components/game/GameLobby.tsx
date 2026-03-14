'use client'

import type { ActiveGame, GamePlayer } from '@/lib/gameService'

export default function GameLobby({ game, players, onStart }: {
    game: ActiveGame
    players: [string, GamePlayer][]
    onStart: () => void
}) {
    const playerCount = players.length
    const sorted = [...players].sort((a, b) => a[1].joinedAt - b[1].joinedAt)

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <p className="text-violet-300 text-sm font-semibold uppercase tracking-widest mb-2">
                    Waiting Room
                </p>
                <h1 className="text-5xl font-extrabold text-white mb-1 text-center">
                    {game.quizTitle}
                </h1>
                <p className="text-violet-300 mb-10">{game.totalQuestions} questions</p>

                <div className="w-full max-w-3xl mb-10">
                    {playerCount === 0 ? (
                        <p className="text-center text-violet-400 animate-pulse">
                            Waiting for students to join...
                        </p>
                    ) : (
                        <>
                            <p className="text-center text-violet-300 text-sm mb-4">
                                👥 {playerCount} player{playerCount !== 1 ? 's' : ''} joined
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {sorted.map(([uid, p]) => (
                                    <span key={uid}
                                        className="bg-white/15 text-white font-semibold px-4 py-2 rounded-full text-sm border border-white/20">
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <button
                    onClick={onStart}
                    disabled={playerCount === 0}
                    className={`px-12 py-4 rounded-2xl font-extrabold text-xl shadow-xl transition-all
                        ${playerCount > 0
                            ? 'bg-white text-violet-700 hover:scale-105 hover:shadow-2xl'
                            : 'bg-white/20 text-white/40 cursor-not-allowed'}`}>
                    {playerCount === 0 ? 'Waiting for players...' : `▶ Start Game (${playerCount} players)`}
                </button>
            </div>
        </div>
    )
}