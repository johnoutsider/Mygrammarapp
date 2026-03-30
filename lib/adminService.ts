import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserProfile, TeacherPermissions } from '@/lib/auth'
import { DEFAULT_TEACHER_PERMISSIONS } from '@/lib/auth'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type AuditActionType =
    | 'teacher_approved'
    | 'teacher_rejected'
    | 'teacher_suspended'
    | 'teacher_unsuspended'
    | 'teacher_removed'
    | 'permissions_changed'
    | 'role_changed'
    | 'platform_settings_updated'

export interface AuditEntry {
    id: string
    action: AuditActionType
    performedBy: string
    performedByName?: string
    targetUser: string
    targetUserName?: string
    targetUserEmail?: string
    details?: Record<string, any>
    timestamp: Date
}

export interface PlatformSettings {
    requireApproval: boolean
    defaultPermissions: TeacherPermissions
    platformName: string
    adminEmails: string[]
}

export interface PlatformStats {
    totalTeachers: number
    approvedTeachers: number
    pendingTeachers: number
    suspendedTeachers: number
    totalStudents: number
    totalClasses: number
}

// ─────────────────────────────────────────────
// Teacher queries
// ─────────────────────────────────────────────

export async function getTeachers(filter?: {
    status?: 'pending' | 'approved' | 'suspended' | 'rejected' | 'all'
}): Promise<UserProfile[]> {
    let q
    if (filter?.status && filter.status !== 'all') {
        q = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('status', '==', filter.status)
        )
    } else {
        q = query(collection(db, 'users'), where('role', '==', 'teacher'))
    }
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
}

export async function getPendingTeachers(): Promise<UserProfile[]> {
    const q = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        where('status', '==', 'pending')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
}

export async function getTeacherById(teacherId: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, 'users', teacherId))
    if (!snap.exists()) return null
    return { uid: snap.id, ...snap.data() } as UserProfile
}

// ─────────────────────────────────────────────
// Teacher approval/rejection/suspension
// ─────────────────────────────────────────────

export async function approveTeacher(
    teacherId: string,
    adminId: string,
    adminName?: string
): Promise<void> {
    const teacher = await getTeacherById(teacherId)
    await updateDoc(doc(db, 'users', teacherId), {
        status: 'approved',
        approvedBy: adminId,
        approvedAt: serverTimestamp(),
        permissions: DEFAULT_TEACHER_PERMISSIONS,
        classIds: teacher?.classIds?.length ? teacher.classIds : [],
    })
    await logAdminAction({
        action: 'teacher_approved',
        performedBy: adminId,
        performedByName: adminName,
        targetUser: teacherId,
        targetUserName: teacher?.displayName || teacher?.name,
        targetUserEmail: teacher?.email,
    })
}

export async function rejectTeacher(
    teacherId: string,
    adminId: string,
    reason?: string,
    adminName?: string
): Promise<void> {
    const teacher = await getTeacherById(teacherId)
    await updateDoc(doc(db, 'users', teacherId), {
        status: 'rejected',
        rejectedReason: reason || '',
    })
    await logAdminAction({
        action: 'teacher_rejected',
        performedBy: adminId,
        performedByName: adminName,
        targetUser: teacherId,
        targetUserName: teacher?.displayName || teacher?.name,
        targetUserEmail: teacher?.email,
        details: { reason },
    })
}

export async function suspendTeacher(
    teacherId: string,
    adminId: string,
    reason: string,
    adminName?: string
): Promise<void> {
    const teacher = await getTeacherById(teacherId)
    await updateDoc(doc(db, 'users', teacherId), {
        status: 'suspended',
        suspendedAt: serverTimestamp(),
        suspendedReason: reason,
    })
    await logAdminAction({
        action: 'teacher_suspended',
        performedBy: adminId,
        performedByName: adminName,
        targetUser: teacherId,
        targetUserName: teacher?.displayName || teacher?.name,
        targetUserEmail: teacher?.email,
        details: { reason },
    })
}

export async function unsuspendTeacher(
    teacherId: string,
    adminId: string,
    adminName?: string
): Promise<void> {
    const teacher = await getTeacherById(teacherId)
    await updateDoc(doc(db, 'users', teacherId), {
        status: 'approved',
        suspendedAt: null,
        suspendedReason: null,
    })
    await logAdminAction({
        action: 'teacher_unsuspended',
        performedBy: adminId,
        performedByName: adminName,
        targetUser: teacherId,
        targetUserName: teacher?.displayName || teacher?.name,
        targetUserEmail: teacher?.email,
    })
}

export async function removeTeacher(
    teacherId: string,
    adminId: string,
    adminName?: string
): Promise<void> {
    const teacher = await getTeacherById(teacherId)
    // Demote to student, clear teacher fields
    await setDoc(doc(db, 'users', teacherId), {
        role: 'student',
        status: null,
        permissions: null,
        classIds: null,
        approvedBy: null,
        approvedAt: null,
        suspendedAt: null,
        suspendedReason: null,
        classId: 'default-class',
        accessMode: 'both',
    }, { merge: true })
    await logAdminAction({
        action: 'teacher_removed',
        performedBy: adminId,
        performedByName: adminName,
        targetUser: teacherId,
        targetUserName: teacher?.displayName || teacher?.name,
        targetUserEmail: teacher?.email,
    })
}

// ─────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────

export async function updateTeacherPermissions(
    teacherId: string,
    permissions: TeacherPermissions,
    adminId: string,
    adminName?: string
): Promise<void> {
    const teacher = await getTeacherById(teacherId)
    await updateDoc(doc(db, 'users', teacherId), { permissions })
    await logAdminAction({
        action: 'permissions_changed',
        performedBy: adminId,
        performedByName: adminName,
        targetUser: teacherId,
        targetUserName: teacher?.displayName || teacher?.name,
        targetUserEmail: teacher?.email,
        details: { permissions },
    })
}

// ─────────────────────────────────────────────
// Platform stats
// ─────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
    const usersSnap = await getDocs(collection(db, 'users'))
    const users = usersSnap.docs.map(d => d.data())

    const teachers = users.filter(u => u.role === 'teacher')
    const students = users.filter(u => u.role === 'student')

    const classesSnap = await getDocs(collection(db, 'classes'))

    return {
        totalTeachers: teachers.length,
        approvedTeachers: teachers.filter(t => t.status === 'approved').length,
        pendingTeachers: teachers.filter(t => t.status === 'pending').length,
        suspendedTeachers: teachers.filter(t => t.status === 'suspended').length,
        totalStudents: students.length,
        totalClasses: classesSnap.size,
    }
}

export async function getTeacherStats(teacherId: string): Promise<{
    classCount: number
    studentCount: number
}> {
    const { getTeacherClasses } = await import('@/lib/classService')
    const classes = await getTeacherClasses(teacherId)

    const studentsSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'student'))
    )
    const students = studentsSnap.docs.map(d => d.data())
    const classIds = classes.map(c => c.id)
    const studentCount = students.filter(s => classIds.includes(s.classId)).length

    return { classCount: classes.length, studentCount }
}

// ─────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────

export async function logAdminAction(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    await addDoc(collection(db, 'auditLog'), {
        ...entry,
        timestamp: serverTimestamp(),
    })
}

export async function getAuditLog(limitCount = 50): Promise<AuditEntry[]> {
    const q = query(
        collection(db, 'auditLog'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => {
        const data = d.data()
        return {
            id: d.id,
            ...data,
            timestamp: data.timestamp instanceof Timestamp
                ? data.timestamp.toDate()
                : new Date(data.timestamp),
        } as AuditEntry
    })
}

// ─────────────────────────────────────────────
// Platform settings
// ─────────────────────────────────────────────

const PLATFORM_SETTINGS_DOC = 'platform'

export async function getPlatformSettings(): Promise<PlatformSettings> {
    const snap = await getDoc(doc(db, 'settings', PLATFORM_SETTINGS_DOC))
    if (!snap.exists()) {
        return {
            requireApproval: true,
            defaultPermissions: DEFAULT_TEACHER_PERMISSIONS,
            platformName: 'Peer Feedback App',
            adminEmails: [],
        }
    }
    return snap.data() as PlatformSettings
}

export async function updatePlatformSettings(
    settings: Partial<PlatformSettings>,
    adminId: string,
    adminName?: string
): Promise<void> {
    await setDoc(doc(db, 'settings', PLATFORM_SETTINGS_DOC), settings, { merge: true })
    await logAdminAction({
        action: 'platform_settings_updated',
        performedBy: adminId,
        performedByName: adminName,
        targetUser: adminId,
        details: { updatedFields: Object.keys(settings) },
    })
}
