'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, deleteDoc, limit } from 'firebase/firestore'
import StudentLayout from '@/components/StudentLayout'

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
    subtopic?: string
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

const STATUS_MAP = {
    pending: { label: '⏳ Awaiting Review', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
    peer_approved: { label: '👥 Peer Approved', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
    teacher_approved: { label: '✅ Teacher Approved', cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
    rejected: { label: '❌ Rejected', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-400' },
}

const Q_STATUS_MAP = {
    pending: { icon: '⏳', cls: 'bg-amber-100 text-amber-700' },
    peer_approved: { icon: '👥', cls: 'bg-blue-100 text-blue-700' },
    teacher_approved: { icon: '✅', cls: 'bg-green-100 text-green-700' },
    rejected: { icon: '❌', cls: 'bg-red-100 text-red-700' },
}

function StatusBadge({ status }: { status: QuizDoc['status'] }) {
    const s = STATUS_MAP[status] ?? STATUS_MAP.pending
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${s.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    )
}

function QuizCard({ quiz, onDelete }: { quiz: QuizDoc; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false)
    const router = useRouter()

    const dateStr = quiz.createdAt?.toDate
        ? quiz.createdAt.toDate().toLocaleDateString()
        : quiz.createdAt?.seconds
            ? new Date(quiz.createdAt.seconds * 1000).toLocaleDateString()
            : '—'

    const questions = Array.isArray(quiz.questions) ? quiz.questions : []

    // Rejected quizzes CAN be edited so student can fix and resubmit
    const canEdit = !quiz.status || quiz.status === 'pending' || quiz.status === 'rejected'
    const canDelete = canEdit || quiz.status === 'peer_approved'
    const isLocked = quiz.status === 'teacher_approved'

    const qStatus = Q_STATUS_MAP[quiz.status] ?? Q_STATUS_MAP.pending

    return (
        <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${quiz.status === 'rejected' ? 'border-red-200' :
                quiz.status === 'teacher_approved' ? 'border-green-200' :
                    quiz.status === 'peer_approved' ? 'border-blue-200' : 'border-slate-200'
            }`}>
            {/* Card Header */}
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate text-base">
                        {quiz.title || '(Untitled Quiz)'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        📅 {dateStr} · {questions.length} question{questions.length !== 1 ? 's' : ''}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={quiz.status} />

                    {canEdit && (
                        <button
                            onClick={() => router.push(`/quiz-create?edit=${quiz.id}`)}
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 transition-all"
                        >
                            ✏️ {quiz.status === 'rejected' ? 'Fix & Resubmit' : 'Edit'}
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => onDelete(quiz.id)}
                            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 transition-all"
                        >
                            🗑️ Delete
                        </button>
                    )}
                    {isLocked && (
                        <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg font-semibold">
                            🔒 Locked
                        </span>
                    )}
                </div>
            </div>

            {/* Peer vote counts */}
            {(quiz.approvedByPeers !== undefined || quiz.rejectedByPeers !== undefined) && (
                <div className="px-5 pb-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="text-green-500">👍</span>
                        {quiz.approvedByPeers ?? 0} peers approved
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-red-400">👎</span>
                        {quiz.rejectedByPeers ?? 0} peers rejected
                    </span>
                </div>
            )}

            {/* Teacher note */}
            {quiz.teacherNote && (
                <div className="mx-5 mb-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-xs text-orange-700">
                    <span className="font-bold">💬 Teacher note:</span> {quiz.teacherNote}
                    {quiz.status === 'rejected' && (
                        <span className="ml-2 font-semibold text-orange-800">→ Please fix and resubmit.</span>
                    )}
                </div>
            )}

            {/* Expandable questions list */}
            {questions.length > 0 && (
                <div className="border-t border-slate-100">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full px-5 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 flex items-center justify-between transition-colors"
                    >
                        <span>📋 View Questions ({questions.length})</span>
                        <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▾</span>
                    </button>

                    {expanded && (
                        <div className="divide-y divide-slate-100">
                            {questions.map((q, qi) => {
                                const answers = Array.isArray(q.answers) ? q.answers : []
                                const correct = answers.find(a => a.isCorrect)
                                const hasCorrect = !!correct

                                return (
                                    <div key={qi} className="px-5 py-3">
                                        {/* Question row header */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <p className="text-sm font-semibold text-slate-700 flex-1">
                                                <span className="text-slate-400 mr-1">Q{qi + 1}.</span>
                                                {q.text || '(No question text)'}
                                            </p>
                                            {/* Per-question review status badge */}
                                            <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${qStatus.cls}`}>
                                                {qStatus.icon}
                                                {STATUS_MAP[quiz.status]?.label.replace(/^[^ ]+ /, '') ?? 'Pending'}
                                            </span>
                                        </div>

                                        {/* Topic tag */}
                                        {q.topicName && (
                                            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full font-semibold mb-2 inline-block">
                                                📚 {q.topicName}{q.subtopic ? ` › ${q.subtopic}` : ''}
                                            </span>
                                        )}

                                        {/* Answers */}
                                        <div className="space-y-1 mt-1">
                                            {answers.filter(a => a.text).map((a, ai) => (
                                                <div
                                                    key={ai}
                                                    className={`flex items-start gap-2 text-xs px-3 py-1.5 rounded-lg ${a.isCorrect
                                                            ? 'bg-green-50 border border-green-200 text-green-800 font-semibold'
                                                            : 'bg-slate-50 text-slate-600'
                                                        }`}
                                                >
                                                    <span className="shrink-0 font-bold">
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
                                        {correct?.explanation && (
                                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                                                💬 {correct.explanation}
                                            </div>
                                        )}

                                        {/* Warning if no correct answer marked */}
                                        {!hasCorrect && (
                                            <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-1.5 border border-yellow-100">
                                                ⚠️ No correct answer marked
                                            </div>
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
                <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col items-center gap-1 shadow-sm">
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-2xl font-bold text-slate-800">{s.value}</span>
                    <span className="text-[10px] text-slate-400 font-semibold text-center">{s.label}</span>
                </div>
            ))}
        </div>
    )
}

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
                    query(collection(db, 'quizzes'), where('createdBy', '==', auth.currentUser!.uid), limit(200))
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

    const FILTER_TABS: Array<{ key: 'all' | QuizDoc['status']; label: string }> = [
        { key: 'all', label: 'All' },
        { key: 'pending', label: '⏳ Pending' },
        { key: 'peer_approved', label: '👥 Peer Approved' },
        { key: 'teacher_approved', label: '✅ Approved' },
        { key: 'rejected', label: '❌ Rejected' },
    ]

    if (loading) {
        return (
            <StudentLayout title="My Questions">
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="My Questions">
            {/* Delete Confirm Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
                        <div className="text-4xl mb-3">🗑️</div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1">Delete Quiz?</h3>
                        <p className="text-slate-500 text-sm mb-5">This cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(confirmDeleteId)}
                                disabled={deleting}
                                className="flex-1 bg-red-500 text-white font-semibold py-2.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {deleting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Deleting…</> : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-3xl mx-auto px-4 py-6">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">My Questions</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Track submitted quizzes and review status</p>
                    </div>
                    <button
                        onClick={() => router.push('/quiz-create')}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
                    >
                        + New Quiz
                    </button>
                </div>

                {/* Summary Stats */}
                {quizzes.length > 0 && <SummaryBar quizzes={quizzes} />}

                {/* Filter Tabs */}
                {quizzes.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-5">
                        {FILTER_TABS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filter === f.key
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                                    }`}
                            >
                                {f.label}
                                {f.key !== 'all' && (
                                    <span className="ml-1 opacity-70">
                                        ({quizzes.filter(q => q.status === f.key).length})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Quiz List / Empty State */}
                {quizzes.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🧠</div>
                        <h3 className="text-lg font-bold text-slate-700 mb-1">No Quizzes Yet</h3>
                        <p className="text-slate-400 text-sm mb-5">Create your first quiz to get started.</p>
                        <button
                            onClick={() => router.push('/quiz-create')}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all"
                        >
                            Create Your First Quiz
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-3xl mb-3">🔍</div>
                        <p className="text-slate-400 text-sm">No quizzes with this status yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(quiz => (
                            <QuizCard key={quiz.id} quiz={quiz} onDelete={setConfirmDeleteId} />
                        ))}
                    </div>
                )}
            </div>
        </StudentLayout>
    )
}
