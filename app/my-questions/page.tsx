'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, deleteDoc, limit } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'

// ── Matches the exact structure saved by submitQuizForReview ──────────────
interface Answer {
    id: number
    text: string
    isCorrect: boolean
    explanation: string
}

interface QuizQuestion {
    id: number
    type: 'quiz' | 'true_or_false'
    text: string
    timeLimit: number
    answers: Answer[]
    topicName?: string
}

interface QuizDoc {
    id: string
    title: string
    questions: QuizQuestion[]
    createdBy: string
    status: 'pending' | 'peer_approved' | 'teacher_approved' | 'rejected'
    approvedByPeers?: number
    rejectedByPeers?: number
    teacherNote?: string
    createdAt: any
}

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: QuizDoc['status'] }) {
    const map = {
        pending: { label: '⏳ Awaiting Review', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        peer_approved: { label: '👥 Peer Approved', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
        teacher_approved: { label: '✅ Teacher Approved', cls: 'bg-green-50 text-green-700 border-green-200' },
        rejected: { label: '❌ Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
    }
    const { label, cls } = map[status] ?? map.pending
    return (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cls}`}>
            {label}
        </span>
    )
}


// ── Single Quiz Card ──────────────────────────────────────────────────────
function QuizCard({ quiz, onDelete }: { quiz: QuizDoc; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false)
    const router = useRouter()

    const dateStr = quiz.createdAt?.toDate
        ? quiz.createdAt.toDate().toLocaleDateString()
        : quiz.createdAt?.seconds
            ? new Date(quiz.createdAt.seconds * 1000).toLocaleDateString()
            : '—'

    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    const canEdit = !quiz.status || quiz.status === 'pending'
    const canDelete = canEdit || quiz.status === 'rejected'


    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 leading-snug">
                        {quiz.title || '(Untitled Quiz)'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        📅 {dateStr} · {questions.length} question{questions.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={quiz.status} />

                    {/* ✅ Edit + Delete — only shown when pending */}
                    {(canEdit || canDelete) && (
                        <div className="flex items-center gap-2 mt-1">
                            {canEdit && (
                                <button
                                    onClick={() => router.push(`/quiz-create?edit=${quiz.id}`)}
                                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-all"
                                >
                                    ✏️ Edit
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => onDelete(quiz.id)}
                                    className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition-all"
                                >
                                    🗑️ Delete
                                </button>
                            )}
                        </div>
                    )}

                    {!canDelete && (
                        <span className="text-[10px] text-slate-400 italic mt-1">
                            Teacher approved — cannot delete
                        </span>
                    )}


                    {/* ✅ Read-only label once approved/rejected */}
                    {!canEdit && (
                        <span className="text-[10px] text-slate-400 italic mt-1">
                            {quiz.status === 'rejected' ? 'Cannot edit rejected quiz' : 'Under review — editing locked'}
                        </span>
                    )}
                </div>
            </div>

            {/* Peer vote counts */}
            {(quiz.approvedByPeers !== undefined || quiz.rejectedByPeers !== undefined) && (
                <div className="px-5 pb-3 flex items-center gap-5 text-xs">
                    <span className="text-green-600 font-bold">👍 {quiz.approvedByPeers ?? 0} peers approved</span>
                    <span className="text-red-500 font-bold">👎 {quiz.rejectedByPeers ?? 0} peers rejected</span>
                </div>
            )}

            {/* Teacher note */}
            {quiz.teacherNote && (
                <div className="mx-5 mb-4 px-4 py-3 bg-amber-50 border-l-4 border-amber-400 rounded-lg text-sm text-amber-800">
                    <span className="font-bold">Teacher note: </span>{quiz.teacherNote}
                </div>
            )}

            {/* Expandable questions list */}
            {questions.length > 0 && (
                <div className="border-t border-slate-100">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full px-5 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 flex items-center justify-between transition-colors"
                    >
                        <span>View Questions ({questions.length})</span>
                        <span className={`transition-transform inline-block ${expanded ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {expanded && (
                        <div className="px-5 pb-4 flex flex-col gap-3">
                            {questions.map((q, qi) => {
                                const answers = Array.isArray(q.answers) ? q.answers : []
                                const correctAnswer = answers.find(a => a.isCorrect)
                                return (
                                    <div key={qi} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                        <p className="text-sm font-semibold text-slate-800 mb-2">
                                            {qi + 1}. {q.text || '(No question text)'}
                                        </p>
                                        <div className="grid gap-1.5">
                                            {answers.filter(a => a.text).map((a, ai) => (
                                                <div
                                                    key={ai}
                                                    className={`px-3 py-1.5 rounded-md text-xs border ${a.isCorrect
                                                        ? 'bg-green-50 border-green-300 text-green-800 font-bold'
                                                        : 'bg-white border-slate-200 text-slate-600'
                                                        }`}
                                                >
                                                    {String.fromCharCode(65 + ai)}. {a.text}
                                                    {a.isCorrect && <span className="ml-2 text-green-600">✓ Correct</span>}
                                                </div>
                                            ))}
                                        </div>
                                        {correctAnswer?.explanation && (
                                            <p className="mt-2 text-xs text-slate-500 italic">💬 {correctAnswer.explanation}</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Summary Stats Bar ─────────────────────────────────────────────────────
function SummaryBar({ quizzes }: { quizzes: QuizDoc[] }) {
    const stats = [
        { icon: '📝', label: 'Total', value: quizzes.length },
        { icon: '⏳', label: 'Pending', value: quizzes.filter(q => q.status === 'pending').length },
        { icon: '👥', label: 'Peer Approved', value: quizzes.filter(q => q.status === 'peer_approved').length },
        { icon: '✅', label: 'Teacher Approved', value: quizzes.filter(q => q.status === 'teacher_approved').length },
        { icon: '❌', label: 'Rejected', value: quizzes.filter(q => q.status === 'rejected').length },
    ]
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {stats.map((s, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
                    <p className="text-xl mb-1">{s.icon}</p>
                    <p className="text-xl font-extrabold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
            ))}
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function MyQuestionsPage() {
    const router = useRouter()
    const [quizzes, setQuizzes] = useState<QuizDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | QuizDoc['status']>('all')
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        const load = async () => {
            if (!auth.currentUser) { router.push('/'); return }
            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'quizzes'),
                        where('createdBy', '==', auth.currentUser!.uid),
                        limit(200)
                    )
                )
                const raw = snap.docs.map(d => ({ id: d.id, ...d.data() as any })) as QuizDoc[]
                raw.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
                setQuizzes(raw)
            } catch (err) {
                console.error('Error loading quizzes:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [router])

    const handleDelete = async (id: string) => {
        setDeleting(true)
        try {
            await deleteDoc(doc(db, 'quizzes', id))
            setQuizzes(prev => prev.filter(q => q.id !== id))
        } finally {
            setDeleting(false)
            setConfirmDeleteId(null)
        }
    }

    const filtered = filter === 'all' ? quizzes : quizzes.filter(q => q.status === filter)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        )
    }

    return (
        <StudentLayout title="My Questions">
            {/* Delete Confirm Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
                        <p className="text-5xl mb-4">🗑️</p>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Quiz?</h2>
                        <p className="text-slate-500 text-sm mb-6">This cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-lg hover:bg-slate-200 transition-colors"
                            >Cancel</button>
                            <button
                                onClick={() => handleDelete(confirmDeleteId)}
                                disabled={deleting}
                                className="flex-1 bg-red-500 text-white font-semibold py-2.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {deleting
                                    ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Deleting…</>
                                    : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="max-w-3xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 mb-1">My Questions</h1>
                        <p className="text-sm text-slate-500">
                            Track your submitted quizzes and see peer & teacher approval status.
                        </p>
                    </div>
                    <Link
                        href="/quiz-create"
                        className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:from-blue-600 hover:to-purple-700 transition-all shrink-0"
                    >
                        + New Quiz
                    </Link>
                </div>

                {/* Summary Stats */}
                {quizzes.length > 0 && <SummaryBar quizzes={quizzes} />}

                {/* Filter Tabs */}
                {quizzes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-5">
                        {(['all', 'pending', 'peer_approved', 'teacher_approved', 'rejected'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filter === f
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                    }`}
                            >
                                {f === 'all' ? 'All'
                                    : f === 'peer_approved' ? 'Peer Approved'
                                        : f === 'teacher_approved' ? 'Teacher Approved'
                                            : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                )}

                {/* Quiz List / Empty State */}
                {quizzes.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                        <p className="text-5xl mb-4">🧠</p>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No Quizzes Yet</h3>
                        <p className="text-slate-500 mb-6 text-sm">
                            Create your first quiz to get started.
                        </p>
                        <Link
                            href="/quiz-create"
                            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                            Create Your First Quiz
                        </Link>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="text-3xl mb-3">🔍</p>
                        <p className="text-sm">No quizzes with this status yet.</p>
                    </div>
                ) : (
                    filtered.map(quiz => (
                        <QuizCard key={quiz.id} quiz={quiz} onDelete={setConfirmDeleteId} />
                    ))
                )}
            </main>
        </StudentLayout>
    )
}
