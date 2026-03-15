'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { ref, onValue, off, update } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { createGame } from '@/lib/gameService'
import TeacherLayout from '@/components/TeacherLayout'
import {
    ArrowLeft, Search, Users, Play,
    Wand2, Sparkles, Minus, Plus, User, GripHorizontal
} from 'lucide-react'

const UZBEK_TEAM_NAMES = ['Lochinlar', 'Burgutlar', 'Tulporlar', 'Sherlar', 'Qoplonlar', 'Birlik', 'Ziyo', 'Umid', 'Yulduzlar', 'Dovonlar', 'Arslonlar', 'Oqtoshlar', 'Zafar', 'Nurlar', 'Bahorlar', 'Shamol', 'Oltin', 'Kumush', 'Toshlar', 'Botirlar']
const TEAM_GRADIENTS = [
    'from-blue-500 to-cyan-400',
    'from-violet-500 to-purple-500',
    'from-orange-400 to-rose-400',
    'from-emerald-400 to-teal-500',
    'from-indigo-500 to-blue-500',
    'from-pink-500 to-rose-500',
    'from-amber-400 to-orange-500',
    'from-teal-400 to-cyan-500',
]
const TEAM_SOLID = [
    'bg-blue-500', 'bg-violet-500', 'bg-orange-400', 'bg-emerald-400',
    'bg-indigo-500', 'bg-pink-500', 'bg-amber-400', 'bg-teal-400',
]

interface Student { uid: string; name: string }
interface Team { id: string; name: string; gradient: string; solid: string; members: Student[] }

function distribute(students: Student[], count: number): Team[] {
    const shuffled = [...students].sort(() => Math.random() - 0.5)
    const teams: Team[] = Array.from({ length: count }, (_, i) => ({
        id: `team_${i}`,
        name: UZBEK_TEAM_NAMES[i % UZBEK_TEAM_NAMES.length],
        gradient: TEAM_GRADIENTS[i % TEAM_GRADIENTS.length],
        solid: TEAM_SOLID[i % TEAM_SOLID.length],
        members: [],
    }))
    shuffled.forEach((s, i) => teams[i % count].members.push(s))
    return teams
}

function TeamsInner() {
    const router = useRouter()
    const params = useSearchParams()
    const quizId = params.get('id') || ''
    const quizTitle = params.get('title') || 'Quiz'
    const mode = params.get('mode') || 'classic'
    const total = params.get('total') || 'all'

    const [students, setStudents] = useState<Student[]>([])
    const [teams, setTeams] = useState<Team[]>([])
    const [teamCount, setTeamCount] = useState(2)
    const [searchQuery, setSearchQuery] = useState('')
    const [isRandomizing, setIsRandomizing] = useState(false)
    const [launching, setLaunching] = useState(false)
    const [gameReady, setGameReady] = useState(false)

    const dragStudent = useRef<Student | null>(null)
    const dragFromTeam = useRef<string | null>(null)

    // ── Create lobby game ──────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            if (!auth.currentUser) return
            const snap = await getDoc(doc(db, 'quizzes', quizId))
            const questions: any[] = snap.data()?.questions || []
            const count = total === 'all' ? questions.length : Math.min(parseInt(total), questions.length)
            await createGame(quizId, quizTitle, count, auth.currentUser.uid, 'team')
            setGameReady(true)
        }
        init()
    }, [quizId])

    // ── Listen to students joining ─────────────────────────────────────────────
    useEffect(() => {
        if (!gameReady) return
        const playersRef = ref(rtdb, 'activeGame/players')
        onValue(playersRef, snap => {
            if (!snap.exists()) return
            const data = snap.val()
            const joined: Student[] = Object.entries(data).map(([uid, p]: any) => ({
                uid, name: p.name || 'Student'
            }))
            setStudents(joined)
        })
        return () => off(playersRef)
    }, [gameReady])

    // ── Re-distribute when students or teamCount changes ───────────────────────
    useEffect(() => {
        if (students.length === 0) {
            setTeams(Array.from({ length: teamCount }, (_, i) => ({
                id: `team_${i}`,
                name: UZBEK_TEAM_NAMES[i % UZBEK_TEAM_NAMES.length],
                gradient: TEAM_GRADIENTS[i % TEAM_GRADIENTS.length],
                solid: TEAM_SOLID[i % TEAM_SOLID.length],
                members: [],
            })))
            return
        }
        setTeams(distribute(students, teamCount))
    }, [students, teamCount])

    // ── Sync teams to RTDB live ────────────────────────────────────────────────
    useEffect(() => {
        if (!gameReady || teams.length === 0) return
        const teamData: Record<string, any> = {}
        teams.forEach(t => {
            teamData[t.id] = {
                name: t.name,
                color: t.solid,
                score: 0,
                members: t.members.reduce((acc, m) => ({ ...acc, [m.uid]: m.name }), {})
            }
        })
        update(ref(rtdb, 'activeGame/teams'), teamData)
    }, [teams, gameReady])

    // ── Randomize ──────────────────────────────────────────────────────────────
    const handleRandomize = () => {
        setIsRandomizing(true)
        setTeams(distribute(students, teamCount))
        setTimeout(() => setIsRandomizing(false), 600)
    }

    // ── Team count ─────────────────────────────────────────────────────────────
    const decreaseTeams = () => setTeamCount(p => Math.max(2, p - 1))
    const increaseTeams = () => setTeamCount(p => Math.min(20, p + 1))

    // ── Drag & Drop ────────────────────────────────────────────────────────────
    const onDragStart = (student: Student, fromTeamId: string) => {
        dragStudent.current = student
        dragFromTeam.current = fromTeamId
    }

    const onDropOnTeam = (toTeamId: string) => {
        const student = dragStudent.current
        const fromTeamId = dragFromTeam.current
        if (!student || !fromTeamId || fromTeamId === toTeamId) return
        setTeams(prev => prev.map(t => {
            if (t.id === fromTeamId) return { ...t, members: t.members.filter(m => m.uid !== student.uid) }
            if (t.id === toTeamId) return { ...t, members: [...t.members, student] }
            return t
        }))
        dragStudent.current = null
        dragFromTeam.current = null
    }

    // ── Launch ─────────────────────────────────────────────────────────────────
    const handleLaunch = async () => {
        if (!auth.currentUser) return
        setLaunching(true)
        const teamData: Record<string, any> = {}
        teams.forEach(t => {
            teamData[t.id] = {
                name: t.name,
                color: t.solid,
                score: 0,
                members: t.members.reduce((acc, m) => ({ ...acc, [m.uid]: m.name }), {})
            }
        })
        await update(ref(rtdb, 'activeGame'), {
            status: 'lobby',
            participation: 'team',
            skipLobby: true,
            mode,
            teams: teamData,
        })
        router.push('/teacher/game/host')
    }

    const filteredTeams = searchQuery
        ? teams.map(t => ({
            ...t,
            members: t.members.filter(m =>
                m.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })).filter(t => t.members.length > 0)
        : teams

    const totalAssigned = teams.reduce((s, t) => s + t.members.length, 0)

    if (!gameReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Setting up game lobby...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full font-sans bg-[#f4f6f9] min-h-screen pb-12">

            {/* Breadcrumb */}
            <div className="px-6 py-4 text-[13px] text-gray-500 flex items-center gap-1">
                <span className="cursor-pointer hover:text-gray-700" onClick={() => router.push('/teacher/game')}>Home</span>
                <span className="text-gray-400">/</span>
                <span className="cursor-pointer hover:text-gray-700" onClick={() => router.push('/teacher/game')}>Live Game</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-700 font-medium">Team Assignment</span>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 mt-2">

                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-[#1f2d3d] flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                                    <Users size={20} />
                                </span>
                                Assign Teams
                            </h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {quizTitle} ·{' '}
                                {students.length > 0
                                    ? <span className="text-green-600 font-medium">{students.length} students joined</span>
                                    : <span className="text-orange-500 font-medium">Waiting for students to join...</span>
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleRandomize}
                            disabled={students.length === 0}
                            className={`flex items-center gap-2 flex-1 sm:flex-none justify-center bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 text-blue-700 hover:from-indigo-100 hover:to-blue-100 transition-all px-5 py-2.5 rounded-xl text-[14px] font-semibold disabled:opacity-40 ${isRandomizing ? 'animate-pulse' : ''}`}
                        >
                            <Wand2 size={16} className={isRandomizing ? 'animate-spin' : ''} />
                            Randomize
                        </button>
                        <button
                            onClick={handleLaunch}
                            disabled={totalAssigned === 0 || launching}
                            className={`flex items-center gap-2 flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-xl text-[14px] font-bold text-white transition-all shadow-md ${totalAssigned > 0 && !launching
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 hover:-translate-y-0.5'
                                    : 'bg-gray-300 cursor-not-allowed'
                                }`}
                        >
                            <Play size={16} className="fill-current" />
                            {launching ? 'Starting...' : 'Start Game'}
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between min-w-[260px]">
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Number of teams</p>
                            <p className="text-2xl font-black text-[#1f2d3d]">{teamCount}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                            <button onClick={decreaseTeams} disabled={teamCount <= 2} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg transition-colors disabled:opacity-30">
                                <Minus size={18} />
                            </button>
                            <div className="w-px h-6 bg-gray-200" />
                            <button onClick={increaseTeams} disabled={teamCount >= 20} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg transition-colors disabled:opacity-30">
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex-1 flex items-center group focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <div className="pl-3 pr-2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                            <Search size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Find a student by name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full text-[15px] py-2 px-2 focus:outline-none placeholder:text-gray-400 font-medium text-gray-700 bg-transparent"
                        />
                    </div>
                </div>

                {/* Teams grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredTeams.map((team, index) => (
                        <div
                            key={team.id}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => onDropOnTeam(team.id)}
                            className={`bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-100 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${isRandomizing ? 'scale-[0.97] opacity-60' : ''}`}
                            style={{ transitionDelay: `${index * 25}ms` }}
                        >
                            <div className={`bg-gradient-to-r ${team.gradient} p-5 relative overflow-hidden`}>
                                <Sparkles className="absolute -right-2 -bottom-2 w-20 h-20 text-white/10 rotate-12" />
                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-[17px] text-white leading-tight mb-0.5">{team.name}</h3>
                                        <p className="text-white/75 text-[12px]">Team {index + 1}</p>
                                    </div>
                                    <div className="bg-white/20 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/20">
                                        {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 flex-1 flex flex-col gap-2 bg-gray-50/30 min-h-[80px]">
                                {team.members.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-6 text-gray-300 text-[12px] font-medium">
                                        Drop students here
                                    </div>
                                ) : (
                                    team.members.map(member => (
                                        <div
                                            key={member.uid}
                                            draggable
                                            onDragStart={() => onDragStart(member, team.id)}
                                            className="group flex items-center gap-3 p-2.5 bg-white border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-sm hover:ring-1 hover:ring-blue-100 transition-all cursor-grab active:cursor-grabbing"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 border border-gray-200 group-hover:from-blue-50 group-hover:to-blue-100 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                                                <User size={14} />
                                            </div>
                                            <span className="text-[13px] font-medium text-gray-700 flex-1 truncate group-hover:text-blue-700 transition-colors">
                                                {member.name}
                                            </span>
                                            <GripHorizontal size={15} className="text-gray-300 group-hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Status bar */}
                {students.length > 0 && (
                    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between">
                        <p className="text-[13px] text-gray-500">
                            <span className="font-bold text-gray-700">{totalAssigned}</span> of{' '}
                            <span className="font-bold text-gray-700">{students.length}</span> students assigned
                        </p>
                        <p className="text-[12px] text-gray-400">
                            ~{Math.ceil(students.length / teamCount)} students per team
                        </p>
                    </div>
                )}

            </div>
        </div>
    )
}

export default function TeamsPage() {
    return (
        <TeacherLayout>
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                </div>
            }>
                <TeamsInner />
            </Suspense>
        </TeacherLayout>
    )
}
