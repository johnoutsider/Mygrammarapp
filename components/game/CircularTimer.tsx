'use client'

export default function CircularTimer({ timeLeft, timeLimitSec, size = 100 }: {
    timeLeft: number
    timeLimitSec: number
    size?: number
}) {
    const strokeWidth = 7
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const pct = timeLimitSec > 0 ? timeLeft / timeLimitSec : 0
    const offset = circumference * (1 - pct)
    const isLow = timeLeft <= 5
    const isMid = timeLeft > 5 && timeLeft <= 10
    const ringColor = isLow ? '#ef4444' : isMid ? '#facc15' : '#4ade80'
    const glowColor = isLow
        ? '0 0 20px rgba(239,68,68,0.7)'
        : isMid
            ? '0 0 20px rgba(250,204,21,0.5)'
            : '0 0 20px rgba(74,222,128,0.4)'

    return (
        <div className={`relative flex items-center justify-center ${isLow ? 'animate-pulse' : ''}`}
            style={{ width: size, height: size }}>
            <div className="absolute inset-0 rounded-full transition-all duration-500"
                style={{ boxShadow: glowColor, opacity: 0.5 }} />
            <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={ringColor} strokeWidth={strokeWidth} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s ease' }} />
            </svg>
            <div className="relative flex flex-col items-center justify-center">
                <span className="font-extrabold leading-none"
                    style={{ fontSize: timeLeft >= 10 ? '1.8rem' : '2rem', color: ringColor, textShadow: glowColor }}>
                    {timeLeft}
                </span>
                <span className="text-white/40 text-[9px] font-semibold uppercase tracking-widest">sec</span>
            </div>
        </div>
    )
}