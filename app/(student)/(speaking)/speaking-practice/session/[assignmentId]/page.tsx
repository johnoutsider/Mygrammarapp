'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import StudentLayout from '@/components/StudentLayout'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { getUserProfile } from '@/lib/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase'
import {
    getSpeakingAssignmentById,
    saveSpeakingResponse,
    SpeakingAssignment,
    SpeakingQuestionStep,
} from '@/lib/speakingService'

declare global {
    interface Window {
        FaceMesh?: new (config: { locateFile: (file: string) => string }) => {
            setOptions: (options: Record<string, unknown>) => void
            onResults: (callback: (results: FaceMeshResults) => void) => void
            send: (input: { image: HTMLVideoElement }) => Promise<void>
            close?: () => void
        }
    }
}

type Landmark = { x: number; y: number }
type FaceMeshResults = { multiFaceLandmarks?: Landmark[][] }
type LogEntry = { no: number; time: string; event: string; duration: string }

const LEFT_IRIS = [468, 469, 470, 471, 472]
const RIGHT_IRIS = [473, 474, 475, 476, 477]
const READING_THRESHOLD = 15

function getAverageY(landmarks: Landmark[], indices: number[]): number {
    return indices.map(index => landmarks[index].y).reduce((sum, value) => sum + value, 0) / indices.length
}

function clampRisk(value: number): number {
    return Math.max(0, Math.min(100, value))
}

function getRingColor(riskLevel: number, detectionEnabled: boolean): string {
    if (!detectionEnabled) return '#f59e0b'
    if (riskLevel >= 60) return '#ef4444'
    if (riskLevel >= 30) return '#f59e0b'
    return '#22c55e'
}

function getRiskLabel(riskLevel: number, detectionEnabled: boolean): string {
    if (!detectionEnabled) return 'Detection fallback mode'
    if (riskLevel >= 60) return 'High cheat risk detected'
    if (riskLevel >= 30) return 'Suspicious behavior detected'
    return 'Speaking behavior looks normal'
}

function getStepIndex(stepParam: string | null, totalSteps: number): number {
    const parsed = Number(stepParam ?? '0')
    if (!Number.isInteger(parsed) || parsed < 0) return 0
    if (parsed >= totalSteps) return Math.max(totalSteps - 1, 0)
    return parsed
}

async function attachVideoStream(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
    video.srcObject = stream
    video.muted = true
    video.playsInline = true

    try {
        await video.play()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const name = error instanceof DOMException ? error.name : ''
        const interrupted = name === 'AbortError' || message.includes('interrupted by a new load request')
        if (!interrupted) {
            throw error
        }
    }
}

export default function SpeakingSessionPage() {
    useAccessGuard()

    const params = useParams<{ assignmentId: string }>()
    const searchParams = useSearchParams()
    const router = useRouter()
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const faceMeshRef = useRef<InstanceType<NonNullable<typeof window.FaceMesh>> | null>(null)
    const frameRequestRef = useRef<number | null>(null)
    const sessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const micMonitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const videoStreamRef = useRef<MediaStream | null>(null)
    const audioStreamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const isMicSpeakingRef = useRef(false)
    const readingFramesRef = useRef(0)
    const noFaceFramesRef = useRef(0)
    const idleFramesRef = useRef(0)
    const warningCountRef = useRef(0)
    const audioChunksRef = useRef<Blob[]>([])
    const sessionSecondsRef = useRef(0)
    const speakingTicksRef = useRef(0)
    const savedRef = useRef(false)
    const detectionDisabledRef = useRef(false)
    const riskLevelRef = useRef(0)
    const logsRef = useRef<LogEntry[]>([])
    const selectedVideoIdRef = useRef('')
    const selectedAudioIdRef = useRef('')

    const [scriptsReady, setScriptsReady] = useState(() =>
        typeof window !== 'undefined' && Boolean(window.FaceMesh)
    )
    const [assignment, setAssignment] = useState<SpeakingAssignment | null>(null)
    const [loading, setLoading] = useState(true)
    const [starting, setStarting] = useState(false)
    const [sessionStarted, setSessionStarted] = useState(false)
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
    const [selectedVideoId, setSelectedVideoId] = useState('')
    const [selectedAudioId, setSelectedAudioId] = useState('')
    const [status, setStatus] = useState('Preparing camera and microphone...')
    const [remainingSeconds, setRemainingSeconds] = useState(0)
    const [warningCount, setWarningCount] = useState(0)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [error, setError] = useState<string | null>(null)
    const [detectionEnabled, setDetectionEnabled] = useState(true)
    const [riskLevel, setRiskLevel] = useState(0)

    // Keep refs in sync with state so useEffect callbacks can read the latest values
    selectedVideoIdRef.current = selectedVideoId
    selectedAudioIdRef.current = selectedAudioId

    const stepIndex = useMemo(() => getStepIndex(searchParams.get('step'), assignment?.questionSteps.length ?? 1), [assignment?.questionSteps.length, searchParams])
    const currentStep: SpeakingQuestionStep | null = assignment?.questionSteps[stepIndex] ?? null

    const addLog = useCallback((event: string, duration = '-') => {
        const time = new Date().toLocaleTimeString()
        setLogs(current => {
            const next = [{ no: current.length + 1, time, event, duration }, ...current]
            logsRef.current = next
            return next
        })
    }, [])

    const updateRiskLevel = useCallback((nextRisk: number) => {
        const clamped = clampRisk(nextRisk)
        riskLevelRef.current = clamped
        setRiskLevel(clamped)
    }, [])

    const disableDetection = useCallback((reason: string) => {
        if (detectionDisabledRef.current) return
        detectionDisabledRef.current = true
        setDetectionEnabled(false)
        faceMeshRef.current?.close?.()
        faceMeshRef.current = null
        if (frameRequestRef.current) cancelAnimationFrame(frameRequestRef.current)
        frameRequestRef.current = null
        updateRiskLevel(Math.max(riskLevelRef.current, 40))
        setStatus('Camera is running. Detection fallback mode is active.')
        addLog(reason)
    }, [addLog, updateRiskLevel])

    const stopMedia = useCallback(() => {
        if (frameRequestRef.current) cancelAnimationFrame(frameRequestRef.current)
        if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current)
        if (micMonitorIntervalRef.current) clearInterval(micMonitorIntervalRef.current)
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
        frameRequestRef.current = null
        sessionIntervalRef.current = null
        micMonitorIntervalRef.current = null
        silenceTimeoutRef.current = null

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop()
        }

        faceMeshRef.current?.close?.()
        faceMeshRef.current = null
        mediaRecorderRef.current = null
        videoStreamRef.current?.getTracks().forEach(track => track.stop())
        audioStreamRef.current?.getTracks().forEach(track => track.stop())
        videoStreamRef.current = null
        audioStreamRef.current = null

        if (audioContextRef.current) {
            void audioContextRef.current.close()
            audioContextRef.current = null
        }

        if (videoRef.current) videoRef.current.srcObject = null
    }, [])

    const saveAndExit = useCallback(async () => {
        if (!assignment || !currentStep || savedRef.current) return
        savedRef.current = true

        // Capture mimeType before stopMedia nulls the ref
        const recorderMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'

        // Stop the MediaRecorder and wait for its final data chunk
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state === 'recording') {
            await new Promise<void>(resolve => {
                recorder.addEventListener('stop', () => resolve(), { once: true })
                recorder.stop()
            })
        }

        stopMedia()

        const currentUser = auth.currentUser
        if (!currentUser) {
            router.replace('/dashboard')
            return
        }

        try {
            // Combine all audio chunks into one valid file, upload to Storage, then transcribe
            let transcript = ''
            let audioUrl: string | undefined
            if (audioChunksRef.current.length > 0) {
                const fullBlob = new Blob(audioChunksRef.current, { type: recorderMimeType })
                if (fullBlob.size >= 1024) {
                    const ext = recorderMimeType.includes('ogg') ? 'ogg' : 'webm'

                    // Upload audio to Firebase Storage
                    try {
                        const audioRef = storageRef(storage, `speaking/${currentUser.uid}/${Date.now()}.${ext}`)
                        const snapshot = await uploadBytes(audioRef, fullBlob, { contentType: recorderMimeType })
                        audioUrl = await getDownloadURL(snapshot.ref)
                    } catch (uploadErr) {
                        console.error('Audio upload error:', uploadErr)
                    }

                    // Transcribe with OpenAI
                    const fd = new FormData()
                    fd.append('audio', fullBlob, `recording.${ext}`)
                    try {
                        const res = await fetch('/api/speaking/transcribe', { method: 'POST', body: fd })
                        const data = await res.json()
                        if (res.ok && typeof data?.text === 'string') transcript = data.text.trim()
                    } catch (transcribeErr) {
                        console.error('Transcription error:', transcribeErr)
                    }
                }
                audioChunksRef.current = []
            }

            const profile = await getUserProfile(currentUser.uid)
            await saveSpeakingResponse({
                assignmentId: assignment.id,
                questionText: currentStep.text,
                questionLabel: `${assignment.partLabel} - Step ${stepIndex + 1} of ${assignment.questionSteps.length}`,
                partLabel: assignment.partLabel,
                stepIndex,
                stepTotal: assignment.questionSteps.length,
                studentId: currentUser.uid,
                studentName: profile?.displayName || profile?.name || currentUser.displayName || 'Student',
                transcript,
                audioUrl,
                warningCount: warningCountRef.current,
                sessionSeconds: sessionSecondsRef.current,
                speakingSeconds: Math.floor(speakingTicksRef.current / 10),
                logs: logsRef.current.slice(0, 100).reverse(),
            })

            if (stepIndex + 1 < assignment.questionSteps.length) {
                router.replace(`/speaking-practice?assignmentId=${assignment.id}&step=${stepIndex + 1}`)
                return
            }

            router.replace('/speaking-log')
        } catch (saveError) {
            console.error(saveError)
            setError('Failed to save your speaking response.')
        }
    }, [assignment, currentStep, router, stepIndex, stopMedia])

    const handleFaceMeshResults = useCallback((results: FaceMeshResults) => {
        if (detectionDisabledRef.current) return

        const faces = results.multiFaceLandmarks || []

        if (faces.length === 0) {
            noFaceFramesRef.current += 1
            idleFramesRef.current += 1
            updateRiskLevel(riskLevelRef.current + 4)
            if (noFaceFramesRef.current === 20) {
                setStatus('No face detected.')
                addLog('Student left camera')
            }
            return
        }

        if (faces.length > 1) {
            updateRiskLevel(100)
            setStatus('Multiple people detected.')
            addLog('Multiple faces detected')
            return
        }

        noFaceFramesRef.current = 0
        const landmarks = faces[0]
        const avgIrisY = (getAverageY(landmarks, LEFT_IRIS) + getAverageY(landmarks, RIGHT_IRIS)) / 2
        const eyeCenter = (landmarks[159].y + landmarks[145].y) / 2
        const lookingDown = avgIrisY > eyeCenter + 0.01
        const headTiltDown = (landmarks[152].y - landmarks[1].y) < 0.22
        const lipMoving = Math.abs(landmarks[14].y - landmarks[13].y) > 0.02
        const isSpeaking = lipMoving || isMicSpeakingRef.current
        const isReading = lookingDown || headTiltDown

        if (isReading) {
            idleFramesRef.current = 0
            readingFramesRef.current += 1
            updateRiskLevel(riskLevelRef.current + 6)
            if (readingFramesRef.current === READING_THRESHOLD) {
                warningCountRef.current += 1
                setWarningCount(warningCountRef.current)
                setStatus('Warning: you seem to be reading.')
                addLog('Reading detected')
            }
            return
        }

        readingFramesRef.current = 0
        if (isSpeaking) {
            idleFramesRef.current = 0
            speakingTicksRef.current += 1
            updateRiskLevel(riskLevelRef.current - 5)
            setStatus('Speaking in progress...')
            return
        }

        idleFramesRef.current += 1
        const idleRiskBoost = idleFramesRef.current > 40 ? 3 : 1
        updateRiskLevel(riskLevelRef.current + idleRiskBoost)
        setStatus('Looking at camera but not speaking.')
    }, [addLog, updateRiskLevel])

    useEffect(() => {
        const loadAssignment = async () => {
            try {
                const nextAssignment = await getSpeakingAssignmentById(params.assignmentId)
                if (!nextAssignment) {
                    setError('Speaking prompt not found.')
                    return
                }
                setAssignment(nextAssignment)
                setRemainingSeconds(nextAssignment.speakingSeconds)
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load the speaking session.')
            } finally {
                setLoading(false)
            }
        }

        void loadAssignment()
    }, [params.assignmentId])

    useEffect(() => {
        if (!assignment) return
        setRemainingSeconds(assignment.speakingSeconds)
    }, [assignment, stepIndex])

    // Enumerate camera/mic devices for the setup screen
    useEffect(() => {
        if (loading || !assignment || sessionStarted) return
        const enumDevices = async () => {
            try {
                const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                tempStream.getTracks().forEach(t => t.stop())
                const all = await navigator.mediaDevices.enumerateDevices()
                const vids = all.filter(d => d.kind === 'videoinput')
                const auds = all.filter(d => d.kind === 'audioinput')
                setVideoDevices(vids)
                setAudioDevices(auds)
                // Auto-select the first available device so no manual picking is needed
                if (vids.length > 0) setSelectedVideoId(vids[0].deviceId)
                if (auds.length > 0) setSelectedAudioId(auds[0].deviceId)
            } catch (err) {
                console.error('Device enumeration error:', err)
            }
        }
        void enumDevices()
    }, [loading, assignment, sessionStarted])

    useEffect(() => {
        if (!assignment || !currentStep || !scriptsReady || loading || !sessionStarted) return

        const startSession = async () => {
            if (!videoRef.current) return
            setStarting(true)
            detectionDisabledRef.current = false
            setDetectionEnabled(true)
            updateRiskLevel(0)
            readingFramesRef.current = 0
            noFaceFramesRef.current = 0
            idleFramesRef.current = 0
            warningCountRef.current = 0
            setWarningCount(0)

            try {
                const combinedStream = await navigator.mediaDevices.getUserMedia({
                    video: selectedVideoIdRef.current ? { deviceId: { exact: selectedVideoIdRef.current } } : true,
                    audio: selectedAudioIdRef.current ? { deviceId: { exact: selectedAudioIdRef.current } } : true,
                })
                const videoStream = new MediaStream(combinedStream.getVideoTracks())
                const audioStream = new MediaStream(combinedStream.getAudioTracks())

                videoStreamRef.current = videoStream
                audioStreamRef.current = audioStream
                await attachVideoStream(videoRef.current, videoStream)

                if (window.FaceMesh) {
                    try {
                        const faceMesh = new window.FaceMesh({
                            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                        })
                        faceMesh.setOptions({
                            maxNumFaces: 2,
                            refineLandmarks: true,
                            minDetectionConfidence: 0.5,
                            minTrackingConfidence: 0.5,
                        })
                        faceMesh.onResults(handleFaceMeshResults)
                        faceMeshRef.current = faceMesh

                        const loop = async () => {
                            if (!videoRef.current || !faceMeshRef.current || detectionDisabledRef.current) return
                            try {
                                if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
                                    frameRequestRef.current = requestAnimationFrame(() => { void loop() })
                                    return
                                }

                                await faceMeshRef.current.send({ image: videoRef.current })
                                frameRequestRef.current = requestAnimationFrame(() => { void loop() })
                            } catch (faceMeshError) {
                                console.error(faceMeshError)
                                disableDetection('Face detection fallback activated')
                            }
                        }

                        frameRequestRef.current = requestAnimationFrame(() => { void loop() })
                    } catch (faceMeshInitError) {
                        console.error(faceMeshInitError)
                        disableDetection('Face detection could not be started')
                    }
                } else {
                    disableDetection('Face detection script did not load')
                }

                const audioContext = new AudioContext()
                audioContextRef.current = audioContext
                const analyser = audioContext.createAnalyser()
                const source = audioContext.createMediaStreamSource(audioStream)
                source.connect(analyser)
                analyser.fftSize = 512
                const dataArray = new Uint8Array(analyser.frequencyBinCount)

                micMonitorIntervalRef.current = setInterval(() => {
                    analyser.getByteFrequencyData(dataArray)
                    const volume = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
                    isMicSpeakingRef.current = volume > 10

                    if (!isMicSpeakingRef.current && !silenceTimeoutRef.current) {
                        silenceTimeoutRef.current = setTimeout(() => {
                            updateRiskLevel(riskLevelRef.current + 8)
                            addLog('Long silence detected')
                            silenceTimeoutRef.current = null
                        }, 3000)
                    } else if (isMicSpeakingRef.current && silenceTimeoutRef.current) {
                        clearTimeout(silenceTimeoutRef.current)
                        silenceTimeoutRef.current = null
                    }
                }, 100)

                if (typeof MediaRecorder !== 'undefined') {
                    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
                    const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
                    const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream)
                    mediaRecorderRef.current = recorder
                    recorder.ondataavailable = event => {
                        if (event.data.size > 0) {
                            audioChunksRef.current.push(event.data)
                        }
                    }
                    recorder.start(10000)
                }

                sessionIntervalRef.current = setInterval(() => {
                    sessionSecondsRef.current += 1
                    setRemainingSeconds(current => {
                        if (current <= 1) {
                            void saveAndExit()
                            return 0
                        }
                        return current - 1
                    })
                }, 1000)

                addLog('Speaking session started')
                setStatus('Speaking in progress...')
            } catch (startError) {
                console.error(startError)
                setError(`Failed to start the speaking session: ${(startError as Error).message}`)
                stopMedia()
            } finally {
                setStarting(false)
            }
        }

        void startSession()

        return () => {
            stopMedia()
        }
    }, [addLog, assignment, currentStep, disableDetection, handleFaceMeshResults, loading, saveAndExit, scriptsReady, sessionStarted, stepIndex, stopMedia, updateRiskLevel])

    if (loading) {
        return (
            <StudentLayout title="Speaking Session">
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4c75c3]" />
                </div>
            </StudentLayout>
        )
    }

    const ringColor = getRingColor(riskLevel, detectionEnabled)
    const progressPct = assignment ? (remainingSeconds / assignment.speakingSeconds) * 100 : 100

    // ── Device setup screen ──
    if (!sessionStarted && assignment) {
        const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4c75c3]'
        return (
            <StudentLayout title="Speaking Session">
                <Script
                    src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
                    strategy="afterInteractive"
                    onLoad={() => setScriptsReady(true)}
                    onError={() => { setScriptsReady(true); setDetectionEnabled(false) }}
                />
                <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Set Up Your Devices</h1>
                        <p className="text-sm text-slate-500 mt-1">Choose your camera and microphone before starting.</p>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Camera</label>
                            <select
                                value={selectedVideoId}
                                onChange={e => setSelectedVideoId(e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Default camera</option>
                                {videoDevices.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>
                                        {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Microphone</label>
                            <select
                                value={selectedAudioId}
                                onChange={e => setSelectedAudioId(e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Default microphone</option>
                                {audioDevices.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>
                                        {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                            {assignment.partLabel} &mdash; Step {stepIndex + 1} of {assignment.questionSteps.length}
                        </div>
                        <div className="text-base font-semibold text-slate-900">{currentStep?.text}</div>
                    </div>

                    <button
                        onClick={() => setSessionStarted(true)}
                        disabled={!scriptsReady}
                        className="w-full px-6 py-3 rounded-xl bg-[#4c75c3] hover:bg-[#3f64ab] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {scriptsReady ? 'Start Session' : 'Loading face detection...'}
                    </button>
                </div>
            </StudentLayout>
        )
    }

    return (
        <StudentLayout title="Speaking Session">
            <Script
                src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
                strategy="afterInteractive"
                onLoad={() => setScriptsReady(true)}
                onError={() => {
                    setScriptsReady(true)
                    setDetectionEnabled(false)
                }}
            />

            <div className="h-full flex flex-col lg:flex-row items-start justify-center gap-5 p-4 lg:p-6 max-w-5xl mx-auto w-full overflow-hidden">

                {/* ── Video panel ── */}
                <div className="flex flex-col items-center gap-3 w-full lg:w-[420px] lg:flex-shrink-0">
                    <div
                        className="w-full rounded-2xl overflow-hidden bg-slate-950 shadow-lg transition-colors duration-500"
                        style={{ border: `4px solid ${ringColor}`, aspectRatio: '1 / 1.1' }}
                    >
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    </div>

                    {/* Countdown card */}
                    <div className="w-full bg-white rounded-xl px-4 py-2.5 shadow-sm">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-slate-500">Step {stepIndex + 1} Countdown</span>
                            <span className="text-lg font-bold text-slate-800">{remainingSeconds}s</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${progressPct}%`, backgroundColor: ringColor }}
                            />
                        </div>
                        <div className="mt-1 text-xs text-slate-400">Detection risk: {riskLevel}%</div>
                    </div>
                </div>

                {/* ── Info panel ── */}
                <div className="flex flex-col justify-center gap-4 flex-1 min-h-0 lg:pt-2">
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                    )}

                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-1.5">
                            {assignment?.partLabel || 'Speaking'} &mdash; Step {stepIndex + 1} of {assignment?.questionSteps.length || 1}
                        </div>
                        <h1 className="text-xl lg:text-3xl font-bold text-slate-900 leading-snug">
                            {currentStep?.text || (starting ? 'Starting your speaking timer...' : 'Answer the question clearly and naturally')}
                        </h1>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm text-slate-500">{status}</p>
                        <p className={`text-xs font-semibold ${riskLevel >= 60 ? 'text-red-600' : riskLevel >= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                            {getRiskLabel(riskLevel, detectionEnabled)}
                        </p>
                    </div>

                    <button
                        onClick={() => void saveAndExit()}
                        className="self-start px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 active:scale-95 transition-all"
                    >
                        End Session
                    </button>
                </div>
            </div>
        </StudentLayout>
    )
}