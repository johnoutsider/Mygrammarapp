'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { hasInlineNoteOverlap, type InlineNote, type InlineNoteAuthorRole } from '@/lib/essayInlineNotes'

interface AnnotatedEssayProps {
    content: string
    notes: InlineNote[]
    noteLabel: string
    tone?: 'teacher' | 'peer'
    mode?: 'readOnly' | 'author'
    authorRole?: InlineNoteAuthorRole
    revisionMs?: number
    layerKey?: string
    onCreateNote?: (note: InlineNote) => string | void
    emptyLayerMessage?: string
}

type OverlayPosition = {
    top: number
    left: number
}

type ComposerState = {
    start: number
    end: number
    selectedText: string
    note: string
    position: OverlayPosition
}

function createNoteId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getOffsetsFromRange(container: HTMLElement, range: Range) {
    const startRange = range.cloneRange()
    startRange.selectNodeContents(container)
    startRange.setEnd(range.startContainer, range.startOffset)

    const endRange = range.cloneRange()
    endRange.selectNodeContents(container)
    endRange.setEnd(range.endContainer, range.endOffset)

    return {
        start: startRange.toString().length,
        end: endRange.toString().length,
    }
}

function buildSegments(content: string, notes: InlineNote[]) {
    const segments: Array<
        | { type: 'text'; id: string; text: string }
        | { type: 'note'; id: string; note: InlineNote; text: string }
    > = []

    let cursor = 0

    notes.forEach(note => {
        if (note.start > cursor) {
            segments.push({
                type: 'text',
                id: `text-${cursor}`,
                text: content.slice(cursor, note.start),
            })
        }

        segments.push({
            type: 'note',
            id: note.id,
            note,
            text: content.slice(note.start, note.end),
        })

        cursor = note.end
    })

    if (cursor < content.length) {
        segments.push({
            type: 'text',
            id: `text-${cursor}`,
            text: content.slice(cursor),
        })
    }

    return segments
}

export default function AnnotatedEssay({
    content,
    notes,
    noteLabel,
    tone = 'peer',
    mode = 'readOnly',
    authorRole = 'student',
    revisionMs = 0,
    layerKey,
    onCreateNote,
    emptyLayerMessage = 'No inline notes in this layer yet.',
}: AnnotatedEssayProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const popoverRef = useRef<HTMLDivElement | null>(null)
    const closeTimerRef = useRef<number | null>(null)

    const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
    const [popoverPosition, setPopoverPosition] = useState<OverlayPosition | null>(null)
    const [composer, setComposer] = useState<ComposerState | null>(null)
    const [composerError, setComposerError] = useState<string | null>(null)
    const [supportsHover, setSupportsHover] = useState(false)

    const segments = buildSegments(content, notes)
    const activeNote = notes.find(note => note.id === activeNoteId) ?? null

    useEffect(() => {
        if (typeof window === 'undefined') return
        setSupportsHover(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
    }, [])

    useEffect(() => {
        setActiveNoteId(null)
        setPopoverPosition(null)
        setComposer(null)
        setComposerError(null)
    }, [layerKey])

    useEffect(() => {
        if (!activeNoteId) return

        const updatePosition = () => {
            const container = containerRef.current
            if (!container) {
                setActiveNoteId(null)
                setPopoverPosition(null)
                return
            }

            const anchor = container.querySelector<HTMLElement>(`[data-inline-note-id="${activeNoteId}"]`)
            if (!anchor) {
                setActiveNoteId(null)
                setPopoverPosition(null)
                return
            }

            const rect = anchor.getBoundingClientRect()
            if (!rect.width && !rect.height) {
                setActiveNoteId(null)
                setPopoverPosition(null)
                return
            }

            const top = rect.bottom + 10
            const left = Math.min(
                Math.max(rect.left + rect.width / 2, 180),
                window.innerWidth - 180
            )

            setPopoverPosition({ top, left })
        }

        updatePosition()

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActiveNoteId(null)
                setPopoverPosition(null)
                setComposer(null)
            }
        }

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node
            const container = containerRef.current
            if (
                popoverRef.current?.contains(target) ||
                container?.contains(target)
            ) {
                return
            }

            setActiveNoteId(null)
            setPopoverPosition(null)
        }

        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('keydown', handleEscape)
        document.addEventListener('mousedown', handlePointerDown)

        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('keydown', handleEscape)
            document.removeEventListener('mousedown', handlePointerDown)
        }
    }, [activeNoteId])

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setComposer(null)
                setComposerError(null)
            }
        }

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node
            const container = containerRef.current
            if (container?.contains(target)) return
            setComposer(null)
            setComposerError(null)
        }

        if (composer) {
            window.addEventListener('keydown', handleEscape)
            document.addEventListener('mousedown', handlePointerDown)
        }

        return () => {
            window.removeEventListener('keydown', handleEscape)
            document.removeEventListener('mousedown', handlePointerDown)
        }
    }, [composer])

    const clearHoverTimer = () => {
        if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
        }
    }

    const schedulePopoverClose = () => {
        clearHoverTimer()
        closeTimerRef.current = window.setTimeout(() => {
            setActiveNoteId(null)
            setPopoverPosition(null)
        }, 140)
    }

    const openComposerFromSelection = () => {
        if (mode !== 'author') return

        const container = containerRef.current
        const selection = window.getSelection()
        if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) return

        const range = selection.getRangeAt(0)
        if (!container.contains(range.commonAncestorContainer)) return

        const { start, end } = getOffsetsFromRange(container, range)
        if (end <= start) return

        const selectedText = content.slice(start, end)
        if (!selectedText.trim()) return

        if (hasInlineNoteOverlap({ start, end }, notes)) {
            setComposer(null)
            setComposerError('That text already has a note. Choose a different passage.')
            return
        }

        const rect = range.getBoundingClientRect()
        if (!rect.width && !rect.height) return

        setActiveNoteId(null)
        setPopoverPosition(null)
        setComposerError(null)
        setComposer({
            start,
            end,
            selectedText,
            note: '',
            position: {
                top: rect.bottom + 10,
                left: Math.min(
                    Math.max(rect.left + rect.width / 2, 200),
                    window.innerWidth - 200
                ),
            },
        })
    }

    const handleCreateNote = () => {
        if (!composer) return

        const trimmedNote = composer.note.trim()
        if (!trimmedNote) {
            setComposerError('Write a short note before saving.')
            return
        }

        if (trimmedNote.length > 200) {
            setComposerError('Keep notes to 200 characters or fewer.')
            return
        }

        const nextNote: InlineNote = {
            id: createNoteId(),
            start: composer.start,
            end: composer.end,
            selectedText: composer.selectedText,
            note: trimmedNote,
            authorRole,
            essayRevisionMs: revisionMs,
        }

        const error = onCreateNote?.(nextNote)
        if (typeof error === 'string' && error) {
            setComposerError(error)
            return
        }

        window.getSelection()?.removeAllRanges()
        setComposer(null)
        setComposerError(null)
    }

    const toneStyles = tone === 'teacher'
        ? {
            text: 'text-teal-800',
            underline: 'decoration-teal-500',
            hover: 'hover:bg-teal-50 focus-visible:bg-teal-50',
            active: 'bg-teal-100',
            badge: 'bg-teal-50 text-teal-700 border-teal-200',
            popover: 'border-teal-200',
            icon: 'text-teal-600',
        }
        : {
            text: 'text-blue-800',
            underline: 'decoration-blue-500',
            hover: 'hover:bg-blue-50 focus-visible:bg-blue-50',
            active: 'bg-blue-100',
            badge: 'bg-blue-50 text-blue-700 border-blue-200',
            popover: 'border-blue-200',
            icon: 'text-blue-600',
        }

    return (
        <div className="relative">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                        Essay Text
                    </p>
                    <p className="text-sm text-slate-500">
                        Underlined passages have notes. Hover or tap to read them.
                    </p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneStyles.badge}`}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    {notes.length} note{notes.length === 1 ? '' : 's'}
                </span>
            </div>

            {composerError && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {composerError}
                </div>
            )}

            <div
                ref={containerRef}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm whitespace-pre-wrap"
                onMouseUp={openComposerFromSelection}
                onKeyUp={openComposerFromSelection}
                onTouchEnd={openComposerFromSelection}
            >
                {segments.map(segment => {
                    if (segment.type === 'text') {
                        return <span key={segment.id}>{segment.text}</span>
                    }

                    const isActive = activeNoteId === segment.note.id
                    return (
                        <button
                            key={segment.id}
                            type="button"
                            data-inline-note-id={segment.note.id}
                            className={`inline cursor-pointer rounded px-0.5 text-left font-medium underline decoration-2 underline-offset-4 transition ${toneStyles.text} ${toneStyles.underline} ${toneStyles.hover} ${isActive ? toneStyles.active : ''}`}
                            onMouseEnter={() => {
                                if (!supportsHover) return
                                clearHoverTimer()
                                setActiveNoteId(segment.note.id)
                            }}
                            onMouseLeave={() => {
                                if (!supportsHover) return
                                schedulePopoverClose()
                            }}
                            onClick={() => {
                                clearHoverTimer()
                                setComposer(null)
                                setComposerError(null)
                                setActiveNoteId(current => current === segment.note.id ? null : segment.note.id)
                            }}
                        >
                            <span>{segment.text}</span>
                            <span className={`ml-1 inline-flex translate-y-[1px] align-middle ${toneStyles.icon}`}>
                                <MessageSquare className="h-3.5 w-3.5" />
                            </span>
                        </button>
                    )
                })}
            </div>

            {notes.length === 0 && mode === 'readOnly' && (
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    {emptyLayerMessage}
                </div>
            )}

            {activeNote && popoverPosition && (
                <div
                    ref={popoverRef}
                    className={`fixed z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border bg-white p-4 shadow-2xl ${toneStyles.popover}`}
                    style={{ top: popoverPosition.top, left: popoverPosition.left }}
                    onMouseEnter={clearHoverTimer}
                    onMouseLeave={() => {
                        if (!supportsHover) return
                        schedulePopoverClose()
                    }}
                >
                    <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                                {noteLabel}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {activeNote.selectedText.trim()}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            onClick={() => {
                                setActiveNoteId(null)
                                setPopoverPosition(null)
                            }}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <p className="text-sm leading-6 text-slate-700">
                        {activeNote.note}
                    </p>
                </div>
            )}

            {mode === 'author' && composer && (
                <div
                    className="fixed z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                    style={{ top: composer.position.top, left: composer.position.left }}
                >
                    <div className="mb-3">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                            Add Inline Note
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            {composer.selectedText.trim()}
                        </p>
                    </div>
                    <textarea
                        value={composer.note}
                        onChange={event => {
                            const nextValue = event.target.value.slice(0, 200)
                            setComposer(current => current ? { ...current, note: nextValue } : current)
                            setComposerError(null)
                        }}
                        rows={3}
                        autoFocus
                        placeholder="Write a short note for this passage."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400"
                    />
                    <div className="mt-2 text-right text-xs text-slate-400">
                        {composer.note.length}/200
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                window.getSelection()?.removeAllRanges()
                                setComposer(null)
                                setComposerError(null)
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateNote}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            Save note
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
