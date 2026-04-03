export type InlineNoteAuthorRole = 'student' | 'teacher'

export interface InlineNote {
    id: string
    start: number
    end: number
    selectedText: string
    note: string
    authorRole: InlineNoteAuthorRole
    essayRevisionMs: number
}

type TimestampLike =
    | { toMillis?: () => number; seconds?: number }
    | null
    | undefined

export interface ReviewAnnotationLayer<TReview = any> {
    id: string
    label: string
    tone: 'teacher' | 'peer'
    review: TReview
    notes: InlineNote[]
}

export function getTimestampMillis(value: TimestampLike): number {
    if (!value) return 0
    if (typeof value.toMillis === 'function') return value.toMillis()
    if (typeof value.seconds === 'number') return value.seconds * 1000
    return 0
}

export function getEssayRevisionMs(essay: { updatedAt?: TimestampLike; submittedAt?: TimestampLike } | null | undefined): number {
    if (!essay) return 0
    return getTimestampMillis(essay.updatedAt) || getTimestampMillis(essay.submittedAt)
}

export function normalizeInlineNotes(notes: unknown, content: string): InlineNote[] {
    if (!Array.isArray(notes)) return []

    return notes
        .map((note: any) => ({
            id: typeof note?.id === 'string' && note.id.trim() ? note.id : '',
            start: Number.isInteger(note?.start) ? note.start : -1,
            end: Number.isInteger(note?.end) ? note.end : -1,
            selectedText: typeof note?.selectedText === 'string' ? note.selectedText : '',
            note: typeof note?.note === 'string' ? note.note.trim() : '',
            authorRole: note?.authorRole === 'teacher' ? 'teacher' : 'student',
            essayRevisionMs: typeof note?.essayRevisionMs === 'number' ? note.essayRevisionMs : 0,
        }))
        .filter(note =>
            note.id &&
            note.note &&
            note.start >= 0 &&
            note.end > note.start &&
            note.end <= content.length
        )
        .sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start
            if (a.end !== b.end) return a.end - b.end
            return a.id.localeCompare(b.id)
        })
}

export function hasInlineNoteOverlap(
    candidate: Pick<InlineNote, 'start' | 'end'>,
    notes: InlineNote[],
    ignoreId?: string
): boolean {
    return notes.some(note =>
        note.id !== ignoreId &&
        candidate.start < note.end &&
        candidate.end > note.start
    )
}

export function dedupeLatestReviews<T extends {
    id: string
    reviewerId?: string
    reviewerRole?: string
    completedAt?: TimestampLike
}>(reviews: T[]): T[] {
    const latestByReviewer = new Map<string, T>()

    reviews.forEach(review => {
        const roleKey = review.reviewerRole === 'teacher' ? 'teacher' : review.reviewerRole === 'ai' ? 'ai' : 'peer'
        const reviewerKey = `${roleKey}:${review.reviewerId || review.id}`
        const existing = latestByReviewer.get(reviewerKey)

        if (!existing || getTimestampMillis(review.completedAt) >= getTimestampMillis(existing.completedAt)) {
            latestByReviewer.set(reviewerKey, review)
        }
    })

    return Array.from(latestByReviewer.values())
}

export function buildReviewAnnotationLayers<TReview extends {
    id: string
    reviewerRole?: string
    completedAt?: TimestampLike
    inlineNotes?: unknown
}>(
    reviews: TReview[],
    content: string,
    options?: {
        includeTeachers?: boolean
        includePeers?: boolean
        notesOnly?: boolean
    }
): ReviewAnnotationLayer<TReview>[] {
    const includeTeachers = options?.includeTeachers ?? true
    const includePeers = options?.includePeers ?? true
    const notesOnly = options?.notesOnly ?? false

    const teacherLayers = includeTeachers
        ? reviews
            .filter(review => review.reviewerRole === 'teacher')
            .map(review => ({
                id: review.id,
                label: 'Teacher',
                tone: 'teacher' as const,
                review,
                notes: normalizeInlineNotes(review.inlineNotes, content),
            }))
        : []

    const peerLayers = includePeers
        ? reviews
            .filter(review => review.reviewerRole !== 'teacher' && review.reviewerRole !== 'ai')
            .sort((a, b) => {
                const millisDiff = getTimestampMillis(a.completedAt) - getTimestampMillis(b.completedAt)
                if (millisDiff !== 0) return millisDiff
                return a.id.localeCompare(b.id)
            })
            .map((review, index) => ({
                id: review.id,
                label: `Reviewer ${index + 1}`,
                tone: 'peer' as const,
                review,
                notes: normalizeInlineNotes(review.inlineNotes, content),
            }))
        : []

    const layers = [...teacherLayers, ...peerLayers]
    return notesOnly ? layers.filter(layer => layer.notes.length > 0) : layers
}
