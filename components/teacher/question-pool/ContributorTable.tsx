'use client'

interface PoolQuestion {
    createdBy: string
    contributorName: string
    subtopic?: string
    status: string
}

export default function ContributorTable({ questions }: { questions: PoolQuestion[] }) {
    const approved = questions.filter(q => q.status === 'teacher_approved')

    const byContributor: Record<string, { name: string; count: number; subtopics: Set<string> }> = {}
    approved.forEach(q => {
        if (!byContributor[q.createdBy]) {
            byContributor[q.createdBy] = { name: q.contributorName, count: 0, subtopics: new Set() }
        }
        byContributor[q.createdBy].count++
        if (q.subtopic) byContributor[q.createdBy].subtopics.add(q.subtopic)
    })

    const rows = Object.entries(byContributor).sort((a, b) => b[1].count - a[1].count)
    if (rows.length === 0) return null

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-base">👥 Contributor Breakdown</h2>
                <p className="text-xs text-slate-400 mt-0.5">Approved questions per student</p>
            </div>
            <div className="divide-y divide-slate-50">
                {rows.map(([uid, { name, count, subtopics }]) => (
                    <div key={uid} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #1a9aaa 0%, #127080 100%)' }}>
                            {name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                            <p className="text-[10px] text-slate-400">
                                {subtopics.size} subtopic{subtopics.size !== 1 ? 's' : ''} covered
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-slate-800">{count}</p>
                            <p className="text-[10px] text-slate-400">questions</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}