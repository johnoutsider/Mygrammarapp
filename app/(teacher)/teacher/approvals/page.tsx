'use client'

import { useState, useEffect } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import { auth, db } from '@/lib/firebase'
import {
    collection, doc, getDocs, query, where,
    updateDoc, serverTimestamp, addDoc,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// ── Config ─────────────────────────────────────────────────────────────────────

const PEER_THRESHOLD = 1 // number of peer reviews before a quiz escalates to teacher

// ── Types ──────────────────────────────────────────────────────────────────────

interface Answer {
    id: number
    text: string
    isCorrect: boolean
    explanation: string
}

interface Question {
    id: number
    type: 'quiz' | 'true_or_false'
    text: string
    answers: Answer[]
    topicName?: string
    subtopic?: string
    timeLimit: number
}

interface QuestionFeedback {
    questionId: number
    verdict: 'approved' | 'rejected' | ''
    comment: string
}

interface PeerReview {
    id: string
    quizId: string
    reviewerName: string
    overallVerdict: 'approved' | 'rejected' | 'mixed'
    questionFeedback: QuestionFeedback[]
    createdAt: any
}

interface PendingQuiz {
    id: string
    title: string
    createdBy: string
    contributorName: string
    status: string
    createdAt: any
    questions: Question[]
    peerReviews: PeerReview[]
    peerApprovedCount: number
    peerRejectedCount: number
    teacherNote?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(val: any): string {
    if (!val) return '—'
    if (val.toDate) return val.toDate().toLocaleDateString()
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString()
    return '—'
}

// ── Peer Review Summary ────────────────────────────────────────────────────────

function PeerReviewSummary({ reviews, questions }: {
    reviews: PeerReview[]
    questions: Question[]
}) {
    if (reviews.length === 0) {
        return <p className="text-sm text-slate-400 italic py-4 text-center">No peer reviews yet.</p>
    }

    return (
        <div className="space-y-3">
            {reviews.map((r, ri) => {
                const verdictCls =
                    r.overallVerdict === 'approved' ? 'bg-green-100 text-green-700' :
                        r.overallVerdict === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                const verdictIcon =
                    r.overallVerdict === 'approved' ? '✅' :
                        r.overallVerdict === 'rejected' ? '❌' : '⚠️'

                return (
                    <div key={r.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <p className="text-sm font-semibold text-slate-700">
                                🎭 Peer {ri + 1}
                                <span className="ml-2 text-xs text-slate-400 font-normal">{fmtDate(r.createdAt)}</span>
                            </p>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${verdictCls}`}>
                                {verdictIcon} {r.overallVerdict.charAt(0).toUpperCase() + r.overallVerdict.slice(1)}
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {r.questionFeedback.map((qf, qi) => {
                                const q = questions.find(q => q.id === qf.questionId)
                                const ok = qf.verdict === 'approved'
                                return (
                                    <div key={qi} className="flex items-start gap-2 text-xs">
                                        <span className={`mt-0.5 font-bold shrink-0 ${ok ? 'text-green-500' : 'text-red-400'}`}>
                                            {ok ? '✓' : '✗'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-600 truncate">
                                                Q{qi + 1}: {q?.text || `Question ${qf.questionId}`}
                                            </p>
                                            {qf.comment && (
                                                <p className="text-slate-400 italic mt-0.5">"{qf.comment}"</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ── Quiz Row Card ──────────────────────────────────────────────────────────────

function QuizRow({ quiz, onReview, archived }: {
    quiz: PendingQuiz
    onReview: () => void
    archived?: boolean
}) {
    const approvedPct = quiz.peerReviews.length > 0
        ? Math.round((quiz.peerApprovedCount / quiz.peerReviews.length) * 100)
        : 0

    const statusLabel =
        quiz.status === 'teacher_approved'
            ? { text: '✅ Approved', cls: 'bg-green-100 text-green-700' }
            : quiz.status === 'rejected'
                ? { text: '❌ Rejected', cls: 'bg-red-100 text-red-700' }
                : { text: '⏳ Awaiting Your Review', cls: 'bg-amber-100 text-amber-700' }

    return (
        <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${archived ? 'opacity-80 border-slate-200' : 'border-amber-200'}`}>
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-slate-800 truncate">{quiz.title || '(Untitled Quiz)'}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusLabel.cls}`}>
                            {statusLabel.text}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400">
                        👤 {quiz.contributorName}
                        <span className="mx-1.5">·</span>
                        📅 {fmtDate(quiz.createdAt)}
                        <span className="mx-1.5">·</span>
                        {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 max-w-[180px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="h-1.5 rounded-full bg-green-400 transition-all"
                                style={{ width: `${approvedPct}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 shrink-0">
                            <span className="text-green-600 font-bold">{quiz.peerApprovedCount}</span>
                            <span className="mx-1">/</span>
                            {quiz.peerReviews.length} peer{quiz.peerReviews.length !== 1 ? 's' : ''} approved
                        </p>
                    </div>
                </div>
                <button
                    onClick={onReview}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${archived
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                        }`}
                >
                    {archived ? '👁 View' : '📋 Review'}
                </button>
            </div>
            {quiz.status === 'rejected' && quiz.teacherNote && (
                <div className="mx-5 mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-xs text-red-700">
                    <span className="font-bold">💬 Your note:</span> {quiz.teacherNote}
                </div>
            )}
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
    const [pendingQuizzes, setPendingQuizzes] = useState<PendingQuiz[]>([])
    const [archivedQuizzes, setArchivedQuizzes] = useState<PendingQuiz[]>([])
    const [loading, setLoading] = useState(true)

    const [selected, setSelected] = useState<PendingQuiz | null>(null)
    const [activeTab, setActiveTab] = useState<'questions' | 'peer_reviews'>('questions')
    const [teacherNote, setTeacherNote] = useState('')
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)

    const [stats, setStats] = useState({
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        totalPeerReviewed: 0,
    })

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) return
            await loadData()
        })
        return () => unsub()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // Scope to teacher's classes
            const { getUserProfile } = await import('@/lib/auth')
            const { getStudentsByClassIds } = await import('@/lib/groupService')
            const profile = await getUserProfile(auth.currentUser!.uid)
            const classIds: string[] = (profile as any)?.classIds ?? []
            const myStudents = classIds.length > 0 ? await getStudentsByClassIds(classIds) : []

            // Build user name map from teacher's students
            const nameMap: Record<string, string> = {}
            myStudents.forEach(s => {
                nameMap[s.uid] = s.displayName || s.name || 'Unknown'
            })

            // Fetch quizzes scoped to teacher's classes + teacher's own quizzes
            const quizDocs: any[] = []
            for (let i = 0; i < classIds.length; i += 30) {
                const chunk = classIds.slice(i, i + 30)
                const snap = await getDocs(query(collection(db, 'quizzes'), where('classId', 'in', chunk)))
                quizDocs.push(...snap.docs)
            }
            // Also include teacher's own quizzes
            const teacherQuizSnap = await getDocs(query(collection(db, 'quizzes'), where('createdBy', '==', auth.currentUser!.uid)))
            const seenIds = new Set(quizDocs.map(d => d.id))
            teacherQuizSnap.docs.forEach(d => { if (!seenIds.has(d.id)) quizDocs.push(d) })
            const quizSnap = { docs: quizDocs }

            // Fetch all peer reviews
            const reviewSnap = await getDocs(collection(db, 'reviews'))
            const allReviews = reviewSnap.docs.map(d => ({ id: d.id, ...d.data() } as PeerReview))

            const pending: PendingQuiz[] = []
            const archived: PendingQuiz[] = []

            quizSnap.docs.forEach(d => {
                const data = d.data() as any
                const quizReviews = allReviews.filter(r => r.quizId === d.id)
                const peerApprovedCount = quizReviews.filter(r => r.overallVerdict === 'approved').length
                const peerRejectedCount = quizReviews.filter(r => r.overallVerdict === 'rejected').length

                const quiz: PendingQuiz = {
                    id: d.id,
                    title: data.title || '(Untitled)',
                    createdBy: data.createdBy || '',
                    contributorName: nameMap[data.createdBy] || 'Unknown Student',
                    status: data.status || 'pending',
                    createdAt: data.createdAt,
                    questions: Array.isArray(data.questions) ? data.questions : [],
                    peerReviews: quizReviews,
                    peerApprovedCount,
                    peerRejectedCount,
                    teacherNote: data.teacherNote,
                }

                const readyForTeacher =
                    (data.status === 'peer_approved' || quizReviews.length >= PEER_THRESHOLD) &&
                    data.status !== 'teacher_approved' &&
                    data.status !== 'rejected'

                if (readyForTeacher) {
                    pending.push(quiz)
                } else if (data.status === 'teacher_approved' || data.status === 'rejected') {
                    archived.push(quiz)
                }
            })

            const byDate = (a: PendingQuiz, b: PendingQuiz) =>
                (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)

            pending.sort(byDate)
            archived.sort(byDate)

            setPendingQuizzes(pending)
            setArchivedQuizzes(archived)
            setStats({
                totalPending: pending.length,
                totalApproved: archived.filter(q => q.status === 'teacher_approved').length,
                totalRejected: archived.filter(q => q.status === 'rejected').length,
                totalPeerReviewed: [...pending, ...archived].reduce((sum, q) => sum + q.peerReviews.length, 0),
            })
        } catch (err) {
            console.error('Failed to load approvals:', err)
        } finally {
            setLoading(false)
        }
    }

    const openModal = (quiz: PendingQuiz) => {
        setSelected(quiz)
        setActiveTab('questions')
        setTeacherNote('')
    }

    const closeModal = () => {
        setSelected(null)
        setTeacherNote('')
    }

    const handleApprove = async () => {
        if (!selected || !auth.currentUser) return
        setApproving(true)
        try {
            await updateDoc(doc(db, 'quizzes', selected.id), {
                status: 'teacher_approved',
                teacherApprovedBy: auth.currentUser.uid,
                teacherApprovedAt: serverTimestamp(),
                teacherNote: teacherNote.trim() || null,
            })

            await addDoc(collection(db, 'messages'), {
                fromId: 'system',
                fromName: 'Teacher (Quiz Review)',
                recipients: [selected.createdBy],
                title: `Your quiz "${selected.title}" has been approved! ✅`,
                body: `Great work! Your quiz has been reviewed by your peers and approved by the teacher. It is now part of the class Question Pool.${teacherNote.trim() ? `\n\nTeacher note: ${teacherNote.trim()}` : ''}`,
                createdAt: serverTimestamp(),
                readBy: [],
                type: 'system',
            })

            setPendingQuizzes(prev => prev.filter(q => q.id !== selected.id))
            setArchivedQuizzes(prev => [{
                ...selected,
                status: 'teacher_approved',
                teacherNote: teacherNote.trim() || undefined,
            }, ...prev])
            setStats(s => ({
                ...s,
                totalPending: s.totalPending - 1,
                totalApproved: s.totalApproved + 1,
            }))
            closeModal()
        } catch (err) {
            console.error(err)
            alert('Error approving quiz. Check console.')
        } finally {
            setApproving(false)
        }
    }

    const handleReject = async () => {
        if (!selected || !auth.currentUser) return
        if (!teacherNote.trim()) {
            alert('Please write a note explaining why the quiz is being rejected.')
            return
        }
        setRejecting(true)
        try {
            await updateDoc(doc(db, 'quizzes', selected.id), {
                status: 'rejected',
                rejectedBy: auth.currentUser.uid,
                rejectedAt: serverTimestamp(),
                teacherNote: teacherNote.trim(),
            })

            await addDoc(collection(db, 'messages'), {
                fromId: 'system',
                fromName: 'Teacher (Quiz Review)',
                recipients: [selected.createdBy],
                title: `Your quiz "${selected.title}" needs revision`,
                body: `Your quiz has been reviewed but was not approved at this stage.\n\nTeacher note: ${teacherNote.trim()}\n\nPlease update your quiz and resubmit it for peer review.`,
                createdAt: serverTimestamp(),
                readBy: [],
                type: 'system',
            })

            setPendingQuizzes(prev => prev.filter(q => q.id !== selected.id))
            setArchivedQuizzes(prev => [{
                ...selected,
                status: 'rejected',
                teacherNote: teacherNote.trim(),
            }, ...prev])
            setStats(s => ({
                ...s,
                totalPending: s.totalPending - 1,
                totalRejected: s.totalRejected + 1,
            }))
            closeModal()
        } catch (err) {
            console.error(err)
            alert('Error rejecting quiz. Check console.')
        } finally {
            setRejecting(false)
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <TeacherLayout title="Approvals">
            <div className="max-w-4xl mx-auto px-4 py-6">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Quiz Approvals</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Quizzes appear here after {PEER_THRESHOLD} peer reviews. Your approval publishes them to the Question Pool.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                        { icon: '⏳', label: 'Awaiting You', value: stats.totalPending, color: 'text-amber-600' },
                        { icon: '✅', label: 'Approved', value: stats.totalApproved, color: 'text-emerald-600' },
                        { icon: '❌', label: 'Rejected', value: stats.totalRejected, color: 'text-red-500' },
                        { icon: '👥', label: 'Peer Reviews Done', value: stats.totalPeerReviewed, color: 'text-blue-600' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col items-center gap-1 shadow-sm text-center">
                            <span className="text-xl">{s.icon}</span>
                            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                            <span className="text-[10px] text-slate-400 font-semibold leading-tight">{s.label}</span>
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                    </div>
                ) : (
                    <>
                        {/* Pending */}
                        <div className="mb-10">
                            <div className="flex items-center gap-2 mb-4">
                                <h2 className="text-base font-bold text-slate-700">Ready for Your Review</h2>
                                {pendingQuizzes.length > 0 && (
                                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {pendingQuizzes.length}
                                    </span>
                                )}
                            </div>

                            {pendingQuizzes.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-14 text-center">
                                    <div className="text-5xl mb-3">🎉</div>
                                    <p className="font-bold text-slate-700">All caught up!</p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        No quizzes have reached {PEER_THRESHOLD} peer reviews yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingQuizzes.map(q => (
                                        <QuizRow key={q.id} quiz={q} onReview={() => openModal(q)} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Archive */}
                        {archivedQuizzes.length > 0 && (
                            <div>
                                <h2 className="text-base font-bold text-slate-700 mb-4">Processed Archive</h2>
                                <div className="space-y-3">
                                    {archivedQuizzes.map(q => (
                                        <QuizRow key={q.id} quiz={q} onReview={() => openModal(q)} archived />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Review Modal ──────────────────────────────────────────────────── */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

                        {/* Modal header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50 rounded-t-2xl shrink-0">
                            <div className="min-w-0">
                                <h2 className="font-bold text-slate-800 text-lg truncate">{selected.title}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    By {selected.contributorName}
                                    <span className="mx-1.5">·</span>
                                    {selected.questions.length} questions
                                    <span className="mx-1.5">·</span>
                                    {selected.peerReviews.length} peer review{selected.peerReviews.length !== 1 ? 's' : ''}
                                    <span className="text-green-600 font-semibold ml-1">
                                        ({selected.peerApprovedCount} approved)
                                    </span>
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold shrink-0 mt-0.5"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 p-3 border-b border-slate-200 bg-white shrink-0">
                            {([
                                { key: 'questions', label: `📋 Questions (${selected.questions.length})` },
                                { key: 'peer_reviews', label: `👥 Peer Reviews (${selected.peerReviews.length})` },
                            ] as const).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.key
                                        ? 'bg-slate-800 text-white'
                                        : 'text-slate-500 hover:bg-slate-100'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto p-5">

                            {activeTab === 'questions' && (
                                <div className="space-y-4">
                                    {selected.questions.map((q, qi) => {
                                        const correctAnswer = q.answers.find(a => a.isCorrect)
                                        let qApproved = 0
                                        let qRejected = 0
                                        selected.peerReviews.forEach(r => {
                                            const qf = r.questionFeedback.find(f => f.questionId === q.id)
                                            if (qf?.verdict === 'approved') qApproved++
                                            if (qf?.verdict === 'rejected') qRejected++
                                        })

                                        return (
                                            <div key={qi} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                                                <div className="px-5 py-4">
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <span className="text-sm font-bold text-slate-400 shrink-0 mt-0.5">Q{qi + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            {q.topicName && (
                                                                <span className="inline-flex items-center text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full mb-2">
                                                                    📚 {q.topicName}{q.subtopic ? ` › ${q.subtopic}` : ''}
                                                                </span>
                                                            )}
                                                            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                                                                {q.text || '(No question text)'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Peer vote tally per question */}
                                                    {selected.peerReviews.length > 0 && (
                                                        <div className="flex items-center gap-3 mb-3 ml-7">
                                                            <span className="text-xs text-green-600 font-bold">👍 {qApproved}</span>
                                                            <span className="text-xs text-red-400 font-bold">👎 {qRejected}</span>
                                                            <div className="flex-1 max-w-[100px] bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className="h-1.5 rounded-full bg-green-400"
                                                                    style={{
                                                                        width: `${selected.peerReviews.length > 0
                                                                            ? Math.round((qApproved / selected.peerReviews.length) * 100)
                                                                            : 0}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Answers */}
                                                    <div className="space-y-1.5 ml-7">
                                                        {q.answers.filter(a => a.text.trim()).map((a, ai) => (
                                                            <div
                                                                key={ai}
                                                                className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${a.isCorrect
                                                                    ? 'bg-green-50 border border-green-200 text-green-800 font-semibold'
                                                                    : 'bg-white border border-slate-200 text-slate-600'
                                                                    }`}
                                                            >
                                                                <span className="font-bold shrink-0">
                                                                    {String.fromCharCode(65 + ai)}.
                                                                </span>
                                                                <span className="flex-1">{a.text}</span>
                                                                {a.isCorrect && (
                                                                    <span className="text-green-600 shrink-0">✓ Correct</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Explanation */}
                                                    {correctAnswer?.explanation && (
                                                        <div className="mt-2 ml-7 text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-100">
                                                            💬 {correctAnswer.explanation}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {activeTab === 'peer_reviews' && (
                                <PeerReviewSummary
                                    reviews={selected.peerReviews}
                                    questions={selected.questions}
                                />
                            )}
                        </div>

                        {/* Modal footer */}
                        <div className="border-t border-slate-200 bg-white rounded-b-2xl p-5 shrink-0">
                            {selected.status !== 'teacher_approved' && selected.status !== 'rejected' ? (
                                <>
                                    <div className="mb-3">
                                        <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                                            📝 Note to student
                                            <span className="ml-1 font-normal text-slate-400">
                                                (required if rejecting, optional if approving)
                                            </span>
                                        </label>
                                        <textarea
                                            value={teacherNote}
                                            onChange={e => setTeacherNote(e.target.value)}
                                            placeholder="e.g. Great work! / Please rewrite Q3 — the correct answer is ambiguous."
                                            rows={2}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={closeModal}
                                            className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            disabled={rejecting || approving}
                                            className="flex-1 sm:flex-none px-6 py-2.5 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50 text-sm"
                                        >
                                            {rejecting ? '⏳ Rejecting…' : '❌ Reject'}
                                        </button>
                                        <button
                                            onClick={handleApprove}
                                            disabled={approving || rejecting}
                                            className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                        >
                                            {approving
                                                ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Approving…</>
                                                : '✅ Approve & Publish'
                                            }
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-between">
                                    {selected.status === 'teacher_approved' ? (
                                        <span className="text-sm font-semibold text-emerald-600">
                                            ✅ Approved and published to the Question Pool.
                                        </span>
                                    ) : (
                                        <div>
                                            <span className="text-sm font-semibold text-red-600">❌ Rejected.</span>
                                            {selected.teacherNote && (
                                                <p className="text-xs text-slate-500 mt-0.5">Note: {selected.teacherNote}</p>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={closeModal}
                                        className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </TeacherLayout>
    )
}