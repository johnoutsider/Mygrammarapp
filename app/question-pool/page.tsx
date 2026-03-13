'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import StudentLayout from '@/components/StudentLayout'

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
    topicName?: string
    topicId?: string
    subtopic?: string
    type: 'quiz' | 'true_or_false'
    text: string
    answers: Answer[]
    timeLimit: number
    imageUrl?: string
}

type FilterType = 'all' | 'quiz' | 'true_or_false'

const GAP_THRESHOLD = 3 // subtopics with fewer questions than this are flagged as gaps

// ── Gap Map Component ──────────────────────────────────────────────────────────

function GapMap({
    questions,
    onFillGap,
}: {
    questions: PoolQuestion[]
    onFillGap: (topicId: string, subtopic: string) => void
}) {
    const counts: Record<string, { count: number; topic: string; subtopic: string; topicId: string }> = {}
    questions.forEach(q => {
        const topic = q.topicName || 'Uncategorised'
        const sub = q.subtopic || '(general)'
        const key = `${topic}|${sub}`
        if (!counts[key]) {
            counts[key] = { count: 0, topic, subtopic: sub, topicId: q.topicId || '' }
        }
        counts[key].count++
    })

    const entries = Object.entries(counts).sort((a, b) => a[1].count - b[1].count)
    if (entries.length === 0) return null

    const maxCount = Math.max(...entries.map(([, v]) => v.count), GAP_THRESHOLD * 2)

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="font-bold text-slate-800 text-base">📊 Question Bank Coverage</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Subtopics with fewer than {GAP_THRESHOLD} questions need your contribution
                    </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                        Needs questions
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                        Well covered
                    </span>
                </div>
            </div>

            <div className="space-y-2">
                {entries.map(([key, { count, topic, subtopic, topicId }]) => {
                    const isGap = count < GAP_THRESHOLD
                    const pct = Math.max(Math.round((count / maxCount) * 100), 3)
                    return (
                        <div key={key} className="flex items-center gap-3">
                            <div className="w-44 shrink-0">
                                <p className="text-[11px] font-semibold text-slate-700 truncate">{subtopic}</p>
                                <p className="text-[10px] text-slate-400 truncate">{topic}</p>
                            </div>
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-2 rounded-full transition-all duration-500 ${isGap ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className={`text-xs font-bold w-10 text-right shrink-0 ${isGap ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {count}Q
                            </span>
                            {isGap && (
                                <button
                                    onClick={() => onFillGap(topicId, subtopic)}
                                    className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md hover:bg-amber-100 transition-colors shrink-0"
                                >
                                    Fill gap ➕
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Question Card ──────────────────────────────────────────────────────────────

function QuestionCard({
    q,
    currentUserId,
}: {
    q: PoolQuestion
    currentUserId: string
}) {
    const [expanded, setExpanded] = useState(false)
    const router = useRouter()
    const isOwn = q.createdBy === currentUserId

    const handleExtend = () => {
        const params = new URLSearchParams()
        if (q.topicId) params.set('topicId', q.topicId)
        if (q.subtopic) params.set('subtopic', q.subtopic)
        router.push(`/quiz-create?${params.toString()}`)
    }

    return (
        <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isOwn ? 'border-purple-200' : 'border-slate-200'}`}>
            {/* Card body */}
            <div className="px-5 py-4">
                {/* Topic tag */}
                {(q.topicName || q.subtopic) && (
                    <div className="mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">
                            📚 {q.topicName}{q.subtopic ? ` › ${q.subtopic}` : ''}
                        </span>
                    </div>
                )}

                {/* Question text */}
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.text || '(No question text)'}</p>

                {/* Meta row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        {q.type === 'true_or_false' ? '✓/✗ True or False' : '📊 Multiple Choice'}
                    </span>
                    <span className="text-[10px] text-slate-400">⏱ {q.timeLimit}s</span>
                    {isOwn && (
                        <span className="text-[10px] bg-teal-50 text-teal-600 border border-teal-100 px-2 py-0.5 rounded-full font-semibold">
                            ✍️ Your question
                        </span>
                    )}
                </div>
            </div>

            {/* Action bar */}
            <div className="border-t border-slate-100 px-5 py-2.5 flex items-center justify-between gap-3">
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                >
                    {expanded ? '▴ Hide answers' : '▾ Show answers'}
                </button>
                <button
                    onClick={handleExtend}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-all flex items-center gap-1"
                >
                    ➕ Extend this
                </button>
            </div>

            {/* Expanded answers — correct answer intentionally hidden */}
            {expanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {q.answers.filter(a => a.text.trim()).map((a, i) => (
                        <div key={i} className="flex items-start gap-3 px-5 py-3 text-xs bg-white">
                            <span className="font-bold text-slate-400 shrink-0 mt-0.5">
                                {String.fromCharCode(65 + i)}.
                            </span>
                            <p className="flex-1 text-slate-600">{a.text}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function QuestionPoolPage() {
    const router = useRouter()
    const [poolQuestions, setPoolQuestions] = useState<PoolQuestion[]>([])
    const [loading, setLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState('')

    // Filters
    const [filterTopic, setFilterTopic] = useState('')
    const [filterSubtopic, setFilterSubtopic] = useState('')
    const [filterType, setFilterType] = useState<FilterType>('all')
    const [showOwnOnly, setShowOwnOnly] = useState(false)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            setCurrentUserId(user.uid)

            try {
                const snap = await getDocs(
                    query(collection(db, 'quizzes'), where('status', '==', 'teacher_approved'))
                )

                const flattened: PoolQuestion[] = []
                snap.docs.forEach(d => {
                    const data = d.data() as any
                    const questions = Array.isArray(data.questions) ? data.questions : []
                    questions.forEach((q: any, qi: number) => {
                        if (!q.text?.trim()) return // skip blank questions
                        flattened.push({
                            quizId: d.id,
                            quizTitle: data.title || '(Untitled)',
                            questionIndex: qi,
                            createdBy: data.createdBy || '',
                            topicName: q.topicName,
                            topicId: q.topicId,
                            subtopic: q.subtopic,
                            type: q.type || 'quiz',
                            text: q.text,
                            answers: Array.isArray(q.answers) ? q.answers : [],
                            timeLimit: q.timeLimit || 20,
                            imageUrl: q.imageUrl,
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

    // Derived filter options
    const topics = useMemo(() =>
        [...new Set(poolQuestions.map(q => q.topicName).filter(Boolean) as string[])].sort(),
        [poolQuestions]
    )

    const subtopics = useMemo(() =>
        [...new Set(
            poolQuestions
                .filter(q => !filterTopic || q.topicName === filterTopic)
                .map(q => q.subtopic)
                .filter(Boolean) as string[]
        )].sort(),
        [poolQuestions, filterTopic]
    )

    const filtered = useMemo(() => {
        return poolQuestions.filter(q => {
            if (filterTopic && q.topicName !== filterTopic) return false
            if (filterSubtopic && q.subtopic !== filterSubtopic) return false
            if (filterType !== 'all' && q.type !== filterType) return false
            if (showOwnOnly && q.createdBy !== currentUserId) return false
            return true
        })
    }, [poolQuestions, filterTopic, filterSubtopic, filterType, showOwnOnly, currentUserId])

    // Stats
    const myCount = poolQuestions.filter(q => q.createdBy === currentUserId).length

    const gapCount = useMemo(() => {
        const counts: Record<string, number> = {}
        poolQuestions.forEach(q => {
            const key = `${q.topicName}|${q.subtopic}`
            counts[key] = (counts[key] || 0) + 1
        })
        return Object.values(counts).filter(v => v < GAP_THRESHOLD).length
    }, [poolQuestions])

    const handleFillGap = (topicId: string, subtopic: string) => {
        const params = new URLSearchParams()
        if (topicId) params.set('topicId', topicId)
        if (subtopic) params.set('subtopic', subtopic)
        router.push(`/quiz-create?${params.toString()}`)
    }

    const clearFilters = () => {
        setFilterTopic('')
        setFilterSubtopic('')
        setFilterType('all')
        setShowOwnOnly(false)
    }

    const hasActiveFilters = filterTopic || filterSubtopic || filterType !== 'all' || showOwnOnly

    if (loading) {
        return (
            <StudentLayout title="Question Pool">
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="Question Pool">
            <div className="max-w-3xl mx-auto px-4 py-6">

                {/* Page header */}
                <div className="flex items-start justify-between mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Question Pool</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            All teacher-approved questions from your class — browse, learn, and extend
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/quiz-create')}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 shrink-0"
                    >
                        ➕ Contribute
                    </button>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { icon: '🧠', label: 'Total Questions', value: poolQuestions.length, color: 'text-slate-800' },
                        { icon: '✍️', label: 'My Contributions', value: myCount, color: 'text-purple-600' },
                        { icon: '⚠️', label: 'Subtopics With Gaps', value: gapCount, color: 'text-amber-600' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 px-3 py-3 flex flex-col items-center gap-1 shadow-sm text-center">
                            <span className="text-xl">{s.icon}</span>
                            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                            <span className="text-[10px] text-slate-400 font-semibold leading-tight">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Gap map */}
                {poolQuestions.length > 0 && (
                    <GapMap questions={poolQuestions} onFillGap={handleFillGap} />
                )}

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-bold text-slate-700">🔍 Filter</span>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <select
                            value={filterTopic}
                            onChange={e => { setFilterTopic(e.target.value); setFilterSubtopic('') }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            <option value="">All topics</option>
                            {topics.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select
                            value={filterSubtopic}
                            onChange={e => setFilterSubtopic(e.target.value)}
                            disabled={!filterTopic}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <option value="">All subtopics</option>
                            {subtopics.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value as FilterType)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            <option value="all">All types</option>
                            <option value="quiz">📊 Multiple Choice</option>
                            <option value="true_or_false">✓/✗ True or False</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showOwnOnly}
                            onChange={e => setShowOwnOnly(e.target.checked)}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-400"
                        />
                        <span className="text-sm text-slate-600 font-medium">Show only my questions</span>
                    </label>
                </div>

                {/* Result count */}
                <p className="text-xs text-slate-400 font-semibold mb-3">
                    Showing {filtered.length} of {poolQuestions.length} questions
                </p>

                {/* Empty states */}
                {poolQuestions.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4">🧠</div>
                        <h3 className="text-lg font-bold text-slate-700 mb-1">No Approved Questions Yet</h3>
                        <p className="text-slate-400 text-sm mb-5">
                            Questions appear here once your teacher approves them. Be the first to contribute!
                        </p>
                        <button
                            onClick={() => router.push('/quiz-create')}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl text-sm"
                        >
                            Create Your First Question
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-14">
                        <div className="text-4xl mb-3">🔍</div>
                        <p className="text-slate-500 text-sm font-semibold mb-1">No questions match your filters.</p>
                        <button onClick={clearFilters} className="text-purple-600 text-sm font-semibold hover:underline">
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(q => (
                            <QuestionCard
                                key={`${q.quizId}-${q.questionIndex}`}
                                q={q}
                                currentUserId={currentUserId}
                            />
                        ))}
                    </div>
                )}
            </div>
        </StudentLayout>
    )
}