'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import TeacherLayout from '@/components/TeacherLayout'
import { createGame, onActiveGame, endGame, clearGame } from '@/lib/gameService'
import type { ActiveGame } from '@/lib/gameService'

interface Quiz {
    id: string
    title: string
    questions: any[]
    contributorName: string
    createdAt: any
}

export default function TeacherGamePage() {
    const router = useRouter()
    const [approvedQuizzes, setApprovedQuizzes] = useState<Quiz[]>([])
    const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
    const [loading, setLoading] = useState(true)
    const [launching, setLaunching] = useState(false)
    const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)

    // Auth guard
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

    // Fetch teacher_approved quizzes from Firestore
    useEffect(() => {
        const fetchQuizzes = async () => {
            const snap = await getDocs(
                query(collection(db, 'quizzes'), where('status', '==', 'teacher_approved'))
            )
            setApprovedQuizzes(
                snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz))
            )
        }
        fetchQuizzes()
    }, [])

    // Listen to active game in RTDB
    useEffect(() => {
        const unsub = onActiveGame(setActiveGame)
        return unsub
    }, [])

    const handleLaunch = async () => {
        if (!selectedQuizId) return
        const quiz = approvedQuizzes.find(q => q.id === selectedQuizId)
        if (!quiz || !auth.currentUser) return

        setLaunching(true)
        await createGame(
            quiz.id,
            quiz.title,
            quiz.questions.length,
            auth.currentUser.uid
        )
        setLaunching(false)
        router.push('/teacher/game/host')
    }

    const handleEndGame = async () => {
        await endGame()
        await clearGame()
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
            </div>
        )
    }

    return (
        <TeacherLayout title="Live Game">
            <div className="max-w-3xl mx-auto px-4 py-8">

                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-slate-900">🎮 Live Game</h1>
                    <p className="text-slate-500 mt-1">Launch a Kahoot-style game from your approved quizzes</p>
                </div>

                {/* Active game warning */}
                {activeGame && (
                    <div className={`mb-6 rounded-2xl p-5 border-2 flex items-center justify-between
                        ${activeGame.status === 'ended'
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-violet-50 border-violet-300'}`}>
                        <div>
                            <p className="font-bold text-slate-800 text-lg">{activeGame.quizTitle}</p>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Status: <span className="font-semibold capitalize">{activeGame.status}</span>
                                {' · '}
                                {Object.keys(activeGame.players || {}).length} players joined
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {activeGame.status !== 'ended' && (
                                <button
                                    onClick={() => router.push('/teacher/game/host')}
                                    className="bg-violet-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors text-sm"
                                >
                                    Back to Host →
                                </button>
                            )}
                            <button
                                onClick={handleEndGame}
                                className="bg-red-100 text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-200 transition-colors text-sm"
                            >
                                Clear Game
                            </button>
                        </div>
                    </div>
                )}

                {/* Quiz picker */}
                {!activeGame && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h2 className="font-bold text-slate-800">Select a Quiz to Launch</h2>
                            <p className="text-sm text-slate-400 mt-0.5">Only teacher-approved quizzes appear here</p>
                        </div>

                        {approvedQuizzes.length === 0 ? (
                            <div className="px-6 py-12 text-center text-slate-400">
                                <div className="text-4xl mb-3">📭</div>
                                <p className="font-medium">No approved quizzes yet</p>
                                <p className="text-sm mt-1">Approve student quizzes from the Approvals page first</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {approvedQuizzes.map(quiz => (
                                    <li
                                        key={quiz.id}
                                        onClick={() => setSelectedQuizId(quiz.id)}
                                        className={`px-6 py-4 cursor-pointer flex items-center justify-between transition-colors
                                            ${selectedQuizId === quiz.id
                                                ? 'bg-violet-50 border-l-4 border-violet-500'
                                                : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-800">{quiz.title}</p>
                                            <p className="text-sm text-slate-400 mt-0.5">
                                                {quiz.questions.length} questions
                                                {quiz.contributorName && ` · by ${quiz.contributorName}`}
                                            </p>
                                        </div>
                                        {selectedQuizId === quiz.id && (
                                            <span className="text-violet-600 text-xl">✓</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* Launch button */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={handleLaunch}
                                disabled={!selectedQuizId || launching}
                                className={`w-full py-3 rounded-xl font-bold text-lg transition-all
                                    ${selectedQuizId && !launching
                                        ? 'bg-violet-600 text-white hover:bg-violet-700 hover:scale-[1.01] shadow-md'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                {launching ? '⏳ Launching...' : '🚀 Launch Game'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}