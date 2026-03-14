'use client'

import type { ActiveGame } from '@/lib/gameService'

const SHAPES = [
    { bg: 'bg-red-500', hover: 'hover:bg-red-400', shape: '▲' },
    { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', shape: '◆' },
    { bg: 'bg-yellow-400', hover: 'hover:bg-yellow-300', shape: '●' },
    { bg: 'bg-green-600', hover: 'hover:bg-green-500', shape: '■' },
]
const TF_SHAPES = [
    { bg: 'bg-blue-500', hover: 'hover:bg-blue-400', shape: '✓' },
    { bg: 'bg-red-500', hover: 'hover:bg-red-400', shape: '✗' },
]

export default function StudentQuestion({ game, currentQ, timeLeft, timeLimitSec, currentUserId, onAnswer }: {
    game: ActiveGame
    currentQ: any
    timeLeft: number
    timeLimitSec: number
    currentUserId: string
    onAnswer: (answerId: number) => void
}) {
    const timerPct = (timeLeft / timeLimitSec) * 100
    const isTF = currentQ?.type === 'true_or_false'
    const answers = currentQ?.answers || []
    const styles = isTF ? TF_SHAPES : SHAPES
    const myScore = (game.players as any)?.[currentUserId]?.score || 0

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">

            {/* Header */}
            <div className="px-4 pt-5 pb-2 flex items-center justify-between">
                <span className="text-white/60 text-xs font-medium">
                    Q {game.currentQuestion + 1}/{game.totalQuestions}
                </span>
                <div className={`text-xl font-extrabold px-3 py-1 rounded-lg
                    ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' :
                        timeLeft <= 10 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/10 text-white'}`}>
                    {timeLeft}s
                </div>
                <span className="text-white/60 text-xs font-medium">{myScore} pts</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/10 mx-4 rounded-full overflow-hidden mt-1">
                <div
                    className={`h-full rounded-full transition-all duration-500
                        ${timerPct > 50 ? 'bg-green-400' : timerPct > 25 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${timerPct}%` }}
                />
            </div>

            {/* Question text */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-center">
                <h2 className="text-lg font-bold text-white text-center leading-snug max-w-sm">
                    {currentQ?.text || ''}
                </h2>
            </div>

            {/* Time's up banner */}
            {timeLeft === 0 && (
                <div className="mx-4 mb-2 bg-orange-500/20 text-orange-300 rounded-xl p-2 text-center font-semibold text-sm">
                    ⏰ Time&apos;s up!
                </div>
            )}

            {/* Answer buttons */}
            <div className="flex-1 grid grid-cols-2 gap-3 p-3 pb-6">
                {answers.map((ans: any, i: number) => {
                    const style = styles[i] || SHAPES[i]
                    return (
                        <button
                            key={ans.id}
                            onClick={() => onAnswer(ans.id)}
                            disabled={timeLeft === 0}
                            className={`
                                ${style.bg} ${timeLeft > 0 ? style.hover : 'opacity-50'}
                                rounded-2xl flex flex-col items-center justify-center gap-2
                                text-white font-bold shadow-lg
                                transition-all duration-150 active:scale-95
                                min-h-[110px] px-3 py-4 disabled:cursor-not-allowed
                            `}
                        >
                            <span className="text-2xl">{style.shape}</span>
                            <span className="text-sm font-semibold text-center leading-tight px-1">
                                {ans.text}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}