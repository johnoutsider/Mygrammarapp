'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { getUserProfile, UserProfile } from '@/lib/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection, query, where, getDocs, doc,
    addDoc, updateDoc, serverTimestamp,
    orderBy, onSnapshot
} from 'firebase/firestore';
import StudentLayout from '@/components/StudentLayout';

// ── Types ──────────────────────────────────────────────────────────────────
interface Answer {
    id: number;
    text: string;
    isCorrect: boolean;
    explanation: string;
}

interface Question {
    id: number;
    type: 'quiz' | 'true_or_false';
    text: string;
    answers: Answer[];
    topicId?: string;
    topicName?: string;
    subtopic?: string;
}

interface Quiz {
    id: string;
    title: string;
    questions: Question[];
    createdBy: string;
    classId: string;
    status: string;
    anonymousLabel?: string;
}

// ── Per-question verdict ───────────────────────────────────────────────────
type Verdict = 'approved' | 'rejected' | '';

interface QuestionFeedback {
    questionId: number;
    verdict: Verdict;
    comment: string;
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ReviewPeersPage() {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
    const [alreadyReviewed, setAlreadyReviewed] = useState<Set<string>>(new Set());

    // Topic filter
    const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<string>('');

    // Review form
    const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedback[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load topics
    useEffect(() => {
        const q = query(collection(db, 'topics'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setTopics(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name })));
        });
        return () => unsub();
    }, []);

    // Auth + load quizzes
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!u) return;
            const profile = await getUserProfile(u.uid);
            setUserProfile(profile);
            if (profile) await loadQuizzes(profile);
        });
        return () => unsub();
    }, []);

    const loadQuizzes = async (profile: UserProfile) => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'quizzes'),
                where('classId', '==', profile.classId),
                where('status', 'in', ['pending', 'peer_reviewed']),
            );
            const snap = await getDocs(q);
            const all = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as Quiz))
                .filter(qz => qz.createdBy !== profile.uid);

            // Shuffle + label anonymously
            const shuffled = all
                .sort(() => Math.random() - 0.5)
                .map((qz, idx) => ({ ...qz, anonymousLabel: `Quiz #${idx + 1}` }));

            // Already reviewed
            const reviewQ = query(
                collection(db, 'reviews'),
                where('reviewerId', '==', profile.uid),
            );
            const reviewSnap = await getDocs(reviewQ);
            const reviewed = new Set(reviewSnap.docs.map(d => (d.data() as any).quizId as string));

            setAlreadyReviewed(reviewed);
            setQuizzes(shuffled);
        } catch (e) {
            console.error(e);
            setError('Failed to load quizzes. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    const openReview = (quiz: Quiz) => {
        setSelectedQuiz(quiz);
        setSubmitted(false);
        setError(null);
        setQuestionFeedback(
            quiz.questions.map(q => ({ questionId: q.id, verdict: '', comment: '' }))
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeReview = () => { setSelectedQuiz(null); setSubmitted(false); };

    const setQFeedback = (questionId: number, field: 'verdict' | 'comment', value: string) => {
        setQuestionFeedback(prev =>
            prev.map(qf => qf.questionId === questionId ? { ...qf, [field]: value } : qf)
        );
    };

    // Submit
    const handleSubmit = async () => {
        if (!selectedQuiz || !userProfile) return;

        const unvoted = questionFeedback.filter(qf => !qf.verdict);
        if (unvoted.length > 0) {
            setError(`Please approve or reject all ${unvoted.length} question(s) before submitting.`);
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const allApproved = questionFeedback.every(qf => qf.verdict === 'approved');
            const allRejected = questionFeedback.every(qf => qf.verdict === 'rejected');

            await addDoc(collection(db, 'reviews'), {
                quizId: selectedQuiz.id,
                quizTitle: selectedQuiz.title,
                quizOwnerId: selectedQuiz.createdBy,
                reviewerId: userProfile.uid,
                reviewerName: userProfile.name || 'Student',
                classId: userProfile.classId,
                questionFeedback,
                overallVerdict: allApproved ? 'approved' : allRejected ? 'rejected' : 'mixed',
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(db, 'quizzes', selectedQuiz.id), {
                status: 'peer_reviewed',
                lastReviewedAt: serverTimestamp(),
            });

            setAlreadyReviewed(prev => new Set([...prev, selectedQuiz.id]));
            setSubmitted(true);
        } catch (e) {
            console.error(e);
            setError('Failed to submit review. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter
    const filteredQuizzes = selectedTopicId
        ? quizzes.filter(qz =>
            qz.questions.some(q =>
                q.topicId === selectedTopicId ||
                q.topicName === topics.find(t => t.id === selectedTopicId)?.name
            )
        )
        : quizzes;

    const pendingQuizzes = filteredQuizzes.filter(qz => !alreadyReviewed.has(qz.id));
    const reviewedQuizzes = filteredQuizzes.filter(qz => alreadyReviewed.has(qz.id));

    // ── Success screen ─────────────────────────────────────────────────────
    if (selectedQuiz && submitted) {
        return (
            <StudentLayout title="Peer Review">
                <div className="max-w-2xl mx-auto p-6 text-center">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Review Submitted!</h2>
                        <p className="text-slate-500 mb-6">
                            Your feedback on <span className="font-semibold text-purple-600">"{selectedQuiz.title}"</span> has been saved.
                        </p>
                        <button
                            onClick={closeReview}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
                        >
                            ← Back to Quizzes
                        </button>
                    </div>
                </div>
            </StudentLayout>
        );
    }

    // ── Review form ────────────────────────────────────────────────────────
    if (selectedQuiz) {
        const approvedCount = questionFeedback.filter(qf => qf.verdict === 'approved').length;
        const rejectedCount = questionFeedback.filter(qf => qf.verdict === 'rejected').length;
        const totalCount = questionFeedback.length;

        return (
            <StudentLayout title="Peer Review">
                <div className="max-w-3xl mx-auto p-4 sm:p-6">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={closeReview}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            ← Back
                        </button>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-slate-800">{selectedQuiz.title}</h1>
                            <p className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
                                <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    🎭 Anonymous submission
                                </span>
                                · {totalCount} question{totalCount !== 1 ? 's' : ''}
                            </p>
                        </div>
                        {/* Progress pill */}
                        <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full shrink-0">
                            {approvedCount + rejectedCount}/{totalCount} rated
                        </div>
                    </div>

                    {/* Anonymous notice */}
                    <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm flex items-center gap-2">
                        🔒 <span>The author is hidden. Review based on content quality only.</span>
                    </div>

                    {error && (
                        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* ── Questions ── */}
                    <div className="space-y-4 mb-6">
                        {selectedQuiz.questions.map((q, idx) => {
                            const qf = questionFeedback.find(f => f.questionId === q.id);
                            const isApproved = qf?.verdict === 'approved';
                            const isRejected = qf?.verdict === 'rejected';

                            return (
                                <div
                                    key={q.id}
                                    className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${isApproved ? 'border-green-400' :
                                            isRejected ? 'border-red-400' :
                                                'border-slate-100'
                                        }`}
                                >
                                    {/* Question header */}
                                    <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-5 py-3 flex items-center justify-between">
                                        <span className="text-white text-xs font-semibold uppercase tracking-wide">
                                            Question {idx + 1} · {q.type === 'true_or_false' ? 'True / False' : 'Multiple Choice'}
                                        </span>
                                        {q.topicName && (
                                            <span className="text-white/80 text-xs">
                                                📚 {q.topicName}{q.subtopic ? ` › ${q.subtopic}` : ''}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-5">
                                        {/* Question text */}
                                        <p className="text-slate-800 font-semibold text-base mb-4">
                                            {q.text || <span className="text-slate-400 italic">No question text</span>}
                                        </p>

                                        {/* Answers */}
                                        <div className={`grid gap-2 mb-5 ${q.type === 'quiz' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
                                            {q.answers.map((a, aIdx) => {
                                                const quizColors = ['bg-red-500', 'bg-blue-600', 'bg-yellow-500', 'bg-green-600'];
                                                const tfColors = ['bg-blue-500', 'bg-red-500'];
                                                const bg = q.type === 'quiz' ? quizColors[aIdx] : tfColors[aIdx];
                                                return (
                                                    <div
                                                        key={a.id}
                                                        className={`${bg} ${a.isCorrect ? 'ring-4 ring-white ring-offset-2' : 'opacity-80'} rounded-xl px-4 py-3 flex items-center gap-2`}
                                                    >
                                                        {a.isCorrect && <span className="text-white font-bold text-sm shrink-0">✓</span>}
                                                        <span className="text-white text-sm font-medium">{a.text || '—'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* ── Approve / Reject + comment ── */}
                                        <div className="border-t border-slate-100 pt-4">
                                            <p className="text-xs font-semibold text-slate-600 mb-3">Your verdict:</p>
                                            <div className="flex gap-3 mb-3">
                                                {/* Approve */}
                                                <button
                                                    onClick={() => setQFeedback(q.id, 'verdict', 'approved')}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${isApproved
                                                            ? 'bg-green-500 border-green-500 text-white scale-[1.02] shadow-md'
                                                            : 'border-slate-200 text-slate-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50'
                                                        }`}
                                                >
                                                    ✅ Approve
                                                </button>
                                                {/* Reject */}
                                                <button
                                                    onClick={() => setQFeedback(q.id, 'verdict', 'rejected')}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${isRejected
                                                            ? 'bg-red-500 border-red-500 text-white scale-[1.02] shadow-md'
                                                            : 'border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-600 hover:bg-red-50'
                                                        }`}
                                                >
                                                    ❌ Reject
                                                </button>
                                            </div>

                                            {/* Feedback comment */}
                                            <textarea
                                                placeholder="Leave feedback for this question (optional but helpful)..."
                                                value={qf?.comment || ''}
                                                onChange={e => setQFeedback(q.id, 'comment', e.target.value)}
                                                rows={2}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Progress summary */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5 flex items-center justify-between">
                        <div className="flex gap-4 text-sm">
                            <span className="text-green-600 font-semibold">✅ {approvedCount} Approved</span>
                            <span className="text-red-500 font-semibold">❌ {rejectedCount} Rejected</span>
                            <span className="text-slate-400">{totalCount - approvedCount - rejectedCount} remaining</span>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || (approvedCount + rejectedCount < totalCount)}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Submitting…</>
                        ) : (
                            `✅ Submit Review`
                        )}
                    </button>
                    {(approvedCount + rejectedCount < totalCount) && (
                        <p className="text-center text-xs text-slate-400 mt-2">
                            Rate all questions to enable submit
                        </p>
                    )}
                </div>
            </StudentLayout>
        );
    }

    // ── Quiz list ──────────────────────────────────────────────────────────
    return (
        <StudentLayout title="Peer Review">
            <div className="max-w-3xl mx-auto p-4 sm:p-6">

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Peer Review</h1>
                    <p className="text-slate-400 text-sm">
                        Review your classmates' quizzes anonymously — approve or reject each question.
                    </p>
                </div>

                {/* Topic Filter */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">🔍 Filter by Topic</h2>
                    <div className="flex gap-3">
                        <select
                            value={selectedTopicId}
                            onChange={e => setSelectedTopicId(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            <option value="">All Topics</option>
                            {topics.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
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
                    {selectedTopicId && (
                        <p className="text-xs text-purple-600 font-medium mt-2">
                            📚 Showing: <span className="font-bold">{topics.find(t => t.id === selectedTopicId)?.name}</span>
                        </p>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                    </div>
                ) : (
                    <>
                        {/* Pending */}
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <h2 className="text-base font-semibold text-slate-700">Needs Your Review</h2>
                                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {pendingQuizzes.length}
                                </span>
                            </div>
                            {pendingQuizzes.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 text-center">
                                    <div className="text-4xl mb-3">🎉</div>
                                    <p className="font-semibold text-slate-700">You're all caught up!</p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {selectedTopicId ? 'No quizzes found for this topic.' : 'No quizzes waiting for your review.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingQuizzes.map(qz => (
                                        <QuizCard key={qz.id} quiz={qz} reviewed={false} onReview={() => openReview(qz)} topics={topics} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Already reviewed */}
                        {reviewedQuizzes.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-base font-semibold text-slate-700">Already Reviewed</h2>
                                    <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {reviewedQuizzes.length}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {reviewedQuizzes.map(qz => (
                                        <QuizCard key={qz.id} quiz={qz} reviewed={true} onReview={() => openReview(qz)} topics={topics} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </StudentLayout>
    );
}

// ── Quiz Card ──────────────────────────────────────────────────────────────
function QuizCard({ quiz, reviewed, onReview, topics }: {
    quiz: Quiz;
    reviewed: boolean;
    onReview: () => void;
    topics: { id: string; name: string }[];
}) {
    const topicNames = [...new Set(quiz.questions.map(q => q.topicName).filter(Boolean))];
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800 truncate">{quiz.title}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                        🎭 {quiz.anonymousLabel}
                    </span>
                    {reviewed && (
                        <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                            ✓ Reviewed
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400">
                    {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                </p>
                {topicNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {topicNames.map((t, i) => (
                            <span key={i} className="text-[10px] bg-purple-50 text-purple-600 font-semibold px-2 py-0.5 rounded-full">
                                📚 {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <button
                onClick={onReview}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${reviewed
                        ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
            >
                {reviewed ? '✏️ Re-review' : '📝 Review'}
            </button>
        </div>
    );
}
