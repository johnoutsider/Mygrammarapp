import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function submitQuizForReview(
    quiz: { title: string; questions: any[] },
    userId: string,
    classId: string,
    extra?: Record<string, any>   // ← add this param
) {
    await addDoc(collection(db, 'quizzes'), {
        ...quiz,
        createdBy: userId,
        classId,
        status: 'pending',        // ← always set on save
        createdAt: serverTimestamp(),
        ...extra,                 // ← spreads createdBy + status safely
    });
}
// ── Teacher Quiz Types ─────────────────────────────────────────────────────────

export interface TeacherQuiz {
    id: string
    title: string
    description: string
    coverColor: string
    privacy: 'public' | 'private'
    questions: any[]
    createdBy: string
    createdAt: any
    status: string
    source: string
}

// ── Teacher Quiz Functions ─────────────────────────────────────────────────────

export async function createTeacherQuiz(
    teacherUid: string,
    title: string,
    description: string,
    privacy: 'public' | 'private',
    coverColor: string
): Promise<string> {
    const { db } = await import('./firebase')
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')

    const docRef = await addDoc(collection(db, 'quizzes'), {
        title,
        description,
        coverColor,
        privacy,
        questions: [],
        createdBy: teacherUid,
        createdAt: serverTimestamp(),
        status: 'teacher_approved',
        source: 'teacher',
    })

    return docRef.id
}

export async function getTeacherQuizzes(teacherUid: string): Promise<TeacherQuiz[]> {
    const { db } = await import('./firebase')
    const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore')

    const snap = await getDocs(
        query(
            collection(db, 'quizzes'),
            where('createdBy', '==', teacherUid),
            where('source', '==', 'teacher'),
            orderBy('createdAt', 'desc')
        )
    )

    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherQuiz))
}

export async function updateTeacherQuiz(
    quizId: string,
    fields: {
        title?: string
        description?: string
        privacy?: 'public' | 'private'
        coverColor?: string
        questions?: any[]
    }
): Promise<void> {
    const { db } = await import('./firebase')
    const { doc, updateDoc } = await import('firebase/firestore')
    await updateDoc(doc(db, 'quizzes', quizId), fields)
}

export async function deleteTeacherQuiz(quizId: string): Promise<void> {
    const { db } = await import('./firebase')
    const { doc, deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'quizzes', quizId))
}