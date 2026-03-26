'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { type UserProfile } from '@/lib/auth'
import { Search, GraduationCap, ArrowRightLeft, Check, X } from 'lucide-react'
import { getClasses, getTeacherClasses, assignStudentToClass, type Class } from '@/lib/classService'
import { getGroupsByClass, assignStudentToGroup, type Group } from '@/lib/groupService'
import { getTeachers } from '@/lib/adminService'

const PAGE_SIZE = 20

export default function AdminStudentAssignPage() {
    // ── Data ─────────────────────────────────────────────────────────────
    const [students, setStudents] = useState<UserProfile[]>([])
    const [teachers, setTeachers] = useState<UserProfile[]>([])
    const [allClasses, setAllClasses] = useState<Class[]>([])
    const [loading, setLoading] = useState(true)

    // ── Search + pagination ───────────────────────────────────────────────
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)

    // ── Selection ────────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // ── Cascading dropdowns ───────────────────────────────────────────────
    const [selectedTeacherId, setSelectedTeacherId] = useState('')
    const [teacherClasses, setTeacherClasses] = useState<Class[]>([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [classGroups, setClassGroups] = useState<Group[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState('')

    // ── Transfer state ────────────────────────────────────────────────────
    const [transferring, setTransferring] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    // ── Initial load ──────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            const [studentsSnap, approvedTeachers, classes] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
                getTeachers({ status: 'approved' }),
                getClasses(),
            ])
            setStudents(studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)))
            setTeachers(approvedTeachers)
            setAllClasses(classes.filter(c => c.id !== 'default-class'))
            setLoading(false)
        }
        load()
    }, [])

    // ── Teacher → classes cascade ─────────────────────────────────────────
    useEffect(() => {
        setSelectedClassId('')
        setClassGroups([])
        setSelectedGroupId('')
        if (!selectedTeacherId) { setTeacherClasses([]); return }
        getTeacherClasses(selectedTeacherId).then(setTeacherClasses)
    }, [selectedTeacherId])

    // ── Class → groups cascade ────────────────────────────────────────────
    useEffect(() => {
        setSelectedGroupId('')
        if (!selectedClassId) { setClassGroups([]); return }
        getGroupsByClass(selectedClassId).then(setClassGroups)
    }, [selectedClassId])

    // ── Filter + pagination reset ─────────────────────────────────────────
    const filtered = search.trim()
        ? students.filter(s => {
            const q = search.toLowerCase()
            return (s.name || '').toLowerCase().includes(q) ||
                (s.displayName || '').toLowerCase().includes(q) ||
                (s.email || '').toLowerCase().includes(q)
        })
        : students

    useEffect(() => { setPage(0) }, [search])

    const startIdx = page * PAGE_SIZE
    const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length)
    const pageStudents = filtered.slice(startIdx, endIdx)

    // ── Selection helpers ─────────────────────────────────────────────────
    const toggleSelect = (uid: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(uid)) next.delete(uid); else next.add(uid)
            return next
        })
    }

    const allOnPageSelected = pageStudents.length > 0 && pageStudents.every(s => selectedIds.has(s.uid))
    const someOnPageSelected = pageStudents.some(s => selectedIds.has(s.uid))

    const toggleSelectAll = () => {
        const pageUids = pageStudents.map(s => s.uid)
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (allOnPageSelected) {
                pageUids.forEach(uid => next.delete(uid))
            } else {
                pageUids.forEach(uid => next.add(uid))
            }
            return next
        })
    }

    // ── Transfer ──────────────────────────────────────────────────────────
    const handleTransfer = async () => {
        if (selectedIds.size === 0 || !selectedClassId) return
        setTransferring(true)
        try {
            for (const studentId of selectedIds) {
                await assignStudentToClass(studentId, selectedClassId)
                if (selectedGroupId) {
                    await assignStudentToGroup(studentId, selectedGroupId)
                }
            }

            const targetGroup = classGroups.find(g => g.id === selectedGroupId)
            setStudents(prev => prev.map(s => {
                if (!selectedIds.has(s.uid)) return s
                const updated: UserProfile = { ...s, classId: selectedClassId }
                if (selectedGroupId && targetGroup) {
                    updated.groupId = selectedGroupId
                    updated.groupName = targetGroup.name
                    updated.accessMode = targetGroup.accessMode
                } else {
                    updated.groupId = undefined
                    updated.groupName = undefined
                }
                return updated
            }))

            const count = selectedIds.size
            setSelectedIds(new Set())
            showToast('success', `${count} student${count !== 1 ? 's' : ''} transferred successfully`)
        } catch (err: any) {
            showToast('error', err.message || 'Transfer failed — please try again')
        } finally {
            setTransferring(false)
        }
    }

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 4000)
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    const getClassName = (classId?: string) => {
        if (!classId || classId === 'default-class') return 'Unassigned'
        return allClasses.find(c => c.id === classId)?.name || 'Unknown'
    }

    const accessBadge = (mode?: string) => {
        const colors: Record<string, string> = {
            both: 'bg-blue-50 text-blue-700',
            writing: 'bg-purple-50 text-purple-700',
            grammar: 'bg-green-50 text-green-700',
            speaking: 'bg-orange-50 text-orange-700',
        }
        return colors[mode || 'both'] || colors['both']
    }

    // ─────────────────────────────────────────────────────────────────────

    return (
        <AdminLayout title="Student Assignment">
            <div className="p-6 max-w-7xl mx-auto">

                {/* Header */}
                <div className="mb-5">
                    <h1 className="text-2xl font-bold text-gray-900">Student Assignment</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Select students, then choose a teacher's class and group to transfer them
                    </p>
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
                        ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {toast.type === 'success'
                            ? <Check className="w-4 h-4 shrink-0" />
                            : <X className="w-4 h-4 shrink-0" />}
                        {toast.msg}
                    </div>
                )}

                {/* Split layout */}
                <div className="flex flex-col lg:flex-row gap-5 items-start">

                    {/* ── LEFT PANEL ── */}
                    <div className="lg:w-[60%] w-full space-y-4">

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                            />
                        </div>

                        {/* Table card */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
                            ) : filtered.length === 0 ? (
                                <div className="p-10 text-center">
                                    <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-400 text-sm">No students found</p>
                                </div>
                            ) : (
                                <>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100 bg-gray-50">
                                                <th className="px-4 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={allOnPageSelected}
                                                        ref={el => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected }}
                                                        onChange={toggleSelectAll}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Student</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Class</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Group</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Access</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {pageStudents.map(student => {
                                                const selected = selectedIds.has(student.uid)
                                                const name = student.displayName || student.name || 'Student'
                                                return (
                                                    <tr
                                                        key={student.uid}
                                                        onClick={() => toggleSelect(student.uid)}
                                                        className={`cursor-pointer transition-colors
                                                            ${selected ? 'bg-indigo-50/60' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={() => toggleSelect(student.uid)}
                                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                                                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                                                    {name[0].toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-gray-900 text-sm">{name}</div>
                                                                    <div className="text-xs text-gray-400">{student.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5 hidden md:table-cell">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                                                ${!student.classId || student.classId === 'default-class'
                                                                    ? 'bg-gray-100 text-gray-500'
                                                                    : 'bg-indigo-50 text-indigo-700'}`}>
                                                                {getClassName(student.classId)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs text-gray-500 hidden lg:table-cell">
                                                            {student.groupName || <span className="text-gray-300">—</span>}
                                                        </td>
                                                        <td className="px-4 py-3.5 hidden md:table-cell">
                                                            <span className={`capitalize text-xs px-2 py-1 rounded-full font-medium ${accessBadge(student.accessMode)}`}>
                                                                {student.accessMode || 'both'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>

                                    {/* Pagination footer */}
                                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-xs text-gray-500">
                                            {filtered.length === 0 ? '0' : `${startIdx + 1}–${endIdx}`} / {filtered.length} students
                                            {selectedIds.size > 0 && (
                                                <span className="ml-2 font-semibold text-indigo-600">
                                                    · {selectedIds.size} selected
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={page === 0}
                                                onClick={() => setPage(p => p - 1)}
                                                className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                disabled={endIdx >= filtered.length}
                                                onClick={() => setPage(p => p + 1)}
                                                className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT PANEL ── */}
                    <div className="lg:w-[40%] w-full">
                        <div className="bg-white rounded-xl shadow-sm p-6 lg:sticky lg:top-6 space-y-5">

                            <div className="flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                                <h2 className="font-semibold text-gray-900 text-lg">Transfer Students</h2>
                            </div>

                            {/* Selected count */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                                ${selectedIds.size > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-400'}`}>
                                <GraduationCap className="w-4 h-4 shrink-0" />
                                <span>
                                    <span className="font-semibold">{selectedIds.size}</span>{' '}
                                    student{selectedIds.size !== 1 ? 's' : ''} selected
                                </span>
                                {selectedIds.size > 0 && (
                                    <button
                                        onClick={() => setSelectedIds(new Set())}
                                        className="ml-auto text-indigo-400 hover:text-indigo-700 transition-colors"
                                        title="Clear selection"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Teacher dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Teacher
                                </label>
                                <select
                                    value={selectedTeacherId}
                                    onChange={e => setSelectedTeacherId(e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                >
                                    <option value="">Select teacher...</option>
                                    {teachers.map(t => (
                                        <option key={t.uid} value={t.uid}>
                                            {t.displayName || t.name || t.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Class dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Class
                                </label>
                                <select
                                    value={selectedClassId}
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    disabled={!selectedTeacherId || teacherClasses.length === 0}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">
                                        {!selectedTeacherId
                                            ? 'Select a teacher first...'
                                            : teacherClasses.length === 0
                                                ? 'No classes found'
                                                : 'Select class...'}
                                    </option>
                                    {teacherClasses.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Group dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Group <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <select
                                    value={selectedGroupId}
                                    onChange={e => setSelectedGroupId(e.target.value)}
                                    disabled={!selectedClassId}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">
                                        {!selectedClassId ? 'Select a class first...' : 'No group (class-level only)'}
                                    </option>
                                    {classGroups.map(g => (
                                        <option key={g.id} value={g.id}>
                                            {g.name} · {g.accessMode}
                                        </option>
                                    ))}
                                </select>
                                {selectedClassId && classGroups.length === 0 && (
                                    <p className="text-xs text-gray-400 mt-1">No groups in this class yet</p>
                                )}
                            </div>

                            {/* Transfer button */}
                            <button
                                onClick={handleTransfer}
                                disabled={selectedIds.size === 0 || !selectedClassId || transferring}
                                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                            >
                                {transferring
                                    ? 'Transferring...'
                                    : selectedIds.size === 0
                                        ? 'Select students to transfer'
                                        : `Transfer ${selectedIds.size} Student${selectedIds.size !== 1 ? 's' : ''}`}
                            </button>

                            {!selectedClassId && selectedIds.size > 0 && (
                                <p className="text-xs text-center text-amber-600">
                                    Select a teacher and class to enable transfer
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
