'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { Video, Mic } from 'lucide-react'
import StudentLayout from '@/components/StudentLayout'
import { useAccessGuard } from '@/hooks/useAccessGuard'
import { getUserProfile } from '@/lib/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase'
import {
    getStudentSpeakingAssignmentById,
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
    const previewVideoRef = useRef<HTMLVideoElement | null>(null)
    const previewStreamRef = useRef<MediaStream | null>(null)
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
    const [permissionDenied, setPermissionDenied] = useState(false)
    const [previewActive, setPreviewActive] = useState(false)

    // Keep refs in sync with state so useEffect callbacks can read the latest values
    selectedVideoIdRef.current = selectedVideoId
    selectedAudioIdRef.current = selectedAudioId

    const skipSetup = searchParams.get('skipSetup') === 'true'
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

    const stopPreview = useCallback(() => {
        previewStreamRef.current?.getTracks().forEach(t => t.stop())
        previewStreamRef.current = null
        setPreviewActive(false)
    }, [])

    const switchPreviewCamera = useCallback(async (deviceId: string) => {
        stopPreview()
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: deviceId ? { deviceId: { exact: deviceId } } : true,
                audio: false,
            })
            previewStreamRef.current = stream
            if (previewVideoRef.current) {
                previewVideoRef.current.srcObject = stream
                await previewVideoRef.current.play().catch(() => {})
            }
            setPreviewActive(true)
        } catch {
            // ignore preview switch failure
        }
    }, [stopPreview])

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
            // Combine all audio chunks into one valid file and upload to Storage
            let audioUrl: string | undefined
            if (audioChunksRef.current.length > 0) {
                const fullBlob = new Blob(audioChunksRef.current, { type: recorderMimeType })
                if (fullBlob.size >= 1024) {
                    const ext = recorderMimeType.includes('ogg') ? 'ogg' : recorderMimeType.includes('mp4') ? 'mp4' : 'webm'

                    // Upload audio to Firebase Storage
                    try {
                        const audioRef = storageRef(storage, `speaking/${currentUser.uid}/${Date.now()}.${ext}`)
                        const snapshot = await uploadBytes(audioRef, fullBlob, { contentType: recorderMimeType })
                        audioUrl = await getDownloadURL(snapshot.ref)
                    } catch (uploadErr) {
                        console.error('Audio upload error:', uploadErr)
                    }
                }
                audioChunksRef.current = []
            }

            const profile = await getUserProfile(currentUser.uid)
            // Save with empty transcript — transcription happens on the review page via Groq
            const saved = await saveSpeakingResponse({
                assignmentId: assignment.id,
                questionText: currentStep.text,
                questionLabel: `${assignment.partLabel} - Step ${stepIndex + 1} of ${assignment.questionSteps.length}`,
                partLabel: assignment.partLabel,
                stepIndex,
                stepTotal: assignment.questionSteps.length,
                studentId: currentUser.uid,
                studentName: profile?.displayName || profile?.name || currentUser.displayName || 'Student',
                transcript: '',
                audioUrl,
                warningCount: warningCountRef.current,
                sessionSeconds: sessionSecondsRef.current,
                speakingSeconds: Math.floor(speakingTicksRef.current / 10),
                logs: logsRef.current.slice(0, 100).reverse(),
            })

            if (stepIndex + 1 < assignment.questionSteps.length) {
                // Go back to the prep page for the next step (runs countdown before starting next session)
                router.replace(`/speaking-practice?assignmentId=${assignment.id}&step=${stepIndex + 1}`)
                return
            }

            // Last question done — clear device sessionStorage so next session starts fresh at setup
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('speaking_camera_id')
                sessionStorage.removeItem('speaking_mic_id')
            }

            // Redirect to review page after last step so student can review + send/delete
            router.replace(`/speaking-log/${saved.id}?review=true`)
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
                const nextAssignment = await getStudentSpeakingAssignmentById(params.assignmentId)
                if (!nextAssignment) {
                    setError('Speaking prompt not found.')
                    return
                }
                setAssignment(nextAssignment)
                setRemainingSeconds(nextAssignment.speakingSeconds)

                if (nextAssignment.id !== params.assignmentId) {
                    const nextParams = searchParams.toString()
                    router.replace(
                        `/speaking-practice/session/${nextAssignment.id}${nextParams ? `?${nextParams}` : ''}`
                    )
                }
            } catch (loadError) {
                console.error(loadError)
                setError('Failed to load the speaking session.')
            } finally {
                setLoading(false)
            }
        }

        void loadAssignment()
    }, [params.assignmentId, router, searchParams])

    useEffect(() => {
        if (!assignment) return
        setRemainingSeconds(assignment.speakingSeconds)
    }, [assignment, stepIndex])

    // If skipSetup=true, restore device IDs from sessionStorage and start immediately
    useEffect(() => {
        if (loading || !assignment || sessionStarted || !skipSetup) return
        const camId = typeof window !== 'undefined' ? sessionStorage.getItem('speaking_camera_id') : null
        const micId = typeof window !== 'undefined' ? sessionStorage.getItem('speaking_mic_id') : null
        if (camId) setSelectedVideoId(camId)
        if (micId) setSelectedAudioId(micId)
        setSessionStarted(true)
    }, [loading, assignment, sessionStarted, skipSetup])

    // Enumerate camera/mic devices for the setup screen
    useEffect(() => {
        if (loading || !assignment || sessionStarted || skipSetup) return
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
                // Start live camera preview
                if (vids.length > 0) {
                    try {
                        const previewStream = await navigator.mediaDevices.getUserMedia({
                            video: { deviceId: { exact: vids[0].deviceId } },
                            audio: false,
                        })
                        previewStreamRef.current = previewStream
                        if (previewVideoRef.current) {
                            previewVideoRef.current.srcObject = previewStream
                            previewVideoRef.current.muted = true
                            previewVideoRef.current.playsInline = true
                            await previewVideoRef.current.play().catch(() => {})
                        }
                        setPreviewActive(true)
                    } catch {
                        // Preview failed but devices are still available
                    }
                }
            } catch (err) {
                console.error('Device enumeration error:', err)
                setPermissionDenied(true)
            }
        }
        void enumDevices()
    }, [loading, assignment, sessionStarted])

    // Stop preview when session starts so it releases the camera for the real stream
    useEffect(() => {
        if (sessionStarted) stopPreview()
    }, [sessionStarted, stopPreview])

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
                    // Prefer ogg/mp4 — Groq Whisper does NOT support webm
                    const preferredTypes = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
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

    // ── Device setup screen ──
    if (!sessionStarted && assignment) {
        const selectClass = 'w-full px-3.5 py-3 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-[#5b7ec9] focus:border-[#5b7ec9] transition-colors'
        return (
            <>
                <Script
                    src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
                    strategy="afterInteractive"
                    onLoad={() => setScriptsReady(true)}
                    onError={() => { setScriptsReady(true); setDetectionEnabled(false) }}
                />
                <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-lg px-10 py-10 w-full max-w-[560px]">

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Video className="w-5 h-5 text-[#5b7ec9]" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900">Device Setup</h1>
                        </div>
                        <p className="text-sm text-slate-400 mb-8 ml-14">Allow access and select your camera and microphone before continuing.</p>

                        {/* Live preview */}
                        <div className="w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden relative mb-7 flex items-center justify-center">
                            <video
                                ref={previewVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover rounded-2xl ${previewActive ? '' : 'hidden'}`}
                            />
                            {!previewActive && (
                                <div className="flex flex-col items-center gap-2.5 text-slate-600">
                                    <Video className="w-9 h-9 stroke-[1.4]" />
                                    <span className="text-sm">Camera preview will appear here</span>
                                </div>
                            )}
                            {previewActive && (
                                <div className="absolute bottom-3 left-3 bg-black/55 text-white text-xs font-semibold px-3 py-1 rounded-full tracking-wide">
                                    ● LIVE
                                </div>
                            )}
                        </div>

                        {/* Dropdowns */}
                        <div className="flex flex-col gap-4 mb-7">
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                                    <Video className="w-3 h-3" /> Camera
                                </label>
                                <select
                                    value={selectedVideoId}
                                    onChange={e => { setSelectedVideoId(e.target.value); void switchPreviewCamera(e.target.value) }}
                                    className={selectClass}
                                >
                                    {permissionDenied
                                        ? <option>Permission denied</option>
                                        : videoDevices.map((d, i) => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                                    <Mic className="w-3 h-3" /> Microphone
                                </label>
                                <select
                                    value={selectedAudioId}
                                    onChange={e => setSelectedAudioId(e.target.value)}
                                    className={selectClass}
                                >
                                    {permissionDenied
                                        ? <option>Permission denied</option>
                                        : audioDevices.map((d, i) => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        {/* Status indicators */}
                        <div className="flex gap-2.5 mb-7">
                            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-500 font-medium">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${permissionDenied ? 'bg-red-500' : videoDevices.length > 0 ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]' : 'bg-slate-300'}`} />
                                Camera
                            </div>
                            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-500 font-medium">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${permissionDenied ? 'bg-red-500' : audioDevices.length > 0 ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]' : 'bg-slate-300'}`} />
                                Microphone
                            </div>
                        </div>

                        {/* Button */}
                        <button
                            onClick={() => {
                                // Persist selected devices so the prep page can pass skipSetup=true
                                if (typeof window !== 'undefined') {
                                    sessionStorage.setItem('speaking_camera_id', selectedVideoId)
                                    sessionStorage.setItem('speaking_mic_id', selectedAudioId)
                                }
                                stopPreview()
                                // Redirect to prep page — it will show the question + timer
                                const nextParams = new URLSearchParams()
                                nextParams.set('assignmentId', assignment.id)
                                nextParams.set('step', String(stepIndex))
                                router.replace(`/speaking-practice?${nextParams.toString()}`)
                            }}
                            disabled={!scriptsReady || permissionDenied}
                            className="w-full py-4 bg-[#5b7ec9] hover:bg-[#4a6db8] text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
                        >
                            {scriptsReady ? 'Continue' : 'Loading face detection...'}
                        </button>
                        <p className="text-center text-xs text-slate-400 mt-3">
                            {permissionDenied
                                ? 'Permission denied. Please allow camera & microphone access.'
                                : videoDevices.length > 0
                                    ? 'Devices ready. You can continue.'
                                    : 'Waiting for permissions\u2026'}
                        </p>

                    </div>
                </div>
            </>
        )
    }

    const riskTier = riskLevel >= 60 ? 'high' : riskLevel >= 30 ? 'medium' : 'low'
    const countdownFormatted = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`

    const camBorderStyle: React.CSSProperties =
        riskTier === 'high'
            ? { border: '5px solid #ef4444', boxShadow: '0 0 0 5px rgba(239,68,68,0.35), 0 0 28px rgba(239,68,68,0.3)', animation: 'redPulse 1.2s ease-in-out infinite' }
            : riskTier === 'medium'
                ? { border: '5px solid #f59e0b', boxShadow: '0 0 0 5px rgba(245,158,11,0.3), 0 0 22px rgba(245,158,11,0.25)' }
                : { border: '5px solid #22c55e', boxShadow: '0 0 0 4px rgba(34,197,94,0.25), 0 0 18px rgba(34,197,94,0.2)' }

    return (
        <>
            <Script
                src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
                strategy="afterInteractive"
                onLoad={() => setScriptsReady(true)}
                onError={() => { setScriptsReady(true); setDetectionEnabled(false) }}
            />
            <style>{`
                @keyframes redPulse {
                    0%,100% { box-shadow: 0 0 0 5px rgba(239,68,68,0.35), 0 0 28px rgba(239,68,68,0.3); }
                    50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0.5),  0 0 40px rgba(239,68,68,0.45); }
                }
                @keyframes liveDot {
                    0%,100% { opacity: 1; } 50% { opacity: 0.3; }
                }
                .live-dot-anim { animation: liveDot 1.4s ease-in-out infinite; }
            `}</style>

            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
                <div className="bg-white rounded-3xl shadow-lg p-7 w-full max-w-[480px] flex flex-col gap-5">

                    {/* Camera */}
                    <div
                        className="w-full rounded-2xl overflow-hidden bg-slate-900 relative transition-all duration-500"
                        style={{ aspectRatio: '1/1', ...camBorderStyle }}
                    >
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                        {/* LIVE pill */}
                        <div className="absolute top-3 left-3 bg-black/55 text-white text-[0.65rem] font-bold tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot-anim" />
                            LIVE
                        </div>
                    </div>

                    {/* Topic */}
                    <div>
                        <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                            {assignment?.partLabel || 'Speaking'} &mdash; Step {stepIndex + 1} of {assignment?.questionSteps.length || 1}
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 leading-snug">
                            {currentStep?.text || (starting ? 'Starting...' : 'Answer the question')}
                        </h1>
                    </div>

                    {/* Warning — only visible at high risk */}
                    {riskTier === 'high' && (
                        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-sm text-red-500 font-medium">
                            <svg className="w-4 h-4 flex-shrink-0 stroke-red-500" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            {getRiskLabel(riskLevel, detectionEnabled)}
                        </div>
                    )}

                    {/* Stats row */}
                    <div className="flex border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="flex-1 flex flex-col items-center py-3.5 gap-1 border-r border-slate-200">
                            <span className="text-[0.62rem] font-semibold uppercase tracking-widest text-slate-400">Countdown</span>
                            <span className="text-lg font-bold text-slate-900">{countdownFormatted}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center py-3.5 gap-1 border-r border-slate-200">
                            <span className="text-[0.62rem] font-semibold uppercase tracking-widest text-slate-400">Status</span>
                            <span className="text-lg font-bold text-green-600">{starting ? 'Starting' : 'Active'}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center py-3.5 gap-1">
                            <span className="text-[0.62rem] font-semibold uppercase tracking-widest text-slate-400">Risk</span>
                            <span className={`text-lg font-bold ${riskTier === 'high' ? 'text-red-500' : riskTier === 'medium' ? 'text-amber-500' : 'text-green-600'}`}>
                                {riskTier === 'high' ? 'High' : riskTier === 'medium' ? 'Medium' : 'Low'}
                            </span>
                        </div>
                    </div>

                    {/* End button */}
                    <button
                        onClick={() => void saveAndExit()}
                        className="w-full py-4 bg-slate-800 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                        End Session
                    </button>

                </div>
            </div>
        </>
    )
}
