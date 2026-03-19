'use client'

import { useEffect, useMemo, useState } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import { auth } from '@/lib/firebase'
import { listAllSpeakingResponses, SpeakingResponse, TeacherSpeakingResponse } from '@/lib/speakingService'

function formatCreatedAt(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}

function scoreColor(score: number) {
    if (score >= 7) return 'text-green-700 bg-green-50 border-green-100'
    if (score >= 5.5) return 'text-amber-700 bg-amber-50 border-amber-100'
    return 'text-red-700 bg-red-50 border-red-100'
}

export default function TeacherSpeakingLogsPage() {
    const [rows, setRows] = useState<TeacherSpeakingResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [groupFilter, setGroupFilter] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [analyzingId, setAnalyzingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadRows = async () => {
            try {
                const nextRows = await listAllSpeakingResponses()
                setRows(nextRows)
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load speaking logs.')
            } finally {
                setLoading(false)
            }
        }

        void loadRows()
    }, [])

    const groups = useMemo(() => [...new Set(rows.map(row => row.studentGroup).filter(Boolean))].sort(), [rows])

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase()
        return rows.filter(row => {
            const matchesSearch = !q ||
                row.studentName.toLowerCase().includes(q) ||
                row.questionText.toLowerCase().includes(q) ||
                (row.studentEmail || '').toLowerCase().includes(q) ||
                (row.transcript || '').toLowerCase().includes(q)
            const matchesGroup = !groupFilter || row.studentGroup === groupFilter
            return matchesSearch && matchesGroup
        })
    }, [groupFilter, rows, search])

    const handleAnalyze = async (row: TeacherSpeakingResponse) => {
        if (!auth.currentUser) {
            setError('You must be signed in as a teacher.')
            return
        }

        setAnalyzingId(row.id)
        setError(null)

        try {
            const response = await fetch('/api/speaking/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId: auth.currentUser.uid,
                    studentId: row.studentId,
                    responseId: row.id,
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Failed to analyze response.')

            setRows(current => current.map(item => (
                item.id === row.id && item.studentId === row.studentId
                    ? { ...item, aiAnalysis: data.analysis }
                    : item
            )))
            setExpandedId(row.id)
        } catch (analysisError) {
            console.error(analysisError)
            setError((analysisError as Error).message || 'Failed to analyze speaking response.')
        } finally {
            setAnalyzingId(null)
        }
    }

    return (
        <TeacherLayout title="Speaking Logs">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Speaking Logs</h1>
                    <p className="text-sm text-slate-500 mt-1">Review how students answered each speaking question and send their responses to AI for scoring.</p>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
                    <input
                        type="text"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search by student, question, transcript, or email"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <select
                        value={groupFilter}
                        onChange={event => setGroupFilter(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    >
                        <option value="">All Groups</option>
                        {groups.map(group => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="min-h-[30vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm text-slate-500">
                        No speaking responses found.
                    </div>
                ) : (
                    <>
                        {/* ── Data table ── */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        <th className="px-5 py-3 text-left">Topic</th>
                                        <th className="px-5 py-3 text-left">Student</th>
                                        <th className="px-5 py-3 text-left hidden md:table-cell">Question</th>
                                        <th className="px-5 py-3 text-left hidden lg:table-cell">Date</th>
                                        <th className="px-5 py-3 text-left hidden lg:table-cell">AI Band</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRows.map(row => (
                                        <tr key={`${row.studentId}-${row.id}`} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4 align-top">
                                                <span className="rounded-full bg-teal-50 text-teal-700 px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
                                                    {row.partLabel || '-'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <div className="font-semibold text-slate-900">{row.studentName}</div>
                                                {row.studentGroup && (
                                                    <div className="text-xs text-slate-400 mt-0.5">{row.studentGroup}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 align-top hidden md:table-cell max-w-xs">
                                                <div className="text-slate-700 line-clamp-2">{row.questionText}</div>
                                                {row.questionLabel && (
                                                    <div className="text-xs text-slate-400 mt-0.5">{row.questionLabel}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 align-top hidden lg:table-cell whitespace-nowrap text-slate-500 text-xs">
                                                {formatCreatedAt(row.createdAt)}
                                            </td>
                                            <td className="px-5 py-4 align-top hidden lg:table-cell">
                                                {row.aiAnalysis ? (
                                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreColor(row.aiAnalysis.overallBand)}`}>
                                                        Band {row.aiAnalysis.overallBand}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 align-top text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                                                    className="px-3 py-1.5 rounded-lg bg-[#1a9aaa] hover:bg-[#127080] text-white text-xs font-semibold transition-colors"
                                                >
                                                    {expandedId === row.id ? 'Close' : 'View'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Detail panel ── */}
                        {expandedId && (() => {
                            const row = filteredRows.find(r => r.id === expandedId)
                            if (!row) return null
                            return (
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">{row.partLabel} — {row.questionLabel}</div>
                                            <h3 className="text-xl font-bold text-slate-900">{row.questionText}</h3>
                                            <div className="text-sm text-slate-500 mt-1">{row.studentName} {row.studentGroup ? `· ${row.studentGroup}` : ''} · {formatCreatedAt(row.createdAt)}</div>
                                        </div>
                                        <button type="button" onClick={() => setExpandedId(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Student Transcript</div>
                                            <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                                                {row.transcript || 'No transcript captured for this response.'}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">AI Evaluation</div>
                                                    <div className="text-sm text-slate-500 mt-1">IELTS-style speaking criteria</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleAnalyze(row)}
                                                    disabled={analyzingId === row.id}
                                                    className="px-4 py-2 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {analyzingId === row.id ? 'Analyzing...' : row.aiAnalysis ? 'Reanalyze' : 'Analyze with AI'}
                                                </button>
                                            </div>

                                            {row.aiAnalysis ? (
                                                <>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {([
                                                            ['Task Response', row.aiAnalysis.criteria.taskResponse],
                                                            ['Fluency & Coherence', row.aiAnalysis.criteria.fluencyCoherence],
                                                            ['Lexical Resource', row.aiAnalysis.criteria.lexicalResource],
                                                            ['Grammar', row.aiAnalysis.criteria.grammaticalRangeAccuracy],
                                                            ['Pronunciation', row.aiAnalysis.criteria.pronunciation],
                                                            ['Overall', row.aiAnalysis.overallBand],
                                                        ] as [string, number][]).map(([label, score]) => (
                                                            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                                                                <div className="text-lg font-bold text-slate-800 mt-1">{score}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {row.aiAnalysis.strengths.length > 0 && (
                                                        <div>
                                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">Strengths</div>
                                                            <ul className="space-y-2 text-sm text-slate-700">
                                                                {row.aiAnalysis.strengths.map((item, index) => (
                                                                    <li key={index} className="rounded-xl bg-emerald-50 px-3 py-2">{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {row.aiAnalysis.improvements.length > 0 && (
                                                        <div>
                                                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">Improvements</div>
                                                            <ul className="space-y-2 text-sm text-slate-700">
                                                                {row.aiAnalysis.improvements.map((item, index) => (
                                                                    <li key={index} className="rounded-xl bg-amber-50 px-3 py-2">{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">Feedback</div>
                                                        <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                                                            {row.aiAnalysis.feedback}
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                                    No AI analysis yet. Click &quot;Analyze with AI&quot; to score this response.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </>
                )}
            </div>
        </TeacherLayout>
    )
}