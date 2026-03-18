export type StatusTone = 'idle' | 'speaking' | 'reading'

export type MediaDeviceOption = {
    deviceId: string
    label: string
}

export type LogEntry = {
    no: number
    time: string
    event: string
    duration: string
}
