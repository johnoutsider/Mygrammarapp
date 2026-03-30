'use client'

import { Maximize, Volume2, User, Users, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import type { ActiveGame, GamePlayer } from '@/lib/gameService'

const AVATAR_COLORS = [
    'bg-orange-400',
    'bg-blue-500',
    'bg-green-500',
    'bg-red-400',
    'bg-purple-500',
    'bg-teal-500',
    'bg-pink-400',
    'bg-indigo-500',
]

const TEAM_COLORS = [
    'from-orange-400 to-orange-500',
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-500',
    'from-red-400 to-red-500',
    'from-purple-400 to-purple-600',
    'from-teal-400 to-teal-500',
    'from-pink-400 to-pink-500',
    'from-indigo-400 to-indigo-600',
]

export default function GameLobby({
    game,
    players,
    onStart,
}: {
    game: ActiveGame
    players: [string, GamePlayer][]
    onStart: () => void
}) {
    const isTeamMode = game.participation === 'team'
    const sorted = [...players].sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    const playerCount = players.length

    const sortedTeams = Object.entries(game.teams || {})
        .map(([id, t]: any) => ({ id, ...t }))
        .sort((a: any, b: any) =>
            Object.keys(b.members || {}).length - Object.keys(a.members || {}).length
        )
    const totalTeamPlayers = sortedTeams.reduce(
        (sum, t: any) => sum + Object.keys(t.members || {}).length, 0
    )

    const displayCount = isTeamMode ? sortedTeams.length : playerCount
    const canStart = isTeamMode ? sortedTeams.length > 0 : playerCount > 0
    const startLabel = isTeamMode
        ? (sortedTeams.length > 0 ? `Start Game · ${sortedTeams.length} team${sortedTeams.length !== 1 ? 's' : ''}` : 'Assign teams first...')
        : (playerCount > 0 ? `Start Game · ${playerCount} player${playerCount !== 1 ? 's' : ''}` : 'Waiting for players...')

    return (
        <div className="flex flex-col h-screen font-sans bg-[#00D2D3] overflow-hidden select-none">

            {/* ── TOP BAR ──────────────────────────────────────────────────── */}
            <div className="bg-[#9c45c1] text-white flex items-stretch px-6 py-4 h-[120px] border-b-[8px] border-[#8130a1] shrink-0">

                {/* Center: player count + title + questions badge */}
                <div className="flex-1 flex items-center relative h-full pr-[50px]">

                    {/* Left: Player / Team count */}
                    <div
                        className="flex items-center gap-3 text-white font-black text-6xl pl-4"
                        style={{ textShadow: '2px 3px 0px rgba(0,0,0,0.15)' }}
                    >
                        <span>{displayCount}</span>
                        {isTeamMode
                            ? <Users className="w-12 h-12 fill-current" strokeWidth={3} />
                            : <User className="w-12 h-12 fill-current" strokeWidth={3} />
                        }
                    </div>

                    {/* Center: Quiz title */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 text-white font-black text-[80px] tracking-wide whitespace-nowrap"
                        style={{
                            textShadow: '0 5px 0 rgba(0,0,0,0.15)',
                            WebkitTextStroke: '2px rgba(255,255,255,0.3)',
                            lineHeight: 1,
                        }}
                    >
                        {game.quizTitle}
                    </div>

                    {/* Questions badge */}
                    <div className="absolute right-6 -bottom-[28px] bg-white/20 text-white py-1.5 rounded-full text-[13px] font-bold tracking-[0.15em] uppercase backdrop-blur-md border-[1.5px] border-white/30 z-30 shadow-[0_4px_12px_rgba(0,0,0,0.1)] px-[24px] py-[10px] ml-[200px] mr-[0px] mt-[50px] mb-[40px]">
                        {game.totalQuestions} QUESTIONS
                    </div>
                </div>

                {/* Right: Start button + icons */}
                <div className="flex items-center gap-8 ml-auto mr-4">
                    <button
                        onClick={onStart}
                        disabled={!canStart}
                        className={`bg-white text-[#333333] py-2 rounded-[10px] font-black text-[24px] shadow-[0_4px_0_0_#cbd5e1] active:shadow-none active:translate-y-[4px] hover:bg-gray-50 transition-all tracking-wide px-8
                            ${canStart ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                    >
                        Start
                    </button>
                    <div className="flex gap-4 text-white/90">
                        <Maximize className="w-6 h-6 cursor-pointer hover:opacity-80 transition-opacity" strokeWidth={2.5} />
                        <Volume2 className="w-6 h-6 cursor-pointer hover:opacity-80 transition-opacity" strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            {/* ── MAIN AREA ────────────────────────────────────────────────── */}
            <div className="flex-1 relative overflow-hidden flex flex-col pt-8">

                {/* Background pattern */}
                <div
                    className="absolute inset-0 opacity-[0.15] pointer-events-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='20' y='20' width='80' height='80' rx='20' fill='%23ffffff' transform='rotate(15 60 60)' /%3E%3C/svg%3E")`,
                        backgroundSize: '120px 120px',
                    }}
                />

                {/* ── SOLO MODE ──────────────────────────────────────────────── */}
                {!isTeamMode && (
                    <div className="flex-1 w-full p-8 mt-8 relative z-10 flex flex-wrap content-start justify-center gap-6 max-w-[1600px] mx-auto overflow-y-auto">
                        {playerCount === 0 ? (
                            <p className="text-white/60 text-xl font-bold mt-20">
                                Waiting for students to join...
                            </p>
                        ) : (
                            sorted.map(([uid, p], index) => (
                                <motion.div
                                    key={uid}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white h-[60px] w-[260px] rounded-[10px] shadow-[0_5px_0_0_#d1d5db] relative flex items-center mt-6 group cursor-pointer hover:-translate-y-1 transition-transform"
                                >
                                    {/* Avatar popping out on the left */}
                                    <div className={`absolute -left-1 bottom-0 w-[72px] h-[72px] ${AVATAR_COLORS[index % AVATAR_COLORS.length]} rounded-xl shadow-[0_3px_6px_rgba(0,0,0,0.15)] z-10 flex items-center justify-center`}>
                                        {(p as any).photoURL ? (
                                            <img
                                                src={(p as any).photoURL}
                                                alt={p.name}
                                                className="w-full h-full object-cover rounded-xl"
                                            />
                                        ) : (
                                            <span className="text-white font-black text-2xl">
                                                {p.name.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 pl-[76px] pr-4 text-center text-[#333333] font-semibold text-[20px] truncate">
                                        {p.name}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                )}

                {/* ── TEAM MODE ──────────────────────────────────────────────── */}
                {isTeamMode && (
                    <div className="flex-1 w-full p-8 mt-8 relative z-10 flex flex-wrap content-start justify-center gap-6 max-w-[1600px] mx-auto overflow-y-auto">
                        {sortedTeams.length === 0 ? (
                            <p className="text-white/60 text-xl font-bold mt-20">
                                No teams assigned yet...
                            </p>
                        ) : (
                            sortedTeams.map((team: any, index: number) => {
                                const memberNames = Object.values(team.members || {}) as string[]
                                return (
                                    <motion.div
                                        key={team.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-white w-[260px] rounded-[10px] shadow-[0_5px_0_0_#d1d5db] relative flex flex-col mt-6 p-4 pl-[80px] cursor-pointer hover:-translate-y-1 transition-transform group"
                                    >
                                        {/* Team color badge popping out left */}
                                        <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-[72px] h-[72px] bg-gradient-to-br ${TEAM_COLORS[index % TEAM_COLORS.length]} rounded-xl shadow-[0_3px_6px_rgba(0,0,0,0.15)] z-10 flex items-center justify-center`}>
                                            <Users className="w-8 h-8 text-white" strokeWidth={2.5} />
                                        </div>

                                        {/* Team name */}
                                        <div className="text-[#333333] font-black text-[18px] truncate">{team.name}</div>
                                        {/* Members */}
                                        <div className="text-gray-400 text-xs mt-1">
                                            {memberNames.slice(0, 3).join(', ')}
                                            {memberNames.length > 3 && ` +${memberNames.length - 3} more`}
                                        </div>
                                    </motion.div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
