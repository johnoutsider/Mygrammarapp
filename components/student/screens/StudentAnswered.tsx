import type { ActiveGame, GameTeam } from '@/lib/gameService'

interface Props {
    myTeam: (GameTeam & { id: string }) | null
    game: ActiveGame | null
}

export default function StudentAnswered({ myTeam, game }: Props) {
    const answeredCount =
        myTeam && game
            ? Object.keys(myTeam.members || {}).filter(
                (uid) => game.players?.[uid]?.answered === true
            ).length
            : 0

    const totalMembers = myTeam
        ? Object.keys(myTeam.members || {}).length
        : 0

    const progressPct =
        totalMembers > 0 ? (answeredCount / totalMembers) * 100 : 0

    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
            {/* Checkmark icon */}
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-white">Answer Submitted!</h2>
                <p className="text-white/60 mt-1">Waiting for the teacher to reveal...</p>
            </div>

            {/* Team progress — only shown in team mode */}
            {myTeam && (
                <div className="w-full max-w-xs bg-white/10 rounded-2xl px-5 py-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm text-white/80">
                        <span className="flex items-center gap-2">
                            <span>👥</span>
                            <span>Teammates answered</span>
                        </span>
                        <span className="font-semibold text-white">
                            {answeredCount} / {totalMembers}
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2.5 rounded-full bg-white/20 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${myTeam.color}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}