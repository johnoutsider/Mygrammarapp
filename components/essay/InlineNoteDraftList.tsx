'use client'

import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import type { InlineNote } from '@/lib/essayInlineNotes'

interface InlineNoteDraftListProps {
    notes: InlineNote[]
    tone?: 'teacher' | 'peer'
    onUpdateNote: (noteId: string, nextText: string) => void
    onDeleteNote: (noteId: string) => void
}

export default function InlineNoteDraftList({
    notes,
    tone = 'peer',
    onUpdateNote,
    onDeleteNote,
}: InlineNoteDraftListProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draftText, setDraftText] = useState('')

    const toneClasses = tone === 'teacher'
        ? {
            accent: 'text-teal-700 bg-teal-50 border-teal-200',
            button: 'text-teal-700 hover:bg-teal-50',
            save: 'bg-teal-600 hover:bg-teal-700',
        }
        : {
            accent: 'text-blue-700 bg-blue-50 border-blue-200',
            button: 'text-blue-700 hover:bg-blue-50',
            save: 'bg-blue-600 hover:bg-blue-700',
        }

    const sortedNotes = [...notes].sort((a, b) => a.start - b.start)

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                        Draft Notes
                    </p>
                    <p className="text-sm text-slate-500">
                        Edit or remove notes before you submit.
                    </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses.accent}`}>
                    {sortedNotes.length} note{sortedNotes.length === 1 ? '' : 's'}
                </span>
            </div>

            {sortedNotes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Highlight part of the essay to add your first inline note.
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedNotes.map(note => {
                        const isEditing = editingId === note.id
                        return (
                            <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                                            Highlighted Text
                                        </p>
                                        <p className="mt-1 text-sm font-medium text-slate-700">
                                            {note.selectedText.trim()}
                                        </p>
                                    </div>
                                    {!isEditing && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingId(note.id)
                                                    setDraftText(note.note)
                                                }}
                                                className={`rounded-lg p-2 transition ${toneClasses.button}`}
                                                title="Edit note"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (editingId === note.id) {
                                                        setEditingId(null)
                                                        setDraftText('')
                                                    }
                                                    onDeleteNote(note.id)
                                                }}
                                                className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                                                title="Delete note"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={draftText}
                                            onChange={event => setDraftText(event.target.value.slice(0, 200))}
                                            rows={3}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400"
                                        />
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs text-slate-400">
                                                {draftText.length}/200
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingId(null)
                                                        setDraftText('')
                                                    }}
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const trimmed = draftText.trim()
                                                        if (!trimmed) return
                                                        onUpdateNote(note.id, trimmed)
                                                        setEditingId(null)
                                                        setDraftText('')
                                                    }}
                                                    className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${toneClasses.save}`}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm leading-6 text-slate-700">
                                        {note.note}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
