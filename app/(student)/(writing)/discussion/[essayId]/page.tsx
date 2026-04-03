'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import { DiscussionForum } from '@/components/DiscussionForum'
import InlineNoteLayerViewer from '@/components/essay/InlineNoteLayerViewer'
import { auth, db } from '@/lib/firebase'
import { buildReviewAnnotationLayers, dedupeLatestReviews } from '@/lib/essayInlineNotes'

export default function DiscussionPage() {
    const params = useParams()
    const router = useRouter()
    const essayId = params.essayId as string

    const [essay, setEssay] = useState<any>(null)
    const [reviews, setReviews] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)

    useEffect(() => {
        const fetchEssay = async () => {
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

                const reviewSnap = await getDocs(query(
                    collection(db, 'reviews'),
                    where('essayId', '==', essayId)
                ))
                const peerReviews = dedupeLatestReviews(
                    reviewSnap.docs
                        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
                        .filter((review: any) => review.reviewerRole !== 'ai' && review.reviewerRole !== 'teacher')
                )

                setEssay(essayData)
                setReviews(peerReviews)
            } catch (fetchError) {
                console.error('Error fetching essay discussion:', fetchError)
            } finally {
                setLoading(false)
            }
        }

        fetchEssay()
    }, [essayId, router])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="h-11 w-11 animate-spin rounded-full border-b-2 border-blue-500" />
            </div>
        )
    }

    if (accessDenied) {
        return (
            <StudentLayout title="Peer Discussion">
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

    const annotationLayers = essay
        ? buildReviewAnnotationLayers(reviews, essay.content ?? '', {
            includeTeachers: false,
            includePeers: true,
        })
        : []

    return (
        <StudentLayout title="Peer Discussion">
            <main className="container mx-auto max-w-4xl px-4 py-8">
                <div className="mb-6">
                    <Link href="/discussions" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to Discussions
                    </Link>
                </div>

                {essay && (
                    <>
                        <div className="mb-6">
                            <h1 className="mb-1 text-3xl font-bold text-slate-900">{essay.title}</h1>
                            <p className="text-sm text-slate-500">Anonymous peer discussion and inline essay notes.</p>
                        </div>

                        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                            <span className="mt-0.5 shrink-0 text-blue-500">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <p className="text-sm leading-relaxed text-blue-700">
                                <span className="font-semibold">Anonymity is maintained.</span> Reviewer names stay hidden while inline notes and discussion comments remain visible to authorized participants.
                            </p>
                        </div>

                        <InlineNoteLayerViewer
                            content={essay.content ?? ''}
                            layers={annotationLayers}
                            title="Inline Notes on the Essay"
                            description="Switch between anonymous reviewer layers. Underlined passages open the saved note in place."
                            emptyMessage="No reviewer has added inline notes to this essay yet."
                        />
                    </>
                )}

                <DiscussionForum
                    essayTitle={essay?.title}
                    essayContent={essay?.content}
                />
            </main>
        </StudentLayout>
    )
}
