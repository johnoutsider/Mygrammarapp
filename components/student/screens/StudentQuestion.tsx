'use client'

import type { ActiveGame } from '@/lib/gameService'

const ANSWER_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500']
const ANSWER_SHAPES = ['▲', '◆', '●', '■']
const TF_COLORS = ['bg-blue-500', 'bg-red-500']
const TF_SHAPES = ['✓', '✗']

export default function StudentQuestion({
    game, currentQ, timeLeft, timeLimitSec, currentUserId, onAnswer
}: {
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
    const colors = isTF ? TF_COLORS : ANSWER_COLORS
    const shapes = isTF ? TF_SHAPES : ANSWER_SHAPES
    const myScore = (game.players as any)?.[currentUserId]?.score || 0

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-400 to-cyan-500 flex flex-col">

            {/* Purple top bar — matches teacher */}
            <div className="bg-purple-700 text-white flex items-center justify-between px-6 py-3">
                <span className="font-bold text-sm">
                    Q{game.currentQuestion + 1} / {game.totalQuestions}
                </span>
                <span className="font-semibold text-sm">{game.quizTitle}</span>
                <span className="font-bold text-sm">{myScore} pts</span>
            </div>

            {/* Green progress bar */}
            <div className="h-1.5 bg-white/30 w-full">
                <div
                    className={`h-full transition-all duration-500 ${timerPct > 50 ? 'bg-green-400' : timerPct > 25 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                    style={{ width: `${timerPct}%` }}
                />
            </div>

            {/* Timer circle + Question */}
            <div className="flex flex-col items-center justify-center px-6 pt-6 pb-4 gap-4">
                {/* Circular timer */}
                <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="6" />
                        <circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke={timerPct > 50 ? '#4ade80' : timerPct > 25 ? '#facc15' : '#f87171'}
                            strokeWidth="6"
                            strokeDasharray={`${2 * Math.PI * 34}`}
                            strokeDashoffset={`${2 * Math.PI * 34 * (1 - timerPct / 100)}`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-bold text-lg leading-tight">
                        {timeLeft}
                        <span className="text-xs font-normal opacity-80">SEC</span>
                    </div>
                </div>

                {/* Question text */}
                <div className="bg-white rounded-2xl px-6 py-4 text-center shadow-md w-full max-w-2xl">
                    <p className="text-gray-900 font-bold text-xl">{currentQ?.text || ''}</p>
                </div>
            </div>

            {/* Time's up banner */}
            {timeLeft === 0 && (
                <div className="text-center text-white font-bold text-lg animate-bounce mb-2">
                    ⏰ Time&apos;s up!
                </div>
            )}

            {/* Answer grid — same colors as teacher */}
            <div className="grid grid-cols-2 gap-4 px-6 pb-6 flex-1">
                {answers.map((ans: any, i: number) => (
                    <button
                        key={ans.id}
                        onClick={() => onAnswer(ans.id)}
                        disabled={timeLeft === 0}
                        className={`
                            ${colors[i] || ANSWER_COLORS[i % 4]}
                            ${timeLeft > 0 ? 'hover:brightness-110 active:scale-95' : 'opacity-50 cursor-not-allowed'}
                            rounded-2xl flex flex-col items-center justify-center gap-2
                            text-white font-bold shadow-lg transition-all duration-150
                            min-h-[130px] px-4 py-5
                        `}
                    >
                        <span className="text-2xl">{shapes[i]}</span>
                        <span className="text-base text-center">{ans.text}</span>
                    </button>
                ))}
            </div>

        </div>
    )
}
