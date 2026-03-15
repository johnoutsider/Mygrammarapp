'use client'

import DonutChart from './DonutChart'
import MuteButton from './MuteButton'
import { showLeaderboard } from '@/lib/gameService'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'
import { Check, X } from 'lucide-react'

const ANSWER_HEX = ['#f97316', '#3b82f6', '#22c55e', '#ef4444']
const ANSWER_SHAPES = ['▲', '◆', '●', '■']
const TF_HEX = ['#3b82f6', '#ef4444']
const TF_SHAPES = ['✓', '✗']

export default function RevealScreen({ game, currentQ, players, answeredCount, answerVotes, revealCountdown, muted, onMuteToggle, onEndEarly }: {
    game: ActiveGame
    currentQ: any
    players: [string, GamePlayer][]
    answeredCount: number
    answerVotes: Record<number, number>
    revealCountdown: number
    muted: boolean
    onMuteToggle: () => void
    onEndEarly: () => void
}) {
    const playerCount = players.length
    const isTF = currentQ?.type === 'true_or_false'
    const hex = isTF ? TF_HEX : ANSWER_HEX
    const shapes = isTF ? TF_SHAPES : ANSWER_SHAPES
    const answers = currentQ?.answers || []

    const totalVotes = Object.values(answerVotes).reduce((a, b) => a + b, 0)
    const correctIds = answers.filter((a: any) => a.isCorrect).map((a: any) => a.id)
    const correctVotes = correctIds.reduce((s: number, id: number) => s + (answerVotes[id] || 0), 0)
    const correctPct = totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0

    const segments = answers.map((ans: any, i: number) => ({
        color: hex[i] || ANSWER_HEX[i],
        pct: totalVotes > 0 ? (answerVotes[ans.id] || 0) / totalVotes : 0,
    }))

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-500 flex flex-col">
            {/* Purple header */}
            <div className="bg-purple-700 px-6 py-4 flex items-center justify-between shadow-lg">
                <span className="text-white font-bold">
                    Q{game.currentQuestion + 1}/{game.totalQuestions} · Results
                </span>
                <span className="text-white/70 text-sm">{answeredCount}/{playerCount} answered</span>
                <div className="flex items-center gap-3">
                    <MuteButton muted={muted} onToggle={onMuteToggle} />
                    <button onClick={onEndEarly} className="text-white/60 hover:text-white text-sm font-semibold">End</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 max-w-5xl mx-auto w-full">
                {/* Question recap */}
                <div className="bg-white rounded-3xl shadow-xl px-8 py-5 text-center">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">{currentQ?.text || ''}</h2>
                </div>

                {/* Correct / Wrong summary */}
                <div className="flex gap-4 justify-center">
                    <div className="bg-green-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg">
                        <Check className="w-5 h-5" />
                        <span className="font-bold">{correctVotes} correct</span>
                        <span className="text-white/70 text-sm">({correctPct}%)</span>
                    </div>
                    <div className="bg-red-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg">
                        <X className="w-5 h-5" />
                        <span className="font-bold">{totalVotes - correctVotes} wrong</span>
                    </div>
                </div>

                {/* Answer bars grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    {answers.map((ans: any, i: number) => {
                        const votes = answerVotes[ans.id] || 0
                        const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
                        return (
                            <div
                                key={ans.id}
                                className={`relative rounded-3xl overflow-hidden shadow-xl min-h-[120px] transition-opacity ${!ans.isCorrect ? 'opacity-60' : ''}`}
                                style={{ backgroundColor: hex[i] || ANSWER_HEX[i] }}
                            >
                                {/* Fill from bottom */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 bg-black/20 transition-all duration-700"
                                    style={{ height: `${pct}%` }}
                                />
                                <div className="relative z-10 p-5 flex flex-col h-full gap-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white/70 text-xl">{shapes[i]}</span>
                                            {ans.isCorrect ? (
                                                <div className="bg-white rounded-full p-1.5 shadow">
                                                    <Check className="w-4 h-4 text-green-600" />
                                                </div>
                                            ) : (
                                                <div className="bg-white/20 rounded-full p-1.5">
                                                    <X className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-white font-extrabold text-2xl">{votes}</span>
                                            <span className="text-white/70 text-sm ml-1">{pct}%</span>
                                        </div>
                                    </div>
                                    <p className="text-white font-bold text-base leading-snug flex-1 flex items-center">
                                        {ans.text}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Skip + countdown */}
                <div className="flex items-center justify-between bg-white/20 backdrop-blur rounded-2xl px-6 py-4">
                    <span className="text-white font-semibold animate-pulse">
                        ⏳ Leaderboard in {revealCountdown}s...
                    </span>
                    <button
                        onClick={() => showLeaderboard()}
                        className="bg-white text-purple-700 font-bold px-6 py-3 rounded-xl hover:scale-105 transition-all shadow-lg"
                    >
                        Skip →
                    </button>
                </div>
            </div>
        </div>
    )
}