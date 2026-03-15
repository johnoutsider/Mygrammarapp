'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import TeacherLayout from '@/components/TeacherLayout'
import { createGame, onActiveGame, endGame, clearGame } from '@/lib/gameService'
import { Play, ChevronDown } from 'lucide-react'
import type { ActiveGame } from '@/lib/gameService'

interface Quiz {
    id: string
    title: string
    questions: any[]
    contributorName: string
    source?: string
    createdAt: any
}

export default function TeacherGamePage() {
    const router = useRouter()
    const [quizzes, setQuizzes] = useState<Quiz[]>([])
    const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
    const [loading, setLoading] = useState(true)
    const [launchingId, setLaunchingId] = useState<string | null>(null)
    const [filterSort, setFilterSort] = useState('')
    const [filterSource, setFilterSource] = useState('')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(user.uid)
            if (profile?.role !== 'teacher') { router.push('/dashboard'); return }
            setLoading(false)
        })
        return unsub
    }, [router])

    useEffect(() => {
        getDocs(query(collection(db, 'quizzes'), where('status', '==', 'teacher_approved')))
            .then(snap => setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz))))
    }, [])

    useEffect(() => {
        const unsub = onActiveGame(setActiveGame)
        return unsub
    }, [])

    const handlePlay = (quiz: Quiz) => {
        router.push(`/teacher/game/setup?id=${quiz.id}&title=${encodeURIComponent(quiz.title)}&total=${quiz.questions?.length || 0}`)
    }


    // Apply filters
    let filtered = [...quizzes]
    if (filterSource) filtered = filtered.filter(q => q.source === filterSource)
    if (filterSort === 'recent') filtered.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
    if (filterSort === 'oldest') filtered.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds)

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
        </div>
    )

    return (
        <TeacherLayout>
            <div className="w-full font-sans bg-[#f4f6f9] min-h-screen pb-10">

                {/* Breadcrumb */}
                <div className="px-6 py-4 text-[13px] text-gray-500 flex items-center gap-1">
                    <span>Home</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-700 font-medium">Live Game</span>
                </div>

                {/* Active game banner */}
                {activeGame && (
                    <div className="mx-4 md:mx-6 mb-4 bg-purple-50 border border-purple-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-bold text-purple-800">{activeGame.quizTitle}</p>
                            <p className="text-sm text-purple-500">
                                Status: <span className="font-semibold">{activeGame.status}</span>
                                {' · '}{Object.keys(activeGame.players || {}).length} players
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {activeGame.status !== 'ended' && (
                                <button
                                    onClick={() => router.push('/teacher/game/host')}
                                    className="bg-purple-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-purple-700 text-sm"
                                >
                                    Back to Host →
                                </button>
                            )}
                            <button
                                onClick={async () => { await endGame(); await clearGame() }}
                                className="bg-red-100 text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-200 text-sm"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                {!activeGame && (
                    <div className="px-4 md:px-6">
                        <div className="bg-white rounded shadow-sm overflow-hidden">

                            {/* Filters */}
                            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4">
                                <div className="relative min-w-[150px] flex-1">
                                    <select
                                        value={filterSort}
                                        onChange={e => setFilterSort(e.target.value)}
                                        className="w-full appearance-none border border-gray-300 rounded text-[13px] text-gray-700 py-2 pl-3 pr-8 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white cursor-pointer h-[38px]"
                                    >
                                        <option value="">Sort by</option>
                                        <option value="recent">Most Recent</option>
                                        <option value="oldest">Oldest</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>

                                <div className="relative min-w-[150px] flex-1">
                                    <select
                                        value={filterSource}
                                        onChange={e => setFilterSource(e.target.value)}
                                        className="w-full appearance-none border border-gray-300 rounded text-[13px] text-gray-700 py-2 pl-3 pr-8 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white cursor-pointer h-[38px]"
                                    >
                                        <option value="">All Sources</option>
                                        <option value="student">Student-created</option>
                                        <option value="teacher">Teacher-created</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-[#f9fafc]">
                                            <th className="py-4 px-6 text-[13px] font-bold text-[#1f2d3d] w-[40px]">#</th>
                                            <th className="py-4 px-6 text-[13px] font-bold text-[#1f2d3d]">Quiz Title</th>
                                            <th className="py-4 px-6 text-[13px] font-bold text-[#1f2d3d]">Questions</th>
                                            <th className="py-4 px-6 text-[13px] font-bold text-[#1f2d3d]">Created by</th>
                                            <th className="py-4 px-6 text-[13px] font-bold text-[#1f2d3d] text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                                                    📭 No approved quizzes yet. Approve quizzes from the Approvals page.
                                                </td>
                                            </tr>
                                        ) : (
                                            filtered.map((quiz, i) => (
                                                <tr
                                                    key={quiz.id}
                                                    className="border-b border-gray-100 hover:bg-[#f2f6f9] transition-colors"
                                                >
                                                    <td className="py-4 px-6 text-[14px] text-gray-400">{i + 1}</td>
                                                    <td className="py-4 px-6 text-[14px] font-semibold text-[#3c8dbc]">{quiz.title}</td>
                                                    <td className="py-4 px-6 text-[14px] text-gray-700">{quiz.questions?.length || 0}</td>
                                                    <td className="py-4 px-6 text-[14px] text-gray-500">{quiz.contributorName || '—'}</td>
                                                    <td className="py-4 px-6 text-right">
                                                        <button
                                                            onClick={() => handlePlay(quiz)}
                                                            disabled={!!launchingId}
                                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded text-[13px] font-semibold transition-colors ${launchingId === quiz.id
                                                                ? 'bg-purple-600 text-white cursor-wait'
                                                                : 'bg-[#e8f0f5] text-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white'
                                                                }`}
                                                        >
                                                            <Play size={14} className="fill-current" />
                                                            {launchingId === quiz.id ? 'Launching...' : 'Play this'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}
