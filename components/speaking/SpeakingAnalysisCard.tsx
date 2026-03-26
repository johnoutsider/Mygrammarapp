import { SpeakingAiAnalysis } from '@/lib/speakingService'

interface Props {
    analysis: SpeakingAiAnalysis
}

const CRITERIA_LABELS: { key: keyof SpeakingAiAnalysis['criteria']; label: string }[] = [
    { key: 'taskResponse', label: 'Task Response' },
    { key: 'fluencyCoherence', label: 'Fluency & Coherence' },
    { key: 'lexicalResource', label: 'Lexical Resource' },
    { key: 'grammaticalRangeAccuracy', label: 'Grammatical Range & Accuracy' },
    { key: 'pronunciation', label: 'Pronunciation' },
]

function bandColor(band: number): string {
    if (band >= 7) return 'text-emerald-600'
    if (band >= 5.5) return 'text-amber-600'
    return 'text-red-500'
}

function bandBg(band: number): string {
    if (band >= 7) return 'bg-emerald-50 border-emerald-200'
    if (band >= 5.5) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
}

function ScoreBar({ score }: { score: number }) {
    const pct = (score / 9) * 100
    const color = score >= 7 ? '#10b981' : score >= 5.5 ? '#f59e0b' : '#ef4444'
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
            <span className={`text-xs font-bold w-8 text-right ${bandColor(score)}`}>{score}</span>
        </div>
    )
}

export default function SpeakingAnalysisCard({ analysis }: Props) {
    const { criteria, overallBand, strengths, improvements, feedback, analyzedAt } = analysis

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${bandBg(overallBand)}`}>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">AI Analysis</div>
                    <div className="text-sm text-slate-500 mt-0.5">
                        {analyzedAt ? new Date(analyzedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Overall Band</div>
                    <div className={`text-4xl font-extrabold ${bandColor(overallBand)}`}>{overallBand}</div>
                </div>
            </div>

            <div className="px-5 py-4 space-y-5">
                {/* Criteria scores */}
                <div className="space-y-2.5">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Criteria Scores</div>
                    {CRITERIA_LABELS.map(({ key, label }) => (
                        <div key={key}>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs text-slate-600">{label}</span>
                            </div>
                            <ScoreBar score={criteria[key]} />
                        </div>
                    ))}
                </div>

                {/* Strengths */}
                {strengths.length > 0 && (
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-2">Strengths</div>
                        <ul className="space-y-1">
                            {strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Improvements */}
                {improvements.length > 0 && (
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-2">Areas to Improve</div>
                        <ul className="space-y-1">
                            {improvements.map((imp, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>
                                    {imp}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Feedback */}
                {feedback && (
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Detailed Feedback</div>
                        <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">{feedback}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
