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
    classId: string      // which class owns this group
    teacherId: string    // who created it
    createdAt?: any
}

export interface StudentProfile {
    uid: string
    name?: string
    displayName?: string
    email?: string
    classId?: string
    groupId?: string
    groupName?: string
    profileGroupName?: string
    accessMode: AccessMode
    role?: string
}

// ─────────────────────────────────────────────
// Group CRUD
// ─────────────────────────────────────────────

/** Fetch groups scoped to a specific class */
export async function getGroupsByClass(classId: string): Promise<Group[]> {
    const q = query(collection(db, 'groups'), where('classId', '==', classId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Group))
}

/** Legacy: fetch all groups (used for migration only) */
export async function getAllGroups(): Promise<Group[]> {
    const snap = await getDocs(collection(db, 'groups'))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Group))
}

/** Create a new group scoped to a class */
export async function createGroup(
    name: string,
    accessMode: AccessMode,
    classId: string,
    teacherId: string
): Promise<Group> {
    const ref = await addDoc(collection(db, 'groups'), {
        name,
        accessMode,
        classId,
        teacherId,
        createdAt: serverTimestamp(),
    })
    return { id: ref.id, name, accessMode, classId, teacherId }
}

/** Update a group's name or accessMode.
 *  If accessMode changes, batch-updates all students in that group. */
export async function updateGroup(
    groupId: string,
    updates: { name?: string; accessMode?: AccessMode }
): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), updates)

    if (updates.accessMode) {
        await batchUpdateGroupAccess(groupId, updates.accessMode)
    }
}

/** Delete a group and reset all its students back to 'both' */
export async function deleteGroup(groupId: string): Promise<void> {
    await batchUpdateGroupAccess(groupId, 'both', true)
    await deleteDoc(doc(db, 'groups', groupId))
}

// ─────────────────────────────────────────────
// Migration: patch orphan groups (no classId)
// ─────────────────────────────────────────────

/**
 * One-time migration: finds groups that have no classId and assigns them
 * to the given defaultClassId. Safe to call multiple times.
 */
export async function migrateOrphanGroups(
    teacherId: string,
    defaultClassId: string
): Promise<void> {
    const snap = await getDocs(collection(db, 'groups'))
    const orphans = snap.docs.filter(d => !d.data().classId)
    if (orphans.length === 0) return

    const batch = writeBatch(db)
    orphans.forEach(d => {
        batch.update(doc(db, 'groups', d.id), {
            classId: defaultClassId,
            teacherId,
        })
    })
    await batch.commit()
}

// ─────────────────────────────────────────────
// Student Assignment
// ─────────────────────────────────────────────

/** Assign a student to a group — updates groupId, groupName, accessMode on user doc */
export async function assignStudentToGroup(studentId: string, groupId: string): Promise<void> {
    const groupSnap = await getDoc(doc(db, 'groups', groupId))
    if (!groupSnap.exists()) throw new Error('Group not found')

    const group = groupSnap.data() as Omit<Group, 'id'>
    await updateDoc(doc(db, 'users', studentId), {
        groupId,
        groupName: group.name,
        accessMode: group.accessMode,
    })
}

/** Remove a student from their group — resets to class defaults */
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
// Student Queries
// ─────────────────────────────────────────────

/**
 * Fetch students belonging to one or more classes.
 * Replaces the old getAllStudents() for teacher-scoped views.
 * Handles Firestore 'in' limit of 30 by chunking.
 */
export async function getStudentsByClassIds(classIds: string[]): Promise<StudentProfile[]> {
    if (classIds.length === 0) return []

    const results: StudentProfile[] = []
    const chunkSize = 30

    for (let i = 0; i < classIds.length; i += chunkSize) {
        const chunk = classIds.slice(i, i + chunkSize)
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('classId', 'in', chunk)
        )
        const snap = await getDocs(q)
        snap.docs.forEach(d => results.push({
            uid: d.id,
            accessMode: 'both',
            ...d.data(),
        } as StudentProfile))
    }

    return results
}

/** Legacy: fetch all students (admin use only) */
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

/** Get student count per group for a specific class */
export async function getGroupStudentCounts(classId?: string): Promise<Record<string, number>> {
    let q
    if (classId) {
        q = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('classId', '==', classId)
        )
    } else {
        q = query(collection(db, 'users'), where('role', '==', 'student'))
    }
    const snap = await getDocs(q)
    const counts: Record<string, number> = {}
    snap.docs.forEach(d => {
        const gid = d.data().groupId
        if (gid) counts[gid] = (counts[gid] || 0) + 1
    })
    return counts
}

// Keep old getGroups() as alias for backward compat with any pages not yet updated
export async function getGroups(): Promise<Group[]> {
    return getAllGroups()
}
