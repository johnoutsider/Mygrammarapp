import { db } from './firebase'
import { sortLeastReviewedFirst } from './peer-assignment'
import type { UserProfile } from './auth'
import {
    addDoc,
    collection,
    doc,
    getDocs,
    increment,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore'

export interface PeerReviewAnswer {
    id: number
    text: string
    isCorrect: boolean
    explanation: string
}

export interface PeerReviewQuestion {
    id: number
    type: 'quiz' | 'true_or_false'
    text: string
    answers: PeerReviewAnswer[]
    topicId?: string
    topicName?: string
    subtopic?: string
}

export interface PeerReviewQuiz {
    id: string
    title: string
    questions: PeerReviewQuestion[]
    createdBy: string
    classId: string
    status: string
    createdAt?: { toMillis?: () => number; seconds?: number } | null
    anonymousLabel: string
    reviewCount: number
}

export type PeerReviewVerdict = 'approved' | 'rejected' | ''
export type PeerRecommendation =
    | 'highly_recommend'
    | 'recommend'
    | 'recommend_with_modification'
    | 'do_not_recommend'

export interface QuestionFeedback {
    questionId: number
    qualityScore: 0 | 1 | 2 | 3 | 4 | 5
    recommendation: '' | PeerRecommendation
    comment: string
}

export interface PeerReviewQueue {
    quizzes: PeerReviewQuiz[]
    alreadyReviewed: Set<string>
}

const REVIEWABLE_STATUSES = ['pending', 'peer_approved', 'peer_reviewed']

export async function getPeerReviewQueue(profile: UserProfile): Promise<PeerReviewQueue> {
    const quizSnap = await getDocs(
        query(
            collection(db, 'quizzes'),
            where('classId', '==', profile.classId),
            where('status', 'in', REVIEWABLE_STATUSES)
        )
    )

    const reviewSnap = await getDocs(
        query(collection(db, 'reviews'), where('classId', '==', profile.classId))
    )

    const reviewCountByQuiz = new Map<string, number>()
    const alreadyReviewed = new Set<string>()

    reviewSnap.docs.forEach(reviewDoc => {
        const data = reviewDoc.data() as any
        const quizId = data.quizId as string | undefined
        if (!quizId) return

        reviewCountByQuiz.set(quizId, (reviewCountByQuiz.get(quizId) ?? 0) + 1)
        if (data.reviewerId === profile.uid) {
            alreadyReviewed.add(quizId)
        }
    })

    const queued = quizSnap.docs
        .map(docSnap => {
            const data = docSnap.data() as any

            return {
                id: docSnap.id,
                title: data.title || '(Untitled Quiz)',
                questions: Array.isArray(data.questions) ? data.questions : [],
                createdBy: data.createdBy || '',
                classId: data.classId || '',
                status: data.status || 'pending',
                createdAt: data.createdAt ?? null,
                reviewCount: reviewCountByQuiz.get(docSnap.id) ?? 0,
            }
        })
        .filter(quiz => quiz.createdBy && quiz.createdBy !== profile.uid)

    const sorted = sortLeastReviewedFirst(queued)
        .map((quiz, index) => ({
            ...quiz,
            anonymousLabel: `Quiz #${index + 1}`,
        }))

    return {
        quizzes: sorted,
        alreadyReviewed,
    }
}

export async function submitPeerQuizReview(args: {
    quiz: Pick<PeerReviewQuiz, 'id' | 'title' | 'createdBy'>
    reviewer: Pick<UserProfile, 'uid' | 'classId' | 'name' | 'displayName'>
    questionFeedback: QuestionFeedback[]
}): Promise<'approved' | 'rejected' | 'mixed'> {
    const { quiz, reviewer, questionFeedback } = args

    const approvedCount = questionFeedback.filter(
        item => item.recommendation === 'highly_recommend' || item.recommendation === 'recommend'
    ).length
    const rejectedCount = questionFeedback.filter(
        item => item.recommendation === 'do_not_recommend'
    ).length

    const overallVerdict =
        rejectedCount === 0
            ? 'approved'
            : approvedCount === 0
                ? 'rejected'
                : 'mixed'

    await addDoc(collection(db, 'reviews'), {
        quizId: quiz.id,
        quizTitle: quiz.title,
        quizOwnerId: quiz.createdBy,
        reviewerId: reviewer.uid,
        reviewerName: reviewer.displayName || reviewer.name || 'Student',
        classId: reviewer.classId,
        questionFeedback,
        overallVerdict,
        createdAt: serverTimestamp(),
    })

    const quizUpdates: Record<string, unknown> = {
        status: 'peer_approved',
        lastReviewedAt: serverTimestamp(),
    }

    if (overallVerdict === 'approved') {
        quizUpdates.approvedByPeers = increment(1)
    } else if (overallVerdict === 'rejected') {
        quizUpdates.rejectedByPeers = increment(1)
    }

    await updateDoc(doc(db, 'quizzes', quiz.id), quizUpdates)

    return overallVerdict
}
