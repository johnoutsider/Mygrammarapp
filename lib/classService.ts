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
    setDoc,
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
    inviteCode: string           // unique 6-char alphanumeric invite code
    inviteEnabled: boolean       // teacher can disable joining
    createdAt?: any
}

// ─────────────────────────────────────────────
// Invite code helpers
// ─────────────────────────────────────────────

/** Generate a unique 6-character alphanumeric invite code */
export function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I ambiguity
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
}

// ─────────────────────────────────────────────
// Seed: ensure default-class exists
// ─────────────────────────────────────────────

export async function ensureDefaultClass(): Promise<void> {
    const ref = doc(db, 'classes', 'default-class')
    const snap = await getDoc(ref)
    if (!snap.exists()) {
        await setDoc(ref, {
            name: 'Default Class',
            subject: 'both',
            teacherIds: [],
            inviteCode: generateInviteCode(),
            inviteEnabled: false, // default-class doesn't accept invites
            createdAt: serverTimestamp(),
        })
    }
}

// ─────────────────────────────────────────────
// Class CRUD
// ─────────────────────────────────────────────

/** Fetch all classes */
export async function getClasses(): Promise<Class[]> {
    const snap = await getDocs(collection(db, 'classes'))
    return snap.docs.map(d => normalizeClass(d.id, d.data()))
}

/** Fetch only classes belonging to a specific teacher */
export async function getTeacherClasses(teacherId: string): Promise<Class[]> {
    const q = query(
        collection(db, 'classes'),
        where('teacherIds', 'array-contains', teacherId)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => normalizeClass(d.id, d.data()))
}

/** Get a single class by id */
export async function getClass(classId: string): Promise<Class | null> {
    const snap = await getDoc(doc(db, 'classes', classId))
    if (!snap.exists()) return null
    return normalizeClass(snap.id, snap.data())
}

/** Lookup a class by its invite code (case-insensitive) */
export async function getClassByInviteCode(code: string): Promise<Class | null> {
    const normalized = code.trim().toUpperCase()
    const q = query(collection(db, 'classes'), where('inviteCode', '==', normalized))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return normalizeClass(d.id, d.data())
}

/** Normalize a class doc — fills in defaults for legacy docs without inviteCode */
function normalizeClass(id: string, data: any): Class {
    return {
        id,
        name: data.name || 'Unnamed Class',
        subject: data.subject || 'both',
        teacherIds: data.teacherIds || [],
        inviteCode: data.inviteCode || '',
        inviteEnabled: data.inviteEnabled ?? (id !== 'default-class'),
        createdAt: data.createdAt,
    }
}

/** Create a new class with auto-generated invite code */
export async function createClass(
    name: string,
    subject: AccessMode,
    teacherId: string
): Promise<Class> {
    const inviteCode = generateInviteCode()
    const ref = await addDoc(collection(db, 'classes'), {
        name,
        subject,
        teacherIds: [teacherId],
        inviteCode,
        inviteEnabled: true,
        createdAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'users', teacherId), {
        classIds: arrayUnion(ref.id),
    })

    return { id: ref.id, name, subject, teacherIds: [teacherId], inviteCode, inviteEnabled: true }
}

/** Update class name or subject */
export async function updateClass(
    classId: string,
    updates: { name?: string; subject?: AccessMode }
): Promise<void> {
    await updateDoc(doc(db, 'classes', classId), updates)
}

/** Regenerate a class's invite code — returns the new code */
export async function regenerateInviteCode(classId: string): Promise<string> {
    const newCode = generateInviteCode()
    await updateDoc(doc(db, 'classes', classId), { inviteCode: newCode })
    return newCode
}

/** Toggle invite link on/off */
export async function toggleClassInvite(classId: string, enabled: boolean): Promise<void> {
    await updateDoc(doc(db, 'classes', classId), { inviteEnabled: enabled })
}

/** Backfill invite code on a legacy class that doesn't have one */
export async function backfillInviteCode(classId: string): Promise<string> {
    const code = generateInviteCode()
    await updateDoc(doc(db, 'classes', classId), { inviteCode: code, inviteEnabled: true })
    return code
}

/** Delete a class — moves its students back to default-class */
export async function deleteClass(classId: string): Promise<void> {
    if (classId === 'default-class') return

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
// Joining via invite code
// ─────────────────────────────────────────────

/** Assign a student to a class via invite — updates classId, clears group */
export async function joinClassByInvite(studentId: string, classId: string): Promise<void> {
    const classDoc = await getDoc(doc(db, 'classes', classId))
    if (!classDoc.exists()) throw new Error('Class not found')

    await updateDoc(doc(db, 'users', studentId), {
        classId,
        groupId: null,
        groupName: null,
        accessMode: classDoc.data().subject || 'both',
    })
}

// ─────────────────────────────────────────────
// Teacher assignment
// ─────────────────────────────────────────────

export async function addTeacherToClass(classId: string, teacherId: string): Promise<void> {
    await updateDoc(doc(db, 'classes', classId), { teacherIds: arrayUnion(teacherId) })
    await updateDoc(doc(db, 'users', teacherId), { classIds: arrayUnion(classId) })
}

export async function removeTeacherFromClass(classId: string, teacherId: string): Promise<void> {
    await updateDoc(doc(db, 'classes', classId), { teacherIds: arrayRemove(teacherId) })
    await updateDoc(doc(db, 'users', teacherId), { classIds: arrayRemove(classId) })
}

// ─────────────────────────────────────────────
// Student assignment
// ─────────────────────────────────────────────

/** Move a student into a class */
export async function assignStudentToClass(studentId: string, classId: string): Promise<void> {
    const classDoc = await getDoc(doc(db, 'classes', classId))
    if (!classDoc.exists()) throw new Error('Class not found')

    await updateDoc(doc(db, 'users', studentId), {
        classId,
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

/** Get students in default-class (unassigned pool) */
export async function getUnassignedStudents() {
    const q = query(
        collection(db, 'users'),
        where('classId', '==', 'default-class'),
        where('role', '==', 'student')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ uid: d.id, ...d.data() as any }))
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
