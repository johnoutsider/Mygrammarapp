'use client'

export default function SpeakingInfoCard() {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">How It Works</h2>
            <ul className="space-y-2 text-sm text-slate-600">
                <li>Face landmarks estimate whether the student is looking down and likely reading.</li>
                <li>Microphone energy and lip movement combine to detect speaking activity.</li>
                <li>Audio is chunked and sent to Groq for transcript updates every 10 seconds.</li>
                <li>Warnings, silence, multi-face events, and the transcript are logged for export.</li>
            </ul>
        </div>
    )
}
