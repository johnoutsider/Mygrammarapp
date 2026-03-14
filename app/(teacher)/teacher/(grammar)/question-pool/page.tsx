'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import TeacherLayout from '@/components/TeacherLayout'

import GapAnalysis from '@/components/teacher/question-pool/GapAnalysis'
import ContributorTable from '@/components/teacher/question-pool/ContributorTable'
import QuestionCard from '@/components/teacher/question-pool/QuestionCard'
import EditModal from '@/components/teacher/question-pool/EditModal'
import DeleteModal from '@/components/teacher/question-pool/DeleteModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Answer {
    id: number
    text: string
    isCorrect: boolean
    explanation: string
}

interface PoolQuestion {
    quizId: string
    quizTitle: string
    questionIndex: number
    createdBy: string
    contributorName: string
    topicName?: string
    topicId?: string
    subtopic?: string
    type: 'quiz' | 'true_or_false'
    text: string
    answers: Answer[]
    timeLimit: number
    status: string
}

type StatusFilter = 'all' | 'teacher_approved' | 'pending' | 'peer_approved' | 'rejected'

const GAP_THRESHOLD = 3

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TeacherQuestionPoolPage() {
    const router = useRouter()
    const [poolQuestions, setPoolQuestions] = useState<PoolQuestion[]>([])
    const [loading, setLoading] = useState(true)

    // Modals
    const [editTarget, setEditTarget] = useState<PoolQuestion | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<PoolQuestion | null>(null)

    // Filters
    const [filterTopic, setFilterTopic] = useState('')
    const [filterSubtopic, setFilterSubtopic] = useState('')
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('teacher_approved')
    const [filterType, setFilterType] = useState<'all' | 'quiz' | 'true_or_false'>('all')
    const [activeTab, setActiveTab] = useState<'questions' | 'coverage' | 'contributors'>('coverage')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            try {
                const quizSnap = await getDocs(collection(db, 'quizzes'))
                const userSnap = await getDocs(collection(db, 'users'))
                const userMap: Record<string, string> = {}
                userSnap.docs.forEach(d => {
                    const data = d.data() as any
                    userMap[d.id] = data.displayName || data.name || 'Unknown Student'
                })
                const flattened: PoolQuestion[] = []
                quizSnap.docs.forEach(d => {
                    const data = d.data() as any
                    const questions = Array.isArray(data.questions) ? data.questions : []
                    questions.forEach((q: any, qi: number) => {
                        if (!q.text?.trim()) return
                        flattened.push({
                            quizId: d.id,
                            quizTitle: data.title || '(Untitled)',
                            questionIndex: qi,
                            createdBy: data.createdBy || '',
                            contributorName: userMap[data.createdBy] || 'Unknown',
                            topicName: q.topicName,
                            topicId: q.topicId,
                            subtopic: q.subtopic,
                            type: q.type || 'quiz',
                            text: q.text,
                            answers: Array.isArray(q.answers) ? q.answers : [],
                            timeLimit: q.timeLimit || 20,
                            status: data.status || 'pending',
                        })
                    })
                })
                setPoolQuestions(flattened)
            } catch (err) {
                console.error('Error loading question pool:', err)
            } finally {
                setLoading(false)
            }
        })
        return () => unsub()
    }, [router])

    // ── Save edit ──────────────────────────────────────────────────────────────
    const handleSaveEdit = async (
        quizId: string,
        questionIndex: number,
        updated: { text: string; timeLimit: number; answers: Answer[] }
    ) => {
        const quizRef = doc(db, 'quizzes', quizId)
        const quizSnap = await getDoc(quizRef)
        if (!quizSnap.exists()) throw new Error('Quiz not found')
        const data = quizSnap.data() as any
        const questions = [...(data.questions || [])]
        questions[questionIndex] = { ...questions[questionIndex], ...updated }
        await updateDoc(quizRef, { questions })
        setPoolQuestions(prev => prev.map(q =>
            q.quizId === quizId && q.questionIndex === questionIndex
                ? { ...q, ...updated }
                : q
        ))
    }

    // ── Confirm delete ─────────────────────────────────────────────────────────
    const handleConfirmDelete = async (quizId: string, questionIndex: number) => {
        const quizRef = doc(db, 'quizzes', quizId)
        const quizSnap = await getDoc(quizRef)
        if (!quizSnap.exists()) throw new Error('Quiz not found')
        const data = quizSnap.data() as any
        const questions = [...(data.questions || [])]
        questions.splice(questionIndex, 1)
        await updateDoc(quizRef, { questions })
        setPoolQuestions(prev => {
            const remaining = prev.filter(
                q => !(q.quizId === quizId && q.questionIndex === questionIndex)
            )
            return remaining.map(q =>
                q.quizId === quizId && q.questionIndex > questionIndex
                    ? { ...q, questionIndex: q.questionIndex - 1 }
                    : q
            )
        })
    }

    // ── Derived filter options ─────────────────────────────────────────────────
    const topics = useMemo(() =>
        [...new Set(poolQuestions.map(q => q.topicName).filter(Boolean) as string[])].sort(),
        [poolQuestions]
    )
    const subtopics = useMemo(() =>
        [...new Set(
            poolQuestions
                .filter(q => !filterTopic || q.topicName === filterTopic)
                .map(q => q.subtopic).filter(Boolean) as string[]
        )].sort(),
        [poolQuestions, filterTopic]
    )
    const filtered = useMemo(() => {
        return poolQuestions.filter(q => {
            if (filterStatus !== 'all' && q.status !== filterStatus) return false
            if (filterTopic && q.topicName !== filterTopic) return false
            if (filterSubtopic && q.subtopic !== filterSubtopic) return false
            if (filterType !== 'all' && q.type !== filterType) return false
            return true
        })
    }, [poolQuestions, filterStatus, filterTopic, filterSubtopic, filterType])

    // ── Stats ──────────────────────────────────────────────────────────────────
    const approvedCount = poolQuestions.filter(q => q.status === 'teacher_approved').length
    const pendingCount = poolQuestions.filter(q => q.status === 'pending').length
    const gapCount = useMemo(() => {
        const counts: Record<string, number> = {}
        poolQuestions.filter(q => q.status === 'teacher_approved').forEach(q => {
            const key = `${q.topicName}|${q.subtopic}`
            counts[key] = (counts[key] || 0) + 1
        })
        return Object.values(counts).filter(v => v < GAP_THRESHOLD).length
    }, [poolQuestions])
    const uniqueContributors = new Set(
        poolQuestions.filter(q => q.status === 'teacher_approved').map(q => q.createdBy)
    ).size

    if (loading) {
        return (
            <TeacherLayout title="Question Pool">
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
                </div>
            </TeacherLayout>
        )
    }

    return (
        <TeacherLayout title="Question Pool">
            <div className="max-w-4xl mx-auto px-4 py-6">

                {/* Page header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Question Pool</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Full view of all student-submitted questions across all statuses
                    </p>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                        { icon: '✅', label: 'Approved', value: approvedCount, color: 'text-emerald-600' },
                        { icon: '⏳', label: 'Pending Review', value: pendingCount, color: 'text-amber-600' },
                        { icon: '⚠️', label: 'Subtopic Gaps', value: gapCount, color: 'text-red-500' },
                        { icon: '👥', label: 'Contributors', value: uniqueContributors, color: 'text-blue-600' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col items-center gap-1 shadow-sm text-center">
                            <span className="text-xl">{s.icon}</span>
                            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                            <span className="text-[10px] text-slate-400 font-semibold leading-tight">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Tab navigation */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
                    {([
                        { key: 'coverage', label: '📊 Coverage Map' },
                        { key: 'contributors', label: '👥 Contributors' },
                        { key: 'questions', label: '🧠 All Questions' },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === tab.key
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {activeTab === 'coverage' && <GapAnalysis questions={poolQuestions} />}
                {activeTab === 'contributors' && <ContributorTable questions={poolQuestions} />}
                {activeTab === 'questions' && (
                    <>
                        {/* Filters */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
                                    <option value="all">All statuses</option>
                                    <option value="teacher_approved">✅ Approved</option>
                                    <option value="peer_approved">👥 Peer Approved</option>
                                    <option value="pending">⏳ Pending</option>
                                    <option value="rejected">❌ Rejected</option>
                                </select>
                                <select value={filterTopic} onChange={e => { setFilterTopic(e.target.value); setFilterSubtopic('') }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
                                    <option value="">All topics</option>
                                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={filterSubtopic} onChange={e => setFilterSubtopic(e.target.value)}
                                    disabled={!filterTopic}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-40">
                                    <option value="">All subtopics</option>
                                    {subtopics.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select value={filterType} onChange={e => setFilterType(e.target.value as 'all' | 'quiz' | 'true_or_false')}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
                                    <option value="all">All types</option>
                                    <option value="quiz">📊 MCQ</option>
                                    <option value="true_or_false">✓/✗ T/F</option>
                                </select>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 font-semibold mb-3">
                            {filtered.length} question{filtered.length !== 1 ? 's' : ''}
                        </p>

                        {filtered.length === 0 ? (
                            <div className="text-center py-14">
                                <div className="text-4xl mb-3">🔍</div>
                                <p className="text-slate-400 text-sm">No questions match these filters.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filtered.map(q => (
                                    <QuestionCard
                                        key={`${q.quizId}-${q.questionIndex}`}
                                        q={q}
                                        onEdit={(q) => setEditTarget(q)}
                                        onDelete={(q) => setDeleteTarget(q)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {editTarget && (
                <EditModal
                    q={editTarget}
                    onClose={() => setEditTarget(null)}
                    onSave={handleSaveEdit}
                />
            )}
            {deleteTarget && (
                <DeleteModal
                    q={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </TeacherLayout>
    )
}
