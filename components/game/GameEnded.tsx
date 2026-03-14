'use client'

import { useRouter } from 'next/navigation'
import { clearGame } from '@/lib/gameService'
import type { GamePlayer } from '@/lib/gameService'

export default function GameEnded({ players, reportSessionId }: {
    players: [string, GamePlayer][]
    reportSessionId: string | null
}) {
    const router = useRouter()
    const sorted = [...players]
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => b.score - a.score)

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-4xl font-extrabold text-white mb-8">Final Results</h2>
            <div className="w-full max-w-md space-y-3 mb-10">
                {sorted.map((p, i) => (
                    <div key={p.uid}
                        className={`flex items-center justify-between px-6 py-4 rounded-2xl font-bold text-lg
                            ${i === 0 ? 'bg-yellow-400 text-yellow-900 scale-105 shadow-xl' :
                                i === 1 ? 'bg-slate-300 text-slate-800' :
                                    i === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-white'}`}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                            <span>{p.name}</span>
                        </div>
                        <span>{p.score} pts</span>
                    </div>
                ))}
            </div>
            <div className="flex gap-3">
                {reportSessionId && (
                    <button
                        onClick={() => router.push(`/teacher/game/reports/${reportSessionId}`)}
                        className="bg-violet-500 hover:bg-violet-400 text-white font-bold px-8 py-3 rounded-2xl transition-transform hover:scale-105 shadow-lg">
                        📊 View Report
                    </button>
                )}
                <button
                    onClick={async () => { await clearGame(); router.push('/teacher/game') }}
                    className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-2xl hover:scale-105 transition-transform shadow-lg">
                    Done
                </button>
            </div>
        </div>
    )
}