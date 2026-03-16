'use client'

import { useRouter } from 'next/navigation'
import { deleteTeacherQuiz, TeacherQuiz } from '@/lib/quizService'
import { useState } from 'react'
import { Play } from 'lucide-react'

export default function QuizCard({
    quiz,
    onDeleted,
}: {
    quiz: TeacherQuiz
    onDeleted: (id: string) => void
}) {
    const router = useRouter()
    const [confirming, setConfirming] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        await deleteTeacherQuiz(quiz.id)
        onDeleted(quiz.id)
    }

    const handlePlay = () => {
        router.push(
            `/teacher/game/setup?id=${quiz.id}&title=${encodeURIComponent(quiz.title)}&total=${quiz.questions?.length || 0}`
        )
    }

    const hasQuestions = (quiz.questions?.length || 0) > 0

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all">

            {/* ✅ Cover block — quiz title now visible */}
            <div className="h-28 bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center px-4">
                <h3 className="text-white font-extrabold text-lg text-center leading-snug line-clamp-2 drop-shadow">
                    {quiz.title}
                </h3>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col flex-1 gap-3">

                {/* ✅ Bigger question count & public badge */}
                <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="text-gray-700 text-base font-extrabold">
                        {quiz.questions?.length || 0} Questions
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className={`text-base font-extrabold ${quiz.privacy === 'public' ? 'text-teal-500' : 'text-gray-400'}`}>
                        {quiz.privacy === 'public' ? '🌐 Public' : '🔒 Private'}
                    </span>
                </div>

                {quiz.description && (
                    <p className="text-gray-400 text-xs line-clamp-2">{quiz.description}</p>
                )}

                {/* Play button */}
                <button
                    onClick={handlePlay}
                    disabled={!hasQuestions}
                    title={!hasQuestions ? 'Add questions first to play' : 'Launch live game'}
                    className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl transition-all ${hasQuestions
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:scale-[1.02]'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    <Play size={14} className="fill-current" />
                    {hasQuestions ? 'Play this' : 'No questions yet'}
                </button>

                {/* Edit / Delete */}
                {!confirming ? (
                    <div className="flex gap-2">
                        <button
                            onClick={() => router.push(`/teacher/my-quizzes/${quiz.id}/edit`)}
                            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold py-2 rounded-xl transition-all"
                        >
                            ✏️ Edit
                        </button>
                        <button
                            onClick={() => setConfirming(true)}
                            className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm font-bold py-2 rounded-xl border border-red-200 transition-all"
                        >
                            🗑️ Delete
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-red-500 font-semibold text-center">Delete this quiz?</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirming(false)}
                                className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 py-2 rounded-xl hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-xl transition-all"
                            >
                                {deleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
