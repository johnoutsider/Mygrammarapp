'use client'

import { Volume2 } from 'lucide-react'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

// Active state colors
const ANSWER_COLORS = ['bg-[#F99F1A]', 'bg-[#3B77F4]', 'bg-[#15D172]', 'bg-[#F34D3A]']
const TF_COLORS    = ['bg-[#3B77F4]', 'bg-[#F34D3A]']
const TF_SHAPES    = ['✓', '✗']

export default function ActiveQuestion({
    game, currentQ, timeLeft, timeLimitSec,
    players, answeredCount, muted, onMuteToggle, onEndEarly
}: {
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
    const isTeamMode = game.participation === 'team'
    const playerCount = players.length
    const isTF = currentQ?.type === 'true_or_false'
    const colors = isTF ? TF_COLORS : ANSWER_COLORS
    const answers = currentQ?.answers || currentQ?.options || []

    // ── Team answered count ───────────────────────────────────────────────────
    const teams = Object.entries(game.teams || {}).map(([id, t]: any) => {
        const memberUids = Object.keys(t.members || {})
        const answeredInTeam = memberUids.filter(
            uid => (game.players as any)?.[uid]?.answered === true
        ).length
        return { id, answered: answeredInTeam, total: memberUids.length }
    })
    const totalRespondents = isTeamMode ? teams.length : playerCount
    const totalAnswered    = isTeamMode ? teams.filter(t => t.answered === t.total && t.total > 0).length : answeredCount

    // ── Stopwatch arc ─────────────────────────────────────────────────────────
    const pct = timeLimitSec > 0 ? timeLeft / timeLimitSec : 0
    const arcR = 36
    const arcCircumference = 2 * Math.PI * arcR // ≈ 226
    const arcOffset = arcCircumference * (1 - pct)

    return (
        <div className="flex flex-col h-screen bg-white font-sans overflow-hidden select-none">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="bg-[#924A9A] flex justify-between items-center shrink-0 h-[56px] relative px-[25px] py-[15px]">
                {/* Left: Question counter */}
                <div
                    className="text-white font-black text-[22px] tracking-wide w-1/3"
                    style={{ textShadow: '1px 1px 0px rgba(0,0,0,0.2)' }}
                >
                    Question {game.currentQuestion + 1}/{game.totalQuestions}
                </div>

                {/* Center: quiz title */}
                <div
                    className="absolute left-1/2 -translate-x-1/2 text-white/70 font-bold text-[15px] tracking-wide truncate max-w-[260px]"
                >
                    {isTeamMode ? `👥 ${game.quizTitle}` : game.quizTitle}
                </div>

                {/* Right: Sound + End */}
                <div className="flex items-center justify-end gap-3 w-1/3 mr-2">
                    <button
                        onClick={onMuteToggle}
                        className="flex items-center gap-2.5 border-[1.5px] border-white/20 hover:bg-white/10 text-white px-4 py-1.5 rounded-[10px] font-bold text-[15px] transition-colors"
                    >
                        <Volume2
                            className={`w-[18px] h-[18px] ${muted ? 'text-gray-400 fill-gray-400' : 'text-[#3B77F4] fill-[#D6D6D6]'}`}
                            strokeWidth={2.5}
                        />
                        <span>{muted ? 'Muted' : 'Sound On'}</span>
                    </button>
                    <button
                        onClick={onEndEarly}
                        className="bg-[#D34152] hover:bg-[#E84A5E] text-white px-5 py-1.5 rounded-[14px] font-bold text-[15px] transition-colors shadow-sm"
                    >
                        End
                    </button>
                </div>
            </div>

            {/* ── Main content ─────────────────────────────────────────────────── */}
            <div className="flex-1 flex px-10 py-6 gap-4 min-h-0">

                {/* Left: Question text — fills all remaining space */}
                <div className="flex-1 flex items-center justify-center px-6">
                    <div>
                        <h1 className="text-[#4D4D4D] text-[34px] leading-snug text-center font-normal">
                            {currentQ?.text || ''}
                        </h1>
                        {currentQ?.topicName && (
                            <p className="text-gray-400 text-sm mt-3 text-center">
                                {currentQ.topicName}{currentQ.subtopic ? ` · ${currentQ.subtopic}` : ''}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: Timer panel */}
                <div className="w-[220px] border-[1.5px] border-[#D6D6D6] rounded-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col items-center py-6 px-4 shrink-0 bg-white ml-8 my-auto h-[280px]">

                    {/* Stopwatch graphic */}
                    <div className="relative w-[110px] h-[120px] mb-2">
                        <svg width="110" height="120" viewBox="0 0 120 120" className="overflow-visible">
                            {/* Top buttons */}
                            <rect x="50" y="-8" width="20" height="12" rx="3" fill="#D1D5DB" />
                            <rect x="44" y="2" width="32" height="6" rx="2" fill="#9CA3AF" />
                            <g transform="translate(95, 15) rotate(45)">
                                <rect x="-8" y="-12" width="16" height="12" rx="2" fill="#D1D5DB" />
                                <rect x="-12" y="-2" width="24" height="6" rx="2" fill="#9CA3AF" />
                            </g>

                            {/* Body */}
                            <circle cx="60" cy="60" r="50" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="4" />
                            <circle cx="60" cy="60" r="42" fill="#FFFFFF" />

                            {/* Track */}
                            <circle cx="60" cy="60" r={arcR} fill="none" stroke="#F3F4F6" strokeWidth="6" />

                            {/* Progress arc */}
                            <circle
                                cx="60" cy="60" r={arcR}
                                fill="none"
                                stroke={timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#facc15' : '#00D4E5'}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={arcCircumference}
                                strokeDashoffset={arcOffset}
                                transform="rotate(-90 60 60)"
                                style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s ease' }}
                            />

                            {/* Time number */}
                            <text
                                x="60" y="75"
                                fontFamily="sans-serif"
                                fontSize="42"
                                fontWeight="900"
                                fill="#333333"
                                textAnchor="middle"
                                style={{ letterSpacing: '-1px' }}
                            >
                                {timeLeft}
                            </text>
                        </svg>
                    </div>

                    {/* Score */}
                    <div className="text-[#333333] font-black text-[42px] tracking-tight mb-2">
                        {totalAnswered}{' '}
                        <span className="text-[#999] font-semibold text-[32px]">/ {totalRespondents}</span>
                    </div>

                    {/* Skip button */}
                    <button
                        onClick={onEndEarly}
                        className="bg-[#00D4E5] border-b-[4px] border-[#00B4C4] hover:bg-[#00C5D5] active:border-b-0 active:translate-y-[4px] text-white font-bold text-[18px] px-8 py-2 rounded-[6px] flex items-center justify-center gap-1.5 transition-all w-[90%] mt-auto"
                    >
                        Skip &raquo;
                    </button>
                </div>
            </div>

            {/* ── Answers grid ─────────────────────────────────────────────────── */}
            <div className="h-[40%] min-h-[260px] max-h-[320px] w-full p-2.5 grid grid-cols-2 grid-rows-2 gap-2.5 shrink-0 bg-white">
                {answers.map((ans: any, i: number) => (
                    <button
                        key={ans.id}
                        className={`${colors[i] || ANSWER_COLORS[i % 4]} rounded-[6px] relative flex items-center justify-center transition-colors hover:brightness-95`}
                    >
                        {isTF && (
                            <span className="absolute left-6 text-white text-[28px] font-bold opacity-70">
                                {TF_SHAPES[i]}
                            </span>
                        )}
                        <span className="text-white text-[32px] font-normal tracking-wide text-center px-4">
                            {ans.text}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── Floating help button ─────────────────────────────────────────── */}
            <button className="fixed bottom-2 right-2 w-7 h-7 bg-[#333333] hover:bg-[#222222] text-[#999999] rounded-full flex items-center justify-center font-bold text-sm shadow-md z-50">
                ?
            </button>
        </div>
    )
}
