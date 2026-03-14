'use client'

import { useState } from 'react'

interface Answer {
    id: number
    text: string
    isCorrect: boolean
    explanation: string
}

interface PoolQuestion {
    quizId: string
    quizTitle: string
    questionIndex: number
    createdBy: string
    contributorName: string
    topicName?: string
    topicId?: string
    subtopic?: string
    type: 'quiz' | 'true_or_false'
    text: string
    answers: Answer[]
    timeLimit: number
    status: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    teacher_approved: { label: 'Approved', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    peer_approved: { label: 'Peer Approved', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
    pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
}

export default function QuestionCard({
    q,
    onEdit,
    onDelete,
}: {
    q: PoolQuestion
    onEdit: (q: PoolQuestion) => void
    onDelete: (q: PoolQuestion) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const statusCfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.pending

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4">
                {/* Tags row */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                    {(q.topicName || q.subtopic) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">
                            📚 {q.topicName}{q.subtopic ? ` › ${q.subtopic}` : ''}
                        </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        {q.type === 'true_or_false' ? '✓/✗ T/F' : '📊 MCQ'}
                    </span>
                </div>

                {/* Question text */}
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.text}</p>

                {/* Contributor */}
                <p className="text-[11px] text-slate-400 mt-2">
                    👤 <span className="font-medium text-slate-500">{q.contributorName}</span>
                    <span className="mx-1">·</span>⏱ {q.timeLimit}s
                </p>
            </div>

            {/* Action bar */}
            <div className="border-t border-slate-100 px-5 py-2.5 flex items-center justify-between gap-3">
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                >
                    {expanded ? '▴ Hide answers' : '▾ Show answers'}
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onEdit(q)}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition-all"
                    >
                        ✏️ Edit
                    </button>
                    <button
                        onClick={() => onDelete(q)}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-all"
                    >
                        🗑️ Delete
                    </button>
                </div>
            </div>

            {/* Expanded answers */}
            {expanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {q.answers.filter(a => a.text.trim()).map((a, i) => (
                        <div key={i} className={`flex items-start gap-3 px-5 py-3 text-xs ${a.isCorrect ? 'bg-green-50' : ''}`}>
                            <span className="font-bold text-slate-400 shrink-0 mt-0.5">
                                {String.fromCharCode(65 + i)}.
                            </span>
                            <div className="flex-1">
                                <p className={a.isCorrect ? 'font-semibold text-green-700' : 'text-slate-600'}>{a.text}</p>
                                {a.isCorrect && a.explanation && (
                                    <p className="text-slate-400 mt-1 italic text-[11px]">💬 {a.explanation}</p>
                                )}
                            </div>
                            {a.isCorrect && <span className="text-green-600 font-bold shrink-0">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
