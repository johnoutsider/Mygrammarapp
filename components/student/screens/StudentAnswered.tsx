'use client'

export default function StudentAnswered() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-400 to-cyan-500 flex flex-col items-center justify-center gap-6 p-6">

            {/* Big checkmark */}
            <div className="bg-green-500 rounded-full w-28 h-28 flex items-center justify-center shadow-lg ring-4 ring-white">
                <span className="text-white text-6xl font-bold">✓</span>
            </div>

            {/* Text */}
            <div className="text-center text-white">
                <h2 className="text-3xl font-extrabold mb-2">Answer Submitted!</h2>
                <p className="text-white/80 text-base">Waiting for teacher to reveal the answer...</p>
            </div>

            {/* Waiting bar */}
            <div className="bg-black/30 text-white/80 text-sm font-medium px-5 py-2.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                Waiting for teacher to reveal...
            </div>

        </div>
    )
}
