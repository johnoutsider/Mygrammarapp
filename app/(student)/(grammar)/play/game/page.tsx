'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import TeacherLayout from '@/components/TeacherLayout'
import { createGame, onActiveGame, endGame, clearGame } from '@/lib/gameService'
import { Gamepad2, CheckCircle2, Rocket, BookOpen, Clock, Users } from 'lucide-react'
import type { ActiveGame } from '@/lib/gameService'

interface Quiz { id: string; title: string; questions: any[]; contributorName: string; createdAt: any }

export default function TeacherGamePage() {
    const router = useRouter()
    const [quizzes, setQuizzes] = useState<Quiz[]>([])
    const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
    const [loading, setLoading] = useState(true)
    const [launching, setLaunching] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [questionTime, setQuestionTime] = useState(20)

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

    useEffect(() => { const unsub = onActiveGame(setActiveGame); return unsub }, [])

    const handleLaunch = async () => {
        if (!selectedId) return
        const quiz = quizzes.find(q => q.id === selectedId)
        if (!quiz || !auth.currentUser) return
        setLaunching(true)
        await createGame(quiz.id, quiz.title, quiz.questions.length, auth.currentUser.uid)
        router.push('/teacher/game/host')
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        </div>
    )

    return (
        <TeacherLayout title="Live Game">
            {/* Active game banner */}
            {activeGame && (
                <div className="mb-6 bg-purple-50 border-2 border-purple-300 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                        <p className="font-bold text-slate-800 text-lg">{activeGame.quizTitle}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Status: <span className="font-semibold capitalize">{activeGame.status}</span>
                            {' · '}{Object.keys(activeGame.players || {}).length} players
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {activeGame.status !== 'ended' && (
                            <button onClick={() => router.push('/teacher/game/host')}
                                className="bg-purple-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-purple-700 text-sm">
                                Back to Host →
                            </button>
                        )}
                        <button onClick={async () => { await endGame(); await clearGame() }}
                            className="bg-red-100 text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-200 text-sm">
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {!activeGame && (
                <div className="max-w-2xl">
                    {/* Quiz picker */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <BookOpen className="w-5 h-5 text-purple-600" />
                            <div>
                                <h2 className="font-bold text-slate-800">Select a Quiz</h2>
                                <p className="text-sm text-slate-400">Teacher-approved quizzes only</p>
                            </div>
                        </div>
                        {quizzes.length === 0 ? (
                            <div className="px-6 py-12 text-center text-slate-400">
                                <div className="text-4xl mb-3">📭</div>
                                <p className="font-medium">No approved quizzes yet</p>
                                <p className="text-sm mt-1">Approve student quizzes from the Approvals page first</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {quizzes.map((quiz, i) => (
                                    <li key={quiz.id} onClick={() => setSelectedId(quiz.id)}
                                        className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all border-l-4 ${selectedId === quiz.id ? 'bg-purple-50 border-purple-600' : 'border-transparent hover:bg-slate-50'
                                            }`}>
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${selectedId === quiz.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>{i + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 truncate">{quiz.title}</p>
                                            <p className="text-sm text-slate-400">{quiz.questions.length} questions
                                                {quiz.contributorName && ` · by ${quiz.contributorName}`}</p>
                                        </div>
                                        {selectedId === quiz.id && <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Time per question */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 mb-5">
                        <div className="flex items-center gap-3 mb-4">
                            <Clock className="w-5 h-5 text-purple-600" />
                            <h2 className="font-bold text-slate-800">Time per Question</h2>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {[10, 20, 30, 60].map(t => (
                                <button key={t} onClick={() => setQuestionTime(t)}
                                    className={`py-3 rounded-xl font-bold transition-all ${questionTime === t ? 'bg-purple-600 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}>{t}s</button>
                            ))}
                        </div>
                    </div>

                    {/* Launch */}
                    <button onClick={handleLaunch} disabled={!selectedId || launching}
                        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${selectedId && !launching
                                ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white hover:scale-[1.01] shadow-lg'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}>
                        {launching ? '⏳ Launching...' : <><Rocket className="w-5 h-5" /> Launch Game</>}
                    </button>
                </div>
            )}
        </TeacherLayout>
    )
}