'use client'

import { useEffect, useRef, useState } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import { auth } from '@/lib/firebase'
import {
    addSpeakingTopic,
    deleteSpeakingTopic,
    listSpeakingTopics,
} from '@/lib/speakingService'

const TEAL = '#1D9E75'


export default function SpeakingTopicsPage() {
    const topicInputRef = useRef<HTMLInputElement>(null)

    const [plainTopics, setPlainTopics] = useState<string[]>([])
    const [newTopic, setNewTopic] = useState('')
    const [addingTopic, setAddingTopic] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const uid = auth.currentUser?.uid
                const plain = await listSpeakingTopics(uid)
                setPlainTopics(plain)
            } catch (err) {
                console.error(err)
                setError('Failed to load topics.')
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [])

    const handleAddTopic = async () => {
        const trimmed = newTopic.trim()
        if (!trimmed) return
        setAddingTopic(true)
        try {
            const updated = await addSpeakingTopic(trimmed, auth.currentUser?.uid)
            setPlainTopics(updated)
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
            const updated = await deleteSpeakingTopic(topic, auth.currentUser?.uid)
            setPlainTopics(updated)
        } catch (err) {
            console.error(err)
            setError('Failed to remove topic.')
        }
    }

    return (
        <TeacherLayout title="Topics">
            <div className="max-w-[700px] mx-auto px-4 py-10 space-y-6">

                <div>
                    <h1 className="text-xl font-semibold text-slate-800 mb-1">Topics</h1>
                    <p className="text-sm text-slate-500">Add topics that students will practice. Each prompt is linked to one topic.</p>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex gap-2">
                        <input
                            ref={topicInputRef}
                            type="text"
                            value={newTopic}
                            onChange={e => setNewTopic(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAddTopic() } }}
                            placeholder="e.g. IELTS Part 1 — Daily Life"
                            className="flex-1 h-[42px] rounded-lg border-2 px-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none bg-white focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-colors"
                            style={{ borderColor: TEAL }}
                        />
                        <button
                            type="button"
                            onClick={() => void handleAddTopic()}
                            disabled={addingTopic || !newTopic.trim()}
                            className="h-[42px] px-5 text-sm font-medium text-white rounded-lg flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                            style={{ background: TEAL }}
                        >
                            {addingTopic ? 'Adding…' : 'Add Topic'}
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: TEAL }} />
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 w-10">#</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Topic</th>
                                        <th className="px-4 py-2.5 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {plainTopics.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                                                No topics yet. Add your first topic above.
                                            </td>
                                        </tr>
                                    ) : plainTopics.map((topic, i) => (
                                        <tr key={topic} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                                            <td className="px-4 py-3 text-slate-800 font-medium">{topic}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteTopic(topic)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
                                                    aria-label={`Remove ${topic}`}
                                                >×</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </TeacherLayout>
    )
}
