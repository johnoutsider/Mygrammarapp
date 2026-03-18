'use client'

import { ReactNode } from 'react'

interface SpeakingCountdownRingProps {
    remainingSeconds: number
    totalSeconds: number
    label?: string
    sublabel?: string
    ringColor?: string
    centerContent?: ReactNode
    showCenterTime?: boolean
    size?: number
    strokeWidth?: number
}

export default function SpeakingCountdownRing({
    remainingSeconds,
    totalSeconds,
    label,
    sublabel,
    ringColor = '#4c75c3',
    centerContent,
    showCenterTime = true,
    size = 420,
    strokeWidth = 28,
}: SpeakingCountdownRingProps) {
    const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
    const center = size / 2
    const radius = center - strokeWidth
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - progress)

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                    <circle cx={center} cy={center} r={radius} stroke="#dbe4f3" strokeWidth={strokeWidth} fill="none" />
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={ringColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    {centerContent || (
                        showCenterTime ? (
                            <div className="text-center">
                                <div className="text-6xl font-bold text-slate-800">{remainingSeconds}s</div>
                            </div>
                        ) : null
                    )}
                </div>
            </div>
            {(label || sublabel || !showCenterTime) && (
                <div className="text-center">
                    <div className="text-4xl font-bold text-slate-800">{remainingSeconds}s</div>
                    {label && <div className="text-base font-semibold text-slate-500 mt-1">{label}</div>}
                    {sublabel && <div className="text-sm text-slate-400 mt-1">{sublabel}</div>}
                </div>
            )}
        </div>
    )
}