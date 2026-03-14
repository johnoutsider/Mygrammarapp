'use client'

import type { ActiveGame } from '@/lib/gameService'

const SHAPES = [
    { bg: 'bg-red-500', shape: '▲' },
    { bg: 'bg-blue-600', shape: '◆' },
    { bg: 'bg-yellow-400', shape: '●' },
    { bg: 'bg-green-600', shape: '■' },
]
const TF_SHAPES = [
    { bg: 'bg-blue-500', shape: '✓' },
    { bg: 'bg-red-500', shape: '✗' },
]

export default function StudentRevealing({ game, currentQ, currentUserId, selectedAnswerId, pointsEarned, answered }: {
    game: ActiveGame
    currentQ: any
    currentUserId: string
    selectedAnswerId: number | null
    pointsEarned: number | null
    answered: boolean
}) {
    const isTF = currentQ?.type === 'true_or_false'
    const answers = currentQ?.answers || []
    const styles = isTF ? TF_SHAPES : SHAPES
    const myScore = (game.players as any)?.[currentUserId]?.score || 0
    const wasCorrect = pointsEarned !== null && pointsEarned > 0

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">

            {/* Header */}
            <div className="px-4 pt-5 pb-3 flex items-center justify-between">
                <span className="text-white/60 text-xs">
                    Q {game.currentQuestion + 1}/{game.totalQuestions}
                </span>
                <span className={`text-sm font-bold px-3 py-1 rounded-lg
                    ${!answered
                        ? 'bg-orange-500/20 text-orange-400'
                        : wasCorrect
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'}`}>
                    {!answered ? "⏰ Time's up" : wasCorrect ? '✓ Correct' : '✗ Wrong'}
                </span>
                <span className="text-white/60 text-xs">{myScore} pts</span>
            </div>

            {/* Question */}
            <div className="px-4 pb-3 flex items-center justify-center">
                <h2 className="text-lg font-bold text-white text-center leading-snug max-w-sm">
                    {currentQ?.text || ''}
                </h2>
            </div>

            {/* Points banner */}
            {answered && wasCorrect && pointsEarned && (
                <div className="mx-4 mb-3 bg-green-500/20 text-green-300 rounded-xl p-2 text-center font-bold">
                    +{pointsEarned} points!
                </div>
            )}

            {/* Answer tiles */}
            <div className="flex-1 grid grid-cols-2 gap-3 p-3 pb-4">
                {answers.map((ans: any, i: number) => {
                    const style = styles[i] || SHAPES[i]
                    const isCorrect = ans.isCorrect
                    const isSelected = selectedAnswerId === ans.id
                    return (
                        <div key={ans.id}
                            className={`rounded-2xl flex flex-col items-center justify-center gap-2
                                min-h-[110px] px-3 py-4 transition-all duration-500
                                ${isCorrect
                                    ? 'bg-green-500 ring-4 ring-white scale-[1.02] shadow-xl'
                                    : isSelected
                                        ? style.bg + ' opacity-40'
                                        : style.bg + ' opacity-20'}`}>
                            <span className="text-2xl text-white">{style.shape}</span>
                            <span className="text-sm font-semibold text-white text-center leading-tight px-1">
                                {ans.text}
                            </span>
                            {isCorrect && (
                                <span className="text-white font-bold text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                    ✓ Correct
                                </span>
                            )}
                            {isSelected && !isCorrect && (
                                <span className="text-white font-bold text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                    ✗ Your answer
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Waiting for next */}
            <div className="pb-6 flex justify-center">
                <div className="flex items-center gap-3 bg-white/10 px-5 py-3 rounded-2xl">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
                    </span>
                    <span className="text-violet-300 text-sm">Waiting for next question...</span>
                </div>
            </div>
        </div>
    )
}