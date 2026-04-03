'use client'

import { useEffect, useState } from 'react'
import AnnotatedEssay from '@/components/essay/AnnotatedEssay'
import type { ReviewAnnotationLayer } from '@/lib/essayInlineNotes'

interface InlineNoteLayerViewerProps<TReview = any> {
    content: string
    layers: ReviewAnnotationLayer<TReview>[]
    title: string
    description: string
    emptyMessage: string
}

export default function InlineNoteLayerViewer<TReview = any>({
    content,
    layers,
    title,
    description,
    emptyMessage,
}: InlineNoteLayerViewerProps<TReview>) {
    const [activeLayerId, setActiveLayerId] = useState<string | null>(layers[0]?.id ?? null)

    useEffect(() => {
        if (!layers.length) {
            setActiveLayerId(null)
            return
        }

        if (!activeLayerId || !layers.some(layer => layer.id === activeLayerId)) {
            setActiveLayerId(layers[0].id)
        }
    }, [layers, activeLayerId])

    const activeLayer = layers.find(layer => layer.id === activeLayerId) ?? layers[0] ?? null

    return (
        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
                <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>

            {layers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    {emptyMessage}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {layers.map(layer => (
                            <button
                                key={layer.id}
                                type="button"
                                onClick={() => setActiveLayerId(layer.id)}
                                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                    activeLayer?.id === layer.id
                                        ? layer.tone === 'teacher'
                                            ? 'border-teal-200 bg-teal-50 text-teal-700'
                                            : 'border-blue-200 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {layer.label}
                                <span className="ml-2 text-xs opacity-75">
                                    {layer.notes.length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {activeLayer && (
                        <AnnotatedEssay
                            content={content}
                            notes={activeLayer.notes}
                            noteLabel={activeLayer.label}
                            tone={activeLayer.tone}
                            layerKey={activeLayer.id}
                            emptyLayerMessage={`${activeLayer.label} did not leave inline notes on the essay.`}
                        />
                    )}
                </div>
            )}
        </section>
    )
}
