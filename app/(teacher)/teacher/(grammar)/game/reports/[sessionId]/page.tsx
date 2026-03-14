'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import TeacherLayout from '@/components/TeacherLayout'

type Tab = 'summary' | 'participants' | 'questions'

type PlayerRow = {
    uid: string
    name: string
    score: number
    rank: number
}

// ---------- Small reusable charts ----------

function MiniDonut({ pct, size = 40 }: { pct: number; size?: number }) {
    const r = size / 2 - 4
    const circ = 2 * Math.PI * r
    const dash = (pct / 100) * circ
    const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
        </svg>
    )
}

function BigDonut({ pct }: { pct: number }) {
    const r = 54
    const circ = 2 * Math.PI * r
    const dash = (pct / 100) * circ
    const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'

    return (
        <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
            <circle
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
            />
            <text
                x="70"
                y="65"
                textAnchor="middle"
                fill="#111827"
                style={{ fontSize: '22px', fontWeight: 700 }}
            >
                {pct}%
            </text>
            <text
                x="70"
                y="83"
                textAnchor="middle"
                fill="#6b7280"
                style={{ fontSize: '12px' }}
            >
                correct
            </text>
        </svg>
    )
}

// ---------- Main page ----------

export default function TeacherGameReportPage() {
    const router = useRouter()
    const { sessionId } = useParams()
    const [report, setReport] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)

    const [activeTab, setActiveTab] = useState<Tab>('summary')
    const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
    const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null)
    const [participantFilter, setParticipantFilter] = useState<'all' | 'needhelp'>('all')
    const [questionFilter, setQuestionFilter] = useState<'all' | 'difficult'>('all')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/')
                return
            }

            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(user.uid)
            if (profile?.role !== 'teacher') {
                router.push('/dashboard')
                return
            }

            try {
                const snap = await getDoc(doc(db, 'gameReports', sessionId as string))
                if (!snap.exists()) {
                    router.push('/teacher/game/reports')
                    return
                }
                setReport(snap.data())
            } finally {
                setLoading(false)
            }
        })

        return () => unsub()
    }, [router, sessionId])

    if (loading) {
        return (
            <TeacherLayout title="Game Report">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
                </div>
            </TeacherLayout>
        )
    }

    if (!report) return null

    // ---------- Derived data from GameReport ----------

    const players: PlayerRow[] = Object.entries(report.players || {})
        .map(([uid, p]: any) => ({ uid, ...(p as any) }))
        .sort((a, b) => a.rank - b.rank)

    const totalPlayers = players.length
    const totalQuestions: number = report.totalQuestions

    const playerAccuracy = (uid: string) => {
        const answers = report.answers?.[uid] || {}
        const answered = Object.keys(answers).length
        const correct = Object.values(answers).filter((a: any) => a.correct).length
        return answered > 0 ? Math.round((correct / answered) * 100) : 0
    }

    const playerUnanswered = (uid: string) => {
        const answers = report.answers?.[uid] || {}
        return totalQuestions - Object.keys(answers).length
    }

    const questionAccuracy = (index: number) => {
        const allAnswers = Object.values(report.answers || {}) as any[]
        const responded = allAnswers.filter((a) => a[index] !== undefined)
        const correct = responded.filter((a: any) => a[index]?.correct).length
        return responded.length > 0 ? Math.round((correct / responded.length) * 100) : 0
    }

    let totalCorrect = 0
    let totalAnswered = 0
    players.forEach((p) => {
        const answers = report.answers?.[p.uid] || {}
        Object.values(answers).forEach((a: any) => {
            totalAnswered++
            if (a.correct) totalCorrect++
        })
    })
    const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

    const difficultQuestions = report.questions
        ?.map((q: any, idx: number) => ({ q, idx, acc: questionAccuracy(idx) }))
        .filter((x: any) => x.acc < 50)
        .sort((a: any, b: any) => a.acc - b.acc)

    const needHelpPlayers = players.filter((p) => playerAccuracy(p.uid) < 40)

    const formatDateTime = (ts: number) =>
        new Date(ts).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })

    const tabs: { key: Tab; label: string }[] = [
        { key: 'summary', label: 'Summary' },
        { key: 'participants', label: `Participants (${totalPlayers})` },
        { key: 'questions', label: `Questions (${totalQuestions})` },
    ]

    // ---------- Render ----------

    return (
        <TeacherLayout title="Game Report">
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Back + header */}
                <button
                    onClick={() => router.push('/teacher/game/reports')}
                    className="text-sm text-slate-400 hover:text-violet-600 mb-4 flex items-center gap-1"
                >
                    ← Back to reports
                </button>

                <div className="mb-4">
                    <h1 className="text-3xl font-bold text-slate-900">{report.quizTitle}</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {formatDateTime(report.playedAt)} · {totalPlayers} participants ·{' '}
                        {totalQuestions} questions
                    </p>
                </div>

                {/* Main tabs */}
                <div className="flex border-b border-slate-200 mb-6">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${activeTab === t.key
                                    ? 'border-violet-600 text-violet-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-700'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ========== SUMMARY TAB ========== */}
                {activeTab === 'summary' && (
                    <div className="space-y-6">
                        {/* Top row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Overall accuracy card */}
                            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-6 shadow-sm">
                                <BigDonut pct={overallAccuracy} />
                                <div>
                                    <p className="text-slate-400 text-sm mb-1">Overall class accuracy</p>
                                    <h2 className="text-4xl font-bold text-slate-900 mb-1">{overallAccuracy}%</h2>
                                    <p className="text-slate-500 text-sm">
                                        {overallAccuracy >= 70
                                            ? 'Play again to see if the class can beat this score.'
                                            : overallAccuracy >= 40
                                                ? 'Solid start — consider replaying the difficult questions.'
                                                : 'Students struggled — focus on the difficult questions below.'}
                                    </p>
                                </div>
                            </div>

                            {/* Quick stats */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4 justify-center">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 text-sm">👥 Participants</span>
                                    <span className="text-xl font-bold text-slate-900">{totalPlayers}</span>
                                </div>
                                <div className="h-px bg-slate-100" />
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 text-sm">❓ Questions</span>
                                    <span className="text-xl font-bold text-slate-900">{totalQuestions}</span>
                                </div>
                                <div className="h-px bg-slate-100" />
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 text-sm">🏆 Top score</span>
                                    <span className="text-xl font-bold text-violet-600">{players[0]?.score ?? 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Bottom row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Difficult questions */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    😓 Difficult questions ({difficultQuestions?.length ?? 0})
                                </h3>

                                {difficultQuestions?.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-6">
                                        🎉 No questions below 50% accuracy!
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {difficultQuestions.slice(0, 5).map(({ q, idx, acc }: any) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
                                            >
                                                <MiniDonut pct={acc} size={36} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-slate-400 mb-0.5">Q{idx + 1}</p>
                                                    <p className="text-sm text-slate-800 font-medium truncate">{q.text}</p>
                                                </div>
                                                <span className="text-sm font-bold text-red-500 flex-shrink-0">
                                                    {acc}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Need help students */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    🆘 Need help ({needHelpPlayers.length})
                                </h3>

                                {needHelpPlayers.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-6">
                                        🎉 All students above 40% accuracy!
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {needHelpPlayers.map((p) => (
                                            <div
                                                key={p.uid}
                                                className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3"
                                            >
                                                <MiniDonut pct={playerAccuracy(p.uid)} size={36} />
                                                <span className="flex-1 text-sm font-medium text-slate-800">
                                                    {p.name}
                                                </span>
                                                <span className="text-sm font-bold text-amber-600">
                                                    {playerAccuracy(p.uid)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ========== PARTICIPANTS TAB ========== */}
                {activeTab === 'participants' && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {/* Sub tabs */}
                        <div className="flex border-b border-slate-100 px-4 pt-4 gap-2">
                            {[
                                { key: 'all', label: `All (${totalPlayers})` },
                                { key: 'needhelp', label: `Need help (${needHelpPlayers.length})` },
                            ].map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setParticipantFilter(t.key as any)}
                                    className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 -mb-px transition-colors ${participantFilter === t.key
                                            ? 'border-violet-600 text-violet-600'
                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Table */}
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                                    <th className="text-left px-5 py-3">Nickname</th>
                                    <th className="text-center px-4 py-3">Rank</th>
                                    <th className="text-center px-4 py-3">Correct answers</th>
                                    <th className="text-center px-4 py-3">Unanswered</th>
                                    <th className="text-right px-5 py-3">Final score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(participantFilter === 'all' ? players : needHelpPlayers).map((p) => {
                                    const acc = playerAccuracy(p.uid)
                                    const unanswered = playerUnanswered(p.uid)
                                    const isExpanded = expandedPlayer === p.uid
                                    const answers = report.answers?.[p.uid] || {}

                                    return (
                                        <>
                                            <tr
                                                key={p.uid}
                                                onClick={() => setExpandedPlayer(isExpanded ? null : p.uid)}
                                                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                                            >
                                                <td className="px-5 py-4 font-medium text-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <span>{p.name}</span>
                                                        <span className="text-slate-300 text-xs">
                                                            {isExpanded ? '▲' : '▼'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-center px-4 py-4 text-slate-600 font-semibold">
                                                    {p.rank}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <MiniDonut pct={acc} size={32} />
                                                        <span
                                                            className={`font-bold text-sm ${acc >= 70
                                                                    ? 'text-green-600'
                                                                    : acc >= 40
                                                                        ? 'text-amber-500'
                                                                        : 'text-red-500'
                                                                }`}
                                                        >
                                                            {acc}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-center px-4 py-4 text-slate-500">
                                                    {unanswered > 0 ? unanswered : '—'}
                                                </td>
                                                <td className="text-right px-5 py-4 font-bold text-violet-600">
                                                    {p.score}
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr key={`${p.uid}-expanded`} className="bg-slate-50">
                                                    <td colSpan={5} className="px-5 py-4">
                                                        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                                            Question breakdown
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {report.questions?.map((_: any, qi: number) => {
                                                                const a = answers[qi]
                                                                const correct = a?.correct
                                                                return (
                                                                    <span
                                                                        key={qi}
                                                                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${correct
                                                                                ? 'bg-green-100 text-green-700'
                                                                                : a
                                                                                    ? 'bg-red-100 text-red-600'
                                                                                    : 'bg-slate-200 text-slate-500'
                                                                            }`}
                                                                    >
                                                                        Q{qi + 1} {correct ? '✓' : a ? '✗' : '–'}
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ========== QUESTIONS TAB ========== */}
                {activeTab === 'questions' && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {/* Sub tabs */}
                        <div className="flex border-b border-slate-100 px-4 pt-4 gap-2">
                            {[
                                { key: 'all', label: `All (${totalQuestions})` },
                                { key: 'difficult', label: `Difficult (${difficultQuestions?.length ?? 0})` },
                            ].map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setQuestionFilter(t.key as any)}
                                    className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 -mb-px transition-colors ${questionFilter === t.key
                                            ? 'border-violet-600 text-violet-600'
                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                                    <th className="text-center px-4 py-3 w-12">#</th>
                                    <th className="text-left px-4 py-3">Question</th>
                                    <th className="text-center px-4 py-3">Correct answers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(questionFilter === 'all'
                                    ? report.questions?.map((q: any, idx: number) => ({ q, idx }))
                                    : difficultQuestions?.map(({ q, idx }: any) => ({ q, idx }))).map(
                                        ({ q, idx }: any) => {
                                            const acc = questionAccuracy(idx)
                                            const isExpanded = expandedQuestion === idx
                                            const allAnswers = Object.entries(report.answers || {}) as any[]

                                            return (
                                                <>
                                                    <tr
                                                        key={idx}
                                                        onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                                                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                                                    >
                                                        <td className="text-center px-4 py-4 text-slate-400 font-semibold">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="px-4 py-4 text-slate-800 font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <span>{q.text}</span>
                                                                <span className="text-slate-300 text-xs">
                                                                    {isExpanded ? '▲' : '▼'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <MiniDonut pct={acc} size={32} />
                                                                <span
                                                                    className={`font-bold text-sm ${acc >= 70
                                                                            ? 'text-green-600'
                                                                            : acc >= 40
                                                                                ? 'text-amber-500'
                                                                                : 'text-red-500'
                                                                        }`}
                                                                >
                                                                    {acc}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {isExpanded && (
                                                        <tr key={`q-${idx}-expanded`} className="bg-slate-50">
                                                            <td colSpan={3} className="px-6 py-6">
                                                                <div className="space-y-6">
                                                                    {/* Top strip: summary numbers */}
                                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-200 pb-4 text-xs text-slate-500">
                                                                        <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                                                                            <span className="font-semibold">Correct answers</span>
                                                                            <span className="flex items-center gap-1 text-sm">
                                                                                <MiniDonut pct={acc} size={28} />
                                                                                <span
                                                                                    className={
                                                                                        acc >= 70
                                                                                            ? 'text-green-600'
                                                                                            : acc >= 40
                                                                                                ? 'text-amber-500'
                                                                                                : 'text-red-500'
                                                                                    }
                                                                                >
                                                                                    {acc}%
                                                                                </span>
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                                                                            <span className="font-semibold">Avg points</span>
                                                                            <span className="text-slate-700 text-sm">
                                                                                {(() => {
                                                                                    const all = Object.values(report.answers || {}) as any[]
                                                                                    const pts: number[] = []
                                                                                    all.forEach((a: any) => {
                                                                                        const ans = a[idx]
                                                                                        if (ans) pts.push(ans.points || 0)
                                                                                    })
                                                                                    if (pts.length === 0) return '—'
                                                                                    const avg = Math.round(
                                                                                        pts.reduce((s, x) => s + x, 0) / pts.length,
                                                                                    )
                                                                                    return avg
                                                                                })()}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                                                                            <span className="font-semibold">Participants answered</span>
                                                                            <span className="text-slate-700 text-sm">
                                                                                {(() => {
                                                                                    const all = Object.values(report.answers || {}) as any[]
                                                                                    const answered = all.filter(
                                                                                        (a: any) => a[idx] !== undefined,
                                                                                    ).length
                                                                                    return `${answered} of ${totalPlayers}`
                                                                                })()}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Options + player table */}
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                        {/* Answer options with bars */}
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                                                                                Answer options
                                                                            </p>

                                                                            <div className="space-y-3">
                                                                                {q.answers?.map((opt: any, oi: number) => {
                                                                                    const chosenCount = allAnswers.filter(
                                                                                        ([, a]: any) => a[idx]?.answerId === opt.id,
                                                                                    ).length
                                                                                    const chosenPct =
                                                                                        totalPlayers > 0
                                                                                            ? Math.round(
                                                                                                (chosenCount / totalPlayers) * 100,
                                                                                            )
                                                                                            : 0
                                                                                    const isCorrect = opt.isCorrect

                                                                                    return (
                                                                                        <div
                                                                                            key={oi}
                                                                                            className={`rounded-xl border px-3 py-2.5 ${isCorrect
                                                                                                    ? 'bg-green-50 border-green-200'
                                                                                                    : 'bg-white border-slate-200'
                                                                                                }`}
                                                                                        >
                                                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                                                <span
                                                                                                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${isCorrect
                                                                                                            ? 'bg-green-500 text-white'
                                                                                                            : 'bg-slate-200 text-slate-700'
                                                                                                        }`}
                                                                                                >
                                                                                                    {String.fromCharCode(65 + oi)}
                                                                                                </span>

                                                                                                <span className="text-sm text-slate-800 flex-1">
                                                                                                    {opt.text}
                                                                                                </span>

                                                                                                <span
                                                                                                    className={`text-xs font-bold flex items-center gap-1 ${isCorrect
                                                                                                            ? 'text-green-600'
                                                                                                            : chosenCount > 0
                                                                                                                ? 'text-red-500'
                                                                                                                : 'text-slate-400'
                                                                                                        }`}
                                                                                                >
                                                                                                    {isCorrect ? '✓' : '✗'}
                                                                                                    {chosenPct}%
                                                                                                </span>
                                                                                            </div>

                                                                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                                                                <div
                                                                                                    className={`h-1.5 rounded-full ${isCorrect
                                                                                                            ? 'bg-green-400'
                                                                                                            : 'bg-slate-400'
                                                                                                        }`}
                                                                                                    style={{ width: `${chosenPct}%` }}
                                                                                                />
                                                                                            </div>

                                                                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                                                                {chosenCount} student
                                                                                                {chosenCount !== 1 ? 's' : ''}
                                                                                            </p>
                                                                                        </div>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        </div>

                                                                        {/* Player answers table */}
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                                                                                Player answers
                                                                            </p>
                                                                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                                                                        <tr>
                                                                                            <th className="text-left px-3 py-2.5">Player</th>
                                                                                            <th className="text-left px-3 py-2.5">Answered</th>
                                                                                            <th className="text-center px-3 py-2.5">
                                                                                                Correct/incorrect
                                                                                            </th>
                                                                                            <th className="text-right px-3 py-2.5">Points</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {players.map((p) => {
                                                                                            const ans = report.answers?.[p.uid]?.[idx]
                                                                                            const chosenOpt = q.answers?.find(
                                                                                                (x: any) => x.id === ans?.answerId,
                                                                                            )

                                                                                            return (
                                                                                                <tr
                                                                                                    key={p.uid}
                                                                                                    className="border-b border-slate-100 last:border-0"
                                                                                                >
                                                                                                    <td className="px-3 py-2.5 text-slate-800 font-medium">
                                                                                                        {p.name}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2.5 text-slate-600">
                                                                                                        {chosenOpt?.text ?? 'No answer'}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2.5 text-center">
                                                                                                        {ans ? (
                                                                                                            <span
                                                                                                                className={`font-bold text-sm ${ans.correct
                                                                                                                        ? 'text-green-500'
                                                                                                                        : 'text-red-500'
                                                                                                                    }`}
                                                                                                            >
                                                                                                                {ans.correct
                                                                                                                    ? '✓ Correct'
                                                                                                                    : '✗ Incorrect'}
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            <span className="text-slate-300 text-sm">
                                                                                                                —
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2.5 text-right font-semibold text-violet-600">
                                                                                                        {ans ? ans.points ?? 0 : 0}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            )
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )
                                        },
                                    )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}
