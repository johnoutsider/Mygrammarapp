'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { useEffect } from 'react'
import { createTeacherQuiz } from '@/lib/quizService'
import TeacherLayout from '@/components/TeacherLayout'
import * as XLSX from 'xlsx'

const COVER_COLORS = [
    { hex: '#0d9488', label: 'Teal' },
    { hex: '#7c3aed', label: 'Purple' },
    { hex: '#ea580c', label: 'Orange' },
    { hex: '#16a34a', label: 'Green' },
    { hex: '#dc2626', label: 'Red' },
    { hex: '#2563eb', label: 'Blue' },
]

const OPTION_COLORS = ['bg-[#f89b29]', 'bg-[#3b82f6]', 'bg-[#00c0a3]', 'bg-[#ef4444]']

type CreationMethod = 'manual' | 'csv'

// ── Excel template column mapping ────────────────────────────────────────────
// col[0] = Question #   (skip — row number)
// col[1] = Question Text
// col[2] = Answer 1
// col[3] = Answer 2
// col[4] = Answer 3     (optional)
// col[5] = Answer 4     (optional)
// col[6] = Time Limit   (seconds, default 20, max 300)
// col[7] = Correct Answer(s)  (1-based, comma-separated e.g. "1" or "1,4")

function parseRows(rows: (string | number)[][]) {
    return rows.slice(1).map((cols, i) => {
        const text = String(cols[1] ?? '').trim()
        if (!text) return null

        const rawCorrect = String(cols[7] ?? '').trim()
        const correctIndices = new Set(
            rawCorrect.split(',').map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n) && n >= 0)
        )

        const timeLimitRaw = parseInt(String(cols[6] ?? ''))
        const timeLimit = isNaN(timeLimitRaw) || timeLimitRaw <= 0 ? 20 : Math.min(timeLimitRaw, 300)

        const options = [cols[2], cols[3], cols[4], cols[5]]
            .map((ans, idx) => ({
                id: String(idx + 1),
                text: String(ans ?? '').trim(),
                isCorrect: correctIndices.has(idx),
                colorClass: OPTION_COLORS[idx],
            }))
            .filter(o => o.text !== '')

        if (options.length < 2) return null

        return { id: Date.now() + i, text, options, timeLimit }
    }).filter(Boolean)
}

function parseCsvText(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const rows = lines.map(line => {
        const cols: string[] = []
        let current = ''
        let inQuotes = false
        for (const char of line) {
            if (char === '"') { inQuotes = !inQuotes }
            else if (char === ',' && !inQuotes) { cols.push(current.trim()); current = '' }
            else { current += char }
        }
        cols.push(current.trim())
        return cols
    })
    return parseRows(rows as (string | number)[][])
}

function parseExcelBuffer(buffer: ArrayBuffer) {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' })
    return parseRows(rows)
}

export default function CreateQuizPage() {
    const router = useRouter()
    const [uid, setUid] = useState('')
    const [method, setMethod] = useState<CreationMethod>('manual')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [coverColor, setCoverColor] = useState(COVER_COLORS[0].hex)
    const [privacy, setPrivacy] = useState<'public' | 'private'>('public')
    const [creating, setCreating] = useState(false)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) { router.push('/'); return }
            setUid(user.uid)
        })
        return unsub
    }, [router])

    // ── Download Excel template from /public ───────────────────────────────────
    const downloadTemplate = () => {
        const a = document.createElement('a')
        a.href = '/excel_template.xlsx'
        a.download = 'quiz-template.xlsx'
        a.click()
    }

    // ── Handle create ──────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!title.trim()) { setError('Please enter a title.'); return }
        if (method === 'csv' && !importFile) { setError('Please upload a file.'); return }
        setError('')
        setCreating(true)

        try {
            const quizId = await createTeacherQuiz(uid, title.trim(), description.trim(), privacy, coverColor)

            if (method === 'csv' && importFile) {
                const isExcel = importFile.name.endsWith('.xlsx') || importFile.name.endsWith('.xls')
                let questions

                if (isExcel) {
                    const buffer = await importFile.arrayBuffer()
                    questions = parseExcelBuffer(buffer)
                } else {
                    const text = await importFile.text()
                    questions = parseCsvText(text)
                }

                if (questions.length > 0) {
                    const { updateTeacherQuiz } = await import('@/lib/quizService')
                    await updateTeacherQuiz(quizId, { questions })
                }
            }

            router.push(`/teacher/my-quizzes/${quizId}/edit`)
        } catch (err) {
            console.error(err)
            setError('Something went wrong. Please try again.')
            setCreating(false)
        }
    }

    return (
        <TeacherLayout title="Create Quiz">
            <div className="max-w-3xl mx-auto px-4 py-6">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Question Set Creator</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        This decides how you will start adding questions to your set
                    </p>
                </div>

                {/* Creation method */}
                <div className="mb-6">
                    <p className="text-sm font-bold text-slate-700 mb-3">Choose a Creation Method</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { key: 'manual', icon: '✏️', label: 'Manual (Default)', active: true },
                            { key: 'csv', icon: '📊', label: 'Excel / CSV', active: true },
                            { key: 'quizlet', icon: '🔵', label: 'Quizlet Import', active: false },
                            { key: 'ai', icon: '🤖', label: 'AI Generator', active: false },
                        ].map(m => (
                            <button
                                key={m.key}
                                onClick={() => m.active && setMethod(m.key as CreationMethod)}
                                disabled={!m.active}
                                title={!m.active ? 'Coming soon' : ''}
                                className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 text-sm font-semibold transition-all
                                    ${method === m.key
                                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                                        : m.active
                                            ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                            : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                            >
                                <span className="text-xl">{m.icon}</span>
                                <span className="text-center leading-tight">{m.label}</span>
                                {!m.active && (
                                    <span className="text-[10px] text-slate-300 font-normal">Coming soon</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main form */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Add a descriptive title"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Tell students about this quiz"
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                        />
                    </div>

                    {/* Cover color */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Cover Colour
                        </label>
                        <div className="flex gap-3 flex-wrap">
                            {COVER_COLORS.map(c => (
                                <button
                                    key={c.hex}
                                    onClick={() => setCoverColor(c.hex)}
                                    title={c.label}
                                    className={`w-10 h-10 rounded-xl transition-all ${coverColor === c.hex ? 'ring-4 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: c.hex }}
                                >
                                    {coverColor === c.hex && (
                                        <span className="text-white font-bold text-sm">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Cover preview */}
                        <div
                            className="mt-3 h-24 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: coverColor }}
                        >
                            <span className="text-white font-extrabold text-lg text-center px-4 drop-shadow">
                                {title || 'Your Quiz Title'}
                            </span>
                        </div>
                    </div>

                    {/* Privacy */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Privacy Setting
                        </label>
                        <p className="text-xs text-slate-400 mb-3">
                            This decides who can find and play your question set
                        </p>
                        <div className="flex gap-3">
                            {[
                                { value: 'public', icon: '🌐', label: 'Public', desc: 'Playable by everyone' },
                                { value: 'private', icon: '🔒', label: 'Private', desc: 'Only you' },
                            ].map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setPrivacy(p.value as 'public' | 'private')}
                                    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all
                                        ${privacy === p.value
                                            ? 'border-teal-500 bg-teal-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                >
                                    <span className="text-lg">{p.icon}</span>
                                    <div className="text-left">
                                        <p className={`font-bold ${privacy === p.value ? 'text-teal-700' : 'text-slate-700'}`}>
                                            {p.label}
                                        </p>
                                        <p className="text-xs text-slate-400">{p.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Excel/CSV upload (only when csv method selected) */}
                    {method === 'csv' && (
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-5">
                            <p className="text-sm font-bold text-slate-700 mb-3">📊 Import from Spreadsheet</p>
                            <div className="space-y-2 text-sm text-slate-500 mb-4">
                                <p>1. <button onClick={downloadTemplate} className="text-teal-600 underline font-semibold hover:text-teal-700">Download</button> our Excel template</p>
                                <p>2. Fill it out and save as Excel</p>
                                <p>3. Upload below</p>
                            </div>
                            <p className="text-xs text-slate-400 mb-3 font-mono bg-slate-50 px-3 py-2 rounded-lg">
                                Columns: Question Text · Answer 1–4 · Time Limit (sec) · Correct Answer # (1–4)
                            </p>
                            <label className="block w-full bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm py-3 rounded-xl text-center cursor-pointer transition-all">
                                {importFile ? `✅ ${importFile.name}` : '📁 Upload Excel / CSV'}
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-red-500 font-semibold">{error}</p>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleCreate}
                        disabled={!title.trim() || creating}
                        className="w-full bg-teal-500 hover:bg-teal-600 text-white font-extrabold py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {creating ? 'Creating...' : '🚀 Create Set'}
                    </button>
                </div>
            </div>
        </TeacherLayout>
    )
}
