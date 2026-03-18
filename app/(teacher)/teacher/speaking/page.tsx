'use client'

import { useEffect, useState } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import SpeakingAssignmentForm from '@/components/speaking/SpeakingAssignmentForm'
import { auth } from '@/lib/firebase'
import {
    activateSpeakingAssignment,
    createSpeakingAssignment,
    listSpeakingAssignments,
    SpeakingAssignment,
} from '@/lib/speakingService'

function formatSeconds(seconds: number): string {
    return `${seconds}s`
}

export default function TeacherSpeakingPage() {
    const [assignments, setAssignments] = useState<SpeakingAssignment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activatingId, setActivatingId] = useState<string | null>(null)

    const loadAssignments = async () => {
        try {
            const nextAssignments = await listSpeakingAssignments()
            setAssignments(nextAssignments)
            setError(null)
        } catch (loadError) {
            console.error(loadError)
            setError('Failed to load speaking prompts.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadAssignments()
    }, [])

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

        await loadAssignments()
    }

    const handleActivate = async (assignmentId: string) => {
        setActivatingId(assignmentId)
        try {
            await activateSpeakingAssignment(assignmentId)
            await loadAssignments()
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
                    <p className="text-sm text-slate-500 mt-1">Create linked speaking questions in sequence and publish them to speaking students step by step.</p>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                <SpeakingAssignmentForm onSubmit={handleCreate} />

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
                                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{assignment.partLabel}</span>
                                                {assignment.isActive && (
                                                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">Active</span>
                                                )}
                                            </div>
                                            <div className="text-xl text-slate-900">{assignment.questionSteps[0]?.text || assignment.questionText}</div>
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                                <span>{assignment.questionSteps.length} linked question{assignment.questionSteps.length !== 1 ? 's' : ''}</span>
                                                <span>Prep: {formatSeconds(assignment.prepSeconds)}</span>
                                                <span>Speak: {formatSeconds(assignment.speakingSeconds)}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => void handleActivate(assignment.id)}
                                            disabled={assignment.isActive || activatingId === assignment.id}
                                            className="px-4 py-2 rounded-xl bg-[#1a9aaa] hover:bg-[#127080] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {assignment.isActive ? 'Active Prompt' : activatingId === assignment.id ? 'Activating...' : 'Set Active'}
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
