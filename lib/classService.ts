import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AccessMode } from '@/lib/groupService'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface Class {
    id: string
    name: string
    subject: AccessMode          // default access for students in this class
    teacherIds: string[]         // multiple teachers can share a class
    createdAt?: any
}

// ─────────────────────────────────────────────
// Seed: ensure default-class exists
// Called once on app boot — safe to call multiple times
// ─────────────────────────────────────────────

export async function ensureDefaultClass(): Promise<void> {
    const ref = doc(db, 'classes', 'default-class')
    const snap = await getDoc(ref)
    if (!snap.exists()) {
        await import('firebase/firestore').then(({ setDoc }) =>
            setDoc(ref, {
                name: 'Default Class',
                subject: 'both',
                teacherIds: [],
                createdAt: serverTimestamp(),
            })
        )
    }
}

// ─────────────────────────────────────────────
// Class CRUD
// ─────────────────────────────────────────────

/** Fetch all classes */
export async function getClasses(): Promise<Class[]> {
    const snap = await getDocs(collection(db, 'classes'))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Class))
}

/** Fetch only classes belonging to a specific teacher */
export async function getTeacherClasses(teacherId: string): Promise<Class[]> {
    const q = query(
        collection(db, 'classes'),
        where('teacherIds', 'array-contains', teacherId)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Class))
}

/** Get a single class by id */
export async function getClass(classId: string): Promise<Class | null> {
    const snap = await getDoc(doc(db, 'classes', classId))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as Class
}

/** Create a new class and assign it to a teacher */
export async function createClass(
    name: string,
    subject: AccessMode,
    teacherId: string
): Promise<Class> {
    const ref = await addDoc(collection(db, 'classes'), {
        name,
        subject,
        teacherIds: [teacherId],
        createdAt: serverTimestamp(),
    })

    // Add classId to teacher's classIds array
    await updateDoc(doc(db, 'users', teacherId), {
        classIds: arrayUnion(ref.id),
    })

    return { id: ref.id, name, subject, teacherIds: [teacherId] }
}

/** Update class name or subject */
export async function updateClass(
    classId: string,
    updates: { name?: string; subject?: AccessMode }
): Promise<void> {
    await updateDoc(doc(db, 'classes', classId), updates)
}

/** Delete a class — moves its students back to default-class */
export async function deleteClass(classId: string): Promise<void> {
    if (classId === 'default-class') return // protect the default class

    // Move all students in this class back to default-class
    const studentsQ = query(
        collection(db, 'users'),
        where('classId', '==', classId),
        where('role', '==', 'student')
    )
    const studentsSnap = await getDocs(studentsQ)

    const { writeBatch } = await import('firebase/firestore')
    if (!studentsSnap.empty) {
        const batch = writeBatch(db)
        studentsSnap.docs.forEach(d => {
            batch.update(doc(db, 'users', d.id), {
                classId: 'default-class',
                groupId: null,
                groupName: null,
                accessMode: 'both',
            })
        })
        await batch.commit()
    }

    // Remove classId from all teachers who had it
    const classDoc = await getDoc(doc(db, 'classes', classId))
    if (classDoc.exists()) {
        const teacherIds: string[] = classDoc.data().teacherIds || []
        for (const tid of teacherIds) {
            await updateDoc(doc(db, 'users', tid), {
                classIds: arrayRemove(classId),
            })
        }
    }

    await deleteDoc(doc(db, 'classes', classId))
}

// ─────────────────────────────────────────────
// Teacher assignment
// ─────────────────────────────────────────────

/** Add a teacher to a class */
export async function addTeacherToClass(
    classId: string,
    teacherId: string
): Promise<void> {
    await updateDoc(doc(db, 'classes', classId), {
        teacherIds: arrayUnion(teacherId),
    })
    await updateDoc(doc(db, 'users', teacherId), {
        classIds: arrayUnion(classId),
    })
}

/** Remove a teacher from a class */
export async function removeTeacherFromClass(
    classId: string,
    teacherId: string
): Promise<void> {
    await updateDoc(doc(db, 'classes', classId), {
        teacherIds: arrayRemove(teacherId),
    })
    await updateDoc(doc(db, 'users', teacherId), {
        classIds: arrayRemove(classId),
    })
}

// ─────────────────────────────────────────────
// Student assignment
// ─────────────────────────────────────────────

/** Move a student into a class */
export async function assignStudentToClass(
    studentId: string,
    classId: string
): Promise<void> {
    const classDoc = await getDoc(doc(db, 'classes', classId))
    if (!classDoc.exists()) throw new Error('Class not found')

    await updateDoc(doc(db, 'users', studentId), {
        classId,
        // Reset group when moving classes
        groupId: null,
        groupName: null,
        accessMode: classDoc.data().subject || 'both',
    })
}

/** Get all students in a class */
export async function getStudentsByClass(classId: string) {
    const q = query(
        collection(db, 'users'),
        where('classId', '==', classId),
        where('role', '==', 'student')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

/** Get student counts per class — returns { classId: count } */
export async function getClassStudentCounts(): Promise<Record<string, number>> {
    const q = query(collection(db, 'users'), where('role', '==', 'student'))
    const snap = await getDocs(q)
    const counts: Record<string, number> = {}
    snap.docs.forEach(d => {
        const cid = d.data().classId
        if (cid) counts[cid] = (counts[cid] || 0) + 1
    })
    return counts
}