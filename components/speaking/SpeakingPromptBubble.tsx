'use client'

interface SpeakingPromptBubbleProps {
    label: string
    text: string
}

export default function SpeakingPromptBubble({ label, text }: SpeakingPromptBubbleProps) {
    return (
        <div className="relative max-w-3xl mx-auto">
            <div className="absolute left-[-56px] top-[52px] w-0 h-0 border-t-[18px] border-t-transparent border-b-[18px] border-b-transparent border-r-[72px] border-r-slate-900/80" />
            <div className="absolute left-[-52px] top-[54px] w-0 h-0 border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent border-r-[64px] border-r-white" />
            <div className="rounded-2xl border border-slate-900 bg-white px-8 py-7 text-center shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">{label}</div>
                <div className="text-3xl leading-snug text-slate-900">{text}</div>
            </div>
        </div>
    )
}
