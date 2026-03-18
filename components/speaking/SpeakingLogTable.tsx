'use client'

import type { LogEntry } from './types'

interface SpeakingLogTableProps {
    logs: LogEntry[]
    onExport: () => void
}

export default function SpeakingLogTable({ logs, onExport }: SpeakingLogTableProps) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Detection Log</h2>
                <button
                    onClick={onExport}
                    disabled={logs.length === 0}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Export CSV
                </button>
            </div>

            {logs.length === 0 ? (
                <p className="text-sm text-slate-400">No events yet. Start a session to populate the log.</p>
            ) : (
                <div className="overflow-auto max-h-[640px] rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                        <thead className="bg-emerald-600 text-white sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-xs font-semibold">#</th>
                                <th className="px-3 py-2 text-xs font-semibold">Time</th>
                                <th className="px-3 py-2 text-xs font-semibold">Event</th>
                                <th className="px-3 py-2 text-xs font-semibold">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map(row => (
                                <tr key={`${row.no}-${row.time}`} className="bg-white">
                                    <td className="px-3 py-2 text-xs text-slate-500">{row.no}</td>
                                    <td className="px-3 py-2 text-xs text-slate-500">{row.time}</td>
                                    <td className="px-3 py-2 text-xs text-slate-700">{row.event}</td>
                                    <td className="px-3 py-2 text-xs text-slate-500">{row.duration}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
