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
    questionIndex: number
    text: string
    timeLimit: number
    answers: Answer[]
}

export default function EditModal({
    q,
    onClose,
    onSave,
}: {
    q: PoolQuestion
    onClose: () => void
    onSave: (quizId: string, questionIndex: number, updated: { text: string; timeLimit: number; answers: Answer[] }) => Promise<void>
}) {
    const [text, setText] = useState(q.text)
    const [timeLimit, setTimeLimit] = useState(q.timeLimit)
    const [answers, setAnswers] = useState<Answer[]>(q.answers.map(a => ({ ...a })))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const setCorrect = (index: number) => {
        setAnswers(prev => prev.map((a, i) => ({ ...a, isCorrect: i === index })))
    }

    const setAnswerText = (index: number, value: string) => {
        setAnswers(prev => prev.map((a, i) => i === index ? { ...a, text: value } : a))
    }

    const handleSave = async () => {
        if (!text.trim()) { setError('Question text cannot be empty.'); return }
        const hasCorrect = answers.some(a => a.isCorrect)
        if (!hasCorrect) { setError('Please mark at least one answer as correct.'); return }
        setSaving(true)
        try {
            await onSave(q.quizId, q.questionIndex, { text, timeLimit, answers })
            onClose()
        } catch {
            setError('Failed to save. Please try again.')
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-800">✏️ Edit Question</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none">×</button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">

                    {/* Question text */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Question Text</label>
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                        />
                    </div>

                    {/* Time limit */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Time Limit (seconds)</label>
                        <input
                            type="number"
                            min={5}
                            max={120}
                            value={timeLimit}
                            onChange={e => setTimeLimit(Number(e.target.value))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                    </div>

                    {/* Answers */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">
                            Answers <span className="text-slate-400 font-normal">(click ✓ to mark correct)</span>
                        </label>
                        <div className="space-y-2">
                            {answers.map((a, i) => (
                                <div key={i} className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-colors ${a.isCorrect ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}`}>
                                    <button
                                        onClick={() => setCorrect(i)}
                                        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${a.isCorrect ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 text-slate-300 hover:border-green-400'}`}
                                    >
                                        ✓
                                    </button>
                                    <span className="text-xs font-bold text-slate-400 shrink-0">{String.fromCharCode(65 + i)}.</span>
                                    <input
                                        type="text"
                                        value={a.text}
                                        onChange={e => setAnswerText(i, e.target.value)}
                                        className="flex-1 text-sm text-slate-800 bg-transparent focus:outline-none"
                                        placeholder={`Answer ${String.fromCharCode(65 + i)}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 px-5 py-2 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}