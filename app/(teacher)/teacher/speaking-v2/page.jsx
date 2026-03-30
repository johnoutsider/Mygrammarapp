'use client'

import TeacherLayout from '@/components/TeacherLayout'
import TeacherTopicManager from '@/components/guided-speaking/TeacherTopicManager'

export default function GuidedSpeakingTopicsPage() {
    return (
        <TeacherLayout title="Guided Speaking">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <TeacherTopicManager
                    title="Guided Speaking Builder"
                    description="Choose a shared topic and build the guided-question and sample-answer content students will see during the new speaking session."
                    secondaryActionLabel="Open Shared Topic Manager"
                    secondaryActionHref="/teacher/speaking/topics"
                />
            </div>
        </TeacherLayout>
    )
}
