'use client'

import { useState } from 'react'

const TEAL = '#1D9E75'
const TEAL_DARK = '#085041'

interface SpeakingAssignmentFormProps {
    topics: string[]
    onSubmit: (input: {
        partLabel: string
        mainQuestion: string
        questionSteps: string[]
        closingLine: string
        prepSeconds: number
        speakingSeconds: number
    }) => Promise<void>
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function SpeakingAssignmentForm({ topics, onSubmit }: SpeakingAssignmentFormProps) {
    const [partLabel, setPartLabel] = useState('')
    const [mainQuestion, setMainQuestion] = useState('')
    const [bullets, setBullets] = useState<string[]>([])
    const [bulletInput, setBulletInput] = useState('')
    const [closingLine, setClosingLine] = useState('')
    const [prepSeconds, setPrepSeconds] = useState(60)
    const [speakingSeconds, setSpeakingSeconds] = useState(120)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function addBullet() {
        const trimmed = bulletInput.trim()
        if (!trimmed) return
        setBullets(prev => [...prev, trimmed])
        setBulletInput('')
    }

    function removeBullet(index: number) {
        setBullets(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (!partLabel.trim()) { setError('Please select a topic.'); return }
        if (!mainQuestion.trim()) { setError('Please enter a main question.'); return }
        if (bullets.length === 0) { setError('Add at least one bullet point.'); return }

        setSaving(true)
        setError(null)
        try {
            await onSubmit({
                partLabel: partLabel.trim(),
                mainQuestion: mainQuestion.trim(),
                questionSteps: bullets,
                closingLine: closingLine.trim(),
                prepSeconds,
                speakingSeconds,
            })
            setSaved(true)
            setPartLabel('')
            setMainQuestion('')
            setBullets([])
            setBulletInput('')
            setClosingLine('')
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            setError((err as Error).message || 'Failed to save.')
        } finally {
            setSaving(false)
        }
    }

    const tealBorder = { border: `2px solid ${TEAL}`, borderRadius: 8 }
    const labelStyle = 'text-[11px] font-medium tracking-[0.07em] uppercase text-slate-400 mb-2 block'
    const canSubmit = Boolean(partLabel.trim() && mainQuestion.trim() && bullets.length > 0)
    const hasPreviewContent = Boolean(mainQuestion || bullets.length > 0 || closingLine)

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* ── Header ── */}
            <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Create Speaking Prompt</h2>
                <p className="text-sm text-slate-500 mt-1">Build an IELTS-style cue card for your students.</p>
            </div>

            {error && (
                <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* ── TOPIC ── */}
            <div className="px-6 py-5 border-b border-slate-100">
                <label className={labelStyle}>Topic</label>
                <div style={tealBorder}>
                    {topics.length > 0 ? (
                        <select
                            value={partLabel}
                            onChange={e => setPartLabel(e.target.value)}
                            style={{
                                width: '100%', height: 44, padding: '0 14px', fontSize: 14,
                                border: 'none', borderRadius: 8, background: 'transparent',
                                color: partLabel ? '#1e293b' : '#94a3b8', outline: 'none',
                                cursor: 'pointer', colorScheme: 'light',
                            }}
                        >
                            <option value="" disabled>— Select a topic —</option>
                            {topics.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    ) : (
                        <div className="px-4 py-3 text-sm text-slate-400">
                            No topics yet — add topics in the Topics section first.
                        </div>
                    )}
                </div>
            </div>

            {/* ── CARD BUILDER + LIVE PREVIEW ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100">

                {/* Left: builder inputs */}
                <div className="px-6 py-5 space-y-5 md:border-r border-slate-100">

                    {/* Main question */}
                    <div>
                        <label className={labelStyle}>Main Question</label>
                        <textarea
                            value={mainQuestion}
                            onChange={e => setMainQuestion(e.target.value)}
                            placeholder="e.g. Describe a family member you spend a lot of time with"
                            rows={2}
                            style={{
                                ...tealBorder,
                                width: '100%', padding: '10px 14px', fontSize: 14,
                                background: '#fff', color: '#1e293b', outline: 'none',
                                resize: 'vertical', colorScheme: 'light',
                            }}
                        />
                    </div>

                    {/* Bullet points */}
                    <div>
                        <div className="flex items-baseline justify-between mb-2">
                            <label className={labelStyle} style={{ marginBottom: 0 }}>You should say: (bullet points)</label>
                            <span className="text-xs font-medium" style={{ color: bullets.length > 0 ? TEAL : '#94a3b8' }}>
                                {bullets.length} point{bullets.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {bullets.length > 0 && (
                            <div className="flex flex-col gap-1.5 mb-2">
                                {bullets.map((b, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, ...tealBorder, padding: '7px 12px' }}>
                                        <span style={{ color: TEAL, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>▶</span>
                                        <span className="flex-1 text-sm text-slate-700 leading-snug">{b}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeBullet(i)}
                                            className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none flex-shrink-0"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                value={bulletInput}
                                onChange={e => setBulletInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBullet() } }}
                                placeholder={`e.g. ${['who this person is', 'what you usually do together', 'what kind of person he/she is'][bullets.length % 3]}`}
                                style={{
                                    flex: 1, height: 40, padding: '0 12px', fontSize: 13,
                                    ...tealBorder, background: '#fff', color: '#1e293b',
                                    outline: 'none', colorScheme: 'light',
                                }}
                            />
                            <button
                                type="button"
                                onClick={addBullet}
                                style={{
                                    height: 40, padding: '0 14px', fontSize: 13, fontWeight: 500,
                                    background: TEAL, color: '#fff', border: 'none',
                                    borderRadius: 8, cursor: 'pointer', flexShrink: 0,
                                }}
                            >Add</button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5">Press Enter or click Add.</p>
                    </div>

                    {/* Closing line */}
                    <div>
                        <label className={labelStyle}>Closing Line <span className="normal-case font-normal">(optional)</span></label>
                        <input
                            value={closingLine}
                            onChange={e => setClosingLine(e.target.value)}
                            placeholder="e.g. and explain why you spend the most time with him/her."
                            style={{
                                width: '100%', height: 40, padding: '0 14px', fontSize: 13,
                                ...tealBorder, background: '#fff', color: '#1e293b',
                                outline: 'none', colorScheme: 'light',
                            }}
                        />
                    </div>
                </div>

                {/* Right: live card preview */}
                <div className="px-6 py-5 bg-slate-50/60">
                    <label className={labelStyle}>Card Preview</label>
                    <div
                        className="rounded-xl border p-5 min-h-[200px] space-y-3"
                        style={{ background: '#EEF3FA', borderColor: '#C8D8E8' }}
                    >
                        {/* Main question */}
                        {mainQuestion ? (
                            <p className="text-slate-800 text-sm font-medium leading-relaxed">{mainQuestion}</p>
                        ) : (
                            <p className="text-slate-400 text-sm italic">Main question will appear here…</p>
                        )}

                        {/* You should say */}
                        {(bullets.length > 0 || !hasPreviewContent) && (
                            <div className="space-y-2">
                                <p className="text-slate-700 text-sm">You should say:</p>
                                {bullets.length > 0 ? (
                                    <ul className="space-y-1.5">
                                        {bullets.map((b, i) => (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <span className="text-[#C0392B] text-xs mt-0.5 font-bold flex-shrink-0">▶</span>
                                                <span className="text-[#7B3535] text-sm leading-snug">{b}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    /* Ghost placeholder bullets */
                                    <ul className="space-y-1.5 opacity-25">
                                        {['who this person is', 'what you usually do together', 'what kind of person he/she is'].map((ph, i) => (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <span className="text-[#C0392B] text-xs mt-0.5 font-bold flex-shrink-0">▶</span>
                                                <span className="text-[#7B3535] text-sm">{ph}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Closing line */}
                        {closingLine ? (
                            <p className="text-slate-700 text-sm">{closingLine}</p>
                        ) : !hasPreviewContent ? (
                            <p className="text-slate-400 text-sm italic opacity-25">and explain why…</p>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── TIMERS ── */}
            <div className="grid grid-cols-2 border-b border-slate-100">
                {[
                    { label: 'Prep Time (seconds)', val: prepSeconds, set: setPrepSeconds },
                    { label: 'Speaking Time (seconds)', val: speakingSeconds, set: setSpeakingSeconds },
                ].map((f, i) => (
                    <div key={f.label} className={`px-6 py-5 ${i === 0 ? 'border-r border-slate-100' : ''}`}>
                        <label className={labelStyle}>{f.label}</label>
                        <div style={{ ...tealBorder, display: 'flex', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => f.set(v => Math.max(0, v - 10))}
                                style={{ width: 40, height: 44, border: 'none', background: 'transparent', fontSize: 20, color: '#64748b', cursor: 'pointer' }}
                            >−</button>
                            <input
                                type="number"
                                value={f.val}
                                onChange={e => f.set(Math.max(0, parseInt(e.target.value) || 0))}
                                style={{ flex: 1, height: 44, border: 'none', background: 'transparent', fontSize: 15, fontWeight: 500, textAlign: 'center', color: '#1e293b', outline: 'none', colorScheme: 'light' }}
                            />
                            <button
                                type="button"
                                onClick={() => f.set(v => v + 10)}
                                style={{ width: 40, height: 44, border: 'none', background: 'transparent', fontSize: 20, color: '#64748b', cursor: 'pointer' }}
                            >+</button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5">{formatDuration(f.val)}</p>
                    </div>
                ))}
            </div>

            {/* ── FOOTER ── */}
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
                <span className="text-sm text-slate-400">
                    {!partLabel
                        ? 'Select a topic to continue'
                        : !mainQuestion
                            ? 'Enter a main question'
                            : bullets.length === 0
                                ? 'Add at least one bullet point'
                                : `${bullets.length} bullet point${bullets.length !== 1 ? 's' : ''} added`}
                </span>
                <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={saving || !canSubmit}
                    style={{
                        height: 40, padding: '0 22px', fontSize: 14, fontWeight: 500,
                        background: !canSubmit ? '#f1f5f9' : saved ? TEAL_DARK : TEAL,
                        color: !canSubmit ? '#94a3b8' : '#fff',
                        border: !canSubmit ? '1px solid #e2e8f0' : 'none',
                        borderRadius: 8,
                        cursor: canSubmit ? 'pointer' : 'not-allowed',
                        transition: 'background 0.2s',
                    }}
                >
                    {saving ? 'Saving…' : saved ? 'Saved!' : 'Save and Activate'}
                </button>
            </div>
        </div>
    )
}
