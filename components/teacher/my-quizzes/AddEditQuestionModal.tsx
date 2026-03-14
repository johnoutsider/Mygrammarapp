'use client'

import { useState, useEffect } from 'react'

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

const TILE_COLORS = ['#f97316', '#818cf8', '#34d399', '#f87171']
const TILE_LABELS = ['Answer 1', 'Answer 2', 'Answer 3', 'Answer 4']

const DEFAULT_ANSWERS: Answer[] = [
    { id: 1, text: '', isCorrect: true, explanation: '' },
    { id: 2, text: '', isCorrect: false, explanation: '' },
    { id: 3, text: '', isCorrect: false, explanation: '' },
    { id: 4, text: '', isCorrect: false, explanation: '' },
]

const TF_ANSWERS: Answer[] = [
    { id: 1, text: 'True', isCorrect: true, explanation: '' },
    { id: 2, text: 'False', isCorrect: false, explanation: '' },
]

export default function AddEditQuestionModal({
    mode,
    questionIndex,
    existingQuestion,
    onSave,
    onClose,
}: {
    mode: 'add' | 'edit'
    questionIndex: number | null
    existingQuestion?: Question | null
    onSave: (question: Question, index: number | null) => void
    onClose: () => void
}) {
    const [text, setText] = useState('')
    const [type, setType] = useState<'quiz' | 'true_or_false'>('quiz')
    const [timeLimit, setTimeLimit] = useState(20)
    const [answers, setAnswers] = useState<Answer[]>(DEFAULT_ANSWERS.map(a => ({ ...a })))
    const [error, setError] = useState('')

    // Pre-fill when editing
    useEffect(() => {
        if (mode === 'edit' && existingQuestion) {
            setText(existingQuestion.text)
            setType(existingQuestion.type)
            setTimeLimit(existingQuestion.timeLimit)
            setAnswers(existingQuestion.answers.map(a => ({ ...a })))
        }
    }, [mode, existingQuestion])

    // Switch between quiz and T/F
    useEffect(() => {
        if (type === 'true_or_false') {
            setAnswers(TF_ANSWERS.map(a => ({ ...a })))
        } else {
            if (mode === 'add') {
                setAnswers(DEFAULT_ANSWERS.map(a => ({ ...a })))
            }
        }
    }, [type])

    const setCorrect = (index: number) => {
        setAnswers(prev => prev.map((a, i) => ({ ...a, isCorrect: i === index })))
    }

    const setAnswerText = (index: number, value: string) => {
        setAnswers(prev => prev.map((a, i) => i === index ? { ...a, text: value } : a))
    }

    const handleSave = () => {
        if (!text.trim()) { setError('Question text is required.'); return }
        const hasCorrect = answers.some(a => a.isCorrect)
        if (!hasCorrect) { setError('Please mark one answer as correct.'); return }
        if (type === 'quiz') {
            const filled = answers.filter(a => a.text.trim())
            if (filled.length < 2) { setError('Please fill in at least 2 answers.'); return }
        }
        setError('')

        const question: Question = {
            id: existingQuestion?.id || Date.now(),
            text: text.trim(),
            type,
            timeLimit,
            answers: type === 'true_or_false'
                ? answers
                : answers.filter(a => a.text.trim()),
        }

        onSave(question, questionIndex)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <h2 className="text-base font-extrabold text-slate-800">
                        {mode === 'add' ? '➕ Add Question' : '✏️ Edit Question'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none"
                    >
                        ×
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* Question text */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Question Text <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Type your question here..."
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                        />
                    </div>

                    {/* Question type + time limit row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                Question Type
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'quiz', label: 'MCQ' },
                                    { value: 'true_or_false', label: 'True / False' },
                                ].map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setType(t.value as 'quiz' | 'true_or_false')}
                                        className={`flex-1 text-xs font-bold py-2 rounded-lg border-2 transition-all
                                            ${type === t.value
                                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                Time Limit
                            </label>
                            <select
                                value={timeLimit}
                                onChange={e => setTimeLimit(Number(e.target.value))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                            >
                                <option value={10}>10 seconds</option>
                                <option value={20}>20 seconds</option>
                                <option value={30}>30 seconds</option>
                                <option value={60}>60 seconds</option>
                            </select>
                        </div>
                    </div>

                    {/* Answers */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">
                            Answers{' '}
                            <span className="text-slate-400 font-normal">
                                (click the circle to mark correct)
                            </span>
                        </label>

                        <div className="space-y-2">
                            {answers.map((ans, i) => (
                                <div
                                    key={ans.id}
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-all"
                                    style={{
                                        backgroundColor: ans.isCorrect
                                            ? TILE_COLORS[i] + '22'
                                            : TILE_COLORS[i] + '11',
                                        borderColor: ans.isCorrect
                                            ? TILE_COLORS[i]
                                            : '#e2e8f0',
                                    }}
                                >
                                    {/* Correct marker */}
                                    <button
                                        onClick={() => setCorrect(i)}
                                        className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all"
                                        style={{
                                            borderColor: TILE_COLORS[i],
                                            backgroundColor: ans.isCorrect ? TILE_COLORS[i] : 'transparent',
                                            color: ans.isCorrect ? 'white' : TILE_COLORS[i],
                                        }}
                                    >
                                        ✓
                                    </button>

                                    {/* Colour dot */}
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: TILE_COLORS[i] }}
                                    />

                                    {/* Input */}
                                    {type === 'true_or_false' ? (
                                        <span className="flex-1 text-sm font-semibold text-slate-700">
                                            {ans.text}
                                        </span>
                                    ) : (
                                        <input
                                            type="text"
                                            value={ans.text}
                                            onChange={e => setAnswerText(i, e.target.value)}
                                            placeholder={TILE_LABELS[i]}
                                            className="flex-1 text-sm text-slate-800 bg-transparent focus:outline-none"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-xs text-red-500 font-semibold">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 px-6 py-2 rounded-lg transition-all"
                    >
                        {mode === 'add' ? 'Add Question' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}