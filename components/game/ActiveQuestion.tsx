'use client'

import CircularTimer from './CircularTimer'
import MuteButton from './MuteButton'
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
    const styles = currentQ?.type === 'true_or_false' ? TF_STYLES : QUIZ_STYLES
    const answers = currentQ?.answers || []
    const hasImage = !!currentQ?.imageUrl

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">

            {/* Top bar */}
            <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                <span className="text-slate-300 font-semibold text-sm">
                    Q {game.currentQuestion + 1} / {game.totalQuestions}
                </span>
                <span className="text-white font-bold">{game.quizTitle}</span>
                <div className="flex items-center gap-3">
                    <MuteButton muted={muted} onToggle={onMuteToggle} />
                    <button onClick={onEndEarly} className="text-red-400 hover:text-red-300 text-sm font-semibold">
                        End Game
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-700">
                <div className={`h-full transition-all duration-500 ${timerPct > 50 ? 'bg-green-400' : timerPct > 25 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${timerPct}%` }} />
            </div>

            <div className="flex-1 flex flex-col">

                {/* Question area */}
                <div className="flex-1 flex items-center justify-center px-8 py-6 relative">

                    {/* Timer top-left */}
                    <div className="absolute top-4 left-6">
                        <CircularTimer timeLeft={timeLeft} timeLimitSec={timeLimitSec} size={100} />
                    </div>

                    {hasImage ? (
                        <div className="flex items-center gap-10 w-full max-w-5xl">
                            <div className="flex-1 text-center">
                                <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                                    {currentQ.text}
                                </h2>
                                {currentQ.topicName && (
                                    <span className="inline-block bg-white/10 text-violet-300 text-sm px-3 py-1 rounded-full mt-3">
                                        {currentQ.topicName}{currentQ.subtopic ? ` · ${currentQ.subtopic}` : ''}
                                    </span>
                                )}
                            </div>
                            <div className="w-80 h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl shrink-0">
                                <img src={currentQ.imageUrl} alt="Question image" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl w-full text-center">
                            {currentQ ? (
                                <>
                                    <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-4">
                                        {currentQ.text}
                                    </h2>
                                    {currentQ.topicName && (
                                        <span className="inline-block bg-white/10 text-violet-300 text-sm px-3 py-1 rounded-full mt-2">
                                            {currentQ.topicName}{currentQ.subtopic ? ` · ${currentQ.subtopic}` : ''}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <div className="animate-pulse h-12 bg-white/10 rounded-xl w-3/4 mx-auto" />
                            )}
                        </div>
                    )}
                </div>

                {/* Answer grid */}
                <div className="grid grid-cols-2 gap-3 px-6 pb-4">
                    {answers.map((ans: any, i: number) => {
                        const s = styles[i] || QUIZ_STYLES[i]
                        return (
                            <div key={ans.id} className={`${s.bg} rounded-2xl px-5 py-4 flex items-center gap-4`}>
                                <span className="text-white text-3xl font-bold">{s.shape}</span>
                                <span className="text-white font-bold text-lg leading-snug">{ans.text}</span>
                            </div>
                        )
                    })}
                </div>

                {/* Bottom bar */}
                <div className="bg-slate-800 border-t border-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            {players.map(([uid, p]) => (
                                <div key={uid}
                                    className={`w-3 h-3 rounded-full transition-colors ${p.answered ? 'bg-green-400' : 'bg-slate-600'}`}
                                    title={p.name} />
                            ))}
                        </div>
                        <span className="text-slate-300 text-sm font-medium">
                            {answeredCount} / {playerCount} answered
                        </span>
                    </div>
                    <span className="text-slate-500 text-sm">Auto-reveals when timer ends</span>
                </div>
            </div>
        </div>
    )
}