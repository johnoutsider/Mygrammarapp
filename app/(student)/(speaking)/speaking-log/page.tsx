'use client'

import { useEffect, useState } from 'react'
import StudentLayout from '@/components/StudentLayout'
import SpeakingResponseCard from '@/components/speaking/SpeakingResponseCard'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { auth } from '@/lib/firebase'
import { listStudentSpeakingResponses, SpeakingResponse } from '@/lib/speakingService'

export default function SpeakingLogPage() {
    useAccessGuard()

    const [responses, setResponses] = useState<SpeakingResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadResponses = async () => {
            if (!auth.currentUser) {
                setLoading(false)
                return
            }

            try {
                const nextResponses = await listStudentSpeakingResponses(auth.currentUser.uid)
                setResponses(nextResponses)
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load your speaking log.')
            } finally {
                setLoading(false)
            }
        }

        void loadResponses()
    }, [])

    return (
        <StudentLayout title="Speaking Log">
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Speaking Log</h1>
                    <p className="text-sm text-slate-500 mt-1">Review each linked question and the transcript captured for that step.</p>
                </div>

                {loading && (
                    <div className="min-h-[30vh] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
                )}

                {!loading && !error && responses.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800">No Speaking Attempts Yet</h2>
                        <p className="text-sm text-slate-500 mt-2">Complete a speaking session and your answer will appear here.</p>
                    </div>
                )}

                {!loading && !error && responses.map(response => (
                    <div key={response.id} className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
                            <div>{response.questionLabel || response.partLabel}</div>
                            <div>{response.warningCount} warning{response.warningCount !== 1 ? 's' : ''}</div>
                        </div>
                        <SpeakingResponseCard
                            questionLabel={response.questionLabel || 'Question'}
                            questionText={response.questionText}
                            studentLabel="Student"
                            studentAnswer={response.transcript}
                        />
                    </div>
                ))}
            </div>
        </StudentLayout>
    )
}
