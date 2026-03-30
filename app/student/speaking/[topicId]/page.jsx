'use client'

import 'regenerator-runtime/runtime'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuthState } from 'react-firebase-hooks/auth'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Mic, Volume2, X, Check } from 'lucide-react'
import { auth, storage } from '@/lib/firebase'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import {
    getSpeakingTopic,
    listGuidedSpeakingQuestions,
    saveGuidedSpeakingSubmission,
} from '@/lib/guidedSpeakingService'

function formatElapsedTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderSentenceWithPlaceholders(sentence) {
    return sentence.split(/(\[[^\]]+\])/g).filter(Boolean).map((part, index) => {
        const isPlaceholder = /^\[[^\]]+\]$/.test(part)
        return (
            <span
                key={`${part}-${index}`}
                className={isPlaceholder ? 'text-slate-400' : ''}
            >
                {part}
            </span>
        )
    })
}

function renderExampleWithHighlights(example, sentence) {
    if (!sentence) return example

    const parts = sentence.split(/(\[[^\]]+\])/g).filter(Boolean)
    const hasPlaceholder = parts.some(part => /^\[[^\]]+\]$/.test(part))
    if (!hasPlaceholder) return example

    const pattern = new RegExp(
        `^${parts.map(part => (/^\[[^\]]+\]$/.test(part) ? '(.+?)' : escapeRegExp(part))).join('')}$`,
    )
    const match = example.match(pattern)
    if (!match) return example

    let placeholderIndex = 1
    return parts.map((part, index) => {
        if (!/^\[[^\]]+\]$/.test(part)) {
            return <span key={`${part}-${index}`}>{part}</span>
        }

        const replacement = match[placeholderIndex] || ''
        placeholderIndex += 1

        return (
            <strong
                key={`${replacement}-${index}`}
                className="font-semibold underline decoration-2 underline-offset-4"
            >
                {replacement}
            </strong>
        )
    })
}

function StepProgress({ total, currentIndex, completedCount }) {
    return (
        <div className="flex items-center justify-center gap-2 overflow-x-auto px-2">
            {Array.from({ length: total }).map((_, index) => {
                const isCompleted = index < completedCount
                const isCurrent = index === currentIndex && !isCompleted
                const isFuture = index > currentIndex && !isCompleted

                return (
                    <div key={`step-${index}`} className="flex items-center gap-2">
                        <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
                                isCompleted
                                    ? 'border-sky-500 bg-sky-500 text-white'
                                    : isCurrent
                                        ? 'border-2 border-sky-500 bg-white text-sky-600'
                                        : 'border-slate-200 bg-slate-100 text-slate-400'
                            }`}
                        >
                            {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                        </div>
                        {index < total - 1 ? (
                            <div className={`h-1 w-10 rounded-full ${isCompleted ? 'bg-sky-500' : 'bg-slate-200'}`} />
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}

export default function StudentGuidedSpeakingSessionPage() {
    useAccessGuard()

    const params = useParams()
    const router = useRouter()
    const topicId = Array.isArray(params?.topicId) ? params.topicId[0] : params?.topicId
    const [user] = useAuthState(auth)
    const [topic, setTopic] = useState(null)
    const [questions, setQuestions] = useState([])
    const [answers, setAnswers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [isHintOpen, setIsHintOpen] = useState(false)
    const [hintTab, setHintTab] = useState('guided')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isRecording, setIsRecording] = useState(false)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [recordingSeconds, setRecordingSeconds] = useState(0)
    const [isCompleted, setIsCompleted] = useState(false)
    const [saveError, setSaveError] = useState('')

    const transcriptContainerRef = useRef(null)
    const recordingTimerRef = useRef(null)
    const sessionStartRef = useRef(Date.now())
    const currentQuestionStartRef = useRef('00:00:00')
    const latestTranscriptRef = useRef('')
    const mediaRecorderRef = useRef(null)
    const audioStreamRef = useRef(null)
    const audioChunksRef = useRef([])
    const recorderMimeTypeRef = useRef('audio/webm')

    const {
        transcript,
        finalTranscript,
        resetTranscript,
        browserSupportsSpeechRecognition,
    } = useSpeechRecognition()

    useEffect(() => {
        latestTranscriptRef.current = transcript
    }, [transcript])

    useEffect(() => {
        const loadSession = async () => {
            if (!topicId) {
                setLoading(false)
                setError('Topic not found.')
                return
            }

            try {
                const [nextTopic, nextQuestions] = await Promise.all([
                    getSpeakingTopic(topicId),
                    listGuidedSpeakingQuestions(topicId),
                ])

                if (!nextTopic || !nextTopic.isPublished) {
                    setError('This topic is not available right now.')
                    setLoading(false)
                    return
                }

                if (nextQuestions.length === 0) {
                    setError('This topic does not have any guided speaking questions yet.')
                    setLoading(false)
                    return
                }

                setTopic(nextTopic)
                setQuestions(nextQuestions)
                sessionStartRef.current = Date.now()
                setError('')
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load this guided speaking session.')
            } finally {
                setLoading(false)
            }
        }

        void loadSession()
    }, [topicId])

    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current)
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop()
            }
            audioStreamRef.current?.getTracks().forEach(track => track.stop())
            mediaRecorderRef.current = null
            audioStreamRef.current = null
            audioChunksRef.current = []
            void SpeechRecognition.stopListening()
        }
    }, [])

    useEffect(() => {
        if (!transcriptContainerRef.current) return

        transcriptContainerRef.current.scrollTo({
            top: transcriptContainerRef.current.scrollHeight,
            behavior: 'smooth',
        })
    }, [answers, currentIndex, isCompleted])

    const currentQuestion = questions[currentIndex]
    const canRecord = Boolean(browserSupportsSpeechRecognition && !loading && !error && currentQuestion && !isTransitioning && !isCompleted)

    const startAudioCapture = async () => {
        audioChunksRef.current = []

        if (typeof window === 'undefined') return
        if (typeof MediaRecorder === 'undefined') return
        if (!navigator.mediaDevices?.getUserMedia) return

        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioStreamRef.current = audioStream

        const preferredTypes = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
        const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type)) || ''
        const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream)

        recorderMimeTypeRef.current = recorder.mimeType || mimeType || 'audio/webm'
        recorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data)
            }
        }
        recorder.start(1000)
        mediaRecorderRef.current = recorder
    }

    const stopAudioCapture = async () => {
        const recorder = mediaRecorderRef.current
        const mimeType = recorderMimeTypeRef.current || recorder?.mimeType || 'audio/webm'

        if (recorder && recorder.state !== 'inactive') {
            await new Promise(resolve => {
                recorder.addEventListener('stop', () => resolve(), { once: true })
                recorder.stop()
            })
        }

        audioStreamRef.current?.getTracks().forEach(track => track.stop())
        mediaRecorderRef.current = null
        audioStreamRef.current = null

        if (audioChunksRef.current.length === 0) return undefined

        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioChunksRef.current = []
        if (fullBlob.size < 1024) return undefined

        const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const audioRef = storageRef(
            storage,
            `guided-speaking/${user.uid}/${topicId}/${Date.now()}-${currentQuestion.id}.${extension}`,
        )
        const snapshot = await uploadBytes(audioRef, fullBlob, { contentType: mimeType })
        return getDownloadURL(snapshot.ref)
    }

    const startRecording = async () => {
        if (!currentQuestion || !canRecord) return

        resetTranscript()
        setSaveError('')
        currentQuestionStartRef.current = formatElapsedTime(
            Math.floor((Date.now() - sessionStartRef.current) / 1000),
        )
        setRecordingSeconds(0)
        setIsRecording(true)

        recordingTimerRef.current = setInterval(() => {
            setRecordingSeconds(current => current + 1)
        }, 1000)

        try {
            await startAudioCapture()
        } catch (audioError) {
            console.error(audioError)
        }

        await SpeechRecognition.startListening({
            continuous: true,
            language: 'en-US',
        })
    }

    const finishQuestion = async () => {
        if (!currentQuestion || !user?.uid) return

        setIsTransitioning(true)
        setIsRecording(false)

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current)
            recordingTimerRef.current = null
        }

        await SpeechRecognition.stopListening()

        const capturedTranscript = (finalTranscript || latestTranscriptRef.current || '').trim()
        let audioUrl
        try {
            audioUrl = await stopAudioCapture()
        } catch (audioError) {
            console.error(audioError)
        }
        const nextAnswer = {
            questionId: currentQuestion.id,
            questionText: currentQuestion.questionText,
            transcript: capturedTranscript,
            durationSeconds: recordingSeconds,
            startedAt: currentQuestionStartRef.current,
            ...(audioUrl ? { audioUrl } : {}),
        }

        const nextAnswers = [...answers, nextAnswer]
        setAnswers(nextAnswers)
        resetTranscript()
        setIsHintOpen(false)
        setHintTab('guided')

        if (currentIndex === questions.length - 1) {
            try {
                await saveGuidedSpeakingSubmission({
                    studentId: user.uid,
                    topicId,
                    answers: nextAnswers,
                })
                setIsCompleted(true)
                setIsTransitioning(false)
                setSaveError('')
            } catch (submissionError) {
                console.error(submissionError)
                setSaveError('Failed to save your speaking submission.')
                setIsTransitioning(false)
            }
            return
        }

        window.setTimeout(() => {
            setCurrentIndex(index => index + 1)
            setIsTransitioning(false)
            setRecordingSeconds(0)
        }, 800)
    }

    const micState = isRecording ? 'recording' : isTransitioning ? 'idle' : 'ready'

    const transcriptBlocks = useMemo(() => {
        return answers.map((answer, index) => ({
            ...answer,
            number: index + 1,
        }))
    }, [answers])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-sky-500" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
                <div className="w-full max-w-2xl rounded-[32px] border border-red-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-2xl font-semibold text-slate-900">Guided Speaking Unavailable</h1>
                    <p className="mt-3 text-sm text-slate-500">{error}</p>
                    <Link
                        href="/student/speaking"
                        className="mt-6 inline-flex rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600"
                    >
                        Back to Topics
                    </Link>
                </div>
            </div>
        )
    }

    if (isCompleted) {
        return (
            <div className="min-h-screen bg-slate-100 px-4 py-10">
                <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="text-center">
                        <p className="text-4xl">🎉</p>
                        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Well done!</h1>
                        <p className="mt-2 text-base text-slate-500">
                            You&apos;ve completed {topic?.title}
                        </p>
                        {saveError ? (
                            <p className="mt-3 text-sm text-red-600">{saveError}</p>
                        ) : null}
                    </div>

                    <div className="mt-8 space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                        <h2 className="text-lg font-semibold text-slate-900">Full Transcript Summary</h2>
                        {answers.map((answer, index) => (
                            <div key={answer.questionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-sm font-semibold text-slate-900">
                                    {index + 1}. {answer.questionText}
                                </p>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                                    {answer.startedAt} • {answer.durationSeconds}s
                                </p>
                                <p className="mt-3 text-sm leading-7 text-slate-700">
                                    {answer.transcript || 'No transcript captured.'}
                                </p>
                                {answer.audioUrl ? (
                                    <audio
                                        controls
                                        src={answer.audioUrl}
                                        className="mt-3 w-full rounded-lg"
                                    />
                                ) : null}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 text-center">
                        <button
                            type="button"
                            onClick={() => router.push('/student/speaking')}
                            className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
                        >
                            Back to Topics
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="truncate text-xl font-semibold text-slate-900">{topic?.title}</h1>
                    </div>
                    <div className="hidden flex-1 lg:block">
                        <StepProgress
                            total={questions.length}
                            currentIndex={currentIndex}
                            completedCount={answers.length}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push('/student/speaking')}
                        className="rounded-full border border-slate-200 p-3 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        aria-label="Close guided speaking session"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="mx-auto mt-4 max-w-[1800px] lg:hidden">
                    <StepProgress
                        total={questions.length}
                        currentIndex={currentIndex}
                        completedCount={answers.length}
                    />
                </div>
            </div>

            <div className="mx-auto grid min-h-[calc(100vh-89px)] max-w-[1800px] grid-cols-1 lg:grid-cols-2">
                <section className="border-b border-slate-200 bg-white px-6 py-8 lg:border-b-0 lg:border-r">
                    <div className="mx-auto flex h-full max-w-3xl flex-col items-center text-center">
                        <p className="max-w-2xl text-base leading-7 text-slate-500">
                            Answer the following question by speaking for at least 30 seconds. Tab the button to speak.
                        </p>

                        <div className="mt-10 flex items-start gap-4">
                            <div className="mt-1 rounded-full border border-slate-200 bg-white p-3 text-sky-500 shadow-sm">
                                <Volume2 className="h-5 w-5" />
                            </div>
                            <h2 className="text-left text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                                {currentIndex + 1}. {currentQuestion?.questionText}
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsHintOpen(open => !open)}
                            className="mt-10 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:from-sky-500 hover:to-blue-600"
                        >
                            💡 Not sure what to say? Click here!
                        </button>

                        {isHintOpen ? (
                            <div className="mt-8 w-full rounded-[28px] border border-sky-300 bg-white p-5 text-left shadow-sm">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                                    <div className="flex flex-wrap gap-5">
                                        <button
                                            type="button"
                                            onClick={() => setHintTab('guided')}
                                            className={`border-b-2 pb-2 text-lg font-medium transition ${
                                                hintTab === 'guided'
                                                    ? 'border-sky-500 text-sky-600'
                                                    : 'border-transparent text-slate-500'
                                            }`}
                                        >
                                            Guided Questions
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHintTab('sample')}
                                            className={`border-b-2 pb-2 text-lg font-medium transition ${
                                                hintTab === 'sample'
                                                    ? 'border-sky-500 text-sky-600'
                                                    : 'border-transparent text-slate-500'
                                            }`}
                                        >
                                            Sample Answers
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsHintOpen(false)}
                                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                        aria-label="Close hints"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {hintTab === 'guided' ? (
                                    <div className="space-y-4 pt-4">
                                        <p className="text-base text-slate-600">
                                            Answer the guided questions below to form your sentences.
                                        </p>
                                        <ul className="list-disc space-y-3 pl-5 text-base leading-7 text-slate-800">
                                            {currentQuestion?.guidedQuestions.map(item => <li key={item}>{item}</li>)}
                                        </ul>
                                        <div>
                                            <p className="text-base font-semibold text-slate-900">Suggested words:</p>
                                            <ul className="mt-3 list-disc space-y-3 pl-5 text-base leading-7 text-slate-800">
                                                {currentQuestion?.suggestedWords.map(item => <li key={item}>{item}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pt-4">
                                        <p className="text-base text-slate-600">
                                            Add your own words to the sentences below, and read them aloud.
                                        </p>
                                        <div>
                                            <p className="text-base font-semibold text-slate-900">Suggested sentences:</p>
                                            <ul className="mt-3 list-disc space-y-3 pl-5 text-base leading-7 text-slate-800">
                                                {currentQuestion?.sampleSentences.map(sentence => (
                                                    <li key={sentence}>{renderSentenceWithPlaceholders(sentence)}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-slate-900">Examples:</p>
                                            <ul className="mt-3 list-disc space-y-3 pl-5 text-base leading-7 text-slate-800">
                                                {currentQuestion?.sampleExamples.map((example, index) => (
                                                    <li key={`${example}-${index}`}>
                                                        {renderExampleWithHighlights(example, currentQuestion?.sampleSentences[index] || currentQuestion?.sampleSentences[0] || '')}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </section>

                <section className="flex min-h-[50vh] flex-col bg-white px-6 py-8">
                    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
                        <div className="flex-1">
                            <h2 className="text-2xl font-semibold text-slate-900">Your Transcript</h2>
                            {!browserSupportsSpeechRecognition ? (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                                    Your browser does not support speech recognition. Please open this activity in a compatible browser.
                                </div>
                            ) : null}
                            {saveError ? (
                                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                                    {saveError}
                                </div>
                            ) : null}

                            <div
                                ref={transcriptContainerRef}
                                className="mt-4 h-[420px] overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-50 p-6 lg:h-[520px]"
                            >
                                <div className="space-y-8">
                                    {transcriptBlocks.map(answer => (
                                        <div key={answer.questionId} className="space-y-2">
                                            <p className="text-xl font-semibold text-slate-900">
                                                {answer.number}. {answer.questionText}
                                            </p>
                                            <p className="text-sm font-medium text-slate-400">{answer.startedAt}</p>
                                            <p className="text-base leading-7 text-slate-700">
                                                {answer.transcript || 'No transcript captured.'}
                                            </p>
                                        </div>
                                    ))}

                                    {currentQuestion ? (
                                        <div className="space-y-2">
                                            <p className="text-xl font-semibold text-slate-900">
                                                {currentIndex + 1}. {currentQuestion.questionText}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col items-center justify-end">
                            {micState === 'recording' ? (
                                <p className="mb-4 text-base font-medium text-orange-500">
                                    Recording... ({recordingSeconds})
                                </p>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => {
                                    if (isRecording) {
                                        void finishQuestion()
                                    } else {
                                        void startRecording()
                                    }
                                }}
                                disabled={!canRecord}
                                className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition ${
                                    micState === 'recording'
                                        ? 'bg-emerald-500 hover:bg-emerald-600'
                                        : micState === 'idle'
                                            ? 'bg-slate-300'
                                            : 'bg-sky-500 hover:bg-sky-600'
                                } disabled:cursor-not-allowed disabled:bg-slate-300`}
                                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                            >
                                <Mic className="h-9 w-9" />
                            </button>

                            {micState === 'ready' ? (
                                <p className="mt-4 text-center text-base text-slate-700">
                                    Click the microphone when you&apos;re ready to speak.
                                </p>
                            ) : null}

                            {micState === 'recording' ? (
                                <p className="mt-4 text-center text-base text-slate-700">
                                    Recording...Click when you&apos;re finished.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
