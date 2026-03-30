'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import StudentLayout from '@/components/StudentLayout'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { listPublishedSpeakingTopics } from '@/lib/guidedSpeakingService'

export default function StudentGuidedSpeakingTopicsPage() {
    useAccessGuard()

    const [topics, setTopics] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const loadTopics = async () => {
            try {
                const nextTopics = await listPublishedSpeakingTopics()
                setTopics(nextTopics)
                setError('')
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load guided speaking topics.')
            } finally {
                setLoading(false)
            }
        }

        void loadTopics()
    }, [])

    return (
        <StudentLayout title="Guided Speaking">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <div className="space-y-6">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <h1 className="text-2xl font-semibold text-slate-900">Guided Speaking Topics</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Pick a published topic to start the new guided speaking practice session.
                        </p>
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {loading ? (
                        <div className="flex min-h-[40vh] items-center justify-center">
                            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-500" />
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="rounded-[28px] border border-slate-200 bg-white px-8 py-12 text-center shadow-sm">
                            <h2 className="text-xl font-semibold text-slate-900">No topics are published yet</h2>
                            <p className="mt-2 text-sm text-slate-500">
                                Ask your teacher to publish a speaking topic before starting the guided activity.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {topics.map(topic => (
                                <Link
                                    key={topic.id}
                                    href={`/student/speaking/${topic.id}`}
                                    className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
                                                Published Topic
                                            </p>
                                            <h2 className="mt-3 text-xl font-semibold text-slate-900">{topic.title}</h2>
                                        </div>
                                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                            Live
                                        </span>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
                                        <span>{topic.questionCount} question{topic.questionCount === 1 ? '' : 's'}</span>
                                        <span className="font-medium text-sky-600 transition group-hover:text-sky-700">
                                            Start Practice
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </StudentLayout>
    )
}
