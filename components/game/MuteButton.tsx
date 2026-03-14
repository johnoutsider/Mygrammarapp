'use client'

export default function MuteButton({ muted, onToggle }: {
    muted: boolean
    onToggle: () => void
}) {
    return (
        <button onClick={onToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                ${muted
                    ? 'bg-slate-700 border-slate-600 text-slate-400'
                    : 'bg-violet-900/50 border-violet-500/50 text-violet-300 hover:bg-violet-800/50'}`}>
            <span className="text-base">{muted ? '🔇' : '🔊'}</span>
            <span>{muted ? 'Muted' : 'Sound On'}</span>
        </button>
    )
}