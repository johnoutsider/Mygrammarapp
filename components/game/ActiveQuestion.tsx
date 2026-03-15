'use client'

import CircularTimer from './CircularTimer'
import MuteButton from './MuteButton'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

const ANSWER_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500']
const ANSWER_SHAPES = ['▲', '◆', '●', '■']
const TF_COLORS = ['bg-blue-500', 'bg-red-500']
const TF_SHAPES = ['✓', '✗']

export default function ActiveQuestion({ game, currentQ, timeLeft, timeLimitSec, players, answeredCount, muted, onMuteToggle, onEndEarly }: {
    game: ActiveGame
    currentQ: any
    timeLeft: number
    timeLimitSec: number
    players: [string, GamePlayer][]
    answeredCount: number
    muted: boolean
    onMuteToggle: () => void
    onEndEarly: () => void
}) {
    const playerCount = players.length
    const timerPct = (timeLeft / timeLimitSec) * 100
    const isTF = currentQ?.type === 'true_or_false'
    const colors = isTF ? TF_COLORS : ANSWER_COLORS
    const shapes = isTF ? TF_SHAPES : ANSWER_SHAPES
    const answers = currentQ?.answers || []
    const answeredPct = playerCount > 0 ? (answeredCount / playerCount) * 100 : 0

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-500 flex flex-col">
            {/* Purple top bar */}
            <div className="bg-purple-700 px-6 py-3 flex items-center justify-between shadow-lg">
                <span className="text-white/80 text-sm font-semibold">
                    Q{game.currentQuestion + 1} / {game.totalQuestions}
                </span>
                <span className="text-white font-bold text-sm truncate max-w-xs text-center">{game.quizTitle}</span>
                <div className="flex items-center gap-3">
                    <MuteButton muted={muted} onToggle={onMuteToggle} />
                    <button onClick={onEndEarly} className="text-white/60 hover:text-white text-sm font-semibold transition-colors">
                        End
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-black/20">
                <div
                    className="h-full rounded-r-full transition-colors duration-300"
                    style={{
                        width: `${timerPct}%`,
                        backgroundColor: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#facc15' : '#4ade80',
                        transition: 'width 0.5s linear',
                    }}
                />
            </div>

            <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 max-w-5xl mx-auto w-full">
                {/* Timer + Question */}
                <div className="flex items-center gap-4">
                    <CircularTimer timeLeft={timeLeft} timeLimitSec={timeLimitSec} size={96} />
                    <div className="flex-1 bg-white rounded-3xl shadow-2xl px-8 py-7 flex items-center justify-center min-h-[110px]">
                        <h2 className="text-2xl md:text-4xl font-bold text-center text-gray-800 leading-snug">
                            {currentQ?.text || ''}
                            {currentQ?.topicName && (
                                <span className="block text-sm font-normal text-gray-400 mt-2">
                                    {currentQ.topicName}{currentQ.subtopic ? ` · ${currentQ.subtopic}` : ''}
                                </span>
                            )}
                        </h2>
                    </div>
                </div>

                {/* Answer grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    {answers.map((ans: any, i: number) => (
                        <div key={ans.id} className={`${colors[i] || ANSWER_COLORS[i]} rounded-3xl shadow-xl flex items-center gap-5 px-7 py-6 min-h-[110px] md:min-h-[130px]`}>
                            <span className="text-white/70 text-3xl font-extrabold shrink-0 w-8 text-center">
                                {shapes[i]}
                            </span>
                            <span className="text-white text-xl md:text-2xl font-bold leading-snug">{ans.text}</span>
                        </div>
                    ))}
                </div>

                {/* Answered bar */}
                <div className="bg-white/20 backdrop-blur rounded-2xl px-6 py-3 flex items-center gap-4">
                    <div className="flex-1 bg-white/30 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${answeredPct}%` }} />
                    </div>
                    <span className="text-white font-bold text-sm shrink-0">
                        {answeredCount} / {playerCount} answered
                    </span>
                </div>
            </div>
        </div>
    )
}