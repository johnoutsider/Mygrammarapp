'use client'

import { useRouter } from 'next/navigation'
import { deleteTeacherQuiz, TeacherQuiz } from '@/lib/quizService'
import { useState } from 'react'

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

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">

            {/* Cover block */}
            <div
                className="h-36 flex items-center justify-center"
                style={{ backgroundColor: quiz.coverColor || '#0d9488' }}
            >
                <span className="text-white text-2xl font-extrabold text-center px-4 leading-tight drop-shadow">
                    {quiz.title}
                </span>
            </div>

            {/* Body */}
            <div className="p-4">
                <h3 className="font-bold text-slate-800 text-base truncate mb-1">
                    {quiz.title}
                </h3>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        {quiz.questions?.length || 0} Questions
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                        ${quiz.privacy === 'public'
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {quiz.privacy === 'public' ? '🌐 Public' : '🔒 Private'}
                    </span>
                </div>

                {quiz.description && (
                    <p className="text-xs text-slate-400 mb-3 line-clamp-2">{quiz.description}</p>
                )}

                {/* Actions */}
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
                    <div className="space-y-2">
                        <p className="text-xs text-red-500 font-semibold text-center">
                            Delete this quiz?
                        </p>
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
                                className="flex-1 text-sm font-bold text-white bg-red-500 hover:bg-red-600 py-2 rounded-xl disabled:opacity-60"
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