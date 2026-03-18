'use client'

import { useMemo, useState } from 'react'

interface SpeakingAssignmentFormProps {
    onSubmit: (input: {
        partLabel: string
        questionSteps: string[]
        prepSeconds: number
        speakingSeconds: number
    }) => Promise<void>
}

export default function SpeakingAssignmentForm({ onSubmit }: SpeakingAssignmentFormProps) {
    const [partLabel, setPartLabel] = useState('Part 1')
    const [questionsText, setQuestionsText] = useState('')
    const [prepSeconds, setPrepSeconds] = useState(60)
    const [speakingSeconds, setSpeakingSeconds] = useState(120)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const parsedQuestions = useMemo(() => {
        return questionsText
            .split(/\r?\n/)
            .map(question => question.trim())
            .filter(Boolean)
    }, [questionsText])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        if (parsedQuestions.length === 0) {
            setError('At least one question is required.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            await onSubmit({
                partLabel: partLabel.trim() || 'Part 1',
                questionSteps: parsedQuestions,
                prepSeconds,
                speakingSeconds,
            })
            setQuestionsText('')
        } catch (submitError) {
            setError((submitError as Error).message || 'Failed to save speaking assignment.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
                <h2 className="text-xl font-bold text-slate-800">Create Speaking Prompt</h2>
                <p className="text-sm text-slate-500 mt-1">Add linked questions in order. Students will receive them step by step.</p>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Part Label</label>
                    <input
                        type="text"
                        value={partLabel}
                        onChange={event => setPartLabel(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        style={{ backgroundColor: '#ffffff', color: '#334155', colorScheme: 'light' }}
                        placeholder="Part 1"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Prep Seconds</label>
                    <input
                        type="number"
                        min={0}
                        max={600}
                        value={prepSeconds}
                        onChange={event => setPrepSeconds(Number(event.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        style={{ backgroundColor: '#ffffff', color: '#334155', colorScheme: 'light' }}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Speaking Seconds</label>
                    <input
                        type="number"
                        min={1}
                        max={1800}
                        value={speakingSeconds}
                        onChange={event => setSpeakingSeconds(Number(event.target.value) || 1)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        style={{ backgroundColor: '#ffffff', color: '#334155', colorScheme: 'light' }}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Linked Questions</label>
                <textarea
                    value={questionsText}
                    onChange={event => setQuestionsText(event.target.value)}
                    rows={6}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                    style={{ backgroundColor: '#ffffff', color: '#334155', colorScheme: 'light' }}
                    placeholder={'Write one question per line.\nQuestion 1\nQuestion 2\nQuestion 3'}
                />
                <div className="mt-2 text-xs text-slate-400">{parsedQuestions.length} linked question{parsedQuestions.length !== 1 ? 's' : ''}</div>
            </div>

            <button
                type="submit"
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? 'Saving...' : 'Save and Activate'}
            </button>
        </form>
    )
}
