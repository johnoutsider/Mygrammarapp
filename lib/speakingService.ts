import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore'
import { db } from './firebase'
import {
    createSpeakingTopic as createSharedSpeakingTopic,
    deleteSpeakingTopicByTitle,
    listTeacherSpeakingTopicTitles,
} from './guidedSpeakingService'

export interface SpeakingQuestionStep {
    id: string
    text: string
}

export interface SpeakingAssignment {
    id: string
    teacherId: string
    partLabel: string
    questionText: string
    questionSteps: SpeakingQuestionStep[]
    prepSeconds: number
    speakingSeconds: number
    isActive: boolean
    createdAt: string
    mainQuestion?: string   // Opening statement shown on the cue card
    closingLine?: string    // Optional closing line (e.g. "and explain why...")
}

export interface SpeakingLogEntry {
    no: number
    time: string
    event: string
    duration: string
}

export interface SpeakingAiAnalysis {
    criteria: {
        taskResponse: number
        fluencyCoherence: number
        lexicalResource: number
        grammaticalRangeAccuracy: number
        pronunciation: number
    }
    overallBand: number
    feedback: string
    strengths: string[]
    improvements: string[]
    analyzedAt: string
}

export interface SpeakingResponse {
    id: string
    assignmentId: string
    questionText: string
    questionLabel?: string
    partLabel: string
    stepIndex?: number
    stepTotal?: number
    studentId: string
    studentName: string
    transcript: string
    warningCount: number
    sessionSeconds: number
    speakingSeconds: number
    logs: SpeakingLogEntry[]
    createdAt: string
    audioUrl?: string
    aiAnalysis?: SpeakingAiAnalysis
    sentForAnalysis?: boolean
}

export interface TeacherSpeakingResponse extends SpeakingResponse {
    studentEmail?: string
    studentGroup?: string
}

type SpeakingAssignmentsDoc = {
    activeAssignmentId?: string | null
    assignments?: SpeakingAssignment[]
}

type UserSpeakingData = {
    displayName?: string
    name?: string
    email?: string
    groupName?: string
    speakingResponses?: SpeakingResponse[]
}

// Per-teacher doc references (fall back to global for backward compat)
function getSpeakingSettingsDoc(teacherId: string) {
    return doc(db, 'settings', `speakingAssignments_${teacherId}`)
}
function getSpeakingTopicsDoc(teacherId: string) {
    return doc(db, 'settings', `speakingTopics_${teacherId}`)
}
// Legacy global docs (kept for migration reads)
const SPEAKING_SETTINGS_DOC_GLOBAL = doc(db, 'settings', 'speakingAssignments')
const SPEAKING_TOPICS_DOC_GLOBAL = doc(db, 'settings', 'speakingTopics')

function serializeSpeakingAssignment(assignment: SpeakingAssignment) {
    return {
        id: assignment.id,
        teacherId: assignment.teacherId,
        partLabel: assignment.partLabel,
        questionText: assignment.questionText,
        questionSteps: assignment.questionSteps.map((step, index) => ({
            id: step.id || `step-${index + 1}`,
            text: step.text,
        })),
        prepSeconds: assignment.prepSeconds,
        speakingSeconds: assignment.speakingSeconds,
        isActive: assignment.isActive,
        createdAt: assignment.createdAt,
        ...(typeof assignment.mainQuestion === 'string' && assignment.mainQuestion.trim()
            ? { mainQuestion: assignment.mainQuestion.trim() }
            : {}),
        ...(typeof assignment.closingLine === 'string' && assignment.closingLine.trim()
            ? { closingLine: assignment.closingLine.trim() }
            : {}),
    }
}

function sanitizeSpeakingAssignments(assignments: SpeakingAssignment[]) {
    return assignments.map(serializeSpeakingAssignment)
}

function createId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}-${crypto.randomUUID()}`
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeSteps(raw: Partial<SpeakingAssignment>): SpeakingQuestionStep[] {
    const rawSteps = Array.isArray(raw.questionSteps) ? (raw.questionSteps as unknown[]) : []
    const normalizedSteps = rawSteps
        .map((step, index) => {
            if (typeof step === 'string') {
                const text = step.trim()
                return text ? { id: `step-${index + 1}`, text } : null
            }

            if (step && typeof step === 'object') {
                const record = step as { id?: unknown; text?: unknown }
                const text = typeof record.text === 'string' ? record.text.trim() : ''
                const id = typeof record.id === 'string' && record.id ? record.id : `step-${index + 1}`
                return text ? { id, text } : null
            }

            return null
        })
        .filter((step): step is SpeakingQuestionStep => Boolean(step))

    if (normalizedSteps.length > 0) return normalizedSteps

    const fallbackText = typeof raw.questionText === 'string' ? raw.questionText.trim() : ''
    return fallbackText ? [{ id: 'step-1', text: fallbackText }] : []
}

function normalizeAssignment(raw: Partial<SpeakingAssignment>): SpeakingAssignment | null {
    if (!raw.id || !raw.teacherId || !raw.partLabel) return null

    const questionSteps = normalizeSteps(raw)
    if (questionSteps.length === 0) return null

    return {
        id: raw.id,
        teacherId: raw.teacherId,
        partLabel: raw.partLabel,
        questionText: questionSteps[0].text,
        questionSteps,
        prepSeconds: Number(raw.prepSeconds ?? 0),
        speakingSeconds: Number(raw.speakingSeconds ?? 0),
        isActive: Boolean(raw.isActive),
        createdAt: raw.createdAt || new Date(0).toISOString(),
        mainQuestion: typeof raw.mainQuestion === 'string' ? raw.mainQuestion : undefined,
        closingLine: typeof raw.closingLine === 'string' ? raw.closingLine : undefined,
    }
}

function normalizeAnalysis(raw: unknown): SpeakingAiAnalysis | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const record = raw as Record<string, unknown>
    const criteria = (record.criteria ?? {}) as Record<string, unknown>

    return {
        criteria: {
            taskResponse: Number(criteria.taskResponse ?? 0),
            fluencyCoherence: Number(criteria.fluencyCoherence ?? 0),
            lexicalResource: Number(criteria.lexicalResource ?? 0),
            grammaticalRangeAccuracy: Number(criteria.grammaticalRangeAccuracy ?? 0),
            pronunciation: Number(criteria.pronunciation ?? 0),
        },
        overallBand: Number(record.overallBand ?? 0),
        feedback: typeof record.feedback === 'string' ? record.feedback : '',
        strengths: Array.isArray(record.strengths) ? record.strengths.filter((item): item is string => typeof item === 'string') : [],
        improvements: Array.isArray(record.improvements) ? record.improvements.filter((item): item is string => typeof item === 'string') : [],
        analyzedAt: typeof record.analyzedAt === 'string' ? record.analyzedAt : '',
    }
}

function normalizeResponse(raw: unknown): SpeakingResponse | null {
    if (!raw || typeof raw !== 'object') return null
    const record = raw as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.assignmentId !== 'string') return null

    return {
        id: record.id,
        assignmentId: record.assignmentId,
        questionText: typeof record.questionText === 'string' ? record.questionText : '',
        questionLabel: typeof record.questionLabel === 'string' ? record.questionLabel : undefined,
        partLabel: typeof record.partLabel === 'string' ? record.partLabel : 'Speaking',
        stepIndex: typeof record.stepIndex === 'number' ? record.stepIndex : undefined,
        stepTotal: typeof record.stepTotal === 'number' ? record.stepTotal : undefined,
        studentId: typeof record.studentId === 'string' ? record.studentId : '',
        studentName: typeof record.studentName === 'string' ? record.studentName : 'Student',
        transcript: typeof record.transcript === 'string' ? record.transcript : '',
        warningCount: Number(record.warningCount ?? 0),
        sessionSeconds: Number(record.sessionSeconds ?? 0),
        speakingSeconds: Number(record.speakingSeconds ?? 0),
        logs: Array.isArray(record.logs) ? record.logs as SpeakingLogEntry[] : [],
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
        audioUrl: typeof record.audioUrl === 'string' ? record.audioUrl : undefined,
        aiAnalysis: normalizeAnalysis(record.aiAnalysis),
        sentForAnalysis: record.sentForAnalysis === true,
    }
}

async function readAssignmentsDoc(teacherId?: string): Promise<SpeakingAssignmentsDoc> {
    const docRef = teacherId ? getSpeakingSettingsDoc(teacherId) : SPEAKING_SETTINGS_DOC_GLOBAL
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) {
        return { activeAssignmentId: null, assignments: [] }
    }

    const data = snapshot.data() as SpeakingAssignmentsDoc
    return {
        activeAssignmentId: data.activeAssignmentId ?? null,
        assignments: Array.isArray(data.assignments)
            ? data.assignments
                .map(item => normalizeAssignment(item))
                .filter((item): item is SpeakingAssignment => Boolean(item))
            : [],
    }
}

export async function listSpeakingAssignments(teacherId?: string): Promise<SpeakingAssignment[]> {
    const { assignments = [], activeAssignmentId = null } = await readAssignmentsDoc(teacherId)

    return assignments
        .map(assignment => ({
            ...assignment,
            isActive: assignment.id === activeAssignmentId,
        }))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function getActiveSpeakingAssignment(teacherId?: string): Promise<SpeakingAssignment | null> {
    const { assignments = [], activeAssignmentId = null } = await readAssignmentsDoc(teacherId)
    if (!activeAssignmentId) return null
    return assignments.find(assignment => assignment.id === activeAssignmentId) ?? null
}

export async function getSpeakingAssignmentById(assignmentId: string, teacherId?: string): Promise<SpeakingAssignment | null> {
    const { assignments = [] } = await readAssignmentsDoc(teacherId)
    return assignments.find(assignment => assignment.id === assignmentId) ?? null
}

export async function createSpeakingAssignment(input: Omit<SpeakingAssignment, 'id' | 'createdAt' | 'questionText'>, teacherId?: string): Promise<SpeakingAssignment> {
    const existing = await readAssignmentsDoc(teacherId)
    const questionSteps = input.questionSteps
        .map((step, index) => ({
            id: step.id || `step-${index + 1}`,
            text: step.text.trim(),
        }))
        .filter(step => step.text)

    if (questionSteps.length === 0) {
        throw new Error('At least one speaking question is required.')
    }

    const assignment: SpeakingAssignment = {
        ...input,
        id: createId('speaking'),
        questionText: questionSteps[0].text,
        questionSteps,
        createdAt: new Date().toISOString(),
    }

    const assignments = [assignment, ...(existing.assignments ?? [])].map(item => ({
        ...item,
        isActive: item.id === assignment.id ? input.isActive : false,
    }))
    const sanitizedAssignments = sanitizeSpeakingAssignments(assignments)

    const docRef = teacherId ? getSpeakingSettingsDoc(teacherId) : SPEAKING_SETTINGS_DOC_GLOBAL
    await setDoc(docRef, {
        activeAssignmentId: input.isActive ? assignment.id : existing.activeAssignmentId ?? null,
        assignments: sanitizedAssignments,
    })

    return {
        ...assignment,
        isActive: input.isActive,
    }
}

export async function activateSpeakingAssignment(assignmentId: string, teacherId?: string): Promise<void> {
    const existing = await readAssignmentsDoc(teacherId)
    const assignments = (existing.assignments ?? []).map(assignment => ({
        ...assignment,
        isActive: assignment.id === assignmentId,
    }))
    const sanitizedAssignments = sanitizeSpeakingAssignments(assignments)

    const docRef = teacherId ? getSpeakingSettingsDoc(teacherId) : SPEAKING_SETTINGS_DOC_GLOBAL
    await setDoc(docRef, {
        activeAssignmentId: assignmentId,
        assignments: sanitizedAssignments,
    })
}

export async function saveSpeakingResponse(input: Omit<SpeakingResponse, 'id' | 'createdAt'>): Promise<SpeakingResponse> {
    const userRef = doc(db, 'users', input.studentId)
    const userSnapshot = await getDoc(userRef)
    const userData = userSnapshot.exists() ? (userSnapshot.data() as UserSpeakingData) : {}
    const response: SpeakingResponse = {
        ...input,
        id: createId('response'),
        createdAt: new Date().toISOString(),
    }

    const speakingResponses = [response, ...((userData.speakingResponses ?? []).map(normalizeResponse).filter((item): item is SpeakingResponse => Boolean(item)))]

    // Firestore rejects `undefined` values — strip them via JSON round-trip
    const sanitized = JSON.parse(JSON.stringify(speakingResponses)) as SpeakingResponse[]

    if (userSnapshot.exists()) {
        await updateDoc(userRef, { speakingResponses: sanitized })
    } else {
        await setDoc(userRef, { speakingResponses: sanitized }, { merge: true })
    }

    return response
}

export async function listStudentSpeakingResponses(studentId: string): Promise<SpeakingResponse[]> {
    const userSnapshot = await getDoc(doc(db, 'users', studentId))
    if (!userSnapshot.exists()) return []

    const data = userSnapshot.data() as UserSpeakingData
    const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []

    return responses
        .map(normalizeResponse)
        .filter((response): response is SpeakingResponse => Boolean(response))
        .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
}

/** Fetch speaking responses scoped to a specific list of student UIDs (for teacher views) */
export async function listSpeakingResponsesByStudentIds(
    studentIds: string[],
    options?: { onlySent?: boolean }
): Promise<TeacherSpeakingResponse[]> {
    if (studentIds.length === 0) return []

    const rows: TeacherSpeakingResponse[] = []
    // Fetch user docs in chunks of 10 (Firestore 'in' limit)
    const chunks: string[][] = []
    for (let i = 0; i < studentIds.length; i += 10) {
        chunks.push(studentIds.slice(i, i + 10))
    }

    for (const chunk of chunks) {
        const usersSnapshot = await getDocs(query(collection(db, 'users'), where('__name__', 'in', chunk)))
        usersSnapshot.forEach(snapshot => {
            const data = snapshot.data() as UserSpeakingData
            const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []
            responses
                .map(normalizeResponse)
                .filter((response): response is SpeakingResponse => Boolean(response))
                .forEach(response => {
                    rows.push({
                        ...response,
                        studentId: response.studentId || snapshot.id,
                        studentName: response.studentName || data.displayName || data.name || 'Student',
                        studentEmail: data.email || '',
                        studentGroup: data.groupName || '',
                    })
                })
        })
    }

    const sorted = rows.sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
    return options?.onlySent ? sorted.filter(r => r.sentForAnalysis === true) : sorted
}

export async function listAllSpeakingResponses(options?: { onlySent?: boolean }): Promise<TeacherSpeakingResponse[]> {
    const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')))
    const rows: TeacherSpeakingResponse[] = []

    usersSnapshot.forEach(snapshot => {
        const data = snapshot.data() as UserSpeakingData
        const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []

        responses
            .map(normalizeResponse)
            .filter((response): response is SpeakingResponse => Boolean(response))
            .forEach(response => {
                rows.push({
                    ...response,
                    studentId: response.studentId || snapshot.id,
                    studentName: response.studentName || data.displayName || data.name || 'Student',
                    studentEmail: data.email || '',
                    studentGroup: data.groupName || '',
                })
            })
    })

    const sorted = rows.sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
    return options?.onlySent ? sorted.filter(r => r.sentForAnalysis === true) : sorted
}

export async function listSpeakingTopics(teacherId?: string): Promise<string[]> {
    if (!teacherId) return []
    return listTeacherSpeakingTopicTitles(teacherId)
}

export async function addSpeakingTopic(topic: string, teacherId?: string): Promise<string[]> {
    if (!teacherId) return []
    await createSharedSpeakingTopic(topic, teacherId)
    return listSpeakingTopics(teacherId)
}

export async function deleteSpeakingTopic(topic: string, teacherId?: string): Promise<string[]> {
    if (!teacherId) return []
    const updatedTopics = await deleteSpeakingTopicByTitle(topic, teacherId)
    return updatedTopics.map(item => item.title)
}

// ── Topics with deadlines ────────────────────────────────────────────────────

export interface TopicWithDeadline {
    id: string
    name: string
    deadline: string // ISO datetime string, or '' if none
}

export async function listTopicsWithDeadlines(teacherId?: string): Promise<TopicWithDeadline[]> {
    const key = teacherId ? `speakingTopicsConfig_${teacherId}` : 'speakingTopicsConfig'
    const snapshot = await getDoc(doc(db, 'settings', key))
    if (!snapshot.exists()) return []
    const data = snapshot.data() as { topics?: unknown }
    return Array.isArray(data.topics) ? (data.topics as TopicWithDeadline[]) : []
}

export async function saveTopicsWithDeadlines(topics: TopicWithDeadline[], teacherId?: string): Promise<void> {
    const key = teacherId ? `speakingTopicsConfig_${teacherId}` : 'speakingTopicsConfig'
    await setDoc(doc(db, 'settings', key), { topics })
}

export async function sendSessionForAnalysis(studentId: string, responseIds: string[]): Promise<void> {
    const userRef = doc(db, 'users', studentId)
    const userSnapshot = await getDoc(userRef)
    if (!userSnapshot.exists()) return

    const data = userSnapshot.data() as UserSpeakingData
    const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []
    const updated = responses.map(r => {
        const normalized = normalizeResponse(r)
        if (!normalized) return r
        return normalized.id && responseIds.includes(normalized.id)
            ? { ...normalized, sentForAnalysis: true }
            : normalized
    })
    const sanitized = JSON.parse(JSON.stringify(updated)) as SpeakingResponse[]
    await updateDoc(userRef, { speakingResponses: sanitized })
}

export async function deleteSessionResponses(studentId: string, responseIds: string[]): Promise<void> {
    const userRef = doc(db, 'users', studentId)
    const userSnapshot = await getDoc(userRef)
    if (!userSnapshot.exists()) return

    const data = userSnapshot.data() as UserSpeakingData
    const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []
    const updated = responses
        .map(normalizeResponse)
        .filter((r): r is SpeakingResponse => Boolean(r) && !responseIds.includes(r!.id))
    const sanitized = JSON.parse(JSON.stringify(updated)) as SpeakingResponse[]
    await updateDoc(userRef, { speakingResponses: sanitized })
}

export async function listAnalyzedSpeakingResponses(): Promise<TeacherSpeakingResponse[]> {
    const all = await listAllSpeakingResponses()
    return all.filter(r => r.sentForAnalysis === true)
}

export async function updateResponseTranscript(studentId: string, responseId: string, transcript: string): Promise<void> {
    const userRef = doc(db, 'users', studentId)
    const userSnapshot = await getDoc(userRef)
    if (!userSnapshot.exists()) return

    const data = userSnapshot.data() as UserSpeakingData
    const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []
    const updated = responses.map(r => {
        const normalized = normalizeResponse(r)
        if (!normalized) return r
        return normalized.id === responseId ? { ...normalized, transcript } : normalized
    })
    const sanitized = JSON.parse(JSON.stringify(updated)) as SpeakingResponse[]
    if (userSnapshot.exists()) {
        await updateDoc(userRef, { speakingResponses: sanitized })
    }
}

export async function saveAnalysisToResponse(studentId: string, responseId: string, analysis: SpeakingAiAnalysis): Promise<void> {
    const userRef = doc(db, 'users', studentId)
    const userSnapshot = await getDoc(userRef)
    if (!userSnapshot.exists()) return

    const data = userSnapshot.data() as UserSpeakingData
    const responses = Array.isArray(data.speakingResponses) ? data.speakingResponses : []
    const updated = responses.map(r => {
        const normalized = normalizeResponse(r)
        if (!normalized) return r
        return normalized.id === responseId ? { ...normalized, aiAnalysis: analysis } : normalized
    })
    const sanitized = JSON.parse(JSON.stringify(updated)) as SpeakingResponse[]
    await updateDoc(userRef, { speakingResponses: sanitized })
}

export interface StudentSpeakingOverview {
    studentId: string
    studentName: string
    studentEmail: string
    studentGroup: string
    totalResponses: number
    totalSessions: number
    avgSpeakingSeconds: number
    totalWarnings: number
    avgBand: number | null
    hasAnalysis: boolean
    lastActivity: string
}

export async function listAllStudentSpeakingOverview(): Promise<StudentSpeakingOverview[]> {
    const all = await listAllSpeakingResponses()

    const map = new Map<string, {
        studentName: string
        studentEmail: string
        studentGroup: string
        responses: TeacherSpeakingResponse[]
    }>()

    for (const r of all) {
        if (!map.has(r.studentId)) {
            map.set(r.studentId, {
                studentName: r.studentName,
                studentEmail: r.studentEmail || '',
                studentGroup: r.studentGroup || '',
                responses: [],
            })
        }
        map.get(r.studentId)!.responses.push(r)
    }

    const SESSION_WINDOW_MS = 30 * 60 * 1000
    const result: StudentSpeakingOverview[] = []

    for (const [studentId, entry] of map) {
        const responses = entry.responses
        const sorted = responses.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))

        // Count distinct sessions (same grouping logic as speaking-log)
        let sessionCount = 0
        const sessionGroups: string[] = []
        for (const r of sorted) {
            const t = new Date(r.createdAt).getTime()
            const match = sessionGroups.findIndex((lastTime, idx) => {
                const groups = sorted.filter((s, i) => i < idx + 1)
                const last = groups[groups.length - 1]
                return last?.assignmentId === r.assignmentId &&
                    Math.abs(new Date(last.createdAt).getTime() - t) < SESSION_WINDOW_MS
            })
            if (match === -1) {
                sessionCount++
                sessionGroups.push(r.createdAt)
            }
        }

        const totalSpeaking = responses.reduce((sum, r) => sum + (r.speakingSeconds || 0), 0)
        const avgSpeaking = responses.length > 0 ? Math.round(totalSpeaking / responses.length) : 0
        const totalWarnings = responses.reduce((sum, r) => sum + (r.warningCount || 0), 0)
        const analyzed = responses.filter(r => r.aiAnalysis)
        const avgBand = analyzed.length > 0
            ? Math.round((analyzed.reduce((sum, r) => sum + (r.aiAnalysis!.overallBand || 0), 0) / analyzed.length) * 10) / 10
            : null
        const lastActivity = responses.reduce((max, r) => r.createdAt > max ? r.createdAt : max, '')

        result.push({
            studentId,
            studentName: entry.studentName,
            studentEmail: entry.studentEmail,
            studentGroup: entry.studentGroup,
            totalResponses: responses.length,
            totalSessions: sessionCount,
            avgSpeakingSeconds: avgSpeaking,
            totalWarnings,
            avgBand,
            hasAnalysis: analyzed.length > 0,
            lastActivity,
        })
    }

    return result.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}

/** Scoped version — builds overview from a pre-filtered response list */
export function buildSpeakingOverviewFromResponses(responses: TeacherSpeakingResponse[]): StudentSpeakingOverview[] {
    const map = new Map<string, {
        studentName: string
        studentEmail: string
        studentGroup: string
        responses: TeacherSpeakingResponse[]
    }>()

    for (const r of responses) {
        if (!map.has(r.studentId)) {
            map.set(r.studentId, {
                studentName: r.studentName,
                studentEmail: r.studentEmail || '',
                studentGroup: r.studentGroup || '',
                responses: [],
            })
        }
        map.get(r.studentId)!.responses.push(r)
    }

    const SESSION_WINDOW_MS = 30 * 60 * 1000
    const result: StudentSpeakingOverview[] = []

    for (const [studentId, entry] of map) {
        const entryResponses = entry.responses
        const sorted = entryResponses.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))

        let sessionCount = 0
        const sessionGroups: string[] = []
        for (const r of sorted) {
            const t = new Date(r.createdAt).getTime()
            const match = sessionGroups.findIndex((lastTime, idx) => {
                const groups = sorted.filter((s, i) => i < idx + 1)
                const last = groups[groups.length - 1]
                return last?.assignmentId === r.assignmentId &&
                    Math.abs(new Date(last.createdAt).getTime() - t) < SESSION_WINDOW_MS
            })
            if (match === -1) {
                sessionCount++
                sessionGroups.push(r.createdAt)
            }
        }

        const totalSpeaking = entryResponses.reduce((sum, r) => sum + (r.speakingSeconds || 0), 0)
        const avgSpeaking = entryResponses.length > 0 ? Math.round(totalSpeaking / entryResponses.length) : 0
        const totalWarnings = entryResponses.reduce((sum, r) => sum + (r.warningCount || 0), 0)
        const analyzed = entryResponses.filter(r => r.aiAnalysis)
        const avgBand = analyzed.length > 0
            ? Math.round((analyzed.reduce((sum, r) => sum + (r.aiAnalysis!.overallBand || 0), 0) / analyzed.length) * 10) / 10
            : null
        const lastActivity = entryResponses.reduce((max, r) => r.createdAt > max ? r.createdAt : max, '')

        result.push({
            studentId,
            studentName: entry.studentName,
            studentEmail: entry.studentEmail,
            studentGroup: entry.studentGroup,
            totalResponses: entryResponses.length,
            totalSessions: sessionCount,
            avgSpeakingSeconds: avgSpeaking,
            totalWarnings,
            avgBand,
            hasAnalysis: analyzed.length > 0,
            lastActivity,
        })
    }

    return result.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}
