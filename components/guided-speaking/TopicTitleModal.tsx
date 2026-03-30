'use client'

import { useEffect, useState } from 'react'

interface TopicTitleModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (title: string) => Promise<void> | void
    saving?: boolean
}

export default function TopicTitleModal({
    isOpen,
    onClose,
    onSave,
    saving = false,
}: TopicTitleModalProps) {
    const [title, setTitle] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isOpen) {
            setTitle('')
            setError('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSave = async () => {
        if (!title.trim()) {
            setError('Topic title is required.')
            return
        }

        setError('')
        await onSave(title.trim())
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Create Shared Topic</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            This topic will be available in both speaking activities.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        aria-label="Close topic modal"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <div className="mt-6 space-y-2">
                    <label className="text-sm font-medium text-slate-700">Topic title</label>
                    <input
                        value={title}
                        onChange={event => setTitle(event.target.value)}
                        placeholder="e.g. Mock Interview 1"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
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
                        {saving ? 'Saving...' : 'Create Topic'}
                    </button>
                </div>
            </div>
        </div>
    )
}
