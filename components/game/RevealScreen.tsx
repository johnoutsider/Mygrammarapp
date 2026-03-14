'use client'

import DonutChart from './DonutChart'
import MuteButton from './MuteButton'
import { showLeaderboard } from '@/lib/gameService'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

const QUIZ_STYLES = [
    { bg: 'bg-red-500', hex: '#ef4444', shape: '▲' },
    { bg: 'bg-blue-600', hex: '#2563eb', shape: '◆' },
    { bg: 'bg-yellow-400', hex: '#facc15', shape: '●' },
    { bg: 'bg-green-600', hex: '#16a34a', shape: '■' },
]
const TF_STYLES = [
    { bg: 'bg-blue-500', hex: '#3b82f6', shape: '✓' },
    { bg: 'bg-red-500', hex: '#ef4444', shape: '✗' },
]

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
    const styles = currentQ?.type === 'true_or_false' ? TF_STYLES : QUIZ_STYLES
    const answers = currentQ?.answers || []
    const hasImage = !!currentQ?.imageUrl

    const totalVotes = Object.values(answerVotes).reduce((a, b) => a + b, 0)
    const correctAnswerIds = answers.filter((a: any) => a.isCorrect).map((a: any) => a.id)
    const correctVotes = correctAnswerIds.reduce((sum: number, id: number) => sum + (answerVotes[id] || 0), 0)
    const correctPct = totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0

    const segments = answers.map((ans: any, i: number) => {
        const s = styles[i] || QUIZ_STYLES[i]
        const votes = answerVotes[ans.id] || 0
        return { color: s.hex, pct: totalVotes > 0 ? votes / totalVotes : 0 }
    })

    const cornerPositions: React.CSSProperties[] = [
        { position: 'absolute', top: 0, left: 16 },
        { position: 'absolute', top: 0, right: 16 },
        { position: 'absolute', bottom: 0, left: 16 },
        { position: 'absolute', bottom: 0, right: 16 },
    ]

    return (
        <div className="min-h-screen bg-slate-800 flex flex-col">

            {/* Purple header */}
            <div className="bg-violet-600 px-6 py-3 flex items-center justify-between">
                <span className="text-white font-extrabold text-base">
                    Question {game.currentQuestion + 1}/{game.totalQuestions}
                </span>
                <span className="text-white font-extrabold text-xl tracking-wide">Results</span>
                <div className="flex items-center gap-3">
                    <MuteButton muted={muted} onToggle={onMuteToggle} />
                    <button onClick={onEndEarly} className="text-white/70 hover:text-white text-sm font-semibold">
                        End Game
                    </button>
                </div>
            </div>

            {/* 3-column layout */}
            <div className="flex-1 flex items-center gap-6 px-8 py-4">

                {/* Left — question + mini stats */}
                <div className="w-52 shrink-0 flex flex-col gap-3">
                    <p className="text-white text-lg font-bold leading-snug">{currentQ?.text || ''}</p>
                    {hasImage && (
                        <div className="w-full h-28 rounded-xl overflow-hidden border border-white/10">
                            <img src={currentQ.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                    )}
                    {totalVotes > 0 && (
                        <div className="space-y-1.5 mt-2">
                            <div className="flex items-center gap-2">
                                <span className="text-green-400 font-bold text-xs w-5">✅</span>
                                <div className="flex-1 bg-slate-600 rounded-full h-2 overflow-hidden">
                                    <div className="h-2 bg-green-500 rounded-full transition-all duration-700"
                                        style={{ width: `${correctPct}%` }} />
                                </div>
                                <span className="text-green-400 font-bold text-xs w-8 text-right">{correctPct}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-red-400 font-bold text-xs w-5">❌</span>
                                <div className="flex-1 bg-slate-600 rounded-full h-2 overflow-hidden">
                                    <div className="h-2 bg-red-500 rounded-full transition-all duration-700"
                                        style={{ width: `${100 - correctPct}%` }} />
                                </div>
                                <span className="text-red-400 font-bold text-xs w-8 text-right">{100 - correctPct}%</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Centre — donut + vote squares */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="relative" style={{ width: 340, height: 240 }}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <DonutChart segments={segments} correctPct={correctPct} size={190} />
                        </div>
                        {answers.slice(0, 4).map((ans: any, i: number) => {
                            const s = styles[i] || QUIZ_STYLES[i]
                            const votes = answerVotes[ans.id] || 0
                            return (
                                <div key={ans.id} style={cornerPositions[i]}>
                                    <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-xl"
                                        style={{ backgroundColor: s.hex }}>
                                        <span className="text-white text-2xl font-extrabold leading-none">{votes}</span>
                                        <span className="text-white/70 text-[10px] font-semibold mt-0.5">
                                            {votes === 1 ? 'student' : 'students'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right — stopwatch countdown + skip */}
                <div className="w-44 shrink-0 flex flex-col items-center gap-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full"
                            style={{ boxShadow: '0 0 30px rgba(245,158,11,0.5)', background: 'radial-gradient(circle, #d97706 0%, #92400e 100%)' }} />
                        <div className="absolute w-20 h-20 rounded-full bg-amber-900 flex items-center justify-center z-10">
                            <span className="text-white font-extrabold text-5xl leading-none">{revealCountdown}</span>
                        </div>
                        <div className="absolute -top-2 w-5 h-3 bg-amber-500 rounded-sm z-10 mx-auto left-0 right-0" />
                    </div>
                    <button
                        onClick={() => showLeaderboard()}
                        className="w-full bg-teal-500 hover:bg-teal-400 text-white font-extrabold py-3 rounded-xl text-sm transition-all hover:scale-105 shadow-lg">
                        Skip ▶▶
                    </button>
                    <p className="text-white/50 text-xs text-center font-semibold">
                        {answeredCount}/{playerCount} answered
                    </p>
                </div>
            </div>

            {/* Bottom answer bars */}
            <div className="grid grid-cols-2 gap-3 px-6 pb-5">
                {answers.map((ans: any, i: number) => {
                    const s = styles[i] || QUIZ_STYLES[i]
                    const isCorrect = ans.isCorrect
                    const votes = answerVotes[ans.id] || 0
                    const votePct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
                    return (
                        <div key={ans.id}
                            className={`rounded-2xl px-5 py-4 flex items-center gap-4 transition-all duration-500 ${!isCorrect ? 'opacity-60' : ''}`}
                            style={{ backgroundColor: s.hex }}>
                            <span className="text-white text-xl font-extrabold shrink-0 w-6">
                                {isCorrect ? '✓' : '✗'}
                            </span>
                            <span className="text-white font-bold text-base flex-1 leading-snug">{ans.text}</span>
                            <div className="text-right shrink-0">
                                <p className="text-white font-extrabold text-base leading-none">{votes}</p>
                                <p className="text-white/70 text-[10px] font-semibold">{votePct}%</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Player dots bar */}
            <div className="bg-slate-900 border-t border-slate-700 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1 flex-wrap">
                        {players.map(([uid, p]) => (
                            <div key={uid}
                                className={`w-3 h-3 rounded-full ${p.answered ? 'bg-green-400' : 'bg-slate-600'}`}
                                title={p.name} />
                        ))}
                    </div>
                    <span className="text-slate-300 text-sm font-medium">{answeredCount} / {playerCount} answered</span>
                </div>
                <span className="text-violet-300 text-sm font-semibold animate-pulse">
                    ⏳ Leaderboard in {revealCountdown}s...
                </span>
            </div>
        </div>
    )
}