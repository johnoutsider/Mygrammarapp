import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function submitQuizForReview(
    quizData: any,
    userId: string,
    classId: string
) {
    const ref = await addDoc(collection(db, 'quizzes'), {
        ...quizData,
        createdBy: userId,
        classId,
        status: 'pending_peer_review',
        peerReviews: [],
        teacherFeedback: null,
        approvedAt: null,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}
