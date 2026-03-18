'use client'

import type { MediaDeviceOption } from './types'

interface SpeakingControlsProps {
    devicesLoading: boolean
    running: boolean
    scriptsReady: boolean
    selectedVideoId: string
    selectedAudioId: string
    videoDevices: MediaDeviceOption[]
    audioDevices: MediaDeviceOption[]
    onVideoChange: (value: string) => void
    onAudioChange: (value: string) => void
    onStart: () => void
    onStop: () => void
    onRefresh: () => void
}

export default function SpeakingControls(props: SpeakingControlsProps) {
    const {
        devicesLoading,
        running,
        scriptsReady,
        selectedVideoId,
        selectedAudioId,
        videoDevices,
        audioDevices,
        onVideoChange,
        onAudioChange,
        onStart,
        onStop,
        onRefresh,
    } = props

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Camera</label>
                    <select
                        value={selectedVideoId}
                        onChange={event => onVideoChange(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        disabled={devicesLoading || running}
                    >
                        <option value="">{devicesLoading ? 'Loading cameras...' : 'Select camera'}</option>
                        {videoDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Microphone</label>
                    <select
                        value={selectedAudioId}
                        onChange={event => onAudioChange(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        disabled={devicesLoading || running}
                    >
                        <option value="">{devicesLoading ? 'Loading microphones...' : 'Select microphone'}</option>
                        {audioDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
                <button
                    onClick={onStart}
                    disabled={!scriptsReady || devicesLoading || running || !selectedVideoId || !selectedAudioId}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Start Detection
                </button>
                <button
                    onClick={onStop}
                    disabled={!running}
                    className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Stop
                </button>
                <button
                    onClick={onRefresh}
                    disabled={running}
                    className="px-5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-50"
                >
                    Refresh Devices
                </button>
            </div>
        </div>
    )
}
