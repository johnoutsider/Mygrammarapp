import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type AccessMode = 'both' | 'writing' | 'grammar' | 'speaking'

export interface Group {
    id: string
    name: string
    accessMode: AccessMode
    createdAt?: any
}

export interface StudentProfile {
    uid: string
    name?: string
    displayName?: string
    email?: string
    groupId?: string
    groupName?: string
    profileGroupName?: string
    accessMode: AccessMode
    role?: string
}

// ─────────────────────────────────────────────
// Group CRUD
// ─────────────────────────────────────────────

/** Fetch all groups */
export async function getGroups(): Promise<Group[]> {
    const snap = await getDocs(collection(db, 'groups'))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Group))
}

/** Create a new group */
export async function createGroup(name: string, accessMode: AccessMode): Promise<Group> {
    const ref = await addDoc(collection(db, 'groups'), {
        name,
        accessMode,
        createdAt: serverTimestamp(),
    })
    return { id: ref.id, name, accessMode }
}

/** Update a group's name or accessMode.
 *  If accessMode changes, batch-updates all students in that group. */
export async function updateGroup(
    groupId: string,
    updates: { name?: string; accessMode?: AccessMode }
): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), updates)

    // If accessMode changed, push it to all students in this group
    if (updates.accessMode) {
        await batchUpdateGroupAccess(groupId, updates.accessMode)
    }
}

/** Delete a group and reset all its students back to 'both' */
export async function deleteGroup(groupId: string): Promise<void> {
    // Reset all students in this group first
    await batchUpdateGroupAccess(groupId, 'both', true)
    await deleteDoc(doc(db, 'groups', groupId))
}

// ─────────────────────────────────────────────
// Student Assignment
// ─────────────────────────────────────────────

/** Assign a student to a group — updates groupId, groupName, accessMode on user doc */
export async function assignStudentToGroup(
    studentId: string,
    groupId: string
): Promise<void> {
    const groupSnap = await getDoc(doc(db, 'groups', groupId))
    if (!groupSnap.exists()) throw new Error('Group not found')

    const group = groupSnap.data() as Omit<Group, 'id'>

    await updateDoc(doc(db, 'users', studentId), {
        groupId,
        groupName: group.name,
        accessMode: group.accessMode,
    })
}

/** Remove a student from their group — resets to defaults */
export async function unassignStudent(studentId: string): Promise<void> {
    await updateDoc(doc(db, 'users', studentId), {
        groupId: null,
        groupName: null,
        accessMode: 'both',
    })
}

// ─────────────────────────────────────────────
// Batch Operations
// ─────────────────────────────────────────────

/** Update accessMode for every student in a group in one batch write.
 *  If clearGroup is true, also clears groupId/groupName (used when deleting a group). */
export async function batchUpdateGroupAccess(
    groupId: string,
    accessMode: AccessMode,
    clearGroup = false
): Promise<void> {
    const q = query(collection(db, 'users'), where('groupId', '==', groupId))
    const snap = await getDocs(q)

    if (snap.empty) return

    const batch = writeBatch(db)

    snap.docs.forEach(d => {
        const updates: any = { accessMode }
        if (clearGroup) {
            updates.groupId = null
            updates.groupName = null
        }
        batch.update(doc(db, 'users', d.id), updates)
    })

    await batch.commit()
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

/** Fetch all students (role === 'student') */
export async function getAllStudents(): Promise<StudentProfile[]> {
    const q = query(collection(db, 'users'), where('role', '==', 'student'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({
        uid: d.id,
        accessMode: 'both',
        ...d.data(),
    } as StudentProfile))
}

/** Fetch all students belonging to a specific group */
export async function getStudentsByGroup(groupId: string): Promise<StudentProfile[]> {
    const q = query(collection(db, 'users'), where('groupId', '==', groupId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({
        uid: d.id,
        accessMode: 'both',
        ...d.data(),
    } as StudentProfile))
}

/** Get student count per group — returns { groupId: count } */
export async function getGroupStudentCounts(): Promise<Record<string, number>> {
    const q = query(collection(db, 'users'), where('role', '==', 'student'))
    const snap = await getDocs(q)

    const counts: Record<string, number> = {}
    snap.docs.forEach(d => {
        const gid = d.data().groupId
        if (gid) counts[gid] = (counts[gid] || 0) + 1
    })
    return counts
}
