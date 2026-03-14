'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import {
    collection, addDoc, deleteDoc, doc, onSnapshot,
    serverTimestamp, query, orderBy, updateDoc,
    writeBatch, Timestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import TeacherLayout from '@/components/TeacherLayout'
import Alert from '@/components/Alert'

interface Topic {
    id: string
    name: string
    createdAt: any
    order?: number
    essayDeadline?: Timestamp | null
    reviewDeadline?: Timestamp | null
    subtopics?: string[]
}

function tsToDateStr(ts?: Timestamp | null): string {
    if (!ts) return ''
    const d = ts.toDate()
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ManageTopics() {
    const router = useRouter()
    const [topics, setTopics] = useState<Topic[]>([])
    const [newTopic, setNewTopic] = useState('')
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [reordering, setReordering] = useState(false)

    // Per-topic deadline editing state
    const [editing, setEditing] = useState<Record<string, {
        essayDeadline: string; reviewDeadline: string; saving: boolean
    }>>({})

    // Per-topic name renaming state
    const [renaming, setRenaming] = useState<Record<string, {
        value: string; active: boolean; saving: boolean
    }>>({})

    // ── NEW: Per-topic subtopic state ───────────────────────────────────────
    const [subtopicInputs, setSubtopicInputs] = useState<Record<string, string>>({})
    const [subtopicAdding, setSubtopicAdding] = useState<Record<string, boolean>>({})
    const [subtopicDeleting, setSubtopicDeleting] = useState<Record<string, string | null>>({})
    const [expandedSubtopics, setExpandedSubtopics] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (!auth.currentUser) { router.push('/'); return }
        const q = query(collection(db, 'topics'), orderBy('createdAt', 'asc'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Topic[]
            const sorted = [...data].sort((a, b) => {
                if (a.order !== undefined && b.order !== undefined) return a.order - b.order
                if (a.order !== undefined) return -1
                if (b.order !== undefined) return 1
                return 0
            })
            setTopics(sorted)
            setEditing(prev => {
                const next = { ...prev }
                data.forEach(t => {
                    if (!next[t.id]) {
                        next[t.id] = {
                            essayDeadline: tsToDateStr(t.essayDeadline),
                            reviewDeadline: tsToDateStr(t.reviewDeadline),
                            saving: false,
                        }
                    }
                })
                return next
            })
            setLoading(false)
        }, (err) => {
            console.error('Error loading topics:', err)
            setLoading(false)
        })
        return () => unsubscribe()
    }, [router])

    // ── Reorder ─────────────────────────────────────────────────────────────
    const moveTopic = async (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= topics.length) return
        const next = [...topics]
            ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
        setTopics(next)
        setReordering(true)
        try {
            const batch = writeBatch(db)
            next.forEach((topic, idx) => batch.update(doc(db, 'topics', topic.id), { order: idx }))
            await batch.commit()
        } catch (err) {
            console.error('Error saving order:', err)
            setError('Failed to save order.')
        } finally {
            setReordering(false)
        }
    }

    // ── Add topic ────────────────────────────────────────────────────────────
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        const name = newTopic.trim()
        if (!name) return
        if (topics.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            setError('A topic with this name already exists.')
            return
        }
        setAdding(true); setError(null)
        try {
            await addDoc(collection(db, 'topics'), {
                name,
                createdBy: auth.currentUser!.uid,
                createdAt: serverTimestamp(),
                order: topics.length,
                essayDeadline: null,
                reviewDeadline: null,
                subtopics: [],              // ← always initialise empty array
            })
            setNewTopic('')
            setSuccess(`Topic "${name}" added!`)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            console.error(err)
            setError('Failed to add topic.')
        } finally {
            setAdding(false)
        }
    }

    // ── Delete topic ─────────────────────────────────────────────────────────
    const handleDelete = async (topicId: string, topicName: string) => {
        if (!confirm(`Delete topic "${topicName}"? Essays already submitted under it will keep their category.`)) return
        try {
            await deleteDoc(doc(db, 'topics', topicId))
        } catch (err) {
            setError('Failed to delete topic.')
        }
    }

    // ── Save deadlines ────────────────────────────────────────────────────────
    const handleSaveDeadlines = async (topicId: string) => {
        const state = editing[topicId]
        if (!state) return
        setEditing(prev => ({ ...prev, [topicId]: { ...prev[topicId], saving: true } }))
        try {
            const toTs = (s: string) => s ? Timestamp.fromDate(new Date(s)) : null
            await updateDoc(doc(db, 'topics', topicId), {
                essayDeadline: toTs(state.essayDeadline),
                reviewDeadline: toTs(state.reviewDeadline),
            })
            setSuccess('Deadlines saved!')
            setTimeout(() => setSuccess(null), 2500)
        } catch (err) {
            setError('Failed to save deadlines.')
        } finally {
            setEditing(prev => ({ ...prev, [topicId]: { ...prev[topicId], saving: false } }))
        }
    }

    const setField = (topicId: string, field: 'essayDeadline' | 'reviewDeadline', value: string) =>
        setEditing(prev => ({ ...prev, [topicId]: { ...prev[topicId], [field]: value } }))

    // ── Rename topic ──────────────────────────────────────────────────────────
    const startRename = (topic: Topic) =>
        setRenaming(prev => ({ ...prev, [topic.id]: { value: topic.name, active: true, saving: false } }))

    const cancelRename = (topicId: string) =>
        setRenaming(prev => ({ ...prev, [topicId]: { ...prev[topicId], active: false } }))

    const handleRenameTopic = async (topicId: string) => {
        const state = renaming[topicId]
        if (!state) return
        const newName = state.value.trim()
        if (!newName) { setError('Topic name cannot be empty.'); return }
        if (topics.some(t => t.id !== topicId && t.name.toLowerCase() === newName.toLowerCase())) {
            setError('A topic with this name already exists.'); return
        }
        setRenaming(prev => ({ ...prev, [topicId]: { ...prev[topicId], saving: true } }))
        try {
            await updateDoc(doc(db, 'topics', topicId), { name: newName })
            setRenaming(prev => ({ ...prev, [topicId]: { value: newName, active: false, saving: false } }))
            setSuccess('Topic name updated!')
            setTimeout(() => setSuccess(null), 2500)
        } catch (err) {
            setError('Failed to rename topic.')
            setRenaming(prev => ({ ...prev, [topicId]: { ...prev[topicId], saving: false } }))
        }
    }

    // ── NEW: Add subtopic ─────────────────────────────────────────────────────
    const handleAddSubtopic = async (topicId: string) => {
        const value = (subtopicInputs[topicId] || '').trim()
        if (!value) return
        const topic = topics.find(t => t.id === topicId)
        if (topic?.subtopics?.map(s => s.toLowerCase()).includes(value.toLowerCase())) {
            setError('This subtopic already exists.'); return
        }
        setSubtopicAdding(prev => ({ ...prev, [topicId]: true }))
        try {
            await updateDoc(doc(db, 'topics', topicId), { subtopics: arrayUnion(value) })
            setSubtopicInputs(prev => ({ ...prev, [topicId]: '' }))
            setSuccess(`Subtopic "${value}" added!`)
            setTimeout(() => setSuccess(null), 2000)
        } catch (err) {
            setError('Failed to add subtopic.')
        } finally {
            setSubtopicAdding(prev => ({ ...prev, [topicId]: false }))
        }
    }

    // ── NEW: Delete subtopic ──────────────────────────────────────────────────
    const handleDeleteSubtopic = async (topicId: string, subtopic: string) => {
        setSubtopicDeleting(prev => ({ ...prev, [topicId]: subtopic }))
        try {
            await updateDoc(doc(db, 'topics', topicId), { subtopics: arrayRemove(subtopic) })
        } catch (err) {
            setError('Failed to delete subtopic.')
        } finally {
            setSubtopicDeleting(prev => ({ ...prev, [topicId]: null }))
        }
    }

    return (
        <TeacherLayout title="Topics">
            <div className="p-6 max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 mb-0.5">Manage Topics</h1>
                    <p className="text-slate-400 text-sm">Create topics & subtopics for students to categorise their quizzes</p>
                </div>

                {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
                {success && <Alert type="success" message={success} />}

                {/* Add Topic Form */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm mb-6">
                    <h2 className="text-base font-semibold text-slate-700 mb-3">Add New Topic</h2>
                    <form onSubmit={handleAdd} className="flex gap-3">
                        <input
                            type="text"
                            value={newTopic}
                            onChange={e => setNewTopic(e.target.value)}
                            placeholder="e.g. Present Perfect, Conditionals, Articles…"
                            className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-teal-500 transition-colors text-sm"
                            maxLength={80}
                        />
                        <button
                            type="submit"
                            disabled={adding || !newTopic.trim()}
                            className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap text-sm"
                        >
                            {adding ? 'Adding…' : '+ Add Topic'}
                        </button>
                    </form>
                </div>

                {/* Topics List */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-700">All Topics</h2>
                        <div className="flex items-center gap-3">
                            {reordering && (
                                <span className="text-xs text-teal-500 flex items-center gap-1.5">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-teal-500" />
                                    Saving order…
                                </span>
                            )}
                            <span className="text-sm text-slate-400">{topics.length} topic{topics.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="py-16 text-center text-gray-500">
                            <div className="text-5xl mb-4">🗂️</div>
                            <p>No topics yet. Add your first one above!</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {topics.map((topic, index) => {
                                const ed = editing[topic.id] || { essayDeadline: '', reviewDeadline: '', saving: false }
                                const essayD = ed.essayDeadline ? new Date(ed.essayDeadline) : null
                                const reviewD = ed.reviewDeadline ? new Date(ed.reviewDeadline) : null
                                const now = Date.now()
                                const rn = renaming[topic.id]
                                const isRenaming = rn?.active
                                const subtopics = topic.subtopics || []
                                const subExpanded = expandedSubtopics[topic.id] ?? false

                                const deadlinePill = (d: Date | null, label: string, color: string) => {
                                    if (!d) return <span className="text-xs text-gray-500">No {label} deadline</span>
                                    const days = Math.ceil((d.getTime() - now) / 86400000)
                                    const cl = days <= 0 ? 'text-red-400' : days <= 3 ? 'text-orange-400' : days <= 7 ? 'text-yellow-400' : `text-${color}-400`
                                    return (
                                        <span className={`text-xs font-medium ${cl}`}>
                                            {days <= 0 ? '🔒 Expired' : `⏳ ${days}d left`} · {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )
                                }

                                return (
                                    <li key={topic.id} className="px-6 py-5 hover:bg-slate-50 transition-colors">

                                        {/* ── Row 1: reorder + name + rename + delete ── */}
                                        <div className="flex items-center justify-between mb-3 gap-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="flex flex-col gap-0.5 shrink-0">
                                                    <button onClick={() => moveTopic(index, 'up')} disabled={index === 0 || reordering}
                                                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-all text-xs" title="Move up">▲</button>
                                                    <button onClick={() => moveTopic(index, 'down')} disabled={index === topics.length - 1 || reordering}
                                                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-all text-xs" title="Move down">▼</button>
                                                </div>
                                                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />

                                                {isRenaming ? (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input
                                                            autoFocus
                                                            value={rn.value}
                                                            onChange={e => setRenaming(prev => ({ ...prev, [topic.id]: { ...prev[topic.id], value: e.target.value } }))}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleRenameTopic(topic.id); if (e.key === 'Escape') cancelRename(topic.id) }}
                                                            className="flex-1 bg-white text-slate-800 border border-teal-500 rounded-lg px-3 py-1.5 text-base font-semibold focus:outline-none"
                                                            maxLength={80}
                                                        />
                                                        <button onClick={() => handleRenameTopic(topic.id)} disabled={rn.saving}
                                                            className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap">
                                                            {rn.saving ? <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Saving…</> : '✓ Save'}
                                                        </button>
                                                        <button onClick={() => cancelRename(topic.id)}
                                                            className="text-slate-400 hover:text-slate-600 text-sm px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">✕</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-slate-800 font-semibold text-base truncate">{topic.name}</span>
                                                        <button onClick={() => startRename(topic)} title="Rename topic"
                                                            className="text-slate-400 hover:text-blue-400 transition-colors p-1 rounded">✏️</button>
                                                    </>
                                                )}
                                            </div>
                                            {!isRenaming && (
                                                <button onClick={() => handleDelete(topic.id, topic.name)}
                                                    className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded hover:bg-red-500/10 transition-all shrink-0">
                                                    Delete
                                                </button>
                                            )}
                                        </div>

                                        {/* ── Row 2: SUBTOPICS section ── */}
                                        <div className="pl-8 mb-3">
                                            <button
                                                onClick={() => setExpandedSubtopics(prev => ({ ...prev, [topic.id]: !subExpanded }))}
                                                className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-2 transition-colors"
                                            >
                                                <span className={`transition-transform inline-block ${subExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                🔖 Subtopics
                                                <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                                    {subtopics.length}
                                                </span>
                                            </button>

                                            {subExpanded && (
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                    {/* Existing subtopics */}
                                                    {subtopics.length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic mb-3">No subtopics yet — add one below.</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            {subtopics.map((sub, si) => (
                                                                <span
                                                                    key={si}
                                                                    className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm"
                                                                >
                                                                    {sub}
                                                                    <button
                                                                        onClick={() => handleDeleteSubtopic(topic.id, sub)}
                                                                        disabled={subtopicDeleting[topic.id] === sub}
                                                                        className="text-slate-300 hover:text-red-500 transition-colors ml-0.5 disabled:opacity-40"
                                                                        title={`Delete "${sub}"`}
                                                                    >
                                                                        {subtopicDeleting[topic.id] === sub
                                                                            ? <span className="animate-spin inline-block">⏳</span>
                                                                            : '×'}
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Add new subtopic */}
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Past Simple, Reported Speech…"
                                                            value={subtopicInputs[topic.id] || ''}
                                                            onChange={e => setSubtopicInputs(prev => ({ ...prev, [topic.id]: e.target.value }))}
                                                            onKeyDown={e => e.key === 'Enter' && handleAddSubtopic(topic.id)}
                                                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 transition-colors"
                                                            maxLength={60}
                                                        />
                                                        <button
                                                            onClick={() => handleAddSubtopic(topic.id)}
                                                            disabled={!subtopicInputs[topic.id]?.trim() || subtopicAdding[topic.id]}
                                                            className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 whitespace-nowrap"
                                                        >
                                                            {subtopicAdding[topic.id] ? '…' : '+ Add'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Row 3: deadline pickers ── */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8">
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                <label className="block text-xs text-slate-400 mb-1.5 font-semibold uppercase tracking-wide">
                                                    📝 Essay Submission Deadline
                                                </label>
                                                {deadlinePill(essayD, 'essay', 'blue')}
                                                <input
                                                    type="datetime-local"
                                                    value={ed.essayDeadline}
                                                    onChange={e => setField(topic.id, 'essayDeadline', e.target.value)}
                                                    className="mt-2 w-full bg-white text-slate-700 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500"
                                                />
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                <label className="block text-xs text-slate-400 mb-1.5 font-semibold uppercase tracking-wide">
                                                    👥 Peer Review Deadline
                                                </label>
                                                {deadlinePill(reviewD, 'review', 'purple')}
                                                <input
                                                    type="datetime-local"
                                                    value={ed.reviewDeadline}
                                                    onChange={e => setField(topic.id, 'reviewDeadline', e.target.value)}
                                                    className="mt-2 w-full bg-white text-slate-700 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500"
                                                />
                                            </div>
                                        </div>

                                        {/* ── Row 4: Save deadlines button ── */}
                                        <div className="mt-3 flex justify-end pl-7">
                                            <button
                                                onClick={() => handleSaveDeadlines(topic.id)}
                                                disabled={ed.saving}
                                                className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {ed.saving
                                                    ? <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-300" />Saving…</>
                                                    : '💾 Save Deadlines'}
                                            </button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <p className="text-slate-400 text-xs mt-4 text-center">
                    💡 Use ▲▼ to reorder topics · Subtopics appear in students' quiz creator · Deleting won't affect existing quizzes
                </p>
            </div>
        </TeacherLayout>
    )
}
