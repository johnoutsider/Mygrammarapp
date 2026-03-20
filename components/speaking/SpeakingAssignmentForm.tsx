'use client'

import { useMemo, useState } from 'react'

interface SpeakingAssignmentFormProps {
    topics: string[]
    onSubmit: (input: {
        partLabel: string
        questionSteps: string[]
        prepSeconds: number
        speakingSeconds: number
    }) => Promise<void>
}

export default function SpeakingAssignmentForm({ topics, onSubmit }: SpeakingAssignmentFormProps) {
    const [partLabel, setPartLabel] = useState('')
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

        if (!partLabel.trim()) {
            setError('Please select or enter a topic.')
            return
        }
        if (parsedQuestions.length === 0) {
            setError('At least one question is required.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            await onSubmit({
                partLabel: partLabel.trim(),
                questionSteps: parsedQuestions,
                prepSeconds,
                speakingSeconds,
            })
            setPartLabel('')
            setQuestionsText('')
        } catch (submitError) {
            setError((submitError as Error).message || 'Failed to save speaking assignment.')
        } finally {
            setSaving(false)
        }
    }

    const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400'

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
                <h2 className="text-xl font-bold text-slate-800">Create Speaking Prompt</h2>
                <p className="text-sm text-slate-500 mt-1">Choose a topic, then add linked questions in order. Students answer them step by step.</p>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Topic</label>
                {topics.length > 0 ? (
                    <select
                        value={partLabel}
                        onChange={e => setPartLabel(e.target.value)}
                        className={inputClass}
                        style={{ backgroundColor: '#ffffff', color: partLabel ? '#334155' : '#94a3b8', colorScheme: 'light' }}
                        required
                    >
                        <option value="">— Select a topic —</option>
                        {topics.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                        No topics yet. Add topics in the Topics section above before creating a prompt.
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Prep Time (seconds)</label>
                    <input
                        type="number"
                        min={0}
                        max={600}
                        value={prepSeconds}
                        onChange={event => setPrepSeconds(Number(event.target.value) || 0)}
                        className={inputClass}
                        style={{ backgroundColor: '#ffffff', color: '#334155', colorScheme: 'light' }}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Speaking Time (seconds)</label>
                    <input
                        type="number"
                        min={1}
                        max={1800}
                        value={speakingSeconds}
                        onChange={event => setSpeakingSeconds(Number(event.target.value) || 1)}
                        className={inputClass}
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
                disabled={saving || topics.length === 0}
                className="px-5 py-3 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? 'Saving...' : 'Save and Activate'}
            </button>
        </form>
    )
}
