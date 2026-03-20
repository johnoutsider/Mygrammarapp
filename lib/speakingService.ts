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

const SPEAKING_SETTINGS_DOC = doc(db, 'settings', 'speakingAssignments')
const SPEAKING_TOPICS_DOC = doc(db, 'settings', 'speakingTopics')

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
    }
}

async function readAssignmentsDoc(): Promise<SpeakingAssignmentsDoc> {
    const snapshot = await getDoc(SPEAKING_SETTINGS_DOC)
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

export async function listSpeakingAssignments(): Promise<SpeakingAssignment[]> {
    const { assignments = [], activeAssignmentId = null } = await readAssignmentsDoc()

    return assignments
        .map(assignment => ({
            ...assignment,
            isActive: assignment.id === activeAssignmentId,
        }))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function getActiveSpeakingAssignment(): Promise<SpeakingAssignment | null> {
    const { assignments = [], activeAssignmentId = null } = await readAssignmentsDoc()
    if (!activeAssignmentId) return null
    return assignments.find(assignment => assignment.id === activeAssignmentId) ?? null
}

export async function getSpeakingAssignmentById(assignmentId: string): Promise<SpeakingAssignment | null> {
    const { assignments = [] } = await readAssignmentsDoc()
    return assignments.find(assignment => assignment.id === assignmentId) ?? null
}

export async function createSpeakingAssignment(input: Omit<SpeakingAssignment, 'id' | 'createdAt' | 'questionText'>): Promise<SpeakingAssignment> {
    const existing = await readAssignmentsDoc()
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

    await setDoc(SPEAKING_SETTINGS_DOC, {
        activeAssignmentId: input.isActive ? assignment.id : existing.activeAssignmentId ?? null,
        assignments,
    })

    return {
        ...assignment,
        isActive: input.isActive,
    }
}

export async function activateSpeakingAssignment(assignmentId: string): Promise<void> {
    const existing = await readAssignmentsDoc()
    const assignments = (existing.assignments ?? []).map(assignment => ({
        ...assignment,
        isActive: assignment.id === assignmentId,
    }))

    await setDoc(SPEAKING_SETTINGS_DOC, {
        activeAssignmentId: assignmentId,
        assignments,
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

export async function listAllSpeakingResponses(): Promise<TeacherSpeakingResponse[]> {
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

    return rows.sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
}

export async function listSpeakingTopics(): Promise<string[]> {
    const snapshot = await getDoc(SPEAKING_TOPICS_DOC)
    if (!snapshot.exists()) return []
    const data = snapshot.data() as { topics?: unknown }
    return Array.isArray(data.topics) ? data.topics.filter((t): t is string => typeof t === 'string') : []
}

export async function addSpeakingTopic(topic: string): Promise<string[]> {
    const existing = await listSpeakingTopics()
    const trimmed = topic.trim()
    if (!trimmed || existing.includes(trimmed)) return existing
    const updated = [...existing, trimmed]
    await setDoc(SPEAKING_TOPICS_DOC, { topics: updated })
    return updated
}

export async function deleteSpeakingTopic(topic: string): Promise<string[]> {
    const existing = await listSpeakingTopics()
    const updated = existing.filter(t => t !== topic)
    await setDoc(SPEAKING_TOPICS_DOC, { topics: updated })
    return updated
}