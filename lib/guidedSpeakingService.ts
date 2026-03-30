import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
    orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface SharedSpeakingTopic {
    id: string
    title: string
    createdBy: string
    isPublished: boolean
    createdAt: string | null
    questionCount: number
}

export interface GuidedSpeakingQuestion {
    id: string
    questionText: string
    order: number
    guidedQuestions: string[]
    suggestedWords: string[]
    sampleSentences: string[]
    sampleExamples: string[]
}

export interface SpeakingSubmissionAnswer {
    questionId: string
    questionText: string
    transcript: string
    durationSeconds: number
    startedAt: string
    audioUrl?: string
}

export interface GuidedSpeakingSubmission {
    id: string
    studentId: string
    topicId: string
    topicTitle: string
    completedAt: string
    answers: SpeakingSubmissionAnswer[]
}

function normalizeStringList(input: unknown): string[] {
    if (!Array.isArray(input)) return []
    return input
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.trim())
        .filter(Boolean)
}

function normalizeCreatedAt(value: unknown): string | null {
    if (!value) return null
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate().toISOString()
    }
    return null
}

function normalizeSubmissionAnswer(input: unknown): SpeakingSubmissionAnswer | null {
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

function normalizeQuestion(
    id: string,
    input: Record<string, unknown>,
): GuidedSpeakingQuestion {
    return {
        id,
        questionText: typeof input.questionText === 'string' ? input.questionText.trim() : '',
        order: typeof input.order === 'number' ? input.order : 0,
        guidedQuestions: normalizeStringList(input.guidedQuestions),
        suggestedWords: normalizeStringList(input.suggestedWords),
        sampleSentences: normalizeStringList(input.sampleSentences),
        sampleExamples: normalizeStringList(input.sampleExamples),
    }
}

function topicsCollection() {
    return collection(db, 'speakingTopics')
}

function topicDoc(topicId: string) {
    return doc(db, 'speakingTopics', topicId)
}

function topicQuestionsCollection(topicId: string) {
    return collection(db, 'speakingTopics', topicId, 'questions')
}

function legacyTopicDoc(teacherId: string) {
    return doc(db, 'settings', `speakingTopics_${teacherId}`)
}

async function countTopicQuestions(topicId: string): Promise<number> {
    const snapshot = await getDocs(topicQuestionsCollection(topicId))
    return snapshot.size
}

async function createSharedTopicIfMissing(title: string, teacherId: string) {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const existing = await getDocs(
        query(topicsCollection(), where('createdBy', '==', teacherId)),
    )

    const alreadyExists = existing.docs.some(snapshot => {
        const data = snapshot.data()
        return typeof data.title === 'string' && data.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
    })

    if (alreadyExists) return

    await addDoc(topicsCollection(), {
        title: trimmedTitle,
        createdBy: teacherId,
        isPublished: false,
        createdAt: serverTimestamp(),
    })
}

export async function migrateLegacySpeakingTopics(teacherId: string): Promise<void> {
    if (!teacherId) return

    const snapshot = await getDoc(legacyTopicDoc(teacherId))
    if (!snapshot.exists()) return

    const data = snapshot.data() as { topics?: unknown }
    const legacyTopics = normalizeStringList(data.topics)
    if (legacyTopics.length === 0) return

    for (const title of legacyTopics) {
        await createSharedTopicIfMissing(title, teacherId)
    }
}

export async function listTeacherSpeakingTopics(teacherId: string): Promise<SharedSpeakingTopic[]> {
    if (!teacherId) return []

    await migrateLegacySpeakingTopics(teacherId)

    const snapshot = await getDocs(
        query(topicsCollection(), where('createdBy', '==', teacherId)),
    )

    const topics = await Promise.all(
        snapshot.docs.map(async topicSnapshot => {
            const data = topicSnapshot.data()
            return {
                id: topicSnapshot.id,
                title: typeof data.title === 'string' ? data.title : 'Untitled topic',
                createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
                isPublished: Boolean(data.isPublished),
                createdAt: normalizeCreatedAt(data.createdAt),
                questionCount: await countTopicQuestions(topicSnapshot.id),
            } satisfies SharedSpeakingTopic
        }),
    )

    return topics.sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
        return rightTime - leftTime
    })
}

export async function listPublishedSpeakingTopics(): Promise<SharedSpeakingTopic[]> {
    const snapshot = await getDocs(
        query(topicsCollection(), where('isPublished', '==', true)),
    )

    const topics = await Promise.all(
        snapshot.docs.map(async topicSnapshot => {
            const data = topicSnapshot.data()
            return {
                id: topicSnapshot.id,
                title: typeof data.title === 'string' ? data.title : 'Untitled topic',
                createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
                isPublished: Boolean(data.isPublished),
                createdAt: normalizeCreatedAt(data.createdAt),
                questionCount: await countTopicQuestions(topicSnapshot.id),
            } satisfies SharedSpeakingTopic
        }),
    )

    return topics.sort((left, right) => left.title.localeCompare(right.title))
}

export async function getSpeakingTopic(topicId: string): Promise<SharedSpeakingTopic | null> {
    const snapshot = await getDoc(topicDoc(topicId))
    if (!snapshot.exists()) return null

    const data = snapshot.data()
    return {
        id: snapshot.id,
        title: typeof data.title === 'string' ? data.title : 'Untitled topic',
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
        isPublished: Boolean(data.isPublished),
        createdAt: normalizeCreatedAt(data.createdAt),
        questionCount: await countTopicQuestions(snapshot.id),
    }
}

export async function createSpeakingTopic(title: string, teacherId: string): Promise<SharedSpeakingTopic[]> {
    await createSharedTopicIfMissing(title, teacherId)
    return listTeacherSpeakingTopics(teacherId)
}

export async function deleteSpeakingTopic(topicId: string): Promise<void> {
    const questionsSnapshot = await getDocs(topicQuestionsCollection(topicId))
    const batch = writeBatch(db)

    questionsSnapshot.docs.forEach(questionSnapshot => {
        batch.delete(questionSnapshot.ref)
    })

    batch.delete(topicDoc(topicId))
    await batch.commit()
}

export async function deleteSpeakingTopicByTitle(title: string, teacherId: string): Promise<SharedSpeakingTopic[]> {
    const topics = await listTeacherSpeakingTopics(teacherId)
    const target = topics.find(topic => topic.title.toLowerCase() === title.trim().toLowerCase())
    if (target) {
        await deleteSpeakingTopic(target.id)
    }
    return listTeacherSpeakingTopics(teacherId)
}

export async function updateSpeakingTopicPublishState(topicId: string, isPublished: boolean): Promise<void> {
    await updateDoc(topicDoc(topicId), { isPublished })
}

export async function listGuidedSpeakingQuestions(topicId: string): Promise<GuidedSpeakingQuestion[]> {
    const snapshot = await getDocs(query(topicQuestionsCollection(topicId), orderBy('order', 'asc')))
    return snapshot.docs.map(questionSnapshot => normalizeQuestion(questionSnapshot.id, questionSnapshot.data()))
}

export async function createGuidedSpeakingQuestion(
    topicId: string,
    input: Omit<GuidedSpeakingQuestion, 'id' | 'order'>,
): Promise<void> {
    const existing = await getDocs(query(topicQuestionsCollection(topicId), orderBy('order', 'desc'), limit(1)))
    const maxOrder = existing.empty ? 0 : Number(existing.docs[0].data().order ?? 0)

    await addDoc(topicQuestionsCollection(topicId), {
        questionText: input.questionText.trim(),
        order: maxOrder + 1,
        guidedQuestions: normalizeStringList(input.guidedQuestions),
        suggestedWords: normalizeStringList(input.suggestedWords),
        sampleSentences: normalizeStringList(input.sampleSentences),
        sampleExamples: normalizeStringList(input.sampleExamples),
    })
}

export async function updateGuidedSpeakingQuestion(
    topicId: string,
    questionId: string,
    input: Omit<GuidedSpeakingQuestion, 'id' | 'order'>,
): Promise<void> {
    await updateDoc(doc(db, 'speakingTopics', topicId, 'questions', questionId), {
        questionText: input.questionText.trim(),
        guidedQuestions: normalizeStringList(input.guidedQuestions),
        suggestedWords: normalizeStringList(input.suggestedWords),
        sampleSentences: normalizeStringList(input.sampleSentences),
        sampleExamples: normalizeStringList(input.sampleExamples),
    })
}

async function rewriteQuestionOrder(topicId: string, questionIds: string[]) {
    const batch = writeBatch(db)
    questionIds.forEach((questionId, index) => {
        batch.update(doc(db, 'speakingTopics', topicId, 'questions', questionId), {
            order: index + 1,
        })
    })
    await batch.commit()
}

export async function deleteGuidedSpeakingQuestion(topicId: string, questionId: string): Promise<void> {
    await deleteDoc(doc(db, 'speakingTopics', topicId, 'questions', questionId))
    const remainingQuestions = await listGuidedSpeakingQuestions(topicId)
    await rewriteQuestionOrder(topicId, remainingQuestions.map(question => question.id))
}

export async function reorderGuidedSpeakingQuestions(topicId: string, questionIds: string[]): Promise<void> {
    await rewriteQuestionOrder(topicId, questionIds)
}

export async function saveGuidedSpeakingSubmission(input: {
    studentId: string
    topicId: string
    answers: SpeakingSubmissionAnswer[]
}) {
    await addDoc(collection(db, 'speakingSubmissions'), {
        studentId: input.studentId,
        topicId: input.topicId,
        completedAt: serverTimestamp(),
        answers: input.answers.map(answer => ({
            questionId: answer.questionId,
            questionText: answer.questionText,
            transcript: answer.transcript,
            durationSeconds: answer.durationSeconds,
            startedAt: answer.startedAt,
            ...(answer.audioUrl ? { audioUrl: answer.audioUrl } : {}),
        })),
    })
}

export async function listStudentGuidedSpeakingSubmissions(studentId: string): Promise<GuidedSpeakingSubmission[]> {
    if (!studentId) return []

    const snapshot = await getDocs(
        query(
            collection(db, 'speakingSubmissions'),
            where('studentId', '==', studentId),
        ),
    )

    const rawSubmissions = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as Record<string, unknown>
        return {
            id: docSnapshot.id,
            studentId,
            topicId: typeof data.topicId === 'string' ? data.topicId : '',
            completedAt: normalizeCreatedAt(data.completedAt) || '',
            answers: Array.isArray(data.answers)
                ? data.answers
                    .map(normalizeSubmissionAnswer)
                    .filter((answer): answer is SpeakingSubmissionAnswer => Boolean(answer))
                : [],
        }
    })

    const uniqueTopicIds = [...new Set(rawSubmissions.map(submission => submission.topicId).filter(Boolean))]
    const topicEntries = await Promise.all(
        uniqueTopicIds.map(async topicId => {
            const topic = await getSpeakingTopic(topicId)
            return [topicId, topic?.title || 'Untitled topic'] as const
        }),
    )
    const topicTitleMap = Object.fromEntries(topicEntries)

    return rawSubmissions
        .map(submission => ({
            ...submission,
            topicTitle: topicTitleMap[submission.topicId] || 'Untitled topic',
        }))
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
}

export async function getStudentGuidedSpeakingSubmission(
    submissionId: string,
    studentId: string,
): Promise<GuidedSpeakingSubmission | null> {
    if (!submissionId || !studentId) return null

    const snapshot = await getDoc(doc(db, 'speakingSubmissions', submissionId))
    if (!snapshot.exists()) return null

    const data = snapshot.data() as Record<string, unknown>
    if (data.studentId !== studentId) return null

    const topicId = typeof data.topicId === 'string' ? data.topicId : ''
    const topic = topicId ? await getSpeakingTopic(topicId) : null

    return {
        id: snapshot.id,
        studentId,
        topicId,
        topicTitle: topic?.title || 'Untitled topic',
        completedAt: normalizeCreatedAt(data.completedAt) || '',
        answers: Array.isArray(data.answers)
            ? data.answers
                .map(normalizeSubmissionAnswer)
                .filter((answer): answer is SpeakingSubmissionAnswer => Boolean(answer))
            : [],
    }
}

export async function listTeacherSpeakingTopicTitles(teacherId: string): Promise<string[]> {
    const topics = await listTeacherSpeakingTopics(teacherId)
    return topics.map(topic => topic.title)
}
