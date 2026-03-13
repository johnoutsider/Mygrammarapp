'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import TeacherLayout from '@/components/TeacherLayout'

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

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    teacher_approved: { label: 'Approved', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    peer_approved: { label: 'Peer Approved', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
    pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
}

const GAP_THRESHOLD = 3

// ── Gap Analysis Panel ─────────────────────────────────────────────────────────

function GapAnalysis({ questions }: { questions: PoolQuestion[] }) {
    // Only count approved questions for the coverage map
    const approved = questions.filter(q => q.status === 'teacher_approved')

    const coverage: Record<string, {
        topic: string
        subtopic: string
        count: number
        contributors: Set<string>
    }> = {}

    approved.forEach(q => {
        const topic = q.topicName || 'Uncategorised'
        const sub = q.subtopic || '(general)'
        const key = `${topic}|${sub}`
        if (!coverage[key]) {
            coverage[key] = { topic, subtopic: sub, count: 0, contributors: new Set() }
        }
        coverage[key].count++
        coverage[key].contributors.add(q.createdBy)
    })

    const entries = Object.entries(coverage).sort((a, b) => a[1].count - b[1].count)
    const maxCount = Math.max(...entries.map(([, v]) => v.count), GAP_THRESHOLD * 2, 1)

    const gaps = entries.filter(([, v]) => v.count < GAP_THRESHOLD)
    const healthy = entries.filter(([, v]) => v.count >= GAP_THRESHOLD)

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="font-bold text-slate-800 text-base">📊 Coverage Map (Approved Questions)</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {gaps.length} subtopic{gaps.length !== 1 ? 's' : ''} below the {GAP_THRESHOLD}-question threshold
                    </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Needs more
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Well covered
                    </span>
                </div>
            </div>

            {entries.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No approved questions yet.</p>
            ) : (
                <div className="space-y-2.5">
                    {entries.map(([key, { topic, subtopic, count, contributors }]) => {
                        const isGap = count < GAP_THRESHOLD
                        const pct = Math.max(Math.round((count / maxCount) * 100), 3)
                        return (
                            <div key={key} className="flex items-center gap-3">
                                <div className="w-48 shrink-0">
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
                                <span className="text-[10px] text-slate-400 w-20 text-right shrink-0">
                                    {contributors.size} contributor{contributors.size !== 1 ? 's' : ''}
                                </span>
                                {isGap && (
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
                                        ⚠️ Gap
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ── Contributor Table ──────────────────────────────────────────────────────────

function ContributorTable({ questions }: { questions: PoolQuestion[] }) {
    const approved = questions.filter(q => q.status === 'teacher_approved')

    const byContributor: Record<string, { name: string; count: number; subtopics: Set<string> }> = {}
    approved.forEach(q => {
        if (!byContributor[q.createdBy]) {
            byContributor[q.createdBy] = {
                name: q.contributorName,
                count: 0,
                subtopics: new Set(),
            }
        }
        byContributor[q.createdBy].count++
        if (q.subtopic) byContributor[q.createdBy].subtopics.add(q.subtopic)
    })

    const rows = Object.entries(byContributor).sort((a, b) => b[1].count - a[1].count)

    if (rows.length === 0) return null

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-base">👥 Contributor Breakdown</h2>
                <p className="text-xs text-slate-400 mt-0.5">Approved questions per student</p>
            </div>
            <div className="divide-y divide-slate-50">
                {rows.map(([uid, { name, count, subtopics }]) => (
                    <div key={uid} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #1a9aaa 0%, #127080 100%)' }}>
                            {name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                            <p className="text-[10px] text-slate-400">
                                {subtopics.size} subtopic{subtopics.size !== 1 ? 's' : ''} covered
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-slate-800">{count}</p>
                            <p className="text-[10px] text-slate-400">questions</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Question Card ──────────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: PoolQuestion }) {
    const [expanded, setExpanded] = useState(false)
    const statusCfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.pending

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4">
                {/* Tags row */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                    {(q.topicName || q.subtopic) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">
                            📚 {q.topicName}{q.subtopic ? ` › ${q.subtopic}` : ''}
                        </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        {q.type === 'true_or_false' ? '✓/✗ T/F' : '📊 MCQ'}
                    </span>
                </div>

                {/* Question text */}
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.text}</p>

                {/* Contributor */}
                <p className="text-[11px] text-slate-400 mt-2">
                    👤 <span className="font-medium text-slate-500">{q.contributorName}</span>
                    <span className="mx-1">·</span>⏱ {q.timeLimit}s
                </p>
            </div>

            {/* Expand */}
            <div className="border-t border-slate-100 px-5 py-2.5">
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                >
                    {expanded ? '▴ Hide answers' : '▾ Show answers'}
                </button>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {q.answers.filter(a => a.text.trim()).map((a, i) => (
                        <div key={i} className={`flex items-start gap-3 px-5 py-3 text-xs ${a.isCorrect ? 'bg-green-50' : ''}`}>
                            <span className="font-bold text-slate-400 shrink-0 mt-0.5">
                                {String.fromCharCode(65 + i)}.
                            </span>
                            <div className="flex-1">
                                <p className={a.isCorrect ? 'font-semibold text-green-700' : 'text-slate-600'}>{a.text}</p>
                                {a.isCorrect && a.explanation && (
                                    <p className="text-slate-400 mt-1 italic text-[11px]">💬 {a.explanation}</p>
                                )}
                            </div>
                            {a.isCorrect && <span className="text-green-600 font-bold shrink-0">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TeacherQuestionPoolPage() {
    const router = useRouter()
    const [poolQuestions, setPoolQuestions] = useState<PoolQuestion[]>([])
    const [loading, setLoading] = useState(true)

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
                // Fetch all quizzes (teacher can see all statuses)
                const quizSnap = await getDocs(collection(db, 'quizzes'))

                // Fetch all user profiles to resolve names
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

    // Derived filter options
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

    // Stats
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
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {activeTab === 'coverage' && (
                    <GapAnalysis questions={poolQuestions} />
                )}

                {activeTab === 'contributors' && (
                    <ContributorTable questions={poolQuestions} />
                )}

                {activeTab === 'questions' && (
                    <>
                        {/* Filters */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <select
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value as StatusFilter)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                >
                                    <option value="all">All statuses</option>
                                    <option value="teacher_approved">✅ Approved</option>
                                    <option value="peer_approved">👥 Peer Approved</option>
                                    <option value="pending">⏳ Pending</option>
                                    <option value="rejected">❌ Rejected</option>
                                </select>
                                <select
                                    value={filterTopic}
                                    onChange={e => { setFilterTopic(e.target.value); setFilterSubtopic('') }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                >
                                    <option value="">All topics</option>
                                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select
                                    value={filterSubtopic}
                                    onChange={e => setFilterSubtopic(e.target.value)}
                                    disabled={!filterTopic}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-40"
                                >
                                    <option value="">All subtopics</option>
                                    {subtopics.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select
                                    value={filterType}
                                    onChange={e => setFilterType(e.target.value as 'all' | 'quiz' | 'true_or_false')}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                >
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
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </TeacherLayout>
    )
}