'use client'

const TILE_COLORS = ['#f97316', '#818cf8', '#34d399', '#f87171']
const TILE_ICONS = ['▲', '◆', '●', '■']

interface Answer {
    id: number
    text: string
    isCorrect: boolean
    explanation: string
}

interface Question {
    id: number
    text: string
    type: 'quiz' | 'true_or_false'
    timeLimit: number
    answers: Answer[]
}

export default function QuestionEditorCard({
    question,
    index,
    total,
    showAnswers,
    onEdit,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
}: {
    question: Question
    index: number
    total: number
    showAnswers: boolean
    onEdit: () => void
    onDelete: () => void
    onDuplicate: () => void
    onMoveUp: () => void
    onMoveDown: () => void
}) {
    const isFirst = index === 0
    const isLast = index === total - 1

    // Pad answers to always show 4 tiles
    const tiles = question.type === 'true_or_false'
        ? question.answers
        : Array.from({ length: 4 }, (_, i) => question.answers[i] || null)

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex">

                {/* Left — move arrows */}
                <div className="flex flex-col items-center justify-center gap-1 px-3 py-4 border-r border-slate-100 bg-slate-50">
                    <button
                        onClick={onMoveUp}
                        disabled={isFirst}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                            ${isFirst
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                    >
                        ▲
                    </button>
                    <button
                        onClick={onMoveDown}
                        disabled={isLast}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                            ${isLast
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                    >
                        ▼
                    </button>
                </div>

                {/* Right — main content */}
                <div className="flex-1 min-w-0">

                    {/* Top row */}
                    <div className="flex items-start gap-3 px-4 py-3">

                        {/* Edit button */}
                        <button
                            onClick={onEdit}
                            className="shrink-0 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        >
                            ✏️ Edit
                        </button>

                        {/* Question info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">
                                Question {index + 1}
                            </p>
                            <p className="text-sm font-semibold text-slate-800 leading-snug truncate">
                                {question.text || '(No question text)'}
                            </p>
                        </div>

                        {/* Right side actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Time badge */}
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                ⏱ {question.timeLimit}s
                            </span>

                            {/* Type badge */}
                            <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 border border-violet-100 px-2 py-1 rounded-md">
                                {question.type === 'true_or_false' ? 'T/F' : 'MCQ'}
                            </span>

                            {/* Duplicate */}
                            <button
                                onClick={onDuplicate}
                                title="Duplicate"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all text-sm"
                            >
                                📋
                            </button>

                            {/* Delete */}
                            <button
                                onClick={onDelete}
                                title="Delete"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-red-300 hover:bg-red-50 hover:text-red-500 transition-all text-sm"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>

                    {/* Answer tiles */}
                    {showAnswers && (
                        <div className={`grid gap-2 px-4 pb-4 ${question.type === 'true_or_false' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                            {tiles.map((ans, i) => (
                                <div
                                    key={i}
                                    className="rounded-xl px-3 py-2.5 flex items-center gap-2 min-h-[44px] transition-all"
                                    style={{
                                        backgroundColor: ans
                                            ? TILE_COLORS[i] + (ans.isCorrect ? 'ff' : '99')
                                            : '#f1f5f9',
                                        opacity: ans ? 1 : 0.5,
                                    }}
                                >
                                    {ans ? (
                                        <>
                                            <span className="text-white text-sm font-bold shrink-0">
                                                {ans.isCorrect ? '✓' : '✗'}
                                            </span>
                                            <span className={`text-xs leading-snug flex-1 text-center
                                                ${ans.isCorrect
                                                    ? 'text-white font-extrabold'
                                                    : 'text-white/90 font-semibold'}`}>
                                                {ans.text}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-slate-400 flex-1 text-center font-medium italic">
                                            Empty
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}