'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ActiveGame, GameTeam } from '@/lib/gameService'

export default function StudentGameEnded({
    game,
    currentUserId,
    myTeam
}: {
    game: ActiveGame
    currentUserId: string
    myTeam: (GameTeam & { id: string }) | null
}) {
    const router = useRouter()
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const isTeamMode = game.participation === 'team'

    const sortedTeams = Object.entries(game.teams || {})
        .map(([id, t]: any) => ({ id, ...t }))
        .sort((a: any, b: any) => b.score - a.score)

    const top3 = sortedTeams.slice(0, 3)
    const gold = top3[0]
    const silver = top3[1]
    const bronze = top3[2]
    const myTeamRank = sortedTeams.findIndex((t: any) => t.id === myTeam?.id) + 1

    const sorted = Object.entries(game.players || {})
        .map(([uid, p]: any) => ({ uid, ...p }))
        .sort((a: any, b: any) => b.score - a.score)

    const myRank = sorted.findIndex((p: any) => p.uid === currentUserId) + 1
    const myScore = (game.players as any)?.[currentUserId]?.score || 0
    const winner = sorted[0]

    // ── Confetti ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const pieces = Array.from({ length: 120 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 6,
            h: Math.random() * 6 + 4,
            color: ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6', '#ef4444'][Math.floor(Math.random() * 6)],
            speed: Math.random() * 2 + 1,
            angle: Math.random() * 360,
            spin: (Math.random() - 0.5) * 4,
        }))

        let raf: number
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            pieces.forEach(p => {
                ctx.save()
                ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
                ctx.rotate((p.angle * Math.PI) / 180)
                ctx.fillStyle = p.color
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
                ctx.restore()
                p.y += p.speed
                p.angle += p.spin
                if (p.y > canvas.height) {
                    p.y = -p.h
                    p.x = Math.random() * canvas.width
                }
            })
            raf = requestAnimationFrame(draw)
        }
        draw()
        return () => cancelAnimationFrame(raf)
    }, [])

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-teal-400 to-cyan-500 flex flex-col items-center justify-start pt-10 pb-10 px-4 overflow-hidden">

            {/* Confetti canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

            {/* Content */}
            {/* Content */}
            <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-5">

                {isTeamMode ? (
                    <>
                        {/* Game Over pill */}
                        <div className="bg-purple-600 text-white font-extrabold text-xl px-7 py-3 rounded-full flex items-center gap-2 shadow-lg">
                            🏆 Game Over!
                        </div>
                        <p className="text-white font-semibold text-base -mt-2">Team Results</p>

                        {/* Podium — silver left, gold center, bronze right */}
                        <div className="w-full flex items-end justify-center gap-3 mt-2">

                            {/* Silver — left */}
                            {silver && (
                                <div className="flex-1 bg-slate-300 rounded-2xl px-3 py-4 flex flex-col items-center gap-1 shadow-lg">
                                    <span className="text-3xl">🥈</span>
                                    <span className="font-extrabold text-slate-800 text-sm text-center">{silver.name}</span>
                                    <span className="text-slate-700 text-xs font-semibold">{silver.score?.toLocaleString()} pts</span>
                                    <span className="text-slate-500 text-xs">{Object.keys(silver.members || {}).length} members</span>
                                </div>
                            )}

                            {/* Gold — center, elevated */}
                            {gold && (
                                <div className="flex-1 bg-amber-400 rounded-2xl px-3 py-5 flex flex-col items-center gap-1 shadow-xl translate-y-[-20px]">
                                    <span className="text-4xl">🏆</span>
                                    <span className="font-extrabold text-amber-900 text-sm text-center">{gold.name}</span>
                                    <span className="text-amber-800 text-xs font-semibold">{gold.score?.toLocaleString()} pts</span>
                                    <span className="text-amber-700 text-xs">{Object.keys(gold.members || {}).length} members</span>
                                </div>
                            )}

                            {/* Bronze — right */}
                            {bronze && (
                                <div className="flex-1 bg-orange-300 rounded-2xl px-3 py-4 flex flex-col items-center gap-1 shadow-lg">
                                    <span className="text-3xl">🥉</span>
                                    <span className="font-extrabold text-orange-900 text-sm text-center">{bronze.name}</span>
                                    <span className="text-orange-800 text-xs font-semibold">{bronze.score?.toLocaleString()} pts</span>
                                    <span className="text-orange-700 text-xs">{Object.keys(bronze.members || {}).length} members</span>
                                </div>
                            )}
                        </div>

                        {/* My team card */}
                        {myTeam && (
                            <div className="w-full bg-white/10 rounded-2xl px-6 py-4 flex items-center gap-3">
                                <span className={`w-4 h-4 rounded-full flex-shrink-0 ${myTeam.color}`} />
                                <span className="text-white font-semibold">Your team: {myTeam.name}</span>
                                <span className="ml-auto text-white font-bold">
                                    #{myTeamRank} · {myTeam.score?.toLocaleString()} pts
                                </span>
                            </div>
                        )}

                        {/* Back button */}
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="bg-white text-indigo-700 font-bold px-10 py-3 rounded-xl hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                        >
                            🏠 Back to Dashboard
                        </button>
                    </>
                ) : (
                    <>
                        {/* Game Over pill */}
                        <div className="bg-purple-600 text-white font-extrabold text-xl px-7 py-3 rounded-full flex items-center gap-2 shadow-lg">
                            🏆 Game Over!
                        </div>
                        <p className="text-white font-semibold text-base -mt-2">Final Results</p>

                        {/* Winner card */}
                        {winner && (
                            <div className="w-full bg-yellow-400 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-xl">
                                <div className="bg-white rounded-xl w-14 h-14 flex items-center justify-center text-yellow-700 font-extrabold text-2xl shadow">
                                    {(winner.name || 'P')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-yellow-800 text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                                        🏅 WINNER
                                    </p>
                                    <p className="text-yellow-900 font-extrabold text-lg leading-tight">{winner.name}</p>
                                    <p className="text-yellow-800 text-sm font-semibold">
                                        {winner.score?.toLocaleString()} pts
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Final Rankings */}
                        <div className="w-full bg-white/90 rounded-2xl overflow-hidden shadow-xl">
                            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200">
                                <span className="text-gray-500 text-sm">📋</span>
                                <span className="font-bold text-gray-700 text-sm">Final Rankings</span>
                                {myRank > 0 && (
                                    <span className="ml-auto text-violet-600 font-bold text-xs">
                                        You: #{myRank}
                                    </span>
                                )}
                            </div>
                            <div className="divide-y divide-gray-100">
                                {sorted.slice(0, 8).map((p: any, i: number) => {
                                    const isMe = p.uid === currentUserId
                                    const rankColors = ['bg-yellow-400', 'bg-gray-300', 'bg-amber-500']
                                    return (
                                        <div
                                            key={p.uid}
                                            className={`flex items-center gap-3 px-5 py-3 ${isMe ? 'bg-violet-50' : ''}`}
                                        >
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs ${rankColors[i] || 'bg-gray-400'}`}>
                                                {i + 1}
                                            </div>
                                            <span className={`flex-1 font-semibold text-sm ${isMe ? 'text-violet-700' : 'text-gray-800'}`}>
                                                {p.name}
                                                {isMe && <span className="ml-1 text-xs text-violet-400 font-normal">(you)</span>}
                                            </span>
                                            <span className="font-bold text-sm text-right text-gray-700">
                                                {p.score?.toLocaleString()}
                                                <span className="text-gray-400 font-normal text-xs"> pts</span>
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Back button */}
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="bg-white text-indigo-700 font-bold px-10 py-3 rounded-xl hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                        >
                            🏠 Back to Dashboard
                        </button>
                    </>
                )}

            </div>
        </div>
    )
}
