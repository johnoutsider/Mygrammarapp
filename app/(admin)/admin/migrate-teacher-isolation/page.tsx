'use client'

import { useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { auth, db } from '@/lib/firebase'
import {
    collection, doc, getDoc, getDocs, setDoc,
    updateDoc, query, where, writeBatch,
} from 'firebase/firestore'

interface LogEntry {
    time: string
    message: string
    type: 'info' | 'success' | 'error' | 'warn'
}

export default function MigrateTeacherIsolationPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [running, setRunning] = useState(false)
    const [targetTeacherId, setTargetTeacherId] = useState('')
    const [teachers, setTeachers] = useState<{ uid: string; name: string; email: string; classIds: string[] }[]>([])
    const [loaded, setLoaded] = useState(false)

    const log = (message: string, type: LogEntry['type'] = 'info') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }])
    }

    const loadTeachers = async () => {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')))
        const list = snap.docs.map(d => {
            const data = d.data() as any
            return {
                uid: d.id,
                name: data.displayName || data.name || 'Unknown',
                email: data.email || '',
                classIds: data.classIds || [],
            }
        })
        setTeachers(list)
        setLoaded(true)
        if (list.length > 0 && !targetTeacherId) {
            setTargetTeacherId(list[0].uid)
        }
    }

    const runMigration = async () => {
        if (!targetTeacherId) { alert('Select a teacher first'); return }
        if (!confirm('Run migration? This will assign existing topics and speaking data to the selected teacher.')) return
        setRunning(true)
        setLogs([])

        try {
            // ── 1. Set teacherId on all topics that don't have one ──
            log('Checking topics without teacherId...')
            const topicsSnap = await getDocs(collection(db, 'topics'))
            let topicCount = 0
            for (const d of topicsSnap.docs) {
                if (!d.data().teacherId) {
                    await updateDoc(doc(db, 'topics', d.id), { teacherId: targetTeacherId })
                    topicCount++
                }
            }
            if (topicCount > 0) {
                log(`Assigned ${topicCount} topics to teacher ${targetTeacherId}`, 'success')
            } else {
                log('All topics already have teacherId', 'info')
            }

            // ── 2. Copy global speaking assignments to per-teacher doc ──
            log('Checking global speaking assignments...')
            const globalAssignDoc = await getDoc(doc(db, 'settings', 'speakingAssignments'))
            if (globalAssignDoc.exists()) {
                const data = globalAssignDoc.data()
                // Copy to each teacher
                for (const t of teachers) {
                    const perTeacherRef = doc(db, 'settings', `speakingAssignments_${t.uid}`)
                    const existing = await getDoc(perTeacherRef)
                    if (!existing.exists()) {
                        await setDoc(perTeacherRef, data)
                        log(`Copied speaking assignments to teacher: ${t.name} (${t.uid})`, 'success')
                    } else {
                        log(`Teacher ${t.name} already has per-teacher speaking assignments`, 'info')
                    }
                }
            } else {
                log('No global speaking assignments found', 'info')
            }

            // ── 3. Copy global speaking topics to per-teacher doc ──
            log('Checking global speaking topics...')
            const globalTopicsDoc = await getDoc(doc(db, 'settings', 'speakingTopics'))
            if (globalTopicsDoc.exists()) {
                const data = globalTopicsDoc.data()
                for (const t of teachers) {
                    const perTeacherRef = doc(db, 'settings', `speakingTopics_${t.uid}`)
                    const existing = await getDoc(perTeacherRef)
                    if (!existing.exists()) {
                        await setDoc(perTeacherRef, data)
                        log(`Copied speaking topics to teacher: ${t.name} (${t.uid})`, 'success')
                    } else {
                        log(`Teacher ${t.name} already has per-teacher speaking topics`, 'info')
                    }
                }
            } else {
                log('No global speaking topics found', 'info')
            }

            // ── 4. Set teacherId on scheduled tasks that don't have one ──
            log('Checking scheduled tasks without teacherId...')
            const tasksSnap = await getDocs(collection(db, 'scheduledTasks'))
            let taskCount = 0
            for (const d of tasksSnap.docs) {
                const data = d.data()
                if (!data.teacherId) {
                    const createdBy = data.createdBy || targetTeacherId
                    await updateDoc(doc(db, 'scheduledTasks', d.id), { teacherId: createdBy })
                    taskCount++
                }
            }
            if (taskCount > 0) {
                log(`Set teacherId on ${taskCount} scheduled tasks`, 'success')
            } else {
                log('All scheduled tasks already have teacherId', 'info')
            }

            // ── 5. Clean 'default-class' from teacher classIds ──
            log('Cleaning default-class from teacher classIds...')
            let cleanedCount = 0
            for (const t of teachers) {
                if (t.classIds.includes('default-class')) {
                    const cleaned = t.classIds.filter(id => id !== 'default-class')
                    await updateDoc(doc(db, 'users', t.uid), { classIds: cleaned })
                    cleanedCount++
                    log(`Removed default-class from ${t.name} (${t.email})`, 'success')
                }
            }
            if (cleanedCount === 0) {
                log('No teachers had default-class in classIds', 'info')
            }

            log('Migration complete!', 'success')
        } catch (err: any) {
            log(`Error: ${err.message}`, 'error')
            console.error(err)
        } finally {
            setRunning(false)
        }
    }

    const typeColor: Record<string, string> = {
        info: 'text-slate-500',
        success: 'text-green-600',
        error: 'text-red-600',
        warn: 'text-amber-600',
    }

    return (
        <AdminLayout>
            <div className="max-w-3xl mx-auto p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Teacher Isolation Migration</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        One-time migration to assign existing data to teachers. This will:
                    </p>
                    <ul className="text-sm text-slate-500 mt-2 list-disc pl-5 space-y-1">
                        <li>Set <code className="bg-slate-100 px-1 rounded">teacherId</code> on all topics without one</li>
                        <li>Copy global speaking assignments/topics to per-teacher docs</li>
                        <li>Set <code className="bg-slate-100 px-1 rounded">teacherId</code> on scheduled tasks</li>
                        <li>Remove <code className="bg-slate-100 px-1 rounded">default-class</code> from teacher classIds</li>
                    </ul>
                </div>

                {!loaded ? (
                    <button
                        onClick={loadTeachers}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
                    >
                        Load Teachers
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                            <h2 className="text-sm font-semibold text-slate-700 mb-3">Teachers in system ({teachers.length})</h2>
                            <div className="space-y-2 mb-4">
                                {teachers.map(t => (
                                    <div key={t.uid} className="flex items-center gap-2 text-sm">
                                        <span className="font-medium text-slate-700">{t.name}</span>
                                        <span className="text-slate-400">{t.email}</span>
                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                                            {t.classIds.length} classes
                                            {t.classIds.includes('default-class') && (
                                                <span className="text-amber-600 ml-1">(has default-class!)</span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <label className="block text-sm font-medium text-slate-600 mb-1">
                                Assign orphan topics to:
                            </label>
                            <select
                                value={targetTeacherId}
                                onChange={e => setTargetTeacherId(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
                            >
                                {teachers.map(t => (
                                    <option key={t.uid} value={t.uid}>{t.name} ({t.email})</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={runMigration}
                            disabled={running}
                            className="px-5 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors"
                        >
                            {running ? 'Running...' : 'Run Migration'}
                        </button>
                    </div>
                )}

                {logs.length > 0 && (
                    <div className="bg-slate-900 rounded-xl p-4 overflow-auto max-h-96">
                        <div className="space-y-1 font-mono text-xs">
                            {logs.map((entry, i) => (
                                <div key={i} className={typeColor[entry.type]}>
                                    <span className="text-slate-600">[{entry.time}]</span> {entry.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
