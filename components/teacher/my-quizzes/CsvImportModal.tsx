'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

interface Answer {
    id: number
    text: string
    isCorrect: boolean
    explanation: string
}

interface Question {
    id: number
    text: string
    type: 'quiz' | 'true_or_false'
    timeLimit: number
    answers: Answer[]
}

export default function CsvImportModal({
    onImport,
    onClose,
}: {
    onImport: (questions: Question[]) => void
    onClose: () => void
}) {
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState<{ count: number } | null>(null)
    const [error, setError] = useState('')

    // ── Download template ──────────────────────────────────────────────────────
    const downloadTemplate = () => {
        const a = document.createElement('a')
        a.href = '/excel_template.xlsx'
        a.download = 'quiz-template.xlsx'
        a.click()
    }

    // ── Copy template to clipboard ─────────────────────────────────────────────
    const copyTemplate = () => {
        const content = [
            'Question #,Question Text,Answer 1,Answer 2,Answer 3,Answer 4,Time Limit (sec),Correct Answer(s)',
            '1,What is the past tense of "go"?,went,goed,gone,going,20,1',
        ].join('\n')
        navigator.clipboard.writeText(content)
    }

    // ── Parse rows (shared for CSV and Excel) ─────────────────────────────────
    // col[0]=Question#(skip), col[1]=QuestionText, col[2-5]=Answers,
    // col[6]=TimeLimit, col[7]=CorrectAnswer(s) 1-based comma-separated
    function parseRows(rows: (string | number)[][]): Question[] {
        if (rows.length < 2) return []
        return rows.slice(1).map((cols, i) => {
            const text = String(cols[1] ?? '').trim()
            if (!text) return null

            const rawCorrect = String(cols[7] ?? '').trim()
            const correctIndices = new Set(
                rawCorrect.split(',').map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n) && n >= 0)
            )

            const timeLimitRaw = parseInt(String(cols[6] ?? ''))
            const timeLimit = isNaN(timeLimitRaw) || timeLimitRaw <= 0 ? 20 : Math.min(timeLimitRaw, 300)

            return {
                id: Date.now() + i,
                text,
                type: 'quiz' as const,
                timeLimit,
                answers: [
                    { id: 1, text: String(cols[2] ?? '').trim(), isCorrect: correctIndices.has(0), explanation: '' },
                    { id: 2, text: String(cols[3] ?? '').trim(), isCorrect: correctIndices.has(1), explanation: '' },
                    { id: 3, text: String(cols[4] ?? '').trim(), isCorrect: correctIndices.has(2), explanation: '' },
                    { id: 4, text: String(cols[5] ?? '').trim(), isCorrect: correctIndices.has(3), explanation: '' },
                ].filter(a => a.text !== '')
            }
        }).filter((q): q is Question => q !== null && q.answers.length >= 2)
    }

    function parseCsvText(text: string): Question[] {
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

    function parseExcelBuffer(buffer: ArrayBuffer): Question[] {
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' })
        return parseRows(rows)
    }

    // ── Handle file upload ─────────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setError('')
        setResult(null)
        setImporting(true)

        try {
            const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
            let questions: Question[]

            if (isExcel) {
                const buffer = await file.arrayBuffer()
                questions = parseExcelBuffer(buffer)
            } else {
                const text = await file.text()
                questions = parseCsvText(text)
            }

            if (questions.length === 0) {
                setError('No valid questions found. Check that your file matches the template columns.')
                setImporting(false)
                return
            }

            const invalid = questions.filter(q => !q.answers.some(a => a.isCorrect))
            if (invalid.length > 0) {
                setError(`${invalid.length} row(s) have an invalid CorrectAnswer value. Must be 1–4.`)
                setImporting(false)
                return
            }

            setResult({ count: questions.length })
            setImporting(false)

            setTimeout(() => {
                onImport(questions)
                onClose()
            }, 1200)

        } catch (err) {
            console.error(err)
            setError('Failed to read file. Make sure it is a valid Excel (.xlsx) or CSV file.')
            setImporting(false)
        }

        e.target.value = ''
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-base font-extrabold text-slate-800">
                        📊 Import From Spreadsheet
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">

                    {/* Steps */}
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 space-y-3 text-center">
                        <p className="text-sm text-slate-600">
                            1.{' '}
                            <button
                                onClick={copyTemplate}
                                className="text-teal-600 underline font-semibold hover:text-teal-700"
                            >
                                Copy
                            </button>
                            {' '}or{' '}
                            <button
                                onClick={downloadTemplate}
                                className="text-teal-600 underline font-semibold hover:text-teal-700"
                            >
                                Download
                            </button>
                            {' '}our template.
                        </p>
                        <p className="text-sm text-slate-600">
                            2. Fill it out and save as Excel
                        </p>
                        <p className="text-sm text-slate-600">
                            3. Upload Below
                        </p>
                    </div>

                    {/* Column guide */}
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-slate-500 mb-2">
                            Template columns (in order):
                        </p>
                        <div className="grid grid-cols-3 gap-1">
                            {[
                                'Question #',
                                'Question Text',
                                'Answer 1',
                                'Answer 2',
                                'Answer 3',
                                'Answer 4',
                                'Time Limit (sec)',
                                'Correct Answer(s)',
                            ].map((col, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-md text-center"
                                >
                                    {col}
                                </span>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                            Correct Answer is 1–4 (comma-separated for multiple, e.g. "1,3")
                        </p>
                    </div>

                    {/* Success message */}
                    {result && (
                        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                            <p className="text-green-700 font-bold text-sm">
                                ✅ {result.count} question{result.count !== 1 ? 's' : ''} imported successfully!
                            </p>
                            <p className="text-green-500 text-xs mt-0.5">
                                Adding to your quiz...
                            </p>
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <p className="text-red-600 font-semibold text-sm">{error}</p>
                        </div>
                    )}

                    {/* Upload button */}
                    <label className={`block w-full text-white font-bold text-sm py-3.5 rounded-xl text-center cursor-pointer transition-all
                        ${importing || result
                            ? 'bg-teal-300 cursor-not-allowed'
                            : 'bg-teal-500 hover:bg-teal-600'}`}>
                        {importing ? '⏳ Reading file...' : result ? '✅ Imported!' : '📁 Upload Excel / CSV'}
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            disabled={importing || !!result}
                            onChange={handleFileUpload}
                        />
                    </label>

                    <p className="text-xs text-slate-400 text-center">
                        Accepts .xlsx, .xls, or .csv — questions will be added to your quiz
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}