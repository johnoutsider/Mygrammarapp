'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthState } from 'react-firebase-hooks/auth'
import StudentLayout from '@/components/StudentLayout'
import SpeakingCountdownRing from '@/components/speaking/SpeakingCountdownRing'
import SpeakingPromptBubble from '@/components/speaking/SpeakingPromptBubble'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { auth } from '@/lib/firebase'
import {
    getStudentActiveSpeakingAssignment,
    getStudentSpeakingAssignmentById,
    SpeakingAssignment,
} from '@/lib/speakingService'

function getValidStep(stepParam: string | null, totalSteps: number): number {
    const parsed = Number(stepParam ?? '0')
    if (!Number.isInteger(parsed) || parsed < 0) return 0
    if (parsed >= totalSteps) return Math.max(totalSteps - 1, 0)
    return parsed
}

function SpeakingPracticeContent() {
    useAccessGuard()

    const router = useRouter()
    const searchParams = useSearchParams()
    const assignmentId = searchParams.get('assignmentId')
    const stepParam = searchParams.get('step')
    const [user, authLoading] = useAuthState(auth)
    const [assignment, setAssignment] = useState<SpeakingAssignment | null>(null)
    const [remainingSeconds, setRemainingSeconds] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const currentStepIndex = useMemo(() => {
        return getValidStep(stepParam, assignment?.questionSteps.length ?? 1)
    }, [assignment?.questionSteps.length, stepParam])

    const currentStep = assignment?.questionSteps[currentStepIndex] ?? null

    useEffect(() => {
        if (authLoading) return

        const loadAssignment = async () => {
            if (!user?.uid) {
                setAssignment(null)
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                const nextAssignment = assignmentId
                    ? await getStudentSpeakingAssignmentById(assignmentId, user.uid)
                    : await getStudentActiveSpeakingAssignment(user.uid)

                if (assignmentId && nextAssignment && nextAssignment.id !== assignmentId) {
                    const nextParams = new URLSearchParams()
                    nextParams.set('assignmentId', nextAssignment.id)

                    if (stepParam) {
                        nextParams.set('step', stepParam)
                    }

                    router.replace(`/speaking-practice?${nextParams.toString()}`)
                }

                setAssignment(nextAssignment)
                setRemainingSeconds(nextAssignment?.prepSeconds ?? 0)
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load the active speaking prompt.')
            } finally {
                setLoading(false)
            }
        }

        void loadAssignment()
    }, [assignmentId, authLoading, router, stepParam, user?.uid])

    useEffect(() => {
        if (!assignment) return
        setRemainingSeconds(assignment.prepSeconds)
    }, [assignment, currentStepIndex])

    // If no devices are configured yet, redirect to device setup
    useEffect(() => {
        if (loading || !assignment) return
        const hasCamera = typeof window !== 'undefined' && sessionStorage.getItem('speaking_camera_id')
        const hasMic = typeof window !== 'undefined' && sessionStorage.getItem('speaking_mic_id')
        if (!hasCamera || !hasMic) {
            const nextParams = new URLSearchParams()
            nextParams.set('step', String(currentStepIndex))
            const dest = `/speaking-practice/session/${assignment.id}?${nextParams.toString()}`
            router.replace(dest)
        }
    }, [loading, assignment, currentStepIndex, router])

    useEffect(() => {
        if (!assignment || !currentStep || remainingSeconds <= 0) return

        const timer = setInterval(() => {
            setRemainingSeconds(current => {
                if (current <= 1) {
                    clearInterval(timer)
                    router.push(`/speaking-practice/session/${assignment.id}?step=${currentStepIndex}&skipSetup=true`)
                    return 0
                }
                return current - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [assignment, currentStep, currentStepIndex, remainingSeconds, router])

    if (loading || authLoading) {
        return (
            <StudentLayout title="Speaking Practice">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                </div>
            </StudentLayout>
        )
    }

    if (error) {
        return (
            <StudentLayout title="Speaking Practice">
                <div className="max-w-3xl mx-auto px-4 py-8">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 text-sm">{error}</div>
                </div>
            </StudentLayout>
        )
    }

    if (!assignment || !currentStep) {
        return (
            <StudentLayout title="Speaking Practice">
                <div className="max-w-3xl mx-auto px-4 py-8">
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
                        <h1 className="text-2xl font-bold text-slate-800">No Speaking Prompt Yet</h1>
                        <p className="text-sm text-slate-500 mt-2">Your teacher has not activated a speaking question yet.</p>
                    </div>
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="Speaking Practice">
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-lg w-full max-w-[560px] overflow-hidden">

                    {/* Step label */}
                    <div className="px-8 pt-8 pb-4 text-center">
                        <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                            {assignment.partLabel} &mdash; Step {currentStepIndex + 1} of {assignment.questionSteps.length}
                        </div>
                    </div>

                    {/* Cue card (if mainQuestion exists) or speech bubble (legacy) */}
                    {assignment.mainQuestion ? (
                        <div className="mx-6 rounded-xl border p-5 space-y-3" style={{ background: '#EEF3FA', borderColor: '#C8D8E8' }}>
                            <p className="text-slate-800 text-sm font-medium leading-relaxed">{assignment.mainQuestion}</p>
                            {assignment.questionSteps.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-slate-700 text-sm">You should say:</p>
                                    <ul className="space-y-1.5">
                                        {assignment.questionSteps.map((step, i) => (
                                            <li key={step.id ?? i} className={`flex items-start gap-2.5 ${i === currentStepIndex ? '' : 'opacity-50'}`}>
                                                <span className={`text-xs mt-0.5 font-bold flex-shrink-0 ${i === currentStepIndex ? 'text-[#C0392B]' : 'text-[#C0392B]'}`}>▶</span>
                                                <span className={`text-sm leading-snug ${i === currentStepIndex ? 'text-[#7B3535] font-medium' : 'text-[#7B3535]'}`}>{step.text}</span>
                                                {i === currentStepIndex && (
                                                    <span className="ml-1 text-[10px] font-semibold text-white bg-[#C0392B] rounded px-1.5 py-0.5 flex-shrink-0">NOW</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {assignment.closingLine && (
                                <p className="text-slate-700 text-sm">{assignment.closingLine}</p>
                            )}
                        </div>
                    ) : (
                        <div className="px-6">
                            <SpeakingPromptBubble text={currentStep.text} />
                        </div>
                    )}

                    {/* Circular countdown */}
                    <div className="flex flex-col items-center gap-1 px-8 py-6">
                        <SpeakingCountdownRing
                            remainingSeconds={remainingSeconds}
                            totalSeconds={assignment.prepSeconds}
                            label="Preparation Time"
                            sublabel="Use this time to think about your answer"
                            size={160}
                            strokeWidth={10}
                        />
                    </div>

                    {/* Start button */}
                    <div className="px-8 pb-8">
                        <button
                            onClick={() => router.push(`/speaking-practice/session/${assignment.id}?step=${currentStepIndex}&skipSetup=true`)}
                            className="w-full py-4 rounded-xl bg-[#5b7ec9] hover:bg-[#4a6db8] text-white font-semibold text-sm transition-colors"
                        >
                            Start This Step
                        </button>
                    </div>

                </div>
            </div>
        </StudentLayout>
    )
}

export default function SpeakingPracticePage() {
    return (
        <Suspense
            fallback={
                <StudentLayout title="Speaking Practice">
                    <div className="min-h-[60vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                    </div>
                </StudentLayout>
            }
        >
            <SpeakingPracticeContent />
        </Suspense>
    )
}
