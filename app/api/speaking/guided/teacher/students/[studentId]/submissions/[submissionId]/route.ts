import { NextResponse } from 'next/server'
import { getGuidedSubmissionDetail } from '@/lib/guidedSpeakingAdmin'
import { getTeacherRequestContext, teacherOwnsStudent } from '@/lib/teacherRequest'

export async function GET(
    request: Request,
    { params }: { params: { studentId: string; submissionId: string } },
) {
    try {
        const { studentId, submissionId } = params
        const { searchParams } = new URL(request.url)
        const teacherId = searchParams.get('teacherId') || ''

        const context = await getTeacherRequestContext(teacherId)
        if (!context) {
            return NextResponse.json({ error: 'Only teachers can access guided speaking submissions.' }, { status: 403 })
        }

        const ownsStudent = await teacherOwnsStudent(context.classIds, studentId)
        if (!ownsStudent) {
            return NextResponse.json({ error: 'Student not in your classes.' }, { status: 403 })
        }

        const submission = await getGuidedSubmissionDetail(submissionId)
        if (!submission || submission.studentId !== studentId) {
            return NextResponse.json({ error: 'Guided submission not found.' }, { status: 404 })
        }

        return NextResponse.json({ submission })
    } catch (error: any) {
        console.error('Guided submission detail route error:', error)
        return NextResponse.json({ error: error?.message || 'Failed to load guided speaking submission.' }, { status: 500 })
    }
}

