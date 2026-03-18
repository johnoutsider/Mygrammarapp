'use client'

interface SpeakingTranscriptPanelProps {
    transcript: string
    wpmDisplay: string
}

export default function SpeakingTranscriptPanel({
    transcript,
    wpmDisplay,
}: SpeakingTranscriptPanelProps) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Live Transcript</h2>
            <p className="text-sm text-slate-700 leading-7 min-h-[96px]">{transcript}</p>
            <p className="mt-3 text-xs text-slate-400 text-right">{wpmDisplay}</p>
        </div>
    )
}
