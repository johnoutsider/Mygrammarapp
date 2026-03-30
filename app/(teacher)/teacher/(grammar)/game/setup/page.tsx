'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { createGame } from '@/lib/gameService'
import TeacherLayout from '@/components/TeacherLayout'
import {
    ArrowLeft, Globe, Zap, Terminal,
    User, Users, Play
} from 'lucide-react'

// ── Inline UI components from Figma ──────────────────────────────────────────

function BackButton({ onClick }: { onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="w-12 h-12 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
    )
}

function TimeInput({
    label, value, onChange, helperText
}: {
    label: string
    value: string
    onChange: (v: string) => void
    helperText?: string
}) {
    return (
        <div className="flex flex-col gap-3">
            <label className="text-gray-700 font-semibold">{label}</label>
            <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl bg-gray-50 hover:border-cyan-400 transition-colors p-[5px]">
                    <input
                        type="number"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        className="w-20 text-gray-700 bg-transparent outline-none font-semibold text-center"
                        min="1"
                    />
                    <span className="text-gray-500 font-medium">min</span>
                </div>
                {helperText && <span className="text-gray-500 text-sm">{helperText}</span>}
            </div>
        </div>
    )
}

const MODES = [
    { id: 'zakovat', label: 'Zakovat', Icon: Globe, description: 'Global knowledge challenge' },
    { id: 'classic', label: 'Classic', Icon: Zap, description: 'Traditional quiz format' },
    { id: 'hacker', label: 'Hacker', Icon: Terminal, description: 'Advanced coding mode' },
] as const

function ModeSelector({
    value, onChange
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div className="flex flex-col gap-3">
            <label className="text-gray-700 font-semibold">Game Mode</label>
            <div className="flex gap-4">
                {MODES.map(({ id, label, Icon, description }) => {
                    const selected = value === id
                    return (
                        <button
                            key={id}
                            onClick={() => onChange(id)}
                            className={`flex-1 rounded-2xl border-4 transition-all flex flex-col items-center justify-center gap-3 py-5
                                ${selected
                                    ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 border-cyan-400 text-white shadow-lg scale-105'
                                    : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:border-cyan-300 hover:shadow-md'}`}
                        >
                            <Icon className={`w-10 h-10 ${selected ? 'drop-shadow-md' : ''}`} />
                            <span className="font-bold text-lg">{label}</span>
                            <span className={`text-xs ${selected ? 'text-cyan-50' : 'text-cyan-600'}`}>
                                {description}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

const PARTICIPATION = [
    { id: 'solo', label: 'Solo', Icon: User, description: 'Individual play' },
    { id: 'team', label: 'Team', Icon: Users, description: 'Group collaboration' },
] as const

function ParticipationSelector({
    value, onChange
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div className="flex flex-col gap-3">
            <label className="text-gray-700 font-semibold">Participation</label>
            <div className="flex gap-4 px-12">
                {PARTICIPATION.map(({ id, label, Icon, description }) => {
                    const selected = value === id
                    return (
                        <button
                            key={id}
                            onClick={() => onChange(id)}
                            className={`flex-1 rounded-2xl border-4 transition-all flex flex-col items-center justify-center gap-3 py-5
                                ${selected
                                    ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 border-cyan-400 text-white shadow-lg scale-105'
                                    : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:border-cyan-300 hover:shadow-md'}`}
                        >
                            <Icon className={`w-10 h-10 ${selected ? 'drop-shadow-md' : ''}`} />
                            <span className="font-bold text-lg">{label}</span>
                            <span className={`text-xs ${selected ? 'text-cyan-50' : 'text-cyan-600'}`}>
                                {description}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ── Main setup component ──────────────────────────────────────────────────────
function QuizSetupInner() {
    const router = useRouter()
    const params = useSearchParams()
    const quizId = params.get('id') || ''
    const quizTitle = params.get('title') || 'Quiz'
    const quizTotal = parseInt(params.get('total') || '0')

    const [questionsCount, setQuestionsCount] = useState(quizTotal)
    const [mode, setMode] = useState('classic')
    const [timeLimit, setTimeLimit] = useState('15')
    const [participation, setParticipation] = useState('solo')
    const [launching, setLaunching] = useState(false)

    const handleStart = async () => {
        if (!auth.currentUser || !quizId) return
        setLaunching(true)
        const count = Math.max(1, Math.min(questionsCount, quizTotal))

        // Fetch teacher's classIds so only their students can join
        const { getUserProfile } = await import('@/lib/auth')
        const teacherProfile = await getUserProfile(auth.currentUser.uid)
        const classIds: string[] = teacherProfile?.classIds || []

        if (participation === 'team') {
            router.push(
                `/teacher/game/teams?id=${quizId}&title=${encodeURIComponent(quizTitle)}&mode=${mode}&total=${count}`
            )
            setLaunching(false)
        } else {
            const snap = await getDoc(doc(db, 'quizzes', quizId))
            const questions: any[] = snap.data()?.questions || []
            const finalCount = Math.min(count, questions.length)
            await createGame(quizId, quizTitle, finalCount, auth.currentUser.uid, 'solo', classIds)
            router.push('/teacher/game/host')
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-600 relative overflow-hidden">
            {/* Geometric background shapes */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-10 left-10 w-32 h-32 bg-cyan-300 rounded-lg transform rotate-12" />
                <div className="absolute top-40 right-20 w-24 h-24 bg-cyan-400 rounded-lg transform -rotate-12" />
                <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-cyan-300 rounded-lg transform rotate-45" />
                <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-cyan-400 rounded-lg transform -rotate-6" />
                <div className="absolute top-1/3 left-1/2 w-36 h-36 bg-cyan-300 rounded-lg transform rotate-12" />
            </div>

            {/* Back button */}
            <div className="relative z-10 px-6 pt-6">
                <BackButton onClick={() => router.push('/teacher/game')} />
            </div>

            {/* Card */}
            <div className="relative z-10 flex items-center justify-center px-4 pb-12 pt-4">
                <div className="w-full max-w-2xl">
                    {/* Purple header */}
                    <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-3xl px-8 py-6">
                        <h2 className="text-3xl font-bold text-white text-center">Quiz Settings</h2>
                    </div>

                    {/* White content */}
                    <div className="bg-white rounded-b-3xl shadow-2xl p-8 space-y-6">
                        {/* Questions + Time side by side */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-3">
                                <label className="text-gray-700 font-semibold">Number of questions</label>
                                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl bg-gray-50 hover:border-cyan-400 transition-colors p-[5px]">
                                    <input
                                        type="number"
                                        value={questionsCount}
                                        onChange={e => {
                                            const v = parseInt(e.target.value)
                                            if (!isNaN(v)) setQuestionsCount(v)
                                        }}
                                        min={1}
                                        max={quizTotal}
                                        className="w-full text-gray-700 bg-transparent outline-none font-semibold text-center"
                                    />
                                </div>
                                <span className="text-gray-500 text-sm">Max: {quizTotal} questions</span>
                            </div>
                            <TimeInput
                                label="Time limit"
                                value={timeLimit}
                                onChange={setTimeLimit}
                                helperText="Total duration for the session"
                            />
                        </div>

                        {/* Mode */}
                        <ModeSelector value={mode} onChange={setMode} />

                        {/* Participation */}
                        <ParticipationSelector value={participation} onChange={setParticipation} />

                        {/* Start button */}
                        <button
                            onClick={handleStart}
                            disabled={launching}
                            className={`w-full py-4 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-105 text-lg
                                ${launching ? 'opacity-60 cursor-wait hover:scale-100' : ''}`}
                        >
                            <Play className="w-6 h-6 fill-white" />
                            {launching ? 'Launching...' : 'Start Quiz Session'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function QuizSetupPage() {
    return (
        <TeacherLayout>
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-400 to-cyan-600">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
                </div>
            }>
                <QuizSetupInner />
            </Suspense>
        </TeacherLayout>
    )
}
