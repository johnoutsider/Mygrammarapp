import { NextRequest, NextResponse } from 'next/server'
import { assessEssay } from '@/lib/openai'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { essayTitle, essayContent } = body

        if (!essayTitle || !essayContent) {
            return NextResponse.json(
                { error: 'Missing essay title or content' },
                { status: 400 }
            )
        }

        const assessment = await assessEssay(essayTitle, essayContent)

        return NextResponse.json({
            success: true,
            assessment,
        })
    } catch (error: any) {
        console.error('Assess essay error:', error?.message)
        return NextResponse.json(
            { error: 'Failed to assess essay. Please try again.' },
            { status: 500 }
        )
    }
}
