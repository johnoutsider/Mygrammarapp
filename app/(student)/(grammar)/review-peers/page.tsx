'use client'

import { useEffect, useMemo, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { getUserProfile, UserProfile } from '@/lib/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'
import {
    getPeerReviewQueue,
    PeerRecommendation,
    PeerReviewQuiz,
    QuestionFeedback,
    submitPeerQuizReview,
} from '@/lib/peerReviewService'

type TopicOption = {
    id: string
    name: string
}

const QUALITY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: 'Well below average',
    2: 'Slightly below average',
    3: 'Average',
    4: 'Slightly above average',
    5: 'Well above average',
}

const RECOMMENDATION_OPTIONS: Array<{
    value: PeerRecommendation
    label: string
}> = [
        { value: 'highly_recommend', label: '1. Highly recommend' },
        { value: 'recommend', label: '2. Recommend' },
        { value: 'recommend_with_modification', label: '3. Recommend with modification' },
        { value: 'do_not_recommend', label: '4. Do not recommend' },
    ]

export default function ReviewPeersPage() {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [quizzes, setQuizzes] = useState<PeerReviewQuiz[]>([])
    const [alreadyReviewed, setAlreadyReviewed] = useState<Set<string>>(new Set())
    const [selectedQuiz, setSelectedQuiz] = useState<PeerReviewQuiz | null>(null)
    const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedback[]>([])
    const [topics, setTopics] = useState<TopicOption[]>([])
    const [selectedTopicId, setSelectedTopicId] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const topicsQuery = query(collection(db, 'topics'), orderBy('createdAt', 'asc'))
        const unsubscribe = onSnapshot(topicsQuery, snapshot => {
            setTopics(snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                name: (docSnap.data() as any).name || 'Untitled topic',
            })))
        })

        return () => unsubscribe()
    }, [])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user) {
                setLoading(false)
                return
            }

            const profile = await getUserProfile(user.uid)
            if (!profile) {
                setLoading(false)
                return
            }

            setUserProfile(profile)
            await loadQueue(profile)
        })

        return () => unsubscribe()
    }, [])

    const loadQueue = async (profile: UserProfile) => {
        setLoading(true)
        try {
            const queue = await getPeerReviewQueue(profile)
            setQuizzes(queue.quizzes)
            setAlreadyReviewed(queue.alreadyReviewed)
            setError(null)
        } catch (loadError) {
            console.error(loadError)
            setError('Failed to load quizzes. Please refresh.')
        } finally {
            setLoading(false)
        }
    }

    const openReview = (quiz: PeerReviewQuiz) => {
        setSelectedQuiz(quiz)
        setSubmitted(false)
        setError(null)
        setQuestionFeedback(
            quiz.questions.map(question => ({
                questionId: question.id,
                qualityScore: 0,
                recommendation: '',
                comment: '',
            }))
        )
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const closeReview = () => {
        setSelectedQuiz(null)
        setSubmitted(false)
        setError(null)
    }

    const setQFeedback = (
        questionId: number,
        field: keyof QuestionFeedback,
        value: QuestionFeedback[keyof QuestionFeedback]
    ) => {
        setQuestionFeedback(current =>
            current.map(item =>
                item.questionId === questionId ? { ...item, [field]: value } : item
            )
        )
    }

    const handleSubmit = async () => {
        if (!selectedQuiz || !userProfile) return

        const unratedQuestions = questionFeedback.filter(
            item => item.qualityScore === 0 || !item.recommendation
        )
        if (unratedQuestions.length > 0) {
            setError('Please complete both scales for every question before submitting.')
            return
        }

        const missingComments = questionFeedback.filter(
            item => item.recommendation === 'do_not_recommend' && !item.comment.trim()
        )
        if (missingComments.length > 0) {
            setError('Please add a comment for each question marked Do not recommend.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            await submitPeerQuizReview({
                quiz: selectedQuiz,
                reviewer: userProfile,
                questionFeedback,
            })

            setAlreadyReviewed(current => new Set([...current, selectedQuiz.id]))
            setQuizzes(current =>
                current.map(quiz =>
                    quiz.id === selectedQuiz.id
                        ? {
                            ...quiz,
                            status: 'peer_approved',
                            reviewCount: quiz.reviewCount + 1,
                        }
                        : quiz
                )
            )
            setSubmitted(true)
        } catch (submitError) {
            console.error(submitError)
            setError('Failed to submit review. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const filteredQuizzes = useMemo(() => {
        if (!selectedTopicId) return quizzes

        const selectedTopicName = topics.find(topic => topic.id === selectedTopicId)?.name
        return quizzes.filter(quiz =>
            quiz.questions.some(question =>
                question.topicId === selectedTopicId || question.topicName === selectedTopicName
            )
        )
    }, [quizzes, selectedTopicId, topics])

    const pendingQuizzes = filteredQuizzes.filter(quiz => !alreadyReviewed.has(quiz.id))
    const reviewedQuizzes = filteredQuizzes.filter(quiz => alreadyReviewed.has(quiz.id))

    if (selectedQuiz && submitted) {
        return (
            <StudentLayout title="Peer Review">
                <div className="max-w-2xl mx-auto p-6 text-center">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Review submitted</h2>
                        <p className="text-slate-500 mb-6">
                            Your feedback for "{selectedQuiz.title}" has been saved.
                        </p>
                        <button
                            onClick={closeReview}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
                        >
                            Back to Queue
                        </button>
                    </div>
                </div>
            </StudentLayout>
        )
    }

    if (selectedQuiz) {
        const highlyRecommendedCount = questionFeedback.filter(
            item => item.recommendation === 'highly_recommend'
        ).length
        const notRecommendedCount = questionFeedback.filter(
            item => item.recommendation === 'do_not_recommend'
        ).length
        const ratedCount = questionFeedback.filter(
            item => item.qualityScore > 0 && !!item.recommendation
        ).length
        const totalCount = questionFeedback.length

        return (
            <StudentLayout title="Peer Review">
                <div className="max-w-3xl mx-auto p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={closeReview}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            Back
                        </button>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-slate-800">{selectedQuiz.title}</h1>
                            <p className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
                                <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    {selectedQuiz.anonymousLabel}
                                </span>
                                <span>{totalCount} question{totalCount !== 1 ? 's' : ''}</span>
                            </p>
                        </div>
                        <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full shrink-0">
                            {ratedCount}/{totalCount} rated
                        </div>
                    </div>

                    <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm">
                        The author stays anonymous. Review only the quality of the questions.
                    </div>

                    {error && (
                        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 mb-6">
                        {selectedQuiz.questions.map((question, index) => {
                            const feedback = questionFeedback.find(item => item.questionId === question.id)
                            const needsComment = feedback?.recommendation === 'do_not_recommend'

                            return (
                                <div
                                    key={question.id}
                                    className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden"
                                >
                                    <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-5 py-3 flex items-center justify-between">
                                        <span className="text-white text-xs font-semibold uppercase tracking-wide">
                                            Question {index + 1}
                                        </span>
                                        {question.topicName && (
                                            <span className="text-white/80 text-xs">
                                                {question.topicName}
                                                {question.subtopic ? ` / ${question.subtopic}` : ''}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-5">
                                        <p className="text-slate-800 font-semibold text-base mb-4">
                                            {question.text || <span className="text-slate-400 italic">No question text</span>}
                                        </p>

                                        <div className={`grid gap-2 mb-5 ${question.type === 'quiz' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
                                            {question.answers.map(answer => (
                                                <div
                                                    key={answer.id}
                                                    className={`rounded-xl px-4 py-3 border-2 ${
                                                        answer.isCorrect
                                                            ? 'border-green-500 bg-green-50 text-green-800 font-semibold'
                                                            : 'border-slate-200 bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    {answer.text || 'No answer text'}
                                                    {answer.isCorrect && <span className="ml-2 text-green-600">Correct</span>}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="border-t border-slate-100 pt-4">
                                            <div className="mb-4">
                                                <p className="text-xs font-semibold text-slate-600 mb-3">
                                                    Overall quality of the question
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                                                    {([1, 2, 3, 4, 5] as const).map(score => (
                                                        <button
                                                            key={score}
                                                            onClick={() => setQFeedback(question.id, 'qualityScore', score)}
                                                            className={`rounded-xl border-2 px-3 py-3 text-left transition-all ${
                                                                feedback?.qualityScore === score
                                                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                                    : 'border-slate-200 text-slate-600 hover:border-purple-300'
                                                            }`}
                                                        >
                                                            <div className="text-base font-bold">{score}</div>
                                                            <div className="text-[11px] leading-4">{QUALITY_LABELS[score]}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <p className="text-xs font-semibold text-slate-600 mb-3">
                                                    Recommendation for this question
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {RECOMMENDATION_OPTIONS.map(option => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => setQFeedback(question.id, 'recommendation', option.value)}
                                                            className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition-all ${
                                                                feedback?.recommendation === option.value
                                                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                                    : 'border-slate-200 text-slate-600 hover:border-purple-300'
                                                            }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <p className="text-xs font-semibold text-slate-600 mb-2">
                                                Comment for the author
                                                <span className={`ml-2 ${needsComment ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {needsComment ? 'Required for Do not recommend' : 'Optional'}
                                                </span>
                                            </p>
                                            <textarea
                                                placeholder="Leave feedback for this question..."
                                                value={feedback?.comment || ''}
                                                onChange={event => setQFeedback(question.id, 'comment', event.target.value)}
                                                rows={2}
                                                className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none ${
                                                    needsComment && !feedback?.comment.trim()
                                                        ? 'border-red-300'
                                                        : 'border-slate-200'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5 flex items-center justify-between">
                        <div className="flex gap-4 text-sm">
                            <span className="text-emerald-600 font-semibold">{highlyRecommendedCount} highly recommended</span>
                            <span className="text-red-500 font-semibold">{notRecommendedCount} not recommended</span>
                            <span className="text-slate-400">{totalCount} questions reviewed</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-all"
                    >
                        {submitting ? 'Submitting...' : 'Submit review'}
                    </button>
                    {ratedCount < totalCount && (
                        <p className="text-center text-xs text-slate-400 mt-2">
                            Complete both scales for every question to enable a clean submission.
                        </p>
                    )}
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="Peer Review">
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Peer Review</h1>
                    <p className="text-slate-400 text-sm">
                        Review classmates' quizzes anonymously. The queue prioritizes quizzes with fewer completed peer reviews.
                    </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Filter by topic</h2>
                    <div className="flex gap-3">
                        <select
                            value={selectedTopicId}
                            onChange={event => setSelectedTopicId(event.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            <option value="">All topics</option>
                            {topics.map(topic => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.name}
                                </option>
                            ))}
                        </select>
                        {selectedTopicId && (
                            <button
                                onClick={() => setSelectedTopicId('')}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-all"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <h2 className="text-base font-semibold text-slate-700">Needs your review</h2>
                                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {pendingQuizzes.length}
                                </span>
                            </div>
                            {pendingQuizzes.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 text-center">
                                    <p className="font-semibold text-slate-700">You are all caught up.</p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {selectedTopicId ? 'No quizzes found for this topic.' : 'No quizzes are waiting for your review.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingQuizzes.map(quiz => (
                                        <QuizCard
                                            key={quiz.id}
                                            quiz={quiz}
                                            reviewed={false}
                                            onReview={() => openReview(quiz)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {reviewedQuizzes.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-base font-semibold text-slate-700">Already reviewed</h2>
                                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {reviewedQuizzes.length}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {reviewedQuizzes.map(quiz => (
                                        <QuizCard
                                            key={quiz.id}
                                            quiz={quiz}
                                            reviewed={true}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </StudentLayout>
    )
}

function QuizCard({
    quiz,
    reviewed,
    onReview,
}: {
    quiz: PeerReviewQuiz
    reviewed: boolean
    onReview?: () => void
}) {
    const topicNames = [...new Set(quiz.questions.map(question => question.topicName).filter(Boolean))]

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800 truncate">{quiz.title}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                        {quiz.anonymousLabel}
                    </span>
                    {reviewed && (
                        <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                            Reviewed
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400">
                    {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''} · {quiz.reviewCount} peer review{quiz.reviewCount !== 1 ? 's' : ''}
                </p>
                {topicNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {topicNames.map(topicName => (
                            <span key={topicName} className="text-[10px] bg-purple-50 text-purple-600 font-semibold px-2 py-0.5 rounded-full">
                                {topicName}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <button
                onClick={onReview}
                disabled={reviewed || !onReview}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    reviewed
                        ? 'bg-slate-100 text-slate-500 cursor-default'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
            >
                {reviewed ? 'Completed' : 'Review'}
            </button>
        </div>
    )
}
