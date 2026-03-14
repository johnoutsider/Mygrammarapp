'use client'

import { useState } from 'react'

interface PoolQuestion {
    quizId: string
    questionIndex: number
    text: string
}

export default function DeleteModal({
    q,
    onClose,
    onConfirm,
}: {
    q: PoolQuestion
    onClose: () => void
    onConfirm: (quizId: string, questionIndex: number) => Promise<void>
}) {
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await onConfirm(q.quizId, q.questionIndex)
            onClose()
        } catch {
            setDeleting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="text-center mb-5">
                    <div className="text-4xl mb-3">🗑️</div>
                    <h2 className="text-base font-bold text-slate-800 mb-1">Delete this question?</h2>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        "<span className="font-semibold text-slate-700">
                            {q.text.length > 80 ? q.text.slice(0, 80) + '…' : q.text}
                        </span>"
                    </p>
                    <p className="text-xs text-red-500 font-semibold mt-3">This action cannot be undone.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 text-sm font-semibold text-slate-600 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 text-sm font-bold text-white bg-red-500 hover:bg-red-600 py-2.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {deleting ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                </div>
            </div>
        </div>
    )
}