'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import TeacherLayout from '@/components/TeacherLayout'

type Tab = 'leaderboard' | 'questions' | 'breakdown'
type SortKey = 'name' | 'accuracy' | number

// ── Sortable Breakdown Table ──────────────────────────────────────────────────
function BreakdownTable({ players, questions, answers }: {
    players: any[]
    questions: any[]
    answers: any
}) {
    const [sortKey, setSortKey] = useState<SortKey>('accuracy')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    const toggle = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('desc') }
    }

    const getAccuracy = (p: any) => {
        const ans = answers?.[p.uid] || {}
        const correct = Object.values(ans).filter((x: any) => x.correct).length
        return questions.length ? correct / questions.length : 0
    }

    const sorted = [...players].sort((a, b) => {
        let av: any, bv: any
        if (sortKey === 'name') {
            av = a.name.toLowerCase(); bv = b.name.toLowerCase()
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        }
        if (sortKey === 'accuracy') {
            av = getAccuracy(a); bv = getAccuracy(b)
        } else {
            av = answers?.[a.uid]?.[sortKey]?.correct ? 1 : 0
            bv = answers?.[b.uid]?.[sortKey]?.correct ? 1 : 0
        }
        return sortDir === 'asc' ? av - bv : bv - av
    })

    const Arrow = ({ sk }: { sk: SortKey }) => {
        if (sortKey !== sk) return <span className="ml-1 text-slate-300">↕</span>
        return <span className="ml-1 text-violet-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
    }

    const Th = ({ label, sk, align = 'center' }: { label: string; sk: SortKey; align?: string }) => (
        <th
            onClick={() => toggle(sk)}
            className={`px-3 py-3 font-semibold text-slate-500 text-${align} cursor-pointer
                hover:text-violet-600 select-none whitespace-nowrap transition-colors`}
        >
            {label}<Arrow sk={sk} />
        </th>
    )

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100">
                        <Th label="Student" sk="name" align="left" />
                        <Th label="Accuracy" sk="accuracy" />
                        {questions.map((_: any, qi: number) => (
                            <Th key={qi} label={`Q${qi + 1}`} sk={qi} />
                        ))}
                        <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((p: any) => {
                        const studentAnswers = answers?.[p.uid] || {}
                        const correctCount = Object.values(studentAnswers).filter((a: any) => a.correct).length
                        const pct = questions.length
                            ? Math.round((correctCount / questions.length) * 100)
                            : 0
                        return (
                            <tr key={p.uid} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                                    {p.name}
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full
                                        ${pct >= 70 ? 'bg-green-100 text-green-700' :
                                            pct >= 40 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-600'}`}>
                                        {pct}%
                                    </span>
                                </td>
                                {questions.map((_: any, qi: number) => {
                                    const ans = studentAnswers[qi]
                                    return (
                                        <td key={qi} className="px-3 py-3 text-center">
                                            {ans ? (
                                                <span className={`inline-flex items-center justify-center w-7 h-7
                                                    rounded-full text-xs font-bold
                                                    ${ans.correct
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-600'}`}>
                                                    {ans.correct ? '✓' : '✗'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center justify-center w-7 h-7
                                                    rounded-full bg-slate-100 text-slate-400 text-xs">
                                                    –
                                                </span>
                                            )}
                                        </td>
                                    )
                                })}
                                <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                                    {p.score} pts
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ── Main Report Detail Page ───────────────────────────────────────────────────
export default function ReportDetailPage() {
    const router = useRouter()
    const { sessionId } = useParams()
    const [report, setReport] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<Tab>('leaderboard')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(user.uid)
            if (profile?.role !== 'teacher') { router.push('/dashboard'); return }

            const snap = await getDoc(doc(db, 'gameReports', sessionId as string))
            if (!snap.exists()) { router.push('/teacher/game/reports'); return }
            setReport(snap.data())
            setLoading(false)
        })
        return unsub
    }, [router, sessionId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
            </div>
        )
    }

    const players = Object.entries(report.players || {})
        .map(([uid, p]: any) => ({ uid, ...p }))
        .sort((a, b) => a.rank - b.rank)

    const formatDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })

    return (
        <TeacherLayout title="Report Detail">
            <div className="max-w-4xl mx-auto px-4 py-8">

                {/* Header */}
                <div className="mb-2">
                    <button
                        onClick={() => router.push('/teacher/game/reports')}
                        className="text-sm text-slate-400 hover:text-violet-600 transition-colors mb-3 flex items-center gap-1"
                    >
                        ← All Reports
                    </button>
                    <h1 className="text-3xl font-extrabold text-slate-900">{report.quizTitle}</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {formatDate(report.playedAt)} · {players.length} players · {report.totalQuestions} questions
                    </p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4 my-6">
                    {[
                        {
                            label: 'Players',
                            value: players.length,
                            color: 'text-slate-800'
                        },
                        {
                            label: 'Avg Score',
                            value: Math.round(
                                players.reduce((s, p: any) => s + p.score, 0) / (players.length || 1)
                            ),
                            color: 'text-violet-600'
                        },
                        {
                            label: 'Top Score',
                            value: players[0]?.score || 0,
                            color: 'text-yellow-500'
                        }
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl border border-slate-200 px-5 py-4 text-center">
                            <p className={`text-3xl font-extrabold ${card.color}`}>{card.value}</p>
                            <p className="text-xs text-slate-400 mt-1">{card.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-200">
                    {(['leaderboard', 'questions', 'breakdown'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px
                                ${activeTab === tab
                                    ? 'border-violet-600 text-violet-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                        >
                            {tab === 'leaderboard' ? '🏆 Leaderboard'
                                : tab === 'questions' ? '❓ Per Question'
                                    : '📋 Full Breakdown'}
                        </button>
                    ))}
                </div>

                {/* ── LEADERBOARD TAB ── */}
                {activeTab === 'leaderboard' && (
                    <div className="space-y-2">
                        {players.map((p: any, i) => (
                            <div key={p.uid}
                                className={`flex items-center justify-between px-6 py-4 rounded-2xl font-bold
                                    ${i === 0 ? 'bg-yellow-400 text-yellow-900 scale-[1.01] shadow-md' :
                                        i === 1 ? 'bg-slate-200 text-slate-800' :
                                            i === 2 ? 'bg-amber-600 text-white'
                                                : 'bg-white border border-slate-200 text-slate-800'}`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-xl w-8">
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                                    </span>
                                    <span>{p.name}</span>
                                </div>
                                <span className="text-lg">{p.score} pts</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── PER QUESTION TAB ── */}
                {activeTab === 'questions' && (
                    <div className="space-y-4">
                        {report.questions.map((q: any, qi: number) => {
                            const allAnswers = Object.values(report.answers || {}) as any[]
                            const qAnswers = allAnswers.map(a => a[qi]).filter(Boolean)
                            const correctCount = qAnswers.filter((a: any) => a.correct).length
                            const totalAnswered = qAnswers.length
                            const pct = totalAnswered
                                ? Math.round((correctCount / totalAnswered) * 100)
                                : 0

                            return (
                                <div key={qi} className="bg-white rounded-2xl border border-slate-200 px-6 py-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">
                                                Q{qi + 1}
                                            </span>
                                            <p className="font-semibold text-slate-800 mt-0.5">{q.text}</p>
                                        </div>
                                        <div className={`ml-4 text-2xl font-extrabold
                                            ${pct >= 70 ? 'text-green-500'
                                                : pct >= 40 ? 'text-yellow-500'
                                                    : 'text-red-500'}`}>
                                            {pct}%
                                        </div>
                                    </div>

                                    {/* Accuracy bar */}
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                                        <div
                                            className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-400'
                                                    : pct >= 40 ? 'bg-yellow-400'
                                                        : 'bg-red-400'
                                                }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>

                                    <p className="text-xs text-slate-400">
                                        {correctCount} of {totalAnswered} students answered correctly
                                    </p>

                                    {/* Answer breakdown */}
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {q.answers.map((ans: any) => {
                                            const chosenCount = qAnswers.filter(
                                                (a: any) => a.answerId === ans.id
                                            ).length
                                            const chosenPct = totalAnswered
                                                ? Math.round((chosenCount / totalAnswered) * 100)
                                                : 0
                                            return (
                                                <div key={ans.id}
                                                    className={`rounded-xl px-3 py-2 text-sm flex items-center justify-between
                                                        ${ans.isCorrect
                                                            ? 'bg-green-50 border border-green-200'
                                                            : 'bg-slate-50 border border-slate-200'}`}>
                                                    <span className={`font-medium ${ans.isCorrect ? 'text-green-700' : 'text-slate-600'}`}>
                                                        {ans.isCorrect ? '✓ ' : ''}{ans.text}
                                                    </span>
                                                    <span className={`font-bold text-xs ml-2 ${ans.isCorrect ? 'text-green-600' : 'text-slate-400'}`}>
                                                        {chosenPct}%
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ── FULL BREAKDOWN TAB ── */}
                {activeTab === 'breakdown' && (
                    <BreakdownTable
                        players={players}
                        questions={report.questions}
                        answers={report.answers}
                    />
                )}

            </div>
        </TeacherLayout>
    )
}