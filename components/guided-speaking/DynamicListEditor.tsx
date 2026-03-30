'use client'

import { useCallback } from 'react'

interface DynamicListEditorProps {
    label: string
    values: string[]
    placeholder: string
    onChange: (values: string[]) => void
    helperText?: string
}

export default function DynamicListEditor({
    label,
    values,
    placeholder,
    onChange,
    helperText,
}: DynamicListEditorProps) {
    const updateValue = (index: number, value: string) => {
        const nextValues = values.slice()
        nextValues[index] = value
        onChange(nextValues)
    }

    const addItem = () => {
        onChange([...values, ''])
    }

    const removeItem = (index: number) => {
        onChange(values.filter((_, currentIndex) => currentIndex !== index))
    }

    const handleResize = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>, index: number) => {
            const el = event.target
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
            updateValue(index, el.value)
        },
        [values, onChange]
    )

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
                </div>
                <button
                    type="button"
                    onClick={addItem}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                    Add Item
                </button>
            </div>

            <div className="space-y-2">
                {values.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400">
                        No items yet.
                    </div>
                ) : null}

                {values.map((value, index) => (
                    <div key={`${label}-${index}`} className="flex items-start gap-2">
                        <textarea
                            value={value}
                            onChange={event => handleResize(event, index)}
                            rows={2}
                            placeholder={placeholder}
                            className="min-h-[84px] flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 bg-white resize-none overflow-hidden"
                            style={{ height: 'auto' }}
                        />
                        <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${label} item ${index + 1}`}
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}