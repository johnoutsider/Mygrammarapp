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
