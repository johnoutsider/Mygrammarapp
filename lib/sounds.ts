// lib/sounds.ts

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let bgAudio: HTMLAudioElement | null = null
let isMuted = false

// ── Unlock audio on first user gesture ────────────────────────────────────────
// Call this inside any button click handler to unblock the browser

export function unlockAudio() {
    // Pre-create and immediately pause — this satisfies the browser's
    // "user gesture required" rule for all future audio calls
    if (!bgAudio) {
        bgAudio = new Audio('/sounds/background.mp3')
        bgAudio.loop = true
        bgAudio.volume = isMuted ? 0 : 0.5
    }

    // Also unlock Web Audio context
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        masterGain = audioCtx.createGain()
        masterGain.connect(audioCtx.destination)
        masterGain.gain.value = isMuted ? 0 : 1
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume()
    }
}

// ── Internal Web Audio helpers ─────────────────────────────────────────────────

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        masterGain = audioCtx.createGain()
        masterGain.connect(audioCtx.destination)
        masterGain.gain.value = isMuted ? 0 : 1
    }
    return { ctx: audioCtx, master: masterGain! }
}

function playNote(
    freq: number,
    startTime: number,
    duration: number,
    volume = 0.3,
    type: OscillatorType = 'sine'
) {
    const { ctx, master } = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(master)
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.start(startTime)
    osc.stop(startTime + duration + 0.05)
}

// ── Background music ───────────────────────────────────────────────────────────

export function startBackgroundMusic() {
    if (!bgAudio) {
        bgAudio = new Audio('/sounds/background.mp3')
        bgAudio.loop = true
        bgAudio.volume = isMuted ? 0 : 0.5
    }

    // Reset to start of track for each new question
    bgAudio.currentTime = 0

    bgAudio.play().catch(err => {
        console.warn('Background music blocked by browser:', err)
    })
}

export function stopBackgroundMusic() {
    if (bgAudio) {
        bgAudio.pause()
        bgAudio.currentTime = 0
    }
}

// ── Correct answer fanfare ─────────────────────────────────────────────────────

export function playCorrectSound() {
    const { ctx } = getCtx()
    ctx.resume()
    const now = ctx.currentTime
    const fanfare = [
        { freq: 523.25, t: 0.00 },
        { freq: 659.25, t: 0.10 },
        { freq: 783.99, t: 0.20 },
        { freq: 1046.50, t: 0.30 },
    ]
    fanfare.forEach(({ freq, t }) => {
        playNote(freq, now + t, 0.35, 0.35, 'sine')
    })
    playNote(261.63, now, 0.7, 0.15, 'triangle')
}

// ── Mute control ───────────────────────────────────────────────────────────────

export function setSoundMuted(muted: boolean) {
    isMuted = muted

    if (bgAudio) {
        bgAudio.volume = muted ? 0 : 0.5
    }

    try {
        const { master } = getCtx()
        master.gain.setTargetAtTime(muted ? 0 : 1, audioCtx!.currentTime, 0.1)
    } catch {
        // AudioContext not yet created — fine
    }
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

export function cleanupSounds() {
    stopBackgroundMusic()
    bgAudio = null
    if (audioCtx) {
        audioCtx.close()
        audioCtx = null
        masterGain = null
    }
}