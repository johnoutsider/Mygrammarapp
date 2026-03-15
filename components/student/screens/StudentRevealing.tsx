'use client'

import type { ActiveGame } from '@/lib/gameService'

const SHAPES = [
    { bg: 'bg-orange-500', shape: '▲' },
    { bg: 'bg-blue-500', shape: '◆' },
    { bg: 'bg-green-500', shape: '●' },
    { bg: 'bg-red-500', shape: '■' },
]
const TF_SHAPES = [
    { bg: 'bg-blue-500', shape: '✓' },
    { bg: 'bg-red-500', shape: '✗' },
]

export default function StudentRevealing({
    game, currentQ, currentUserId, selectedAnswerId, pointsEarned, answered
}: {
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
        <div className="min-h-screen bg-gradient-to-br from-teal-400 to-cyan-500 flex flex-col">

            {/* Purple top bar */}
            <div className="bg-purple-700 text-white flex items-center justify-between px-6 py-3">
                <span className="font-bold text-sm">
                    Q{game.currentQuestion + 1} / {game.totalQuestions}
                </span>
                <span className={`font-bold text-sm px-3 py-1 rounded-full ${!answered
                        ? 'bg-orange-600'
                        : wasCorrect
                            ? 'bg-green-500'
                            : 'bg-red-500'
                    }`}>
                    {!answered ? "⏰ Time's up" : wasCorrect ? '✓ Correct!' : '✗ Wrong'}
                </span>
                <span className="font-bold text-sm">{myScore} pts</span>
            </div>

            {/* Points earned banner */}
            {answered && wasCorrect && pointsEarned && (
                <div className="bg-yellow-400 text-yellow-900 text-center font-extrabold py-2 text-lg animate-bounce">
                    🎉 +{pointsEarned} points!
                </div>
            )}

            {/* Question card */}
            <div className="px-6 pt-5 pb-3 flex justify-center">
                <div className="bg-white rounded-2xl px-6 py-4 text-center shadow-md w-full max-w-2xl">
                    <p className="text-gray-900 font-bold text-xl">{currentQ?.text || ''}</p>
                </div>
            </div>

            {/* Answer grid */}
            <div className="grid grid-cols-2 gap-4 px-6 pb-4 flex-1">
                {answers.map((ans: any, i: number) => {
                    const style = styles[i] || SHAPES[i % 4]
                    const isCorrect = ans.isCorrect
                    const isSelected = selectedAnswerId === ans.id

                    return (
                        <div
                            key={ans.id}
                            className={`
                                rounded-2xl flex flex-col items-center justify-center gap-2
                                text-white font-bold shadow-lg px-4 py-5 min-h-[130px]
                                transition-all duration-300
                                ${isCorrect
                                    ? 'bg-green-500 ring-4 ring-white scale-105'
                                    : `${style.bg} opacity-40`
                                }
                            `}
                        >
                            <span className="text-2xl">{style.shape}</span>
                            <span className="text-base text-center">{ans.text}</span>
                            {isCorrect && (
                                <span className="bg-white text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                                    ✓ Correct
                                </span>
                            )}
                            {isSelected && !isCorrect && (
                                <span className="bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    ✗ Your answer
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Waiting bar */}
            <div className="flex justify-center pb-6">
                <div className="bg-black/30 text-white/80 text-sm font-medium px-5 py-2.5 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    Waiting for next question...
                </div>
            </div>

        </div>
    )
}
