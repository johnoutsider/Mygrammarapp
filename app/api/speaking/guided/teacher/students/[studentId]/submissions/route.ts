import { NextResponse } from 'next/server'
import { listGuidedSubmissionsForStudent } from '@/lib/guidedSpeakingAdmin'
import { getTeacherRequestContext, teacherOwnsStudent } from '@/lib/teacherRequest'

export async function GET(
    request: Request,
    { params }: { params: { studentId: string } },
) {
    try {
        const { studentId } = params
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

        const submissions = await listGuidedSubmissionsForStudent(studentId)
        return NextResponse.json({ submissions })
    } catch (error: any) {
        console.error('Guided submissions route error:', error)
        return NextResponse.json({ error: error?.message || 'Failed to load guided speaking submissions.' }, { status: 500 })
    }
}

