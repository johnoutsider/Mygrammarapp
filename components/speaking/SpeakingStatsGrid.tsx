'use client'

interface SpeakingStatsGridProps {
    timerText: string
    speakingTimeText: string
    warningCount: number
    faceCount: number
    wpm: number
}

export default function SpeakingStatsGrid({
    timerText,
    speakingTimeText,
    warningCount,
    faceCount,
    wpm,
}: SpeakingStatsGridProps) {
    const stats = [
        { label: 'Session Time', value: timerText },
        { label: 'Speaking Time', value: speakingTimeText },
        { label: 'Warnings', value: String(warningCount) },
        { label: 'Faces', value: String(faceCount) },
        { label: 'Words / Min', value: String(wpm) },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.map(stat => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{stat.label}</div>
                    <div className="text-2xl font-bold text-slate-800 mt-2">{stat.value}</div>
                </div>
            ))}
        </div>
    )
}
