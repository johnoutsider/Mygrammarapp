'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import TopicTitleModal from '@/components/guided-speaking/TopicTitleModal'
import {
    createSpeakingTopic,
    deleteSpeakingTopic,
    listTeacherSpeakingTopics,
    updateSpeakingTopicPublishState,
    type SharedSpeakingTopic,
} from '@/lib/guidedSpeakingService'
import { auth } from '@/lib/firebase'

interface TeacherTopicManagerProps {
    title: string
    description: string
    secondaryActionLabel?: string
    secondaryActionHref?: string
}

export default function TeacherTopicManager({
    title,
    description,
    secondaryActionLabel,
    secondaryActionHref,
}: TeacherTopicManagerProps) {
    const [user, authLoading] = useAuthState(auth)
    const [topics, setTopics] = useState<SharedSpeakingTopic[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [savingTopic, setSavingTopic] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [busyTopicId, setBusyTopicId] = useState('')

    const loadTopics = async () => {
        if (!user?.uid) {
            setLoading(false)
            return
        }

        try {
            const nextTopics = await listTeacherSpeakingTopics(user.uid)
            setTopics(nextTopics)
            setError('')
        } catch (loadError) {
            console.error(loadError)
            setError('Failed to load shared speaking topics.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (authLoading) return
        void loadTopics()
    }, [authLoading, user?.uid])

    const handleCreateTopic = async (topicTitle: string) => {
        if (!user?.uid) return

        setSavingTopic(true)
        try {
            const nextTopics = await createSpeakingTopic(topicTitle, user.uid)
            setTopics(nextTopics)
            setIsModalOpen(false)
            setError('')
        } catch (createError) {
            console.error(createError)
            setError('Failed to create the shared topic.')
        } finally {
            setSavingTopic(false)
        }
    }

    const handlePublishToggle = async (topic: SharedSpeakingTopic) => {
        setBusyTopicId(topic.id)
        try {
            await updateSpeakingTopicPublishState(topic.id, !topic.isPublished)
            await loadTopics()
        } catch (toggleError) {
            console.error(toggleError)
            setError('Failed to update topic visibility.')
        } finally {
            setBusyTopicId('')
        }
    }

    const handleDelete = async (topic: SharedSpeakingTopic) => {
        setBusyTopicId(topic.id)
        try {
            await deleteSpeakingTopic(topic.id)
            await loadTopics()
        } catch (deleteError) {
            console.error(deleteError)
            setError('Failed to delete the shared topic.')
        } finally {
            setBusyTopicId('')
        }
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
                        <p className="text-sm text-slate-500">{description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {secondaryActionLabel && secondaryActionHref ? (
                            <Link
                                href={secondaryActionHref}
                                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                {secondaryActionLabel}
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600"
                        >
                            New Topic
                        </button>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Shared Topics</h2>
                            <p className="text-sm text-slate-500">
                                These topics are reused by classic speaking and the guided speaking builder.
                            </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {topics.length} topic{topics.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex min-h-[220px] items-center justify-center">
                            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-500" />
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <h3 className="text-lg font-semibold text-slate-900">No shared topics yet</h3>
                            <p className="mt-2 text-sm text-slate-500">
                                Create your first topic and then use it in both speaking activities.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {topics.map(topic => (
                                <div
                                    key={topic.id}
                                    className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                                >
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h3 className="text-lg font-semibold text-slate-900">{topic.title}</h3>
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    topic.isPublished
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}
                                            >
                                                {topic.isPublished ? 'Published' : 'Draft'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                            <span>{topic.questionCount} guided question{topic.questionCount === 1 ? '' : 's'}</span>
                                            <span className="text-slate-300">•</span>
                                            <span>{topic.createdAt ? new Date(topic.createdAt).toLocaleString() : 'Recently created'}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <Link
                                            href={`/teacher/speaking-v2/${topic.id}`}
                                            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                        >
                                            Manage Questions
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => void handlePublishToggle(topic)}
                                            disabled={busyTopicId === topic.id}
                                            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                                                topic.isPublished
                                                    ? 'bg-slate-600 hover:bg-slate-700'
                                                    : 'bg-sky-500 hover:bg-sky-600'
                                            } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                            {busyTopicId === topic.id
                                                ? 'Saving...'
                                                : topic.isPublished
                                                    ? 'Unpublish'
                                                    : 'Publish'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(topic)}
                                            disabled={busyTopicId === topic.id}
                                            className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <TopicTitleModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleCreateTopic}
                saving={savingTopic}
            />
        </>
    )
}
