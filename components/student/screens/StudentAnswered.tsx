'use client'

export default function StudentAnswered() {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-violet-600 flex items-center justify-center text-5xl mb-5 shadow-xl">
                ✓
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-2">Answer Submitted!</h2>
            <p className="text-slate-400 text-sm mb-10">
                Waiting for teacher to reveal the answer...
            </p>
            <div className="bg-violet-900/60 border border-violet-500/40 rounded-2xl px-6 py-5 mb-6 w-full max-w-xs">
                <p className="text-violet-200 font-bold text-lg mb-1">✅ Answer Accepted</p>
                <p className="text-violet-400 text-sm">Your response has been recorded</p>
            </div>
            <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
                </span>
                <span className="text-violet-400 text-sm">Waiting for teacher to reveal...</span>
            </div>
        </div>
    )
}