'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { getUserProfile, UserProfile } from '@/lib/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection, query, where, getDocs, doc,
    addDoc, updateDoc, serverTimestamp, getDoc,
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
    createdByName?: string;
    classId: string;
    status: string;
    topicName?: string;
    createdAt?: any;
}

type Quality = 'good' | 'needs_improvement' | 'irrelevant' | '';

interface QuestionFeedback {
    questionId: number;
    quality: Quality;
    comment: string;
}

// ── Quality options ────────────────────────────────────────────────────────
const QUALITY_OPTIONS: { value: Quality; label: string; color: string; bg: string }[] = [
    { value: 'good', label: '✅ Good', color: 'text-green-700', bg: 'bg-green-50 border-green-400' },
    { value: 'needs_improvement', label: '⚠️ Needs Work', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-400' },
    { value: 'irrelevant', label: '❌ Irrelevant', color: 'text-red-700', bg: 'bg-red-50 border-red-400' },
];

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ReviewPeersPage() {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
    const [alreadyReviewed, setAlreadyReviewed] = useState<Set<string>>(new Set());

    // Topic filter state
    const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<string>('');
    const [searched, setSearched] = useState(false);

    // Review form state
    const [overallFeedback, setOverallFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedback[]>([]);
    const [suggestToTeacher, setSuggestToTeacher] = useState(false);
    const [suggestReason, setSuggestReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load topics from Firestore
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

            // Enrich with creator name
            const enriched = await Promise.all(all.map(async (qz) => {
                try {
                    const userSnap = await getDoc(doc(db, 'users', qz.createdBy));
                    const userData = userSnap.data() as any;
                    return { ...qz, createdByName: userData?.name || 'A classmate' };
                } catch {
                    return { ...qz, createdByName: 'A classmate' };
                }
            }));

            // Check which ones this user already reviewed
            const reviewQ = query(
                collection(db, 'reviews'),
                where('reviewerId', '==', profile.uid),
            );
            const reviewSnap = await getDocs(reviewQ);
            const reviewed = new Set(reviewSnap.docs.map(d => (d.data() as any).quizId as string));

            setAlreadyReviewed(reviewed);
            setQuizzes(enriched);
        } catch (e) {
            console.error(e);
            setError('Failed to load quizzes. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    // Open a quiz for review
    const openReview = (quiz: Quiz) => {
        setSelectedQuiz(quiz);
        setOverallFeedback('');
        setRating(0);
        setHoverRating(0);
        setSuggestToTeacher(false);
        setSuggestReason('');
        setSubmitted(false);
        setError(null);
        setQuestionFeedback(
            quiz.questions.map(q => ({ questionId: q.id, quality: '', comment: '' }))
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeReview = () => {
        setSelectedQuiz(null);
        setSubmitted(false);
    };

    const setQFeedback = (questionId: number, field: 'quality' | 'comment', value: string) => {
        setQuestionFeedback(prev =>
            prev.map(qf => qf.questionId === questionId ? { ...qf, [field]: value } : qf)
        );
    };

    // Submit review
    const handleSubmit = async () => {
        if (!selectedQuiz || !userProfile) return;
        if (!overallFeedback.trim()) { setError('Please write overall feedback.'); return; }
        if (rating === 0) { setError('Please give a star rating.'); return; }
        const unanswered = questionFeedback.filter(qf => !qf.quality);
        if (unanswered.length > 0) {
            setError(`Please rate all ${unanswered.length} question(s) — Good / Needs Work / Irrelevant.`);
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await addDoc(collection(db, 'reviews'), {
                quizId: selectedQuiz.id,
                quizTitle: selectedQuiz.title,
                quizOwnerId: selectedQuiz.createdBy,
                reviewerId: userProfile.uid,
                reviewerName: userProfile.name || 'Student',
                classId: userProfile.classId,
                overallFeedback,
                rating,
                questionFeedback,
                suggestToTeacher,
                suggestReason: suggestToTeacher ? suggestReason : '',
                createdAt: serverTimestamp(),
            });

            const newStatus = suggestToTeacher ? 'peer_approved' : 'peer_reviewed';
            await updateDoc(doc(db, 'quizzes', selectedQuiz.id), {
                status: newStatus,
                lastReviewedAt: serverTimestamp(),
                ...(suggestToTeacher && { suggestedByPeer: true }),
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

    // Filtered quiz lists
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

    // ── Render: Success screen ─────────────────────────────────────────────
    if (selectedQuiz && submitted) {
        return (
            <StudentLayout title="Peer Review">
                <div className="max-w-2xl mx-auto p-6 text-center">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Review Submitted!</h2>
                        <p className="text-slate-500 mb-2">
                            Your feedback on <span className="font-semibold text-purple-600">"{selectedQuiz.title}"</span> has been saved.
                        </p>
                        {suggestToTeacher && (
                            <p className="text-sm text-green-600 font-semibold bg-green-50 px-4 py-2 rounded-lg inline-block mb-4">
                                ✅ You suggested this quiz to the teacher for classroom use!
                            </p>
                        )}
                        <div className="flex gap-3 justify-center mt-6">
                            <button
                                onClick={closeReview}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
                            >
                                ← Back to Quizzes
                            </button>
                        </div>
                    </div>
                </div>
            </StudentLayout>
        );
    }

    // ── Render: Review Form ────────────────────────────────────────────────
    if (selectedQuiz) {
        return (
            <StudentLayout title="Peer Review">
                <div className="max-w-3xl mx-auto p-4 sm:p-6">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={closeReview}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            ← Back
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Reviewing: {selectedQuiz.title}</h1>
                            <p className="text-sm text-slate-400">
                                By {selectedQuiz.createdByName} · {selectedQuiz.questions.length} question{selectedQuiz.questions.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* ── Questions ── */}
                    <div className="space-y-5 mb-6">
                        {selectedQuiz.questions.map((q, idx) => {
                            const qf = questionFeedback.find(f => f.questionId === q.id);
                            return (
                                <div key={q.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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

                                        {/* Per-question rating */}
                                        <div className="border-t border-slate-100 pt-4">
                                            <p className="text-xs font-semibold text-slate-600 mb-2">Rate this question:</p>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {QUALITY_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setQFeedback(q.id, 'quality', opt.value)}
                                                        className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${qf?.quality === opt.value
                                                                ? `${opt.bg} ${opt.color} scale-105`
                                                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <textarea
                                                placeholder="Optional: add a comment about this specific question..."
                                                value={qf?.comment || ''}
                                                onChange={e => setQFeedback(q.id, 'comment', e.target.value)}
                                                rows={2}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Overall Feedback ── */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
                        <h3 className="font-semibold text-slate-800 mb-1">📝 Overall Feedback</h3>
                        <p className="text-xs text-slate-400 mb-3">What do you think about this quiz overall? Be specific and constructive.</p>
                        <textarea
                            value={overallFeedback}
                            onChange={e => setOverallFeedback(e.target.value)}
                            placeholder="e.g. The questions are clear and well-structured. Question 2 might be too easy. Overall a great quiz on this topic!"
                            rows={4}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                        />

                        {/* Star Rating */}
                        <div className="mt-4">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Overall Quality Rating:</p>
                            <div className="flex gap-1 items-center">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setRating(star)}
                                        className="text-3xl transition-transform hover:scale-110"
                                    >
                                        {star <= (hoverRating || rating) ? '⭐' : '☆'}
                                    </button>
                                ))}
                                {rating > 0 && (
                                    <span className="ml-2 text-sm text-slate-500">
                                        {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Suggest to Teacher ── */}
                    <div className={`rounded-2xl border-2 p-5 mb-6 transition-all ${suggestToTeacher ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-start gap-3">
                            <button
                                onClick={() => setSuggestToTeacher(v => !v)}
                                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${suggestToTeacher ? 'bg-teal-500 border-teal-500' : 'border-slate-300'
                                    }`}
                            >
                                {suggestToTeacher && <span className="text-white text-xs font-bold">✓</span>}
                            </button>
                            <div className="flex-1">
                                <p className="font-semibold text-slate-800 text-sm">
                                    🏫 Suggest this quiz to the teacher for classroom use
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    If you think this quiz is high quality and relevant to the topic, recommend it for the teacher to use.
                                </p>
                                {suggestToTeacher && (
                                    <textarea
                                        value={suggestReason}
                                        onChange={e => setSuggestReason(e.target.value)}
                                        placeholder="Why should the teacher use this quiz? (optional but helpful)"
                                        rows={2}
                                        className="mt-3 w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Submit ── */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Submitting…</>
                        ) : (
                            '✅ Submit Review'
                        )}
                    </button>
                </div>
            </StudentLayout>
        );
    }

    // ── Render: Quiz List ──────────────────────────────────────────────────
    return (
        <StudentLayout title="Peer Review">
            <div className="max-w-3xl mx-auto p-4 sm:p-6">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Peer Review</h1>
                    <p className="text-slate-400 text-sm">
                        Review your classmates' quizzes — rate quality, give feedback, and suggest great ones to the teacher.
                    </p>
                </div>

                {/* ── Topic Search Bar ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">🔍 Filter by Topic</h2>
                    <div className="flex gap-3">
                        <select
                            value={selectedTopicId}
                            onChange={e => { setSelectedTopicId(e.target.value); setSearched(true); }}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            <option value="">All Topics</option>
                            {topics.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        {selectedTopicId && (
                            <button
                                onClick={() => { setSelectedTopicId(''); setSearched(false); }}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-all"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {selectedTopicId && searched && (
                        <p className="text-xs text-purple-600 font-medium mt-2">
                            📚 Showing quizzes for: <span className="font-bold">{topics.find(t => t.id === selectedTopicId)?.name}</span>
                        </p>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                    </div>
                ) : (
                    <>
                        {/* ── Pending Reviews ── */}
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
                                        {selectedTopicId
                                            ? 'No quizzes found for this topic.'
                                            : 'No quizzes waiting for your review right now.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingQuizzes.map(qz => (
                                        <QuizCard
                                            key={qz.id}
                                            quiz={qz}
                                            reviewed={false}
                                            onReview={() => openReview(qz)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Already Reviewed ── */}
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
                                        <QuizCard
                                            key={qz.id}
                                            quiz={qz}
                                            reviewed={true}
                                            onReview={() => openReview(qz)}
                                        />
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
function QuizCard({
    quiz, reviewed, onReview
}: {
    quiz: Quiz;
    reviewed: boolean;
    onReview: () => void;
}) {
    // Collect unique topic names from questions
    const topicNames = [...new Set(quiz.questions.map(q => q.topicName).filter(Boolean))];

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800 truncate">{quiz.title}</span>
                    {quiz.status === 'peer_approved' && (
                        <span className="text-[10px] bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded-full">
                            🏫 Suggested to teacher
                        </span>
                    )}
                    {reviewed && (
                        <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                            ✓ Reviewed
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400">
                    By {quiz.createdByName} · {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
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
