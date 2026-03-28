'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { updateTeacherQuiz } from '@/lib/quizService'
import TeacherLayout from '@/components/TeacherLayout'
import QuestionEditorCard from '@/components/teacher/my-quizzes/QuestionEditorCard'
import QuestionModal from '@/components/game/create/QuestionModal'
import CsvImportModal from '@/components/teacher/my-quizzes/CsvImportModal'

const COVER_COLORS = [
    { hex: '#0d9488', label: 'Teal' },
    { hex: '#7c3aed', label: 'Purple' },
    { hex: '#ea580c', label: 'Orange' },
    { hex: '#16a34a', label: 'Green' },
    { hex: '#dc2626', label: 'Red' },
    { hex: '#2563eb', label: 'Blue' },
]

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

interface QuizInfo {
    title: string
    description: string
    coverColor: string
    privacy: 'public' | 'private'
}

export default function QuizEditorPage() {
    const router = useRouter()
    const params = useParams()
    const quizId = params.quizId as string

    // ── State ──────────────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true)
    const [questions, setQuestions] = useState<Question[]>([])
    const [info, setInfo] = useState<QuizInfo>({
        title: '',
        description: '',
        coverColor: '#0d9488',
        privacy: 'public',
    })
    const [saved, setSaved] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveLabel, setSaveLabel] = useState('💾 Save Set')
    const [showAnswers, setShowAnswers] = useState(true)
    const [editInfoOpen, setEditInfoOpen] = useState(false)

    // Modals
    const [addEditModal, setAddEditModal] = useState<{
        open: boolean
        mode: 'add' | 'edit'
        index: number | null
    }>({ open: false, mode: 'add', index: null })
    const [csvOpen, setCsvOpen] = useState(false)

    // Temp info state for editing
    const [tempInfo, setTempInfo] = useState<QuizInfo>(info)

    // ── Load quiz ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }

            try {
                const snap = await getDoc(doc(db, 'quizzes', quizId))
                if (!snap.exists()) { router.push('/teacher/my-quizzes'); return }

                const data = snap.data() as any
                const loadedInfo = {
                    title: data.title || '',
                    description: data.description || '',
                    coverColor: data.coverColor || '#0d9488',
                    privacy: data.privacy || 'public',
                }
                setInfo(loadedInfo)
                setTempInfo(loadedInfo)
                setQuestions(data.questions || [])
            } catch (err) {
                console.error('Error loading quiz:', err)
            } finally {
                setLoading(false)
            }
        })
        return unsub
    }, [quizId, router])

    // ── Save to Firestore ──────────────────────────────────────────────────────
    const handleSave = async () => {
        if (saving) return
        setSaving(true)
        try {
            await updateTeacherQuiz(quizId, { questions, ...info })
            setSaved(true)
            setSaveLabel('✅ Saved!')
            setTimeout(() => setSaveLabel('💾 Save Set'), 2000)
        } catch (err) {
            console.error(err)
            setSaveLabel('❌ Failed — retry')
            setTimeout(() => setSaveLabel('💾 Save Set'), 2000)
        } finally {
            setSaving(false)
        }
    }

    // ── Save info panel ────────────────────────────────────────────────────────
    const handleSaveInfo = async () => {
        setInfo(tempInfo)
        setSaved(false)
        setEditInfoOpen(false)
        // Auto-save info immediately
        await updateTeacherQuiz(quizId, tempInfo)
        setSaved(true)
    }

    // ── Question actions ───────────────────────────────────────────────────────
    const handleSaveQuestion = (question: Question, index: number | null) => {
        setQuestions(prev => {
            const updated = [...prev]
            if (index === null) {
                updated.push(question)
            } else {
                updated[index] = question
            }
            return updated
        })
        setSaved(false)
    }

    const handleDelete = (index: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== index))
        setSaved(false)
    }

    const handleDuplicate = (index: number) => {
        setQuestions(prev => {
            const copy = { ...prev[index], id: Date.now() }
            const updated = [...prev]
            updated.splice(index + 1, 0, copy)
            return updated
        })
        setSaved(false)
    }

    const handleMoveUp = (index: number) => {
        if (index === 0) return
        setQuestions(prev => {
            const updated = [...prev]
                ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
            return updated
        })
        setSaved(false)
    }

    const handleMoveDown = (index: number) => {
        setQuestions(prev => {
            if (index === prev.length - 1) return prev
            const updated = [...prev]
                ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
            return updated
        })
        setSaved(false)
    }

    const handleCsvImport = (imported: Question[]) => {
        setQuestions(prev => [...prev, ...imported])
        setSaved(false)
    }

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <TeacherLayout title="Quiz Editor">
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
                </div>
            </TeacherLayout>
        )
    }

    const currentQuestion = addEditModal.index !== null
        ? questions[addEditModal.index]
        : null

    return (
        <TeacherLayout title="Quiz Editor">
            <div className="flex h-[calc(100vh-64px)] overflow-hidden">

                {/* ── Left Panel ── */}
                <div className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-auto">

                    {/* Cover block */}
                    <div
                        className="h-40 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: info.coverColor }}
                    >
                        <span className="text-white text-xl font-extrabold text-center px-4 leading-tight drop-shadow">
                            {info.title || 'Untitled Quiz'}
                        </span>
                    </div>

                    <div className="p-4 space-y-3 flex-1">

                        {/* Title + privacy */}
                        <div>
                            <h2 className="font-extrabold text-slate-800 text-base truncate">
                                {info.title || 'Untitled Quiz'}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {info.privacy === 'public' ? '🌐 Public' : '🔒 Private'}
                            </p>
                        </div>

                        {/* Save button */}
                        <button
                            onClick={handleSave}
                            disabled={saved || saving}
                            className={`w-full font-bold py-2.5 rounded-xl text-sm transition-all
                                ${saved
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-teal-500 hover:bg-teal-600 text-white shadow-sm'}`}
                        >
                            {saving ? 'Saving...' : saveLabel}
                        </button>

                        {/* Edit Info button */}
                        <button
                            onClick={() => {
                                setTempInfo(info)
                                setEditInfoOpen(v => !v)
                            }}
                            className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold py-2 rounded-xl text-sm transition-all"
                        >
                            ✏️ Edit Info
                        </button>

                        {/* Edit Info panel */}
                        {editInfoOpen && (
                            <div className="bg-slate-50 rounded-xl p-3 space-y-3 border border-slate-200">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Title</label>
                                    <input
                                        type="text"
                                        value={tempInfo.title}
                                        onChange={e => setTempInfo(p => ({ ...p, title: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Description</label>
                                    <textarea
                                        value={tempInfo.description}
                                        onChange={e => setTempInfo(p => ({ ...p, description: e.target.value }))}
                                        rows={2}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cover Colour</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {COVER_COLORS.map(c => (
                                            <button
                                                key={c.hex}
                                                onClick={() => setTempInfo(p => ({ ...p, coverColor: c.hex }))}
                                                className={`w-7 h-7 rounded-lg transition-all ${tempInfo.coverColor === c.hex ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                                                style={{ backgroundColor: c.hex }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Privacy</label>
                                    <div className="flex gap-2">
                                        {[
                                            { value: 'public', label: '🌐 Public' },
                                            { value: 'private', label: '🔒 Private' },
                                        ].map(p => (
                                            <button
                                                key={p.value}
                                                onClick={() => setTempInfo(prev => ({ ...prev, privacy: p.value as 'public' | 'private' }))}
                                                className={`flex-1 text-xs font-bold py-1.5 rounded-lg border-2 transition-all
                                                    ${tempInfo.privacy === p.value
                                                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                        : 'border-slate-200 text-slate-500'}`}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveInfo}
                                    className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 rounded-lg text-xs transition-all"
                                >
                                    Save Info
                                </button>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="border-t border-slate-100 pt-3 space-y-2">

                            {/* Add Question */}
                            <button
                                onClick={() => setAddEditModal({ open: true, mode: 'add', index: null })}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                            >
                                ➕ Add Question
                            </button>

                            {/* Spreadsheet Import */}
                            <button
                                onClick={() => setCsvOpen(true)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                            >
                                📥 Spreadsheet Import
                            </button>

                            {/* Show / Hide Answers */}
                            <button
                                onClick={() => setShowAnswers(v => !v)}
                                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                            >
                                {showAnswers ? '👁 Hide Answers' : '👁 Show Answers'}
                            </button>

                            {/* Back to list */}
                            <button
                                onClick={() => router.push('/teacher/my-quizzes')}
                                className="w-full border border-slate-200 text-slate-500 hover:bg-slate-50 font-semibold py-2 rounded-xl text-sm transition-all"
                            >
                                ← Back to My Quizzes
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Right Panel ── */}
                <div className="flex-1 overflow-y-auto bg-slate-50">

                    {/* Top bar */}
                    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="bg-slate-100 text-slate-600 font-bold text-sm px-3 py-1.5 rounded-full">
                                {questions.length} Question{questions.length !== 1 ? 's' : ''}
                            </span>
                            {!saved && (
                                <span className="text-xs text-amber-500 font-semibold animate-pulse">
                                    ● Unsaved changes
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setAddEditModal({ open: true, mode: 'add', index: null })}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2"
                        >
                            ➕ Add Question
                        </button>
                    </div>

                    {/* Questions list */}
                    <div className="p-6 space-y-3">
                        {questions.length === 0 ? (
                            <div className="text-center py-24">
                                <div className="text-5xl mb-4">🧠</div>
                                <h3 className="text-lg font-bold text-slate-600 mb-2">
                                    No Questions Yet
                                </h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Add questions manually or import from a spreadsheet
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setAddEditModal({ open: true, mode: 'add', index: null })}
                                        className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                                    >
                                        ➕ Add Question
                                    </button>
                                    <button
                                        onClick={() => setCsvOpen(true)}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                                    >
                                        📥 Import CSV
                                    </button>
                                </div>
                            </div>
                        ) : (
                            questions.map((q, i) => (
                                <QuestionEditorCard
                                    key={q.id}
                                    question={q}
                                    index={i}
                                    total={questions.length}
                                    showAnswers={showAnswers}
                                    onEdit={() => setAddEditModal({ open: true, mode: 'edit', index: i })}
                                    onDelete={() => handleDelete(i)}
                                    onDuplicate={() => handleDuplicate(i)}
                                    onMoveUp={() => handleMoveUp(i)}
                                    onMoveDown={() => handleMoveDown(i)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modals ── */}
            {addEditModal.open && (
                <QuestionModal
                    isOpen={true}
                    initialQuestion={currentQuestion}
                    globalTimeLimit={20}
                    onSave={(question) => handleSaveQuestion(question, addEditModal.index)}
                    onClose={() => setAddEditModal({ open: false, mode: 'add', index: null })}
                />
            )}

            {csvOpen && (
                <CsvImportModal
                    onImport={handleCsvImport}
                    onClose={() => setCsvOpen(false)}
                />
            )}
        </TeacherLayout>
    )
}