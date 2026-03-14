'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { getTeacherQuizzes, TeacherQuiz } from '@/lib/quizService'
import TeacherLayout from '@/components/TeacherLayout'
import QuizCard from '@/components/teacher/my-quizzes/QuizCard'

export default function MyQuizzesPage() {
    const router = useRouter()
    const [quizzes, setQuizzes] = useState<TeacherQuiz[]>([])
    const [loading, setLoading] = useState(true)
    const [uid, setUid] = useState('')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return }
            setUid(user.uid)
            try {
                const data = await getTeacherQuizzes(user.uid)
                setQuizzes(data)
            } catch (err) {
                console.error('Error loading quizzes:', err)
            } finally {
                setLoading(false)
            }
        })
        return unsub
    }, [router])

    const handleDeleted = (id: string) => {
        setQuizzes(prev => prev.filter(q => q.id !== id))
    }

    if (loading) {
        return (
            <TeacherLayout title="My Quizzes">
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
                </div>
            </TeacherLayout>
        )
    }

    return (
        <TeacherLayout title="My Quizzes">
            <div className="max-w-5xl mx-auto px-4 py-6">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">My Quizzes</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Create and manage your teacher quiz sets
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/teacher/my-quizzes/create')}
                        className="bg-teal-500 hover:bg-teal-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
                    >
                        ➕ Create Quiz
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {[
                        { icon: '📚', label: 'Total Quizzes', value: quizzes.length },
                        { icon: '🧠', label: 'Total Questions', value: quizzes.reduce((sum, q) => sum + (q.questions?.length || 0), 0) },
                        { icon: '🌐', label: 'Public Quizzes', value: quizzes.filter(q => q.privacy === 'public').length },
                    ].map((s, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col items-center gap-1 shadow-sm text-center">
                            <span className="text-xl">{s.icon}</span>
                            <span className="text-2xl font-bold text-slate-800">{s.value}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Quiz grid */}
                {quizzes.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">📚</div>
                        <h3 className="text-lg font-bold text-slate-700 mb-2">No Quizzes Yet</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Create your first quiz set to use in live games
                        </p>
                        <button
                            onClick={() => router.push('/teacher/my-quizzes/create')}
                            className="bg-teal-500 hover:bg-teal-600 text-white font-bold px-8 py-3 rounded-xl text-sm"
                        >
                            ➕ Create Your First Quiz
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {quizzes.map(quiz => (
                            <QuizCard
                                key={quiz.id}
                                quiz={quiz}
                                onDeleted={handleDeleted}
                            />
                        ))}
                    </div>
                )}
            </div>
        </TeacherLayout>
    )
}