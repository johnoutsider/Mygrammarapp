'use client'

export default function StudentLobby() {
    return (
        <div className="min-h-screen bg-indigo-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4" />
                <p className="text-white text-lg font-semibold">Waiting for game to start...</p>
            </div>
        </div>
    )
}