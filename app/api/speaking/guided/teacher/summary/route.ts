import { NextResponse } from 'next/server'
import { listGuidedSubmissionSummariesByStudentIds } from '@/lib/guidedSpeakingAdmin'
import { filterOwnedStudentIds, getTeacherRequestContext } from '@/lib/teacherRequest'

export async function POST(request: Request) {
    try {
        const { teacherId, studentIds } = await request.json()
        if (typeof teacherId !== 'string' || !teacherId.trim()) {
            return NextResponse.json({ error: 'teacherId is required.' }, { status: 400 })
        }

        const context = await getTeacherRequestContext(teacherId)
        if (!context) {
            return NextResponse.json({ error: 'Only teachers can access guided speaking summaries.' }, { status: 403 })
        }

        const requestedStudentIds = Array.isArray(studentIds)
            ? studentIds.filter((studentId): studentId is string => typeof studentId === 'string' && studentId.trim().length > 0)
            : []

        const ownedStudentIds = await filterOwnedStudentIds(context.classIds, requestedStudentIds)
        const summaries = await listGuidedSubmissionSummariesByStudentIds(ownedStudentIds)

        return NextResponse.json({ summaries })
    } catch (error: any) {
        console.error('Guided summary route error:', error)
        return NextResponse.json({ error: error?.message || 'Failed to load guided speaking summaries.' }, { status: 500 })
    }
}
