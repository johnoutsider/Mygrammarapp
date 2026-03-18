'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StudentLayout from '@/components/StudentLayout'
import SpeakingCountdownRing from '@/components/speaking/SpeakingCountdownRing'
import SpeakingPromptBubble from '@/components/speaking/SpeakingPromptBubble'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { getActiveSpeakingAssignment, getSpeakingAssignmentById, SpeakingAssignment } from '@/lib/speakingService'

function getValidStep(stepParam: string | null, totalSteps: number): number {
    const parsed = Number(stepParam ?? '0')
    if (!Number.isInteger(parsed) || parsed < 0) return 0
    if (parsed >= totalSteps) return Math.max(totalSteps - 1, 0)
    return parsed
}

export default function SpeakingPracticePage() {
    useAccessGuard()

    const router = useRouter()
    const searchParams = useSearchParams()
    const assignmentId = searchParams.get('assignmentId')
    const [assignment, setAssignment] = useState<SpeakingAssignment | null>(null)
    const [remainingSeconds, setRemainingSeconds] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const currentStepIndex = useMemo(() => {
        return getValidStep(searchParams.get('step'), assignment?.questionSteps.length ?? 1)
    }, [assignment?.questionSteps.length, searchParams])

    const currentStep = assignment?.questionSteps[currentStepIndex] ?? null

    useEffect(() => {
        const loadAssignment = async () => {
            try {
                const nextAssignment = assignmentId
                    ? await getSpeakingAssignmentById(assignmentId)
                    : await getActiveSpeakingAssignment()
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
    }, [assignmentId])

    useEffect(() => {
        if (!assignment) return
        setRemainingSeconds(assignment.prepSeconds)
    }, [assignment, currentStepIndex])

    useEffect(() => {
        if (!assignment || !currentStep || remainingSeconds <= 0) return

        const timer = setInterval(() => {
            setRemainingSeconds(current => {
                if (current <= 1) {
                    clearInterval(timer)
                    router.push(`/speaking-practice/session/${assignment.id}?step=${currentStepIndex}`)
                    return 0
                }
                return current - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [assignment, currentStep, currentStepIndex, remainingSeconds, router])

    if (loading) {
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
            <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
                <SpeakingPromptBubble
                    label={`${assignment.partLabel} � Step ${currentStepIndex + 1} of ${assignment.questionSteps.length}`}
                    text={currentStep.text}
                />

                <div className="flex justify-center">
                    <SpeakingCountdownRing
                        remainingSeconds={remainingSeconds}
                        totalSeconds={assignment.prepSeconds}
                        label="Preparation Time"
                        sublabel="Each linked question is given step by step"
                    />
                </div>

                <div className="flex justify-center gap-3">
                    <button
                        onClick={() => router.push(`/speaking-practice/session/${assignment.id}?step=${currentStepIndex}`)}
                        className="px-6 py-3 rounded-xl bg-[#4c75c3] hover:bg-[#3f64ab] text-white font-semibold"
                    >
                        Start This Step
                    </button>
                    <button
                        onClick={() => router.push('/speaking-log')}
                        className="px-6 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
                    >
                        Open My Speaking Log
                    </button>
                </div>
            </div>
        </StudentLayout>
    )
}
