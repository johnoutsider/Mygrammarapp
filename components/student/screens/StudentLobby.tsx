'use client'

export default function StudentLobby() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-violet-900 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="relative mb-8">
                <div className="absolute inset-0 rounded-full bg-white/10 animate-ping scale-150" />
                <div className="relative w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-5xl">
                    🎮
                </div>
            </div>
            <h2 className="text-3xl font-extrabold mb-2">You're in!</h2>
            <p className="text-violet-300 text-base mb-6">Game is about to start</p>
            <div className="bg-black/20 text-white/70 text-sm font-medium px-5 py-2.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Waiting for teacher to start...
            </div>
        </div>
    )
}
