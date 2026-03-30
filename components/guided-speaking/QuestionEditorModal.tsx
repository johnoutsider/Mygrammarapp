'use client'

import { useEffect, useState } from 'react'
import type { GuidedSpeakingQuestion } from '@/lib/guidedSpeakingService'
import DynamicListEditor from '@/components/guided-speaking/DynamicListEditor'

type QuestionFormState = {
    questionText: string
    guidedQuestions: string[]
    suggestedWords: string[]
    sampleSentences: string[]
    sampleExamples: string[]
}

interface QuestionEditorModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (input: QuestionFormState) => Promise<void> | void
    initialQuestion?: GuidedSpeakingQuestion | null
    saving?: boolean
}

const emptyFormState: QuestionFormState = {
    questionText: '',
    guidedQuestions: [],
    suggestedWords: [],
    sampleSentences: [],
    sampleExamples: [],
}

export default function QuestionEditorModal({
    isOpen,
    onClose,
    onSave,
    initialQuestion,
    saving = false,
}: QuestionEditorModalProps) {
    const [formState, setFormState] = useState<QuestionFormState>(emptyFormState)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isOpen) {
            setFormState(emptyFormState)
            setError('')
            return
        }

        if (initialQuestion) {
            setFormState({
                questionText: initialQuestion.questionText,
                guidedQuestions: initialQuestion.guidedQuestions,
                suggestedWords: initialQuestion.suggestedWords,
                sampleSentences: initialQuestion.sampleSentences,
                sampleExamples: initialQuestion.sampleExamples,
            })
            setError('')
            return
        }

        setFormState(emptyFormState)
        setError('')
    }, [initialQuestion, isOpen])

    if (!isOpen) return null

    const handleSave = async () => {
        if (!formState.questionText.trim()) {
            setError('Question text is required.')
            return
        }

        setError('')
        await onSave({
            questionText: formState.questionText.trim(),
            guidedQuestions: formState.guidedQuestions,
            suggestedWords: formState.suggestedWords,
            sampleSentences: formState.sampleSentences,
            sampleExamples: formState.sampleExamples,
        })
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-8">
            <div className="mx-auto w-full max-w-5xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-slate-900">
                            {initialQuestion ? 'Edit Guided Speaking Question' : 'Add Guided Speaking Question'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Add one main prompt and the helper content for the guided and sample-answer tabs.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        aria-label="Close question editor"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <div className="mt-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Main Question</label>
                        <textarea
                            value={formState.questionText}
                            onChange={event => setFormState(current => ({ ...current, questionText: event.target.value }))}
                            rows={3}
                            placeholder="e.g. First, tell me about yourself."
                            className="min-h-[120px] w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 bg-white"
                        />
                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2 bg-white p-4 rounded-2xl border border-slate-200">
                        <DynamicListEditor
                            label="Guided Questions"
                            values={formState.guidedQuestions}
                            placeholder="e.g. What is your background?"
                            helperText="Shown in the Guided Questions tab."
                            onChange={values => setFormState(current => ({ ...current, guidedQuestions: values }))}
                        />
                        <DynamicListEditor
                            label="Suggested Words"
                            values={formState.suggestedWords}
                            placeholder="e.g. enthusiastic, collaborative, detail-oriented"
                            helperText="Shown below the guided questions."
                            onChange={values => setFormState(current => ({ ...current, suggestedWords: values }))}
                        />
                        <DynamicListEditor
                            label="Sample Sentences"
                            values={formState.sampleSentences}
                            placeholder="e.g. I started working at [company] after graduating from [university]."
                            helperText="Shown in the Sample Answers tab. Use [placeholders] where students should customize the sentence."
                            onChange={values => setFormState(current => ({ ...current, sampleSentences: values }))}
                        />
                        <DynamicListEditor
                            label="Sample Examples"
                            values={formState.sampleExamples}
                            placeholder="e.g. I started working at Antigravity after graduating from Westminster University."
                            helperText="Shown under Examples. Matching placeholder replacements will be highlighted."
                            onChange={values => setFormState(current => ({ ...current, sampleExamples: values }))}
                        />
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
                    >
                        {saving ? 'Saving...' : initialQuestion ? 'Save Changes' : 'Save Question'}
                    </button>
                </div>
            </div>
        </div>
    )
}
