'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuthState } from 'react-firebase-hooks/auth'
import TeacherLayout from '@/components/TeacherLayout'
import QuestionEditorModal from '@/components/guided-speaking/QuestionEditorModal'
import {
    createGuidedSpeakingQuestion,
    deleteGuidedSpeakingQuestion,
    getSpeakingTopic,
    listGuidedSpeakingQuestions,
    reorderGuidedSpeakingQuestions,
    updateGuidedSpeakingQuestion,
} from '@/lib/guidedSpeakingService'
import { auth } from '@/lib/firebase'

export default function GuidedSpeakingTopicDetailPage() {
    const params = useParams()
    const topicId = Array.isArray(params?.topicId) ? params.topicId[0] : params?.topicId
    const [user, authLoading] = useAuthState(auth)
    const [topic, setTopic] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingQuestion, setEditingQuestion] = useState(null)
    const [saving, setSaving] = useState(false)
    const [busyQuestionId, setBusyQuestionId] = useState('')

    const loadData = async () => {
        if (!topicId) {
            setLoading(false)
            setError('Topic not found.')
            return
        }

        try {
            const [nextTopic, nextQuestions] = await Promise.all([
                getSpeakingTopic(topicId),
                listGuidedSpeakingQuestions(topicId),
            ])

            if (!nextTopic) {
                setError('This topic could not be found.')
                setLoading(false)
                return
            }

            if (user?.uid && nextTopic.createdBy !== user.uid) {
                setError('You do not have access to manage this topic.')
                setLoading(false)
                return
            }

            setTopic(nextTopic)
            setQuestions(nextQuestions)
            setError('')
        } catch (loadError) {
            console.error(loadError)
            setError('Failed to load the guided speaking topic.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (authLoading) return
        void loadData()
    }, [authLoading, topicId, user?.uid])

    const handleCreateOrUpdate = async input => {
        if (!topicId) return

        setSaving(true)
        try {
            if (editingQuestion) {
                await updateGuidedSpeakingQuestion(topicId, editingQuestion.id, input)
            } else {
                await createGuidedSpeakingQuestion(topicId, input)
            }

            await loadData()
            setIsModalOpen(false)
            setEditingQuestion(null)
        } catch (saveError) {
            console.error(saveError)
            setError('Failed to save the guided speaking question.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async questionId => {
        if (!topicId) return

        setBusyQuestionId(questionId)
        try {
            await deleteGuidedSpeakingQuestion(topicId, questionId)
            await loadData()
        } catch (deleteError) {
            console.error(deleteError)
            setError('Failed to delete the question.')
        } finally {
            setBusyQuestionId('')
        }
    }

    const moveQuestion = async (index, direction) => {
        if (!topicId) return

        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= questions.length) return

        const reordered = questions.slice()
        const [movedQuestion] = reordered.splice(index, 1)
        reordered.splice(targetIndex, 0, movedQuestion)

        setBusyQuestionId(movedQuestion.id)
        try {
            await reorderGuidedSpeakingQuestions(topicId, reordered.map(question => question.id))
            await loadData()
        } catch (reorderError) {
            console.error(reorderError)
            setError('Failed to reorder the questions.')
        } finally {
            setBusyQuestionId('')
        }
    }

    const summary = useMemo(() => {
        return {
            guided: questions.reduce((total, question) => total + question.guidedQuestions.length, 0),
            examples: questions.reduce((total, question) => total + question.sampleExamples.length, 0),
        }
    }, [questions])

    return (
        <TeacherLayout title={topic?.title || 'Guided Speaking Topic'}>
            <div className="mx-auto max-w-6xl px-4 py-8">
                <div className="space-y-6">
                    <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                            <Link href="/teacher/speaking-v2" className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Back to Guided Speaking Topics
                            </Link>
                            <h1 className="text-3xl font-semibold text-slate-900">{topic?.title || 'Loading topic...'}</h1>
                            <p className="text-sm text-slate-500">
                                Add the main speaking prompt plus the guided and sample-answer support students can open during the session.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href="/teacher/speaking/topics"
                                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                Shared Topic Manager
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingQuestion(null)
                                    setIsModalOpen(true)
                                }}
                                className="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600"
                            >
                                Add Question
                            </button>
                        </div>
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-sm text-slate-500">Questions</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{questions.length}</p>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-sm text-slate-500">Guided Prompts</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.guided}</p>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-sm text-slate-500">Sample Examples</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.examples}</p>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-4">
                            <h2 className="text-lg font-semibold text-slate-900">Guided Speaking Questions</h2>
                            <p className="text-sm text-slate-500">
                                Students see the main question first, then open the hint card for the guided and sample tabs.
                            </p>
                        </div>

                        {loading ? (
                            <div className="flex min-h-[240px] items-center justify-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-500" />
                            </div>
                        ) : questions.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <h3 className="text-lg font-semibold text-slate-900">No guided questions yet</h3>
                                <p className="mt-2 text-sm text-slate-500">
                                    Add the first main question and its helper content to start this guided speaking topic.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4 p-6">
                                {questions.map((question, index) => (
                                    <div key={question.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                                                        Question {index + 1}
                                                    </span>
                                                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                                                        Main Prompt
                                                    </span>
                                                </div>
                                                <h3 className="text-xl font-semibold text-slate-900">{question.questionText}</h3>
                                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                                    <span>{question.guidedQuestions.length} guided question{question.guidedQuestions.length === 1 ? '' : 's'}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{question.suggestedWords.length} suggested word{question.suggestedWords.length === 1 ? '' : 's'}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{question.sampleSentences.length} sample sentence{question.sampleSentences.length === 1 ? '' : 's'}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void moveQuestion(index, -1)}
                                                    disabled={index === 0 || busyQuestionId === question.id}
                                                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Up
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void moveQuestion(index, 1)}
                                                    disabled={index === questions.length - 1 || busyQuestionId === question.id}
                                                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Down
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingQuestion(question)
                                                        setIsModalOpen(true)
                                                    }}
                                                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDelete(question.id)}
                                                    disabled={busyQuestionId === question.id}
                                                    className="rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {busyQuestionId === question.id ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <QuestionEditorModal
                isOpen={isModalOpen}
                initialQuestion={editingQuestion}
                onClose={() => {
                    setIsModalOpen(false)
                    setEditingQuestion(null)
                }}
                onSave={handleCreateOrUpdate}
                saving={saving}
            />
        </TeacherLayout>
    )
}
