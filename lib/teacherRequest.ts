import { adminDb } from '@/lib/firebase-admin'
import { FieldPath } from 'firebase-admin/firestore'

export interface TeacherRequestContext {
    teacherId: string
    classIds: string[]
}

export async function getTeacherRequestContext(teacherId: string): Promise<TeacherRequestContext | null> {
    if (!teacherId) return null

    const teacherSnapshot = await adminDb.collection('users').doc(teacherId).get()
    if (!teacherSnapshot.exists) return null

    const teacherData = teacherSnapshot.data() || {}
    const role = String(teacherData.role || '')
    if (role !== 'teacher' && role !== 'admin') return null

    return {
        teacherId,
        classIds: Array.isArray(teacherData.classIds)
            ? teacherData.classIds.filter((classId): classId is string => typeof classId === 'string')
            : [],
    }
}

export async function filterOwnedStudentIds(
    teacherClassIds: string[],
    studentIds: string[],
): Promise<string[]> {
    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))]
    if (teacherClassIds.length === 0 || uniqueStudentIds.length === 0) return []

    const ownedStudentIds: string[] = []
    const chunkSize = 30

    for (let index = 0; index < uniqueStudentIds.length; index += chunkSize) {
        const chunk = uniqueStudentIds.slice(index, index + chunkSize)
        const snapshot = await adminDb
            .collection('users')
            .where('role', '==', 'student')
            .where(FieldPath.documentId(), 'in', chunk)
            .get()

        snapshot.forEach(studentSnapshot => {
            const classId = studentSnapshot.data()?.classId
            if (typeof classId === 'string' && teacherClassIds.includes(classId)) {
                ownedStudentIds.push(studentSnapshot.id)
            }
        })
    }

    return ownedStudentIds
}

export async function teacherOwnsStudent(
    teacherClassIds: string[],
    studentId: string,
): Promise<boolean> {
    if (!studentId || teacherClassIds.length === 0) return false

    const studentSnapshot = await adminDb.collection('users').doc(studentId).get()
    if (!studentSnapshot.exists) return false

    const classId = studentSnapshot.data()?.classId
    return typeof classId === 'string' && teacherClassIds.includes(classId)
}
