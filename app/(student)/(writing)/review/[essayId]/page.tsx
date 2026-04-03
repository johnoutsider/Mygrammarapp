'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import AnnotatedEssay from '@/components/essay/AnnotatedEssay'
import InlineNoteDraftList from '@/components/essay/InlineNoteDraftList'
import { auth, db } from '@/lib/firebase'
import { getEssayRevisionMs, hasInlineNoteOverlap, type InlineNote } from '@/lib/essayInlineNotes'

const ASPECTS = [
    {
        id: 'content',
        title: 'Content',
        levels: [
            { range: '27–30', desc: 'Essay clearly addresses topic · Ideas are developed thoroughly · Essay reflects substantive thought · No extraneous material' },
            { range: '22–26', desc: 'Essay mostly focused on topic · Expresses a few advanced ideas · Some details and reasons included, though thesis not fully developed' },
            { range: '17–21', desc: 'Essay minimally addresses the topic (at the surface level) · Development of ideas is not complete · Lacks detail and support' },
            { range: '13–16', desc: 'Essay does not adequately address the topic · Ideas are either non-substantive or not pertinent · OR Not enough to evaluate' },
        ],
    },
    {
        id: 'organization',
        title: 'Organization',
        levels: [
            { range: '18–20', desc: 'Essay is well-organized · Paragraphs demonstrate logical sequencing · Sophisticated use of connectors contribute to cohesion' },
            { range: '14–17', desc: 'Somewhat choppy and loosely organized, but clear main ideas · Mostly logical sequencing · Frequent and appropriate use of connectors' },
            { range: '10–13', desc: 'Essay organization barely seen; lacks fluidity · Ideas appear disconnected and lack logical flow · Some simple connectors may be used' },
            { range: '7–9', desc: 'Essay lacks any discernible organization of ideas · Sentences unrelated to one another, or randomly written · OR Not enough to evaluate' },
        ],
    },
    {
        id: 'vocabulary',
        title: 'Vocabulary',
        levels: [
            { range: '18–20', desc: 'Effective and appropriate word/idiom choice and usage · Wide range of vocabulary; more frequent use of academic vocabulary · Word form mastery' },
            { range: '14–17', desc: 'Occasional errors of word/idiom choice and usage, but meaning not obscured · Adequate range; some use of low-frequency or specialized vocabulary' },
            { range: '10–13', desc: 'More frequent errors of word/idiom choice and usage; meaning occasionally obscured · More limited range of vocabulary; repetitive' },
            { range: '7–9', desc: 'Large number of errors in word choice and usage such that meaning is frequently obscured · Very limited range and/or too little writing to evaluate' },
        ],
    },
    {
        id: 'languageUse',
        title: 'Language Use',
        levels: [
            { range: '22–25', desc: 'Effective complex constructions · No, or only a few minor errors in use of relative clauses, agreement, tense, articles, pronouns, prepositions' },
            { range: '18–21', desc: 'Effective but simple constructions · Errors of agreement, tense, articles, pronouns, and prepositions, but meaning not obscured' },
            { range: '11–17', desc: 'Definite problems in simple/complex constructions · Little variety in sentence type · Frequent errors obscure meaning' },
            { range: '5–10', desc: 'Virtually no mastery of sentence construction rules · Dominated by errors and grammar problems · Barely communicates' },
        ],
    },
    {
        id: 'mechanics',
        title: 'Mechanics',
        levels: [
            { range: '5', desc: 'Demonstrates mastery of conventions · Few errors of spelling, punctuation, capitalization, paragraphing' },
            { range: '4', desc: 'Occasional errors of spelling, punctuation, capitalization, paragraphing but meaning not obscured' },
            { range: '3', desc: 'Frequent errors of spelling, punctuation, capitalization, paragraphing · Poor handwriting · Meaning confused or obscured' },
            { range: '2', desc: 'No mastery of conventions · Dominated by errors · Handwriting illegible · OR Not enough to evaluate' },
        ],
    },
] as const

function getHighest(range: string | null): number {
    if (!range) return 0
    const nums = range
        .split(/[-–]/)
        .map(n => parseInt(n.trim(), 10))
        .filter(n => !Number.isNaN(n))
    return nums.length > 0 ? Math.max(...nums) : 0
}

function AspectCard({
    aspect,
    index,
    selected,
    onSelect,
    missing,
}: {
    aspect: typeof ASPECTS[number]
    index: number
    selected: string | null
    onSelect: (range: string | null) => void
    missing?: boolean
}) {
    return (
        <div className={`mb-3 overflow-hidden rounded-xl border bg-white transition-all ${missing ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'}`}>
            <div className={`flex items-center gap-3 border-b px-4 py-3 ${missing ? 'border-red-100 bg-red-50' : 'border-slate-100'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${selected ? 'bg-blue-600' : missing ? 'bg-red-500' : 'bg-slate-400'}`}>
                    {selected ? '✓' : index}
                </span>
                <span className="flex-1 text-sm font-bold text-slate-900">{aspect.title}</span>
                {missing && (
                    <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-500">
                        Required
                    </span>
                )}
                {selected && !missing && (
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">
                        Scored
                    </span>
                )}
            </div>
            <div className="space-y-1.5 p-3">
                {aspect.levels.map(level => {
                    const isSelected = selected === level.range
                    return (
                        <div
                            key={level.range}
                            className={`flex items-stretch overflow-hidden rounded-lg border transition-all ${isSelected ? 'border-blue-500' : 'border-transparent'} bg-slate-50`}
                        >
                            <button
                                type="button"
                                onClick={() => onSelect(isSelected ? null : level.range)}
                                className={`shrink-0 border-r px-3 py-2 text-xs font-bold transition-all ${isSelected ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-blue-50'}`}
                            >
                                {level.range}
                            </button>
                            <span className="px-3 py-2 text-xs leading-relaxed text-slate-600">
                                {level.desc}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function EssayPanel({
    essay,
    inlineNotes,
    essayRevisionMs,
    onAddInlineNote,
    onUpdateInlineNote,
    onDeleteInlineNote,
}: {
    essay: any
    inlineNotes: InlineNote[]
    essayRevisionMs: number
    onAddInlineNote: (note: InlineNote) => string | void
    onUpdateInlineNote: (noteId: string, nextText: string) => void
    onDeleteInlineNote: (noteId: string) => void
}) {
    const wordCount = essay?.content?.trim().split(/\s+/).filter(Boolean).length ?? 0

    return (
        <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Topic</p>
                <p className="mb-3 text-base font-bold text-slate-900">{essay?.topicName || 'Essay'}</p>
                {essay?.topicInstruction && (
                    <>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Task Instruction</p>
                        <p className="text-sm leading-relaxed text-slate-600">{essay.topicInstruction}</p>
                    </>
                )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
                {essay?.title && (
                    <p className="mb-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
                        {essay.title}
                    </p>
                )}
                <div className="mb-4">
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                        {wordCount} words
                    </span>
                </div>

                <AnnotatedEssay
                    content={essay?.content ?? ''}
                    notes={inlineNotes}
                    noteLabel="Your note"
                    tone="peer"
                    mode="author"
                    authorRole="student"
                    revisionMs={essayRevisionMs}
                    onCreateNote={onAddInlineNote}
                />
            </div>

            <InlineNoteDraftList
                notes={inlineNotes}
                tone="peer"
                onUpdateNote={onUpdateInlineNote}
                onDeleteNote={onDeleteInlineNote}
            />
        </div>
    )
}

export default function ReviewEssay() {
    const router = useRouter()
    const params = useParams()
    const essayId = params.essayId as string

    const [essay, setEssay] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [alreadyReviewed, setAlreadyReviewed] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [submitAttempted, setSubmitAttempted] = useState(false)
    const [inlineNotes, setInlineNotes] = useState<InlineNote[]>([])
    const [essayRevisionMs, setEssayRevisionMs] = useState(0)

    const [scores, setScores] = useState<Record<string, string | null>>({
        content: null,
        organization: null,
        vocabulary: null,
        languageUse: null,
        mechanics: null,
    })
    const [feedback, setFeedback] = useState('')
    const [activeTab, setActiveTab] = useState<'essay' | 'rubric'>('essay')
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkViewport = () => setIsMobile(window.innerWidth < 768)
        checkViewport()
        window.addEventListener('resize', checkViewport)
        return () => window.removeEventListener('resize', checkViewport)
    }, [])

    useEffect(() => {
        const fetchEssay = async () => {
            if (!auth.currentUser) {
                router.push('/')
                return
            }

            try {
                const essayDoc = await getDoc(doc(db, 'essays', essayId))
                if (!essayDoc.exists()) {
                    setNotFound(true)
                    return
                }

                const reviewsQuery = query(
                    collection(db, 'reviews'),
                    where('essayId', '==', essayId),
                    where('reviewerId', '==', auth.currentUser.uid)
                )

                if (!(await getDocs(reviewsQuery)).empty) {
                    setAlreadyReviewed(true)
                }

                const essayData = { id: essayDoc.id, ...essayDoc.data() }
                setEssay(essayData)
                setEssayRevisionMs(getEssayRevisionMs(essayData))
            } catch (fetchError) {
                console.error('Error fetching essay:', fetchError)
            } finally {
                setLoading(false)
            }
        }

        fetchEssay()
    }, [essayId, router])

    const allScored = ASPECTS.every(aspect => scores[aspect.id] !== null)
    const totalScore = ASPECTS.reduce((sum, aspect) => sum + getHighest(scores[aspect.id]), 0)
    const feedbackWordCount = feedback.trim() === '' ? 0 : feedback.trim().split(/\s+/).length
    const feedbackValid = feedbackWordCount >= 20
    const canSubmit = allScored && feedbackValid && !submitting

    const addInlineNote = (note: InlineNote) => {
        const essayContent = essay?.content ?? ''
        if (note.start < 0 || note.end > essayContent.length || note.end <= note.start) {
            return 'Select a valid passage before adding a note.'
        }

        if (hasInlineNoteOverlap(note, inlineNotes)) {
            return 'That text overlaps an existing note.'
        }

        setInlineNotes(prev => [...prev, note].sort((a, b) => a.start - b.start))
    }

    const updateInlineNote = (noteId: string, nextText: string) => {
        const trimmedText = nextText.trim().slice(0, 200)
        if (!trimmedText) return

        setInlineNotes(prev =>
            prev.map(note => note.id === noteId ? { ...note, note: trimmedText } : note)
        )
    }

    const deleteInlineNote = (noteId: string) => {
        setInlineNotes(prev => prev.filter(note => note.id !== noteId))
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)
        setSubmitAttempted(true)

        if (!auth.currentUser || !essay) return
        if (!allScored) {
            setError('Please select a score for all 5 rubric categories.')
            return
        }
        if (!feedbackValid) {
            setError('Please write at least 20 words of feedback.')
            return
        }

        setSubmitting(true)
        try {
            const latestEssayDoc = await getDoc(doc(db, 'essays', essayId))
            if (!latestEssayDoc.exists()) {
                setError('This essay is no longer available.')
                return
            }

            const latestRevisionMs = getEssayRevisionMs(latestEssayDoc.data() as any)
            if (latestRevisionMs !== essayRevisionMs) {
                setError('This essay changed while you were reviewing it. Refresh the page and review the latest version.')
                return
            }

            await addDoc(collection(db, 'reviews'), {
                essayId,
                reviewerId: auth.currentUser.uid,
                reviewerName: auth.currentUser.displayName || 'Anonymous',
                reviewerRole: 'student',
                scores,
                totalScore,
                feedback,
                inlineNotes,
                essayRevisionMs: latestRevisionMs,
                completedAt: serverTimestamp(),
            })

            try {
                const authorDoc = await getDoc(doc(db, 'users', essay.studentId))
                const chatId = authorDoc.exists() ? authorDoc.data().telegramChatId : null
                if (chatId) {
                    fetch('/api/notifications/telegram', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId, essayTitle: essay.title }),
                    }).catch(() => {})
                }
            } catch {}

            setSuccess('Review submitted! Redirecting...')
            setTimeout(() => router.push('/review'), 1500)
        } catch (submitError) {
            console.error('Review submit error:', submitError)
            setError('Failed to submit review. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const rubricPanel = (
        <div className="space-y-0 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <p className="mb-0.5 text-base font-bold text-slate-900">Writing Development Rubric</p>
                    <p className="text-xs text-slate-500">Click a score range to select it for each category.</p>
                </div>
                <div className={`rounded-full border px-3 py-1 text-sm font-bold ${allScored ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    {ASPECTS.filter(aspect => scores[aspect.id]).length}/{ASPECTS.length} scored
                </div>
            </div>

            {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {success} <Link href="/review" className="ml-1 mt-1 inline-block font-semibold underline">Go to Reviews</Link>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {ASPECTS.map((aspect, index) => (
                    <AspectCard
                        key={aspect.id}
                        aspect={aspect}
                        index={index + 1}
                        selected={scores[aspect.id]}
                        onSelect={range => setScores(prev => ({ ...prev, [aspect.id]: range }))}
                        missing={submitAttempted && !scores[aspect.id]}
                    />
                ))}

                <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Total Score</p>
                        <p className={`text-3xl font-extrabold leading-none ${allScored ? 'text-blue-600' : 'text-slate-300'}`}>
                            {allScored ? totalScore : '—'}
                        </p>
                    </div>
                    <div className="flex max-w-[60%] flex-wrap justify-end gap-2">
                        {ASPECTS.map(aspect => (
                            <div key={aspect.id} className="text-center">
                                <div className="mb-1 text-xs text-slate-400">{aspect.title}</div>
                                <div className={`rounded px-2 py-0.5 text-xs font-bold ${scores[aspect.id] ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    {scores[aspect.id] ? getHighest(scores[aspect.id]) : '–'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">6</span>
                        <span className="text-sm font-bold text-slate-900">Write Your Review</span>
                    </div>
                    <div className="p-4">
                        <textarea
                            value={feedback}
                            onChange={event => {
                                setFeedback(event.target.value)
                                setError(null)
                            }}
                            placeholder="Please write at least 20 words of feedback. Be specific about strengths, weaknesses, and what the writer can improve."
                            rows={5}
                            className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                        />
                        <p className={`mt-1.5 text-xs ${feedbackValid ? 'text-slate-400' : 'text-red-500'}`}>
                            {feedbackWordCount} word{feedbackWordCount === 1 ? '' : 's'}
                            {!feedbackValid && feedbackWordCount > 0 && ` · ${20 - feedbackWordCount} more needed`}
                        </p>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all ${canSubmit ? 'bg-green-600 text-white hover:bg-green-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}
                >
                    {submitting ? (
                        <>
                            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                            Submitting...
                        </>
                    ) : 'Submit Review'}
                </button>
            </form>
        </div>
    )

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="h-11 w-11 animate-spin rounded-full border-b-2 border-blue-500" />
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <p className="mb-4 text-5xl">Search</p>
                    <h2 className="mb-2 text-xl font-bold text-slate-900">Essay Not Found</h2>
                    <Link href="/review" className="inline-block text-sm text-blue-500 hover:underline">Back to Reviews</Link>
                </div>
            </div>
        )
    }

    if (alreadyReviewed) {
        return (
            <StudentLayout title="Already Reviewed">
                <div className="mx-auto mt-20 max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <p className="mb-4 text-5xl">Done</p>
                    <h2 className="mb-2 text-xl font-bold text-slate-900">Already Reviewed</h2>
                    <p className="mb-6 text-sm text-slate-500">You have already submitted a review for this essay.</p>
                    <Link href="/review" className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                        Back to Reviews
                    </Link>
                </div>
            </StudentLayout>
        )
    }

    const essayPanel = (
        <EssayPanel
            essay={essay}
            inlineNotes={inlineNotes}
            essayRevisionMs={essayRevisionMs}
            onAddInlineNote={addInlineNote}
            onUpdateInlineNote={updateInlineNote}
            onDeleteInlineNote={deleteInlineNote}
        />
    )

    return (
        <StudentLayout title="Reviewing Essay">
            {isMobile && (
                <div className="flex shrink-0 border-b border-slate-200 bg-white">
                    {(['essay', 'rubric'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 border-b-2 py-3 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            )}

            {isMobile ? (
                <div className="flex-1 overflow-auto">
                    {activeTab === 'essay' ? essayPanel : rubricPanel}
                </div>
            ) : (
                <div className="grid h-full grid-cols-2 overflow-hidden">
                    <div className="overflow-auto border-r border-slate-200">
                        {essayPanel}
                    </div>
                    <div className="overflow-auto">
                        {rubricPanel}
                    </div>
                </div>
            )}
        </StudentLayout>
    )
}
