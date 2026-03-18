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
                    <div className="space-y-4">
                        {filteredRows.map(row => {
                            const expanded = expandedId === row.id
                            return (
                                <div key={`${row.studentId}-${row.id}`} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(expanded ? null : row.id)}
                                        className="w-full text-left px-5 py-5 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="space-y-2 min-w-0">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className="text-sm font-semibold text-slate-900">{row.studentName}</span>
                                                    {row.studentGroup && (
                                                        <span className="rounded-full bg-violet-50 text-violet-700 px-3 py-1 text-xs font-semibold">{row.studentGroup}</span>
                                                    )}
                                                    {row.questionLabel && (
                                                        <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-semibold">{row.questionLabel}</span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-slate-500">{row.studentEmail || 'No email saved'} • {formatCreatedAt(row.createdAt)}</div>
                                                <div className="text-lg text-slate-900 line-clamp-2">{row.questionText}</div>
                                                <div className="text-sm text-slate-500 line-clamp-2">{row.transcript || 'No transcript captured.'}</div>
                                            </div>
                                            <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
                                                {row.aiAnalysis ? (
                                                    <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${scoreColor(row.aiAnalysis.overallBand)}`}>
                                                        AI Band {row.aiAnalysis.overallBand}
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-500">
                                                        Not analyzed
                                                    </span>
                                                )}
                                                <div className="text-xs text-slate-400">{row.warningCount} warning{row.warningCount !== 1 ? 's' : ''}</div>
                                            </div>
                                        </div>
                                    </button>

                                    {expanded && (
                                        <div className="border-t border-slate-100 px-5 py-5 space-y-5 bg-slate-50/60">
                                            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
                                                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Transcript</div>
                                                    <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap min-h-[180px]">
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
                                                                {[
                                                                    ['Task Response', row.aiAnalysis.criteria.taskResponse],
                                                                    ['Fluency & Coherence', row.aiAnalysis.criteria.fluencyCoherence],
                                                                    ['Lexical Resource', row.aiAnalysis.criteria.lexicalResource],
                                                                    ['Grammar', row.aiAnalysis.criteria.grammaticalRangeAccuracy],
                                                                    ['Pronunciation', row.aiAnalysis.criteria.pronunciation],
                                                                    ['Overall', row.aiAnalysis.overallBand],
                                                                ].map(([label, score]) => (
                                                                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
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
                                                            No AI analysis yet. Run analysis to score this speaking response.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}