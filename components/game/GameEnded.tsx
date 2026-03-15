'use client'

import { useRouter } from 'next/navigation'
import { clearGame } from '@/lib/gameService'
import { Trophy, RotateCcw, FileBarChart2 } from 'lucide-react'
import type { GamePlayer } from '@/lib/gameService'
import { useEffect } from 'react'
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

export default function GameEnded({ players, reportSessionId }: {
    players: [string, GamePlayer][]
    reportSessionId: string | null
}) {
    const router = useRouter()
    const sorted = [...players].map(([uid, p]) => ({ uid, ...p })).sort((a, b) => b.score - a.score)
    const winner = sorted[0]

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
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-500 flex flex-col items-center p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

            <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-6">
                {/* Header */}
                <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-purple-700 text-white px-8 py-4 rounded-full shadow-xl mb-3">
                        <Trophy className="w-6 h-6 animate-bounce" />
                        <h1 className="text-2xl font-bold">Game Over!</h1>
                    </div>
                    <p className="text-white/90 font-semibold text-lg">Final Results</p>
                </div>

                {/* Winner */}
                {winner && (
                    <div className="w-full bg-gradient-to-br from-amber-400 to-yellow-500 rounded-3xl p-6 shadow-2xl flex items-center gap-5">
                        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-lg shrink-0 font-bold text-amber-600">
                            {winner.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-amber-900/70 text-xs font-bold uppercase tracking-widest mb-1">🏆 Winner</p>
                            <p className="text-2xl font-extrabold text-amber-900 truncate">{winner.name}</p>
                            <p className="text-amber-800 font-semibold">{winner.score.toLocaleString()} pts</p>
                        </div>
                    </div>
                )}

                {/* Full leaderboard */}
                <div className="w-full bg-white/95 rounded-3xl shadow-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                        <FileBarChart2 className="w-5 h-5 text-purple-600" />
                        <h3 className="font-bold text-gray-800 text-lg">Final Rankings</h3>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
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

                {/* Buttons */}
                <div className="flex gap-4">
                    {reportSessionId && (
                        <button
                            onClick={() => router.push(`/teacher/game/reports/${reportSessionId}`)}
                            className="flex items-center gap-2 bg-purple-700 text-white font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-all shadow-xl"
                        >
                            <FileBarChart2 className="w-5 h-5" />
                            View Report
                        </button>
                    )}
                    <button
                        onClick={async () => { await clearGame(); router.push('/teacher/game') }}
                        className="flex items-center gap-2 bg-white text-purple-700 font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-all shadow-xl"
                    >
                        <RotateCcw className="w-5 h-5" />
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}