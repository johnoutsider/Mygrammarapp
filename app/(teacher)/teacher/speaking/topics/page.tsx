'use client'

import TeacherLayout from '@/components/TeacherLayout'
import TeacherTopicManager from '@/components/guided-speaking/TeacherTopicManager'

export default function SpeakingTopicsPage() {
    return (
        <TeacherLayout title="Speaking Topics">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <TeacherTopicManager
                    title="Shared Speaking Topics"
                    description="Create once and reuse the same topic titles in classic speaking and the new guided speaking activity."
                    secondaryActionLabel="Open Guided Builder"
                    secondaryActionHref="/teacher/speaking-v2"
                />
            </div>
        </TeacherLayout>
    )
}
