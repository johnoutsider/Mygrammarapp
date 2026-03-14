'use client'

import { useState } from 'react'

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
        const content = [
            'Question,Answer1,Answer2,Answer3,Answer4,CorrectAnswer',
            'What is the past tense of "go"?,went,goed,gone,going,1',
            'Which article is used before a vowel sound?,a,an,the,—,2',
        ].join('\n')

        const blob = new Blob([content], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'quiz-template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    // ── Copy template to clipboard ─────────────────────────────────────────────
    const copyTemplate = () => {
        const content = [
            'Question,Answer1,Answer2,Answer3,Answer4,CorrectAnswer',
            'What is the past tense of "go"?,went,goed,gone,going,1',
        ].join('\n')
        navigator.clipboard.writeText(content)
    }

    // ── CSV parser ─────────────────────────────────────────────────────────────
    function parseCsv(text: string): Question[] {
        const lines = text
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)

        if (lines.length < 2) return []

        // Skip header row
        return lines.slice(1).map((line, i) => {
            // Handle commas inside quotes
            const cols: string[] = []
            let current = ''
            let inQuotes = false
            for (const char of line) {
                if (char === '"') { inQuotes = !inQuotes }
                else if (char === ',' && !inQuotes) {
                    cols.push(current.trim())
                    current = ''
                } else {
                    current += char
                }
            }
            cols.push(current.trim())

            const correctIndex = parseInt(cols[5]) - 1 // 1-4 → 0-3

            return {
                id: Date.now() + i,
                text: cols[0] || '',
                type: 'quiz' as const,
                timeLimit: 20,
                answers: [
                    { id: 1, text: cols[1] || '', isCorrect: correctIndex === 0, explanation: '' },
                    { id: 2, text: cols[2] || '', isCorrect: correctIndex === 1, explanation: '' },
                    { id: 3, text: cols[3] || '', isCorrect: correctIndex === 2, explanation: '' },
                    { id: 4, text: cols[4] || '', isCorrect: correctIndex === 3, explanation: '' },
                ].filter(a => a.text.trim() !== '')
            }
        }).filter(q => q.text.trim() !== '')
    }

    // ── Handle file upload ─────────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setError('')
        setResult(null)
        setImporting(true)

        try {
            const text = await file.text()
            const questions = parseCsv(text)

            if (questions.length === 0) {
                setError('No valid questions found. Please check your CSV format.')
                setImporting(false)
                return
            }

            // Check each question has at least one correct answer
            const invalid = questions.filter(q => !q.answers.some(a => a.isCorrect))
            if (invalid.length > 0) {
                setError(`${invalid.length} row(s) have an invalid CorrectAnswer value. Must be 1–4.`)
                setImporting(false)
                return
            }

            setResult({ count: questions.length })
            setImporting(false)

            // Short delay so user sees success message
            setTimeout(() => {
                onImport(questions)
                onClose()
            }, 1200)

        } catch (err) {
            console.error(err)
            setError('Failed to read file. Please make sure it is a valid CSV.')
            setImporting(false)
        }

        // Reset input so same file can be re-uploaded
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
                            2. Fill it out and export as CSV
                        </p>
                        <p className="text-sm text-slate-600">
                            3. Upload Below
                        </p>
                    </div>

                    {/* Column guide */}
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-slate-500 mb-2">
                            Required columns:
                        </p>
                        <div className="grid grid-cols-3 gap-1">
                            {[
                                'Question',
                                'Answer1',
                                'Answer2',
                                'Answer3',
                                'Answer4',
                                'CorrectAnswer (1–4)',
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
                            CorrectAnswer is a number 1–4 indicating which answer is correct
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
                        {importing ? '⏳ Reading file...' : result ? '✅ Imported!' : '📁 Upload CSV'}
                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            disabled={importing || !!result}
                            onChange={handleFileUpload}
                        />
                    </label>

                    <p className="text-xs text-slate-400 text-center">
                        Questions will be added to your existing quiz — nothing will be overwritten
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