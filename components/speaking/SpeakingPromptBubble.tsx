'use client'

interface SpeakingPromptBubbleProps {
    text: string
}

export default function SpeakingPromptBubble({ text }: SpeakingPromptBubbleProps) {
    return (
        <div className="relative w-full">
            {/* Bubble box */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-center">
                <div className="text-xl font-bold text-slate-900 leading-snug">{text}</div>
            </div>
            {/* Downward-pointing arrow */}
            <div className="absolute bottom-[-11px] left-1/2 -translate-x-1/2 w-0 h-0
                border-l-[11px] border-l-transparent
                border-r-[11px] border-r-transparent
                border-t-[11px] border-t-slate-200" />
            <div className="absolute bottom-[-9px] left-1/2 -translate-x-1/2 w-0 h-0
                border-l-[10px] border-l-transparent
                border-r-[10px] border-r-transparent
                border-t-[10px] border-t-slate-50" />
        </div>
    )
}
