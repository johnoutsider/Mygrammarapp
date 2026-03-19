'use client'

interface SpeakingResponseCardProps {
    questionLabel: string
    questionText: string
    studentLabel: string
    studentAnswer: string
}

export default function SpeakingResponseCard({
    questionLabel,
    questionText,
    studentLabel,
    studentAnswer,
}: SpeakingResponseCardProps) {
    return (
        <div className="space-y-6">
            <div className="relative max-w-3xl">
                <div className="absolute left-[-56px] top-[38px] w-0 h-0 border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent border-r-[72px] border-r-slate-900/70" />
                <div className="absolute left-[-52px] top-[40px] w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-r-[64px] border-r-white" />
                <div className="rounded-2xl border border-slate-900 bg-white px-7 py-5 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">{questionLabel}</div>
                    <div className="text-2xl text-slate-900">{questionText}</div>
                </div>
            </div>

            <div className="relative max-w-4xl ml-auto">
                <div className="absolute right-[-56px] bottom-[34px] w-0 h-0 border-t-[22px] border-t-transparent border-b-[22px] border-b-transparent border-l-[86px] border-l-[#6ea4ff]" />
                <div className="absolute right-[-50px] bottom-[38px] w-0 h-0 border-t-[18px] border-t-transparent border-b-[18px] border-b-transparent border-l-[74px] border-l-white" />
                <div className="rounded-[2rem] border border-[#6ea4ff] bg-white px-8 py-6 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">{studentLabel}</div>
                    <div className="text-lg leading-8 text-slate-700 whitespace-pre-wrap">
                        {studentAnswer || 'No transcript captured for this attempt.'}
                    </div>
                </div>
            </div>
        </div>
    )
}
