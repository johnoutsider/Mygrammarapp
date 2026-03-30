'use client'

import { useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import TeacherLayout from '@/components/TeacherLayout'
import SpeakingAssignmentForm from '@/components/speaking/SpeakingAssignmentForm'
import { auth } from '@/lib/firebase'
import {
    activateSpeakingAssignment,
    createSpeakingAssignment,
    listSpeakingAssignments,
    listSpeakingTopics,
    SpeakingAssignment,
} from '@/lib/speakingService'

const TEAL = '#1D9E75'

export default function TeacherSpeakingPage() {
    const [user, authLoading] = useAuthState(auth)
    const [assignments, setAssignments] = useState<SpeakingAssignment[]>([])
    const [topics, setTopics] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activatingId, setActivatingId] = useState<string | null>(null)

    const loadData = async () => {
        try {
            const teacherId = user?.uid
            if (!teacherId) {
                setAssignments([])
                setTopics([])
                return
            }
            const [nextAssignments, nextTopics] = await Promise.all([
                listSpeakingAssignments(teacherId),
                listSpeakingTopics(teacherId),
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
        if (authLoading) return
        void loadData()
    }, [authLoading, user?.uid])

    const handleCreate = async (input: {
        partLabel: string
        mainQuestion: string
        questionSteps: string[]
        closingLine: string
        prepSeconds: number
        speakingSeconds: number
    }) => {
        const teacherId = user?.uid
        if (!teacherId) throw new Error('You must be signed in as a teacher.')

        await createSpeakingAssignment({
            teacherId,
            partLabel: input.partLabel,
            mainQuestion: input.mainQuestion,
            closingLine: input.closingLine,
            questionSteps: input.questionSteps.map((text, index) => ({
                id: `step-${index + 1}`,
                text,
            })),
            prepSeconds: input.prepSeconds,
            speakingSeconds: input.speakingSeconds,
            isActive: true,
        }, teacherId)

        await loadData()
    }

    const handleActivate = async (assignmentId: string) => {
        setActivatingId(assignmentId)
        try {
            await activateSpeakingAssignment(assignmentId, user?.uid)
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
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Speaking Practice</h1>
                    <p className="text-sm text-slate-500 mt-1">Create linked speaking questions for students.</p>
                </div>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {loading || authLoading ? (
                    <div className="py-16 flex justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: TEAL }} />
                    </div>
                ) : (
                    <>
                        {/* ── Create prompt form ── */}
                        <SpeakingAssignmentForm topics={topics} onSubmit={handleCreate} />

                        {/* ── Saved prompts ── */}
                        {assignments.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-slate-800">Saved Prompts</h2>
                                    <span className="text-xs text-slate-400">{assignments.length} prompt{assignments.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex flex-col gap-4">
                                    {assignments.map(assignment => (
                                        <div key={assignment.id}
                                            className={`rounded-xl border overflow-hidden ${assignment.isActive ? 'border-emerald-200' : 'border-slate-200'}`}>

                                            {/* Card header */}
                                            <div className={`px-4 py-3 flex items-center justify-between gap-3 ${assignment.isActive ? 'bg-emerald-50/60' : 'bg-slate-50'}`}>
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <span className="text-sm font-semibold text-slate-800 truncate">{assignment.partLabel}</span>
                                                    {assignment.isActive && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex-shrink-0">Active</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs text-slate-400">Prep {assignment.prepSeconds}s · Speak {assignment.speakingSeconds}s</span>
                                                    <button
                                                        onClick={() => void handleActivate(assignment.id)}
                                                        disabled={assignment.isActive || activatingId === assignment.id}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        style={{ background: assignment.isActive ? '#94a3b8' : TEAL }}
                                                    >
                                                        {assignment.isActive ? 'Active' : activatingId === assignment.id ? 'Activating…' : 'Set Active'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Cue card body */}
                                            <div className="px-5 py-4 space-y-2.5" style={{ background: '#EEF3FA', borderTop: '1px solid #C8D8E8' }}>
                                                {assignment.mainQuestion ? (
                                                    <p className="text-slate-800 text-sm font-medium leading-relaxed">{assignment.mainQuestion}</p>
                                                ) : (
                                                    <p className="text-slate-600 text-sm font-medium leading-relaxed">{assignment.questionSteps[0]?.text}</p>
                                                )}
                                                {assignment.questionSteps.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <p className="text-slate-700 text-sm">You should say:</p>
                                                        <ul className="space-y-1">
                                                            {assignment.questionSteps.map((step, i) => (
                                                                <li key={step.id ?? i} className="flex items-start gap-2.5">
                                                                    <span className="text-[#C0392B] text-xs mt-0.5 font-bold flex-shrink-0">▶</span>
                                                                    <span className="text-[#7B3535] text-sm leading-snug">{step.text}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {assignment.closingLine && (
                                                    <p className="text-slate-700 text-sm">{assignment.closingLine}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </TeacherLayout>
    )
}
