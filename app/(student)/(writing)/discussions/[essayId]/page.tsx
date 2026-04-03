'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import InlineNoteLayerViewer from '@/components/essay/InlineNoteLayerViewer'
import { auth, db } from '@/lib/firebase'
import { buildReviewAnnotationLayers, dedupeLatestReviews } from '@/lib/essayInlineNotes'
import { getScore100, isNewRubric } from '@/lib/score-calculator'

export default function DiscussionThreadPage() {
    const router = useRouter()
    const params = useParams()
    const essayId = params.essayId as string

    const [essay, setEssay] = useState<any>(null)
    const [reviews, setReviews] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)

    const newRubricAspects = [
        { key: 'content', label: 'Content', max: 30 },
        { key: 'organization', label: 'Organization', max: 20 },
        { key: 'vocabulary', label: 'Vocabulary', max: 20 },
        { key: 'languageUse', label: 'Language Use', max: 25 },
        { key: 'mechanics', label: 'Mechanics', max: 5 },
    ]

    useEffect(() => {
        const load = async () => {
            if (!auth.currentUser) {
                router.push('/')
                return
            }

            try {
                const { getUserProfile } = await import('@/lib/auth')
                const profile = await getUserProfile(auth.currentUser.uid)
                const isTeacher = profile?.role === 'teacher'

                const essayDoc = await getDoc(doc(db, 'essays', essayId))
                if (!essayDoc.exists()) {
                    setLoading(false)
                    return
                }
                const essayData = { id: essayDoc.id, ...essayDoc.data() } as any

                if (essayData.studentId !== auth.currentUser.uid && !isTeacher) {
                    const reviewerSnap = await getDocs(query(
                        collection(db, 'reviews'),
                        where('essayId', '==', essayId),
                        where('reviewerId', '==', auth.currentUser.uid)
                    ))
                    if (reviewerSnap.empty) {
                        setAccessDenied(true)
                        setLoading(false)
                        return
                    }
                }

                const reviewsSnap = await getDocs(query(
                    collection(db, 'reviews'),
                    where('essayId', '==', essayId)
                ))
                const rawReviews = reviewsSnap.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                })) as any[]
                const peerReviews = dedupeLatestReviews(
                    rawReviews.filter(review => review.reviewerRole !== 'ai' && review.reviewerRole !== 'teacher')
                )

                setEssay(essayData)
                setReviews(peerReviews)
            } catch (loadError) {
                console.error('Error loading discussion:', loadError)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [essayId, router])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
            </div>
        )
    }

    if (accessDenied) {
        return (
            <StudentLayout title="Discussions">
                <main className="container mx-auto max-w-4xl px-4 py-8">
                    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                        <div className="mb-4 text-6xl">Stop</div>
                        <h2 className="mb-2 text-xl font-semibold text-slate-900">Access Denied</h2>
                        <p className="mb-6 text-sm text-slate-500">You can only view discussions for essays you have reviewed.</p>
                        <Link href="/discussions" className="font-medium text-[#1a9aaa] hover:underline">&larr; Back to Discussions</Link>
                    </div>
                </main>
            </StudentLayout>
        )
    }

    if (!essay) {
        return (
            <StudentLayout title="Discussions">
                <main className="container mx-auto max-w-4xl px-4 py-8">
                    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                        <div className="mb-4 text-6xl">Search</div>
                        <h2 className="mb-2 text-xl font-semibold text-slate-900">Essay Not Found</h2>
                        <Link href="/discussions" className="font-medium text-[#1a9aaa] hover:underline">&larr; Back to Discussions</Link>
                    </div>
                </main>
            </StudentLayout>
        )
    }

    const usingNewRubric = reviews.length > 0 ? isNewRubric(reviews[0].scores ?? {}) : false
    const avgScore100 = usingNewRubric && reviews.length > 0
        ? Math.round(reviews.reduce((sum, review) => sum + getScore100(review.scores ?? {}), 0) / reviews.length)
        : null
    const annotationLayers = buildReviewAnnotationLayers(reviews, essay.content ?? '', {
        includeTeachers: false,
        includePeers: true,
    })
    const peerLayerOrderById = Object.fromEntries(annotationLayers.map((layer, index) => [layer.id, index])) as Record<string, number>
    const orderedReviews = [...reviews].sort((a, b) => (peerLayerOrderById[a.id] ?? 999) - (peerLayerOrderById[b.id] ?? 999))
    const peerLabelByReviewId = Object.fromEntries(annotationLayers.map(layer => [layer.id, layer.label])) as Record<string, string>

    return (
        <StudentLayout title="Discussions">
            <main className="container mx-auto max-w-4xl px-4 py-8">
                <div className="mb-6">
                    <Link href="/discussions" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to Discussions
                    </Link>
                </div>

                <div className="mb-6">
                    <h1 className="mb-1 text-3xl font-bold text-slate-900">{essay.title}</h1>
                    <div className="mt-2 flex items-center gap-3">
                        {essay.topicName && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                                {essay.topicName}
                            </span>
                        )}
                        <span className="text-sm text-slate-400">
                            {reviews.length} peer {reviews.length === 1 ? 'review' : 'reviews'}
                        </span>
                    </div>
                </div>

                <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                    <span className="mt-0.5 shrink-0 text-blue-500">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                    <p className="text-sm leading-relaxed text-blue-700">
                        <span className="font-semibold">Anonymity is maintained.</span> The essay author and all reviewers are kept anonymous throughout this discussion.
                    </p>
                </div>

                {reviews.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                        <div className="mb-3 text-5xl">Wait</div>
                        <h3 className="mb-1 text-lg font-semibold text-slate-900">No Reviews Yet</h3>
                        <p className="text-sm text-slate-500">Peer reviews for this essay have not been submitted yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <InlineNoteLayerViewer
                            content={essay.content ?? ''}
                            layers={annotationLayers}
                            title="Inline Notes on the Essay"
                            description="Switch between anonymous reviewer layers. Underlined passages open the saved note in place."
                            emptyMessage="No reviewer has added inline notes to this essay yet."
                        />

                        {usingNewRubric && avgScore100 !== null && (
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h2 className="mb-4 text-lg font-semibold text-slate-900">Score Summary</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Aspect</th>
                                                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Max</th>
                                                {orderedReviews.map((review, index) => (
                                                    <th key={review.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                                                        {peerLabelByReviewId[review.id] ?? `Reviewer ${index + 1}`}
                                                    </th>
                                                ))}
                                                {reviews.length > 1 && (
                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Avg</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {newRubricAspects.map(({ key, label, max }) => {
                                                const values = orderedReviews.map(review => {
                                                    const raw = review.scores?.[key]
                                                    if (typeof raw === 'number') return raw
                                                    const nums = String(raw ?? '')
                                                        .split(/[-–]/)
                                                        .map((n: string) => parseInt(n.trim(), 10))
                                                        .filter((n: number) => !isNaN(n))
                                                    return nums.length ? Math.max(...nums) : 0
                                                })
                                                const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
                                                return (
                                                    <tr key={key} className="border-b border-slate-100">
                                                        <td className="px-3 py-2 text-sm font-medium text-slate-800">{label}</td>
                                                        <td className="px-3 py-2 text-center text-sm text-slate-400">/{max}</td>
                                                        {values.map((value, index) => (
                                                            <td key={`${key}-${index}`} className="px-3 py-2 text-center text-sm font-bold text-slate-900">{value}</td>
                                                        ))}
                                                        {reviews.length > 1 && (
                                                            <td className="px-3 py-2 text-center text-sm font-bold text-blue-600">{average}</td>
                                                        )}
                                                    </tr>
                                                )
                                            })}
                                            <tr className="border-t-2 border-slate-200 bg-slate-50">
                                                <td className="px-3 py-2 text-sm font-bold text-slate-900">Total</td>
                                                <td className="px-3 py-2 text-center text-sm text-slate-400">/100</td>
                                                {orderedReviews.map(review => (
                                                    <td key={`total-${review.id}`} className="px-3 py-2 text-center text-sm font-extrabold text-slate-900">{getScore100(review.scores ?? {})}</td>
                                                ))}
                                                {reviews.length > 1 && (
                                                    <td className="px-3 py-2 text-center text-sm font-extrabold text-blue-600">{avgScore100}</td>
                                                )}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <h2 className="text-xl font-semibold text-slate-900">Peer Feedback</h2>
                        {orderedReviews.map((review, index) => (
                            <div key={review.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex items-center gap-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                                        {index + 1}
                                    </span>
                                    <h3 className="text-lg font-semibold text-slate-900">
                                        {peerLabelByReviewId[review.id] ?? `Reviewer ${index + 1}`}
                                    </h3>
                                    {review.totalScore !== null && (
                                        <span className="ml-auto rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                                            Score: {review.totalScore}
                                        </span>
                                    )}
                                </div>

                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Feedback</p>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{review.feedback}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </StudentLayout>
    )
}
