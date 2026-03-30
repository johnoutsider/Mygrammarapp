'use client'

import { Volume2 } from 'lucide-react'
import { showLeaderboard } from '@/lib/gameService'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

// Active colors (full saturation)
const ANSWER_COLORS_ACTIVE  = ['bg-[#F99F1A]', 'bg-[#3B77F4]', 'bg-[#15D172]', 'bg-[#F34D3A]']
// Faded / result colors
const ANSWER_COLORS_RESULT  = ['bg-[#FBD08F]', 'bg-[#9CBDFB]', 'bg-[#87E3B6]', 'bg-[#F74F3B]']
const ANSWER_COLORS_HEX     = ['#FBD08F',      '#9CBDFB',      '#87E3B6',      '#F74F3B']
const TF_ACTIVE             = ['bg-[#3B77F4]', 'bg-[#F34D3A]']
const TF_RESULT             = ['bg-[#9CBDFB]', 'bg-[#F74F3B]']
const TF_HEX                = ['#9CBDFB',      '#F74F3B']

// Left-column indices: answers 0 & 2, Right-column indices: answers 1 & 3
const LEFT_INDICES  = [0, 2]
const RIGHT_INDICES = [1, 3]

export default function RevealScreen({
    game, currentQ, players, answeredCount, answerVotes, revealCountdown, muted, onMuteToggle, onEndEarly
}: {
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
    const resultColors = isTF ? TF_RESULT : ANSWER_COLORS_RESULT
    const hexColors    = isTF ? TF_HEX   : ANSWER_COLORS_HEX
    const answers = currentQ?.answers || currentQ?.options || []

    const totalVotes   = Object.values(answerVotes).reduce((a, b) => a + b, 0)
    const correctIds   = answers.filter((a: any) => a.isCorrect).map((a: any) => a.id)
    const correctVotes = correctIds.reduce((s: number, id: number) => s + (answerVotes[id] || 0), 0)
    const correctPct   = totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0

    // Build donut segments
    const donutR = 32
    const donutCircumference = 2 * Math.PI * donutR // ≈ 201
    let cumulativeOffset = 0
    const donutSegments = answers.map((ans: any, i: number) => {
        const votes   = answerVotes[ans.id] || 0
        const segPct  = totalVotes > 0 ? votes / totalVotes : 0
        const length  = segPct * donutCircumference
        const offset  = -cumulativeOffset
        cumulativeOffset += length
        return { length, offset, color: hexColors[i] || ANSWER_COLORS_HEX[i % 4], votes, isCorrect: ans.isCorrect }
    })

    const getVotes = (i: number) => answerVotes[answers[i]?.id] ?? 0

    return (
        <div className="flex flex-col h-screen bg-white font-sans overflow-hidden select-none">

            {/* ── Header ────────────────────────────────────────────────────────── */}
            <div className="bg-[#924A9A] flex justify-between items-center shrink-0 h-[56px] relative px-[25px] py-[15px]">
                {/* Left */}
                <div
                    className="text-white font-black text-[22px] tracking-wide w-1/3"
                    style={{ textShadow: '1px 1px 0px rgba(0,0,0,0.2)' }}
                >
                    Question {game.currentQuestion + 1}/{game.totalQuestions}
                </div>

                {/* Center: Results label */}
                <div
                    className="absolute left-1/2 -translate-x-1/2 text-white font-black text-[26px] tracking-wide"
                    style={{ textShadow: '1px 1px 0px rgba(0,0,0,0.2)' }}
                >
                    Results
                </div>

                {/* Right */}
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

            {/* ── Main content ──────────────────────────────────────────────────── */}
            <div className="flex-1 flex px-10 py-6 gap-4 min-h-0">

                {/* Left: Question text */}
                <div className="flex-1 flex items-center justify-center max-w-[32%] px-6">
                    <h1 className="text-[#4D4D4D] text-[34px] leading-snug text-center font-normal">
                        {currentQ?.text || ''}
                    </h1>
                </div>

                {/* Middle: Vote boxes + Donut chart */}
                <div className="flex-[2] flex items-center justify-center gap-8">

                    {/* Left column: answers 0 & 2 */}
                    <div className="flex flex-col gap-6">
                        {LEFT_INDICES.map(i => answers[i] && (
                            <div
                                key={i}
                                className="w-[84px] h-[84px] rounded-[8px] flex items-center justify-center text-white text-[32px] font-black"
                                style={{ backgroundColor: hexColors[i] || ANSWER_COLORS_HEX[i % 4] }}
                            >
                                {getVotes(i)}
                            </div>
                        ))}
                    </div>

                    {/* Center: Donut chart */}
                    <div className="relative w-[190px] h-[190px]">
                        <svg
                            viewBox="0 0 100 100"
                            className="w-full h-full transform -rotate-90 drop-shadow-sm"
                        >
                            {/* Background ring */}
                            <circle
                                cx="50" cy="50" r={donutR}
                                fill="none"
                                stroke="#F3F4F6"
                                strokeWidth="22"
                            />
                            {/* Segments */}
                            {donutSegments.map((seg, i) =>
                                seg.length > 0 ? (
                                    <circle
                                        key={i}
                                        cx="50" cy="50" r={donutR}
                                        fill="none"
                                        stroke={seg.color}
                                        strokeWidth="22"
                                        strokeLinecap="butt"
                                        strokeDasharray={`${seg.length} ${donutCircumference - seg.length}`}
                                        strokeDashoffset={seg.offset}
                                        style={{ transition: 'all 0.8s ease' }}
                                    />
                                ) : null
                            )}
                        </svg>

                        {/* Center label */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-[76px] h-[76px] bg-white rounded-full flex items-center justify-center relative shadow-sm">
                                <div className="absolute left-[-22px] top-1/2 -translate-y-1/2 w-[22px] h-[1.5px] bg-[#D6D6D6]" />
                                <span className="text-[#333] text-[24px] font-black tracking-tight">
                                    {correctPct}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right column: answers 1 & 3 */}
                    <div className="flex flex-col gap-6">
                        {RIGHT_INDICES.map(i => answers[i] && (
                            <div
                                key={i}
                                className="w-[84px] h-[84px] rounded-[8px] flex items-center justify-center text-white text-[32px] font-black"
                                style={{ backgroundColor: hexColors[i] || ANSWER_COLORS_HEX[i % 4] }}
                            >
                                {getVotes(i)}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Countdown panel */}
                <div className="w-[220px] border-[1.5px] border-[#D6D6D6] rounded-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center py-6 px-4 shrink-0 bg-white ml-8 my-auto h-[280px] gap-4">
                    <div className="text-[#9CA3AF] text-sm font-semibold text-center">
                        Next in
                    </div>
                    <div className="text-[#333333] font-black text-[72px] leading-none tracking-tight">
                        {revealCountdown}
                    </div>
                    <div className="text-[#9CA3AF] text-xs font-medium text-center">
                        {answeredCount}/{playerCount} answered
                    </div>
                    <button
                        onClick={() => showLeaderboard()}
                        className="bg-[#00D4E5] border-b-[4px] border-[#00B4C4] hover:bg-[#00C5D5] active:border-b-0 active:translate-y-[4px] text-white font-bold text-[18px] px-8 py-2 rounded-[6px] flex items-center justify-center gap-1.5 transition-all w-[90%] mt-auto"
                    >
                        Skip &raquo;
                    </button>
                </div>
            </div>

            {/* ── Answers grid (faded, with ✓/× markers) ───────────────────────── */}
            <div className="h-[40%] min-h-[260px] max-h-[320px] w-full p-2.5 grid grid-cols-2 grid-rows-2 gap-2.5 shrink-0 bg-white">
                {answers.map((ans: any, i: number) => (
                    <button
                        key={ans.id}
                        className={`${resultColors[i] || ANSWER_COLORS_RESULT[i % 4]} rounded-[6px] relative flex items-center justify-center transition-colors hover:brightness-95`}
                    >
                        {/* ✓ or × marker */}
                        <span className="absolute left-6 text-white text-[20px] font-medium">
                            {ans.isCorrect ? '✓' : '×'}
                        </span>
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
