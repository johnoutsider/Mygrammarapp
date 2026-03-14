'use client'

import { useRouter } from 'next/navigation'
import type { ActiveGame } from '@/lib/gameService'

export default function StudentGameEnded({ game, currentUserId }: {
    game: ActiveGame
    currentUserId: string
}) {
    const router = useRouter()
    const sorted = Object.entries(game.players || {})
        .map(([uid, p]: any) => ({ uid, ...p }))
        .sort((a: any, b: any) => b.score - a.score)

    const myRank = sorted.findIndex((p: any) => p.uid === currentUserId) + 1
    const myScore = (game.players as any)?.[currentUserId]?.score || 0

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-extrabold mb-2">Game Over!</h2>
            <p className="text-violet-300 mb-6">
                You finished #{myRank} with {myScore} points
            </p>
            <div className="w-full max-w-sm space-y-3 mb-8">
                {sorted.slice(0, 5).map((p: any, i) => (
                    <div key={p.uid}
                        className={`flex items-center justify-between px-5 py-3 rounded-xl font-bold
                            ${p.uid === currentUserId
                                ? 'bg-violet-500 ring-2 ring-white'
                                : i === 0
                                    ? 'bg-yellow-500 text-yellow-900'
                                    : 'bg-white/10'}`}>
                        <span>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}
                            {p.uid === currentUserId && (
                                <span className="ml-2 text-xs opacity-70">(you)</span>
                            )}
                        </span>
                        <span>{p.score} pts</span>
                    </div>
                ))}
            </div>
            <button
                onClick={() => router.push('/dashboard')}
                className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform"
            >
                Back to Dashboard
            </button>
        </div>
    )
}