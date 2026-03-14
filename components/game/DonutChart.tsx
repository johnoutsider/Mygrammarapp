'use client'

export default function DonutChart({ segments, correctPct, size = 190 }: {
    segments: { color: string; pct: number }[]
    correctPct: number
    size?: number
}) {
    const strokeWidth = 44
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    let cumulative = 0

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
                {segments.map((seg, i) => {
                    if (seg.pct <= 0) return null
                    const length = seg.pct * circumference
                    const dashOffset = -cumulative
                    cumulative += length
                    return (
                        <circle key={i}
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none" stroke={seg.color}
                            strokeWidth={strokeWidth} strokeLinecap="butt"
                            strokeDasharray={`${length} ${circumference - length}`}
                            strokeDashoffset={dashOffset}
                            style={{ transition: 'all 0.8s ease' }} />
                    )
                })}
            </svg>
            <div className="relative flex flex-col items-center justify-center z-10">
                <span className="text-3xl font-extrabold text-white leading-none">{correctPct}%</span>
                <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mt-0.5">correct</span>
            </div>
        </div>
    )
}