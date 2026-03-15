'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { createGame } from '@/lib/gameService'
import TeacherLayout from '@/components/TeacherLayout'
import {
    ArrowLeft, Brain, Zap, Terminal,
    User, Users, Play, ChevronDown
} from 'lucide-react'

function QuizSetupInner() {
    const router = useRouter()
    const params = useSearchParams()
    const quizId = params.get('id') || ''
    const quizTitle = params.get('title') || 'Quiz'
    const quizTotal = parseInt(params.get('total') || '0')

    const [questionsCount, setQuestionsCount] = useState('all')
    const [mode, setMode] = useState('classic')
    const [timeLimit, setTimeLimit] = useState('15')
    const [participation, setParticipation] = useState('solo')
    const [launching, setLaunching] = useState(false)

    const handleStart = async () => {
        if (!auth.currentUser || !quizId) return
        setLaunching(true)

        if (participation === 'team') {
            router.push(
                `/teacher/game/teams?id=${quizId}&title=${encodeURIComponent(quizTitle)}&mode=${mode}&total=${questionsCount}`
            )
            setLaunching(false)    // ← ADD THIS
        } else {
            const snap = await getDoc(doc(db, 'quizzes', quizId))
            const questions: any[] = snap.data()?.questions || []
            const count = questionsCount === 'all'
                ? questions.length
                : Math.min(parseInt(questionsCount), questions.length)
            await createGame(quizId, quizTitle, count, auth.currentUser.uid, 'solo')  // ← ADD 'solo'
            router.push('/teacher/game/host')
        }
    }


    const modeOptions = [
        { value: 'zakovat', label: 'Zakovat', icon: <Brain size={16} /> },
        { value: 'classic', label: 'Classic', icon: <Zap size={16} /> },
        { value: 'hacker', label: 'Hacker', icon: <Terminal size={16} /> },
    ]

    const participationOptions = [
        { value: 'solo', label: 'Solo', icon: <User size={16} /> },
        { value: 'team', label: 'Team', icon: <Users size={16} /> },
    ]

    return (
        <div className="w-full font-sans bg-[#f4f6f9] min-h-screen pb-10">

            {/* Breadcrumb */}
            <div className="px-6 py-4 text-[13px] text-gray-500 flex items-center gap-1">
                <span className="cursor-pointer hover:text-gray-700" onClick={() => router.push('/teacher/game')}>Home</span>
                <span className="text-gray-400">/</span>
                <span className="cursor-pointer hover:text-gray-700" onClick={() => router.push('/teacher/game')}>Live Game</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-500">Setup</span>
            </div>

            <div className="max-w-3xl mx-auto px-4 md:px-6 mt-2">

                {/* Back + Title */}
                <div className="mb-6 flex items-center gap-4">
                    <button
                        onClick={() => router.push('/teacher/game')}
                        className="p-2 bg-white border border-gray-200 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-2xl font-bold text-[#1f2d3d] flex-1">{quizTitle}</h1>
                </div>

                {/* Settings Card */}
                <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">

                    <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-[15px] font-semibold text-[#1f2d3d]">Quiz Settings</h2>
                        <p className="text-[13px] text-gray-500 mt-1">Configure the parameters for your quiz session before starting.</p>
                    </div>

                    <div className="divide-y divide-gray-100">

                        {/* Number of questions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                            <label className="text-[14px] font-semibold text-gray-700 w-full sm:w-1/3">
                                Number of questions
                            </label>
                            <div className="relative w-full sm:w-2/3 max-w-md">
                                <select
                                    value={questionsCount}
                                    onChange={e => setQuestionsCount(e.target.value)}
                                    className="w-full appearance-none border border-gray-300 rounded text-[14px] text-gray-700 py-2.5 pl-3 pr-8 focus:outline-none focus:border-[#3c8dbc] focus:ring-1 focus:ring-[#3c8dbc] bg-white cursor-pointer"
                                >
                                    {[5, 10, 15, 20].filter(n => n <= quizTotal).map(n => (
                                        <option key={n} value={n}>{n} questions</option>
                                    ))}
                                    <option value="all">All ({quizTotal}) questions</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Mode */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                            <label className="text-[14px] font-semibold text-gray-700 w-full sm:w-1/3">Mode</label>
                            <div className="w-full sm:w-2/3 max-w-md">
                                <div className="flex bg-gray-100 p-1 rounded-md gap-1">
                                    {modeOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setMode(opt.value)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded text-[13px] font-medium transition-all duration-200 ${mode === opt.value
                                                ? 'bg-white text-[#3c8dbc] shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            {opt.icon} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Time limit */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                            <label className="text-[14px] font-semibold text-gray-700 w-full sm:w-1/3">Time limit</label>
                            <div className="w-full sm:w-2/3 max-w-md flex items-center gap-3">
                                <div className="relative w-32">
                                    <input
                                        type="number"
                                        value={timeLimit}
                                        onChange={e => setTimeLimit(e.target.value)}
                                        min="1"
                                        className="w-full border border-gray-300 rounded text-[14px] text-gray-700 py-2.5 pl-3 pr-10 focus:outline-none focus:border-[#3c8dbc] focus:ring-1 focus:ring-[#3c8dbc] bg-white"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-500 pointer-events-none">
                                        min
                                    </span>
                                </div>
                                <span className="text-[13px] text-gray-500">Total duration for the session</span>
                            </div>
                        </div>

                        {/* Participation */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                            <label className="text-[14px] font-semibold text-gray-700 w-full sm:w-1/3">Participation</label>
                            <div className="w-full sm:w-2/3 max-w-md">
                                <div className="flex bg-gray-100 p-1 rounded-md gap-1">
                                    {participationOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setParticipation(opt.value)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded text-[13px] font-medium transition-all duration-200 ${participation === opt.value
                                                ? 'bg-white text-[#3c8dbc] shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            {opt.icon} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="p-5 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                        <button
                            onClick={handleStart}
                            disabled={launching}
                            className={`flex items-center gap-2 transition-colors px-6 py-2.5 rounded text-[14px] font-semibold shadow-sm text-white ${launching
                                ? 'bg-gray-400 cursor-wait'
                                : 'bg-[#3c8dbc] hover:bg-[#367fa9]'
                                }`}
                        >
                            <Play size={16} className="fill-current" />
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
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3c8dbc]" />
                </div>
            }>
                <QuizSetupInner />
            </Suspense>
        </TeacherLayout>
    )
}
