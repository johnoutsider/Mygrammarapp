'use client'

import type { ActiveGame } from '@/lib/gameService'

export default function StudentGetReady({
    game,
    currentUserId
}: {
    game: ActiveGame
    currentUserId: string
}) {
    const myTeamEntry = Object.entries(game?.teams || {}).find(
        ([_, t]: any) => t.members && t.members[currentUserId] !== undefined
    )
    const myTeamData = myTeamEntry?.[1] as any || null

    const teammates: { uid: string; name: string }[] = myTeamData
        ? Object.entries(myTeamData.members || {}).map(([uid, name]: any) => ({ uid, name }))
        : []

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-400 to-cyan-500 flex flex-col items-center justify-center p-6 text-white text-center">

            {/* Pulsing icon */}
            <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-white/20 animate-ping scale-150" />
                <div className="relative w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-5xl">
                    {myTeamData ? '🎯' : '⏳'}
                </div>
            </div>

            {myTeamData ? (
                <>
                    <h2 className="text-3xl font-extrabold mb-1">You're in a team!</h2>
                    <p className="text-white/80 text-sm mb-6">
                        Waiting for teacher to start the game...
                    </p>

                    {/* Team card */}
                    <div className="w-full max-w-sm bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl overflow-hidden mb-5">

                        {/* Team name header */}
                        <div className="bg-white/20 px-5 py-4 border-b border-white/20">
                            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Your Team</p>
                            <p className="text-2xl font-extrabold">{myTeamData.name}</p>
                        </div>

                        {/* Teammates list */}
                        <div className="p-3 space-y-2">
                            {teammates.map(({ uid, name }) => {
                                const isMe = uid === currentUserId
                                return (
                                    <div
                                        key={uid}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${isMe
                                                ? 'bg-white text-teal-700 ring-2 ring-white/50'
                                                : 'bg-white/20 text-white'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isMe ? 'bg-teal-100 text-teal-700' : 'bg-white/20 text-white'
                                            }`}>
                                            {name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <span className="flex-1 text-left text-sm">{name}</span>
                                        {isMe && (
                                            <span className="text-xs opacity-60 font-normal">(you)</span>
                                        )}
                                    </div>
                                )
                            })}

                            {teammates.length === 0 && (
                                <p className="text-white/50 text-sm py-2">No teammates yet...</p>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <h2 className="text-3xl font-extrabold mb-2">Hold on!</h2>
                    <p className="text-white/80 text-base mb-6">
                        Teacher is assigning teams right now...
                    </p>
                    <div className="w-full max-w-sm bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl px-6 py-8 mb-5">
                        <div className="flex justify-center mb-3">
                            <div className="flex gap-1">
                                {[0, 1, 2].map(i => (
                                    <div
                                        key={i}
                                        className="w-3 h-3 bg-white rounded-full animate-bounce"
                                        style={{ animationDelay: `${i * 0.15}s` }}
                                    />
                                ))}
                            </div>
                        </div>
                        <p className="text-white/70 text-sm">You'll see your team soon</p>
                    </div>
                </>
            )}

            {/* Waiting pill */}
            <div className="bg-black/20 text-white/80 text-sm font-medium px-5 py-2.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                {myTeamData ? 'Get ready — game starts soon!' : 'Waiting to be assigned...'}
            </div>

        </div>
    )
}
