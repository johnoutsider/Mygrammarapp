'use client'

const GAP_THRESHOLD = 3

interface PoolQuestion {
    createdBy: string
    topicName?: string
    subtopic?: string
    status: string
}

export default function GapAnalysis({ questions }: { questions: PoolQuestion[] }) {
    const approved = questions.filter(q => q.status === 'teacher_approved')

    const coverage: Record<string, {
        topic: string
        subtopic: string
        count: number
        contributors: Set<string>
    }> = {}

    approved.forEach(q => {
        const topic = q.topicName || 'Uncategorised'
        const sub = q.subtopic || '(general)'
        const key = `${topic}|${sub}`
        if (!coverage[key]) {
            coverage[key] = { topic, subtopic: sub, count: 0, contributors: new Set() }
        }
        coverage[key].count++
        coverage[key].contributors.add(q.createdBy)
    })

    const entries = Object.entries(coverage).sort((a, b) => a[1].count - b[1].count)
    const maxCount = Math.max(...entries.map(([, v]) => v.count), GAP_THRESHOLD * 2, 1)
    const gaps = entries.filter(([, v]) => v.count < GAP_THRESHOLD)

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="font-bold text-slate-800 text-base">📊 Coverage Map (Approved Questions)</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {gaps.length} subtopic{gaps.length !== 1 ? 's' : ''} below the {GAP_THRESHOLD}-question threshold
                    </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Needs more
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Well covered
                    </span>
                </div>
            </div>

            {entries.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No approved questions yet.</p>
            ) : (
                <div className="space-y-2.5">
                    {entries.map(([key, { topic, subtopic, count, contributors }]) => {
                        const isGap = count < GAP_THRESHOLD
                        const pct = Math.max(Math.round((count / maxCount) * 100), 3)
                        return (
                            <div key={key} className="flex items-center gap-3">
                                <div className="w-48 shrink-0">
                                    <p className="text-[11px] font-semibold text-slate-700 truncate">{subtopic}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{topic}</p>
                                </div>
                                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${isGap ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className={`text-xs font-bold w-10 text-right shrink-0 ${isGap ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {count}Q
                                </span>
                                <span className="text-[10px] text-slate-400 w-20 text-right shrink-0">
                                    {contributors.size} contributor{contributors.size !== 1 ? 's' : ''}
                                </span>
                                {isGap && (
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
                                        ⚠️ Gap
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}