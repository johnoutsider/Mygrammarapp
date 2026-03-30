'use client'

interface SpeakingCountdownRingProps {
    remainingSeconds: number
    totalSeconds: number
    label?: string
    sublabel?: string
    size?: number
    strokeWidth?: number
}

export default function SpeakingCountdownRing({
    remainingSeconds,
    totalSeconds,
    label,
    sublabel,
    size = 160,
    strokeWidth = 10,
}: SpeakingCountdownRingProps) {
    const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
    const center = size / 2
    const radius = center - strokeWidth
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - progress)
    const isUrgent = remainingSeconds <= 8 && remainingSeconds > 0

    return (
        <div className="flex flex-col items-center gap-3">
            {/* Ring */}
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    className="w-full h-full -rotate-90"
                    viewBox={`0 0 ${size} ${size}`}
                    aria-hidden="true"
                >
                    <circle
                        cx={center} cy={center} r={radius}
                        stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none"
                    />
                    <circle
                        cx={center} cy={center} r={radius}
                        stroke={isUrgent ? '#ef4444' : '#5b7ec9'}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-extrabold text-slate-900">{remainingSeconds}s</span>
                </div>
            </div>

            {/* Labels */}
            {(label || sublabel) && (
                <div className="text-center">
                    {label && <div className="text-sm font-bold text-slate-800">{label}</div>}
                    {sublabel && <div className="text-xs text-slate-400 mt-0.5">{sublabel}</div>}
                </div>
            )}
        </div>
    )
}
