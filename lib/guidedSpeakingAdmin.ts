import { adminDb } from '@/lib/firebase-admin'
import type { SpeakingSubmissionAnswer } from '@/lib/guidedSpeakingService'

export interface GuidedSubmissionSummary {
    guidedCount: number
    lastCompletedAt: string
}

export interface GuidedSubmissionRecord {
    id: string
    studentId: string
    topicId: string
    completedAt: string
    answers: SpeakingSubmissionAnswer[]
}

export interface GuidedSubmissionListItem extends GuidedSubmissionRecord {
    topicTitle: string
    questionCount: number
}

export interface GuidedSubmissionDetail extends GuidedSubmissionListItem {
    studentName: string
    studentEmail: string
    studentGroup: string
}

function normalizeTimestamp(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate().toISOString()
    }
    return ''
}

function normalizeAnswer(input: unknown): SpeakingSubmissionAnswer | null {
    if (!input || typeof input !== 'object') return null

    const record = input as Record<string, unknown>
    return {
        questionId: typeof record.questionId === 'string' ? record.questionId : '',
        questionText: typeof record.questionText === 'string' ? record.questionText : '',
        transcript: typeof record.transcript === 'string' ? record.transcript : '',
        durationSeconds: Number(record.durationSeconds ?? 0),
        startedAt: typeof record.startedAt === 'string' ? record.startedAt : '00:00:00',
        audioUrl: typeof record.audioUrl === 'string' ? record.audioUrl : undefined,
    }
}

function normalizeSubmission(
    id: string,
    data: FirebaseFirestore.DocumentData,
): GuidedSubmissionRecord {
    return {
        id,
        studentId: typeof data.studentId === 'string' ? data.studentId : '',
        topicId: typeof data.topicId === 'string' ? data.topicId : '',
        completedAt: normalizeTimestamp(data.completedAt),
        answers: Array.isArray(data.answers)
            ? data.answers
                .map(normalizeAnswer)
                .filter((answer): answer is SpeakingSubmissionAnswer => Boolean(answer))
            : [],
    }
}

async function resolveTopicTitles(topicIds: string[]): Promise<Record<string, string>> {
    const uniqueTopicIds = [...new Set(topicIds.filter(Boolean))]
    if (uniqueTopicIds.length === 0) return {}

    const topicSnapshots = await Promise.all(
        uniqueTopicIds.map(topicId => adminDb.collection('speakingTopics').doc(topicId).get()),
    )

    return Object.fromEntries(
        topicSnapshots.map(topicSnapshot => [
            topicSnapshot.id,
            topicSnapshot.exists ? String(topicSnapshot.data()?.title || 'Untitled topic') : 'Untitled topic',
        ]),
    )
}

export async function listGuidedSubmissionSummariesByStudentIds(
    studentIds: string[],
): Promise<Record<string, GuidedSubmissionSummary>> {
    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))]
    if (uniqueStudentIds.length === 0) return {}

    const summaries = new Map<string, GuidedSubmissionSummary>()
    const chunkSize = 30

    for (let index = 0; index < uniqueStudentIds.length; index += chunkSize) {
        const chunk = uniqueStudentIds.slice(index, index + chunkSize)
        const snapshot = await adminDb
            .collection('speakingSubmissions')
            .where('studentId', 'in', chunk)
            .get()

        snapshot.forEach(docSnapshot => {
            const submission = normalizeSubmission(docSnapshot.id, docSnapshot.data())
            const existing = summaries.get(submission.studentId)

            if (!existing) {
                summaries.set(submission.studentId, {
                    guidedCount: 1,
                    lastCompletedAt: submission.completedAt,
                })
                return
            }

            existing.guidedCount += 1
            if (submission.completedAt > existing.lastCompletedAt) {
                existing.lastCompletedAt = submission.completedAt
            }
        })
    }

    return Object.fromEntries(summaries.entries())
}

export async function listGuidedSubmissionsForStudent(studentId: string): Promise<GuidedSubmissionListItem[]> {
    if (!studentId) return []

    const snapshot = await adminDb
        .collection('speakingSubmissions')
        .where('studentId', '==', studentId)
        .get()

    const submissions = snapshot.docs.map(docSnapshot => normalizeSubmission(docSnapshot.id, docSnapshot.data()))
    const topicTitleMap = await resolveTopicTitles(submissions.map(submission => submission.topicId))

    return submissions
        .map(submission => ({
            ...submission,
            topicTitle: topicTitleMap[submission.topicId] || 'Untitled topic',
            questionCount: submission.answers.length,
        }))
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
}

export async function getGuidedSubmissionDetail(submissionId: string): Promise<GuidedSubmissionDetail | null> {
    if (!submissionId) return null

    const snapshot = await adminDb.collection('speakingSubmissions').doc(submissionId).get()
    if (!snapshot.exists) return null

    const submission = normalizeSubmission(snapshot.id, snapshot.data() || {})
    const [topicSnapshot, studentSnapshot] = await Promise.all([
        submission.topicId ? adminDb.collection('speakingTopics').doc(submission.topicId).get() : null,
        submission.studentId ? adminDb.collection('users').doc(submission.studentId).get() : null,
    ])

    const studentData = studentSnapshot?.data() || {}
    return {
        ...submission,
        topicTitle: topicSnapshot?.exists ? String(topicSnapshot.data()?.title || 'Untitled topic') : 'Untitled topic',
        questionCount: submission.answers.length,
        studentName: String(studentData.displayName || studentData.name || 'Student'),
        studentEmail: String(studentData.email || ''),
        studentGroup: String(studentData.groupName || ''),
    }
}
