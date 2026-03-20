'use client'

import { useEffect, useRef, useState } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import SpeakingAssignmentForm from '@/components/speaking/SpeakingAssignmentForm'
import { auth } from '@/lib/firebase'
import {
    activateSpeakingAssignment,
    addSpeakingTopic,
    createSpeakingAssignment,
    deleteSpeakingTopic,
    listSpeakingAssignments,
    listSpeakingTopics,
    SpeakingAssignment,
} from '@/lib/speakingService'

function formatSeconds(seconds: number): string {
    return `${seconds}s`
}

export default function TeacherSpeakingPage() {
    const [assignments, setAssignments] = useState<SpeakingAssignment[]>([])
    const [topics, setTopics] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activatingId, setActivatingId] = useState<string | null>(null)
    const [newTopic, setNewTopic] = useState('')
    const [addingTopic, setAddingTopic] = useState(false)
    const topicInputRef = useRef<HTMLInputElement>(null)

    const loadData = async () => {
        try {
            const [nextAssignments, nextTopics] = await Promise.all([
                listSpeakingAssignments(),
                listSpeakingTopics(),
            ])
            setAssignments(nextAssignments)
            setTopics(nextTopics)
            setError(null)
        } catch (loadError) {
            console.error(loadError)
            setError('Failed to load speaking data.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadData()
    }, [])

    const handleAddTopic = async () => {
        const trimmed = newTopic.trim()
        if (!trimmed) return
        setAddingTopic(true)
        try {
            const updated = await addSpeakingTopic(trimmed)
            setTopics(updated)
            setNewTopic('')
            topicInputRef.current?.focus()
        } catch (err) {
            console.error(err)
            setError('Failed to add topic.')
        } finally {
            setAddingTopic(false)
        }
    }

    const handleDeleteTopic = async (topic: string) => {
        try {
            const updated = await deleteSpeakingTopic(topic)
            setTopics(updated)
        } catch (err) {
            console.error(err)
            setError('Failed to delete topic.')
        }
    }

    const handleCreate = async (input: {
        partLabel: string
        questionSteps: string[]
        prepSeconds: number
        speakingSeconds: number
    }) => {
        const teacherId = auth.currentUser?.uid
        if (!teacherId) throw new Error('You must be signed in as a teacher.')

        await createSpeakingAssignment({
            teacherId,
            partLabel: input.partLabel,
            questionSteps: input.questionSteps.map((text, index) => ({
                id: `step-${index + 1}`,
                text,
            })),
            prepSeconds: input.prepSeconds,
            speakingSeconds: input.speakingSeconds,
            isActive: true,
        })

        await loadData()
    }

    const handleActivate = async (assignmentId: string) => {
        setActivatingId(assignmentId)
        try {
            await activateSpeakingAssignment(assignmentId)
            await loadData()
        } catch (activateError) {
            console.error(activateError)
            setError('Failed to activate the selected prompt.')
        } finally {
            setActivatingId(null)
        }
    }

    return (
        <TeacherLayout title="Speaking">
            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Speaking Practice</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage topics and create linked speaking questions for students.</p>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {/* ── Topics management ── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Topics</h2>
                        <p className="text-sm text-slate-500 mt-1">Add topics that students will practice. Each prompt is linked to one topic.</p>
                    </div>

                    {/* Add topic input */}
                    <div className="flex gap-2">
                        <input
                            ref={topicInputRef}
                            type="text"
                            value={newTopic}
                            onChange={e => setNewTopic(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAddTopic() } }}
                            placeholder="e.g. IELTS Part 1 — Daily Life"
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                            style={{ backgroundColor: '#ffffff', color: '#334155', colorScheme: 'light' }}
                        />
                        <button
                            type="button"
                            onClick={() => void handleAddTopic()}
                            disabled={addingTopic || !newTopic.trim()}
                            className="px-4 py-2.5 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {addingTopic ? 'Adding...' : 'Add Topic'}
                        </button>
                    </div>

                    {/* Topic list */}
                    {loading ? (
                        <div className="py-6 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a9aaa]" />
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-400 text-center">
                            No topics yet. Add your first topic above.
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {topics.map(topic => (
                                <div key={topic} className="flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-100 px-3 py-1.5">
                                    <span className="text-sm font-medium text-teal-800">{topic}</span>
                                    <button
                                        type="button"
                                        onClick={() => void handleDeleteTopic(topic)}
                                        className="text-teal-400 hover:text-red-500 transition-colors leading-none text-base"
                                        aria-label={`Remove ${topic}`}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Create prompt form ── */}
                <SpeakingAssignmentForm topics={topics} onSubmit={handleCreate} />

                {/* ── Saved prompts ── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800">Saved Prompts</h2>
                        <div className="text-sm text-slate-400">{assignments.length} prompt{assignments.length !== 1 ? 's' : ''}</div>
                    </div>

                    {loading ? (
                        <div className="py-10 flex justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a9aaa]" />
                        </div>
                    ) : assignments.length === 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-8 text-sm text-slate-500 text-center">
                            No speaking prompts created yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {assignments.map(assignment => (
                                <div key={assignment.id} className={`rounded-2xl border px-5 py-5 ${assignment.isActive ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="rounded-full bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 text-xs font-semibold">
                                                    {assignment.partLabel}
                                                </span>
                                                {assignment.isActive && (
                                                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">Active</span>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                {assignment.questionSteps.map((step, i) => (
                                                    <div key={step.id} className="text-sm text-slate-700">
                                                        <span className="font-semibold text-slate-400 mr-2">Q{i + 1}.</span>{step.text}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                                <span>{assignment.questionSteps.length} question{assignment.questionSteps.length !== 1 ? 's' : ''}</span>
                                                <span>Prep: {formatSeconds(assignment.prepSeconds)}</span>
                                                <span>Speak: {formatSeconds(assignment.speakingSeconds)}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => void handleActivate(assignment.id)}
                                            disabled={assignment.isActive || activatingId === assignment.id}
                                            className="px-4 py-2 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {assignment.isActive ? 'Active' : activatingId === assignment.id ? 'Activating...' : 'Set Active'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </TeacherLayout>
    )
}
