'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { type UserProfile } from '@/lib/auth'
import { Search, GraduationCap } from 'lucide-react'
import { getClasses, assignStudentToClass, type Class } from '@/lib/classService'

export default function AdminStudentsPage() {
    const [students, setStudents] = useState<UserProfile[]>([])
    const [filtered, setFiltered] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [classes, setClasses] = useState<Class[]>([])
    const [assigning, setAssigning] = useState<Record<string, boolean>>({})
    const [assignError, setAssignError] = useState<Record<string, string>>({})

    useEffect(() => {
        const load = async () => {
            const [studentsSnap, allClasses] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
                getClasses(),
            ])
            const data = studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
            setStudents(data)
            setFiltered(data)
            // Exclude default-class from the assignment dropdown (it's the unassigned pool)
            setClasses(allClasses.filter(c => c.id !== 'default-class'))
            setLoading(false)
        }
        load()
    }, [])

    useEffect(() => {
        if (!search.trim()) { setFiltered(students); return }
        const q = search.toLowerCase()
        setFiltered(students.filter(s =>
            s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        ))
    }, [search, students])

    const handleAssign = async (studentId: string, classId: string) => {
        if (!classId) return
        setAssigning(prev => ({ ...prev, [studentId]: true }))
        setAssignError(prev => ({ ...prev, [studentId]: '' }))
        try {
            await assignStudentToClass(studentId, classId)
            // Update local state so class column refreshes immediately
            setStudents(prev => prev.map(s =>
                s.uid === studentId ? { ...s, classId } as UserProfile : s
            ))
        } catch (err: any) {
            setAssignError(prev => ({ ...prev, [studentId]: err.message || 'Failed' }))
        } finally {
            setAssigning(prev => ({ ...prev, [studentId]: false }))
        }
    }

    const getClassName = (classId?: string) => {
        if (!classId || classId === 'default-class') return 'Unassigned'
        return classes.find(c => c.id === classId)?.name || classId
    }

    return (
        <AdminLayout title="Students">
            <div className="p-6 max-w-6xl mx-auto space-y-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">All Students</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{students.length} students across the platform</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search by name or email..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-10 text-center">
                            <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No students found</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Student</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Current Class</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Assign to Class</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Access</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(student => (
                                    <tr key={student.uid} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                                    {(student.displayName || student.name || 'S')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{student.displayName || student.name}</div>
                                                    <div className="text-xs text-gray-400">{student.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-gray-500 text-xs hidden md:table-cell">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                !student.classId || student.classId === 'default-class'
                                                    ? 'bg-gray-100 text-gray-500'
                                                    : 'bg-indigo-50 text-indigo-700'
                                            }`}>
                                                {getClassName(student.classId)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 hidden lg:table-cell">
                                            <div className="flex items-center gap-2">
                                                <select
                                                    defaultValue=""
                                                    onChange={e => {
                                                        if (e.target.value) handleAssign(student.uid, e.target.value)
                                                    }}
                                                    disabled={assigning[student.uid]}
                                                    className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 max-w-[200px]"
                                                >
                                                    <option value="">Move to class…</option>
                                                    <option value="default-class">Unassigned (pool)</option>
                                                    {classes.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                                {assigning[student.uid] && (
                                                    <div className="w-3 h-3 border-b border-indigo-500 rounded-full animate-spin" />
                                                )}
                                                {assignError[student.uid] && (
                                                    <span className="text-xs text-red-500">{assignError[student.uid]}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 hidden md:table-cell">
                                            <span className="capitalize text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                                                {student.accessMode || 'both'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-gray-400 text-xs hidden md:table-cell">
                                            {student.createdAt ? new Date(student.createdAt as any).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
