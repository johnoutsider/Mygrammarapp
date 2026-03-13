'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { onActiveGame, joinGame } from '@/lib/gameService'
import type { ActiveGame } from '@/lib/gameService'

export default function PlayLobby() {
    const router = useRouter()
    const [game, setGame] = useState<ActiveGame | null>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [joined, setJoined] = useState(false)
    const [playerCount, setPlayerCount] = useState(0)

    // Auth check
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) { router.push('/'); return }
            setCurrentUser(user)
        })
        return unsub
    }, [router])

    // Listen to active game
    useEffect(() => {
        const unsub = onActiveGame((g) => {
            setGame(g)
            setPlayerCount(Object.keys(g?.players || {}).length)

            // Game started — move to game screen
            if (g?.status === 'question') {
                router.push('/play/game')
            }

            // Game ended or cleared
            if (!g || g.status === 'ended') {
                router.push('/dashboard')
            }
        })
        return unsub
    }, [router])

    // Auto-join when user + game are both ready
    useEffect(() => {
        if (!currentUser || !game || joined) return
        const alreadyIn = game.players?.[currentUser.uid]
        if (alreadyIn) { setJoined(true); return }

        const doJoin = async () => {
            const { getUserProfile } = await import('@/lib/auth')
            const profile = await getUserProfile(currentUser.uid)
            await joinGame(currentUser.uid, profile?.name || currentUser.displayName || 'Student')
            setJoined(true)
        }
        doJoin()
    }, [currentUser, game, joined])

    if (!game) {
        return (
            <div className="min-h-screen bg-indigo-900 flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
                    <p className="text-lg opacity-70">Looking for a game...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 flex flex-col items-center justify-center p-6">

            {/* Game title */}
            <div className="text-center mb-10">
                <p className="text-violet-300 text-sm font-semibold uppercase tracking-widest mb-2">
                    🎮 Game Lobby
                </p>
                <h1 className="text-4xl font-extrabold text-white mb-1">
                    {game.quizTitle}
                </h1>
                <p className="text-violet-300 text-sm">{game.totalQuestions} questions</p>
            </div>

            {/* Joined status */}
            {joined ? (
                <div className="bg-white/10 border border-white/20 rounded-2xl px-8 py-6 text-center mb-8 backdrop-blur-sm">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="text-white text-xl font-bold">You&apos;re in!</p>
                    <p className="text-violet-300 text-sm mt-1">
                        {game.players?.[currentUser?.uid]?.name}
                    </p>
                </div>
            ) : (
                <div className="bg-white/10 border border-white/20 rounded-2xl px-8 py-6 text-center mb-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
                    <p className="text-violet-300 text-sm mt-3">Joining...</p>
                </div>
            )}

            {/* Player count */}
            <div className="flex items-center gap-2 text-white/70 mb-10">
                <span className="text-2xl">👥</span>
                <span className="text-lg font-semibold">{playerCount} player{playerCount !== 1 ? 's' : ''} joined</span>
            </div>

            {/* Waiting pulse */}
            <div className="flex items-center gap-3 text-violet-300">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
                </span>
                <span className="text-sm">Waiting for teacher to start...</span>
            </div>
        </div>
    )
}