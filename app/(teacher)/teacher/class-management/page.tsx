'use client'

import { useEffect, useState } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import {
    getGroups, getAllStudents, createGroup, updateGroup,
    deleteGroup, assignStudentToGroup, unassignStudent, getGroupStudentCounts
} from '@/lib/groupService'
import type { Group, StudentProfile, AccessMode } from '@/lib/groupService'
import { accessModeBadgeClass, accessModeLabel } from '@/lib/accessControl'

// ── Types ────────────────────────────────────────────────────────────────────

type FilterAccess = 'all' | AccessMode
type FilterGroup = 'all' | 'unassigned' | string

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClassManagementPage() {
    const [groups, setGroups] = useState<Group[]>([])
    const [students, setStudents] = useState<StudentProfile[]>([])
    const [counts, setCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)

    // Filters
    const [search, setSearch] = useState('')
    const [filterGroup, setFilterGroup] = useState<FilterGroup>('all')
    const [filterAccess, setFilterAccess] = useState<FilterAccess>('all')

    // Saving state per student row
    const [savingStudent, setSavingStudent] = useState<string | null>(null)

    // Toast
    const [toast, setToast] = useState<string | null>(null)

    // Modal state
    const [showNewGroupModal, setShowNewGroupModal] = useState(false)
    const [editingGroup, setEditingGroup] = useState<Group | null>(null)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupAccess, setNewGroupAccess] = useState<AccessMode>('both')
    const [modalSaving, setModalSaving] = useState(false)

    // ── Load data ─────────────────────────────────────────────────────────────

    const loadData = async () => {
        setLoading(true)
        const [g, s, c] = await Promise.all([getGroups(), getAllStudents(), getGroupStudentCounts()])
        setGroups(g)
        setStudents(s)
        setCounts(c)
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    // ── Toast helper ──────────────────────────────────────────────────────────

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    // ── Assign student to group ───────────────────────────────────────────────

    const handleAssignGroup = async (studentId: string, studentName: string, value: string) => {
        setSavingStudent(studentId)
        try {
            if (value === '') {
                await unassignStudent(studentId)
                showToast(`${studentName} removed from group`)
            } else {
                await assignStudentToGroup(studentId, value)
                const group = groups.find(g => g.id === value)
                showToast(`${studentName} moved to ${group?.name || 'group'}`)
            }
            // Update local state immediately for snappy UI
            setStudents(prev => prev.map(s => {
                if (s.uid !== studentId) return s
                if (value === '') return { ...s, groupId: undefined, groupName: undefined, accessMode: 'both' }
                const group = groups.find(g => g.id === value)
                return { ...s, groupId: value, groupName: group?.name, accessMode: group?.accessMode || 'both' }
            }))
            // Refresh counts
            const c = await getGroupStudentCounts()
            setCounts(c)
        } catch (e) {
            showToast('Failed to update — please try again')
        }
        setSavingStudent(null)
    }

    // ── Group access edit ─────────────────────────────────────────────────────

    const handleUpdateGroupAccess = async (groupId: string, accessMode: AccessMode) => {
        try {
            await updateGroup(groupId, { accessMode })
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, accessMode } : g))
            // Reflect new access on affected students locally
            setStudents(prev => prev.map(s =>
                s.groupId === groupId ? { ...s, accessMode } : s
            ))
            showToast('Group access updated')
        } catch {
            showToast('Failed to update group')
        }
    }

    // ── Delete group ──────────────────────────────────────────────────────────

    const handleDeleteGroup = async (group: Group) => {
        if (!confirm(`Delete "${group.name}"? All students will be unassigned.`)) return
        await deleteGroup(group.id)
        setGroups(prev => prev.filter(g => g.id !== group.id))
        setStudents(prev => prev.map(s =>
            s.groupId === group.id ? { ...s, groupId: undefined, groupName: undefined, accessMode: 'both' } : s
        ))
        const c = await getGroupStudentCounts()
        setCounts(c)
        showToast(`"${group.name}" deleted`)
    }

    // ── Create / rename group modal ───────────────────────────────────────────

    const openNewGroupModal = () => {
        setEditingGroup(null)
        setNewGroupName('')
        setNewGroupAccess('both')
        setShowNewGroupModal(true)
    }

    const openEditGroupModal = (group: Group) => {
        setEditingGroup(group)
        setNewGroupName(group.name)
        setNewGroupAccess(group.accessMode)
        setShowNewGroupModal(true)
    }

    const handleSaveGroup = async () => {
        if (!newGroupName.trim()) return
        setModalSaving(true)
        try {
            if (editingGroup) {
                await updateGroup(editingGroup.id, { name: newGroupName.trim(), accessMode: newGroupAccess })
                setGroups(prev => prev.map(g =>
                    g.id === editingGroup.id ? { ...g, name: newGroupName.trim(), accessMode: newGroupAccess } : g
                ))
                showToast(`"${newGroupName.trim()}" updated`)
            } else {
                const newGroup = await createGroup(newGroupName.trim(), newGroupAccess)
                setGroups(prev => [...prev, newGroup])
                showToast(`"${newGroupName.trim()}" created`)
            }
            setShowNewGroupModal(false)
        } catch {
            showToast('Failed to save group')
        }
        setModalSaving(false)
    }

    // ── Filtered students ─────────────────────────────────────────────────────

    const filtered = students.filter(s => {
        const matchSearch = (s.displayName || s.name || s.email || '').toLowerCase().includes(search.toLowerCase())
        const matchGroup =
            filterGroup === 'all' ? true :
                filterGroup === 'unassigned' ? !s.groupId :
                    s.groupId === filterGroup
        const matchAccess = filterAccess === 'all' ? true : s.accessMode === filterAccess
        return matchSearch && matchGroup && matchAccess
    })

    const unassignedCount = students.filter(s => !s.groupId).length

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <TeacherLayout title="Class Management">
            <div className="p-6 max-w-6xl mx-auto">

                {/* Toast */}
                {toast && (
                    <div className="fixed top-5 right-5 z-50 bg-[#1a2535] text-white text-sm px-4 py-3 rounded-xl shadow-xl border border-white/10 transition-all">
                        ✓ {toast}
                    </div>
                )}

                {/* Page header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Class Management</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Assign students to groups and control their access</p>
                    </div>
                    <button
                        onClick={openNewGroupModal}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                        New Group
                    </button>
                </div>

                {/* Group cards */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                        {groups.map(group => (
                            <div key={group.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                <div className="flex items-start justify-between mb-2">
                                    <p className="font-bold text-slate-800 text-sm truncate pr-1">{group.name}</p>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => openEditGroupModal(group)}
                                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                                                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" strokeLinecap="round" />
                                                <path d="M17.586 3.586a2 2 0 112.828 2.828L12 15l-4 1 1-4 8.586-8.414z" strokeLinecap="round" />
                                            </svg>
                                        </button>
                                        <button onClick={() => handleDeleteGroup(group)}
                                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Access toggle */}
                                <div className="flex gap-1 mb-3">
                                    {(['writing', 'grammar', 'both'] as AccessMode[]).map(mode => (
                                        <button key={mode}
                                            onClick={() => handleUpdateGroupAccess(group.id, mode)}
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all capitalize
                                                ${group.accessMode === mode
                                                    ? 'bg-[#1a9aaa] text-white'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}>
                                            {mode}
                                        </button>
                                    ))}
                                </div>

                                <p className="text-xs text-slate-400">{counts[group.id] || 0} students</p>
                            </div>
                        ))}

                        {/* Unassigned info card */}
                        {unassignedCount > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <p className="font-bold text-amber-700 text-sm mb-1">⚠ Unassigned</p>
                                <p className="text-xs text-amber-600">{unassignedCount} student{unassignedCount > 1 ? 's' : ''} not in a group</p>
                                <button onClick={() => setFilterGroup('unassigned')}
                                    className="mt-2 text-xs text-amber-700 underline hover:no-underline">
                                    Show them
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Table card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
                        <div className="relative flex-1 min-w-[180px]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                            </svg>
                            <input
                                type="text" placeholder="Search students..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30"
                            />
                        </div>

                        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none bg-white focus:ring-2 focus:ring-[#1a9aaa]/30 text-slate-600">
                            <option value="all">All Groups</option>
                            <option value="unassigned">Unassigned</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>

                        <select value={filterAccess} onChange={e => setFilterAccess(e.target.value as FilterAccess)}
                            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none bg-white focus:ring-2 focus:ring-[#1a9aaa]/30 text-slate-600">
                            <option value="all">All Access</option>
                            <option value="both">Both</option>
                            <option value="writing">Writing</option>
                            <option value="grammar">Grammar</option>
                        </select>

                        <span className="text-xs text-slate-400 ml-auto">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 text-sm">Loading students...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No students match your filters</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs font-semibold text-slate-400  uppercase tracking-wider bg-slate-50">
                                        <th className="px-5 py-3">Name</th>
                                        <th className="px-5 py-3">Group</th>
                                        <th className="px-5 py-3">Access</th>
                                        <th className="px-5 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(student => {
                                        const isUnassigned = !student.groupId
                                        const isSaving = savingStudent === student.uid
                                        const name = student.displayName || student.name || student.email || 'Unknown'

                                        return (
                                            <tr key={student.uid}
                                                className={`transition-colors hover:bg-slate-50/70
                                                    ${isUnassigned ? 'bg-white' : ''}`}>

                                                {/* Name */}
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                                            style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}>
                                                            {name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-800">{name}</p>
                                                            {student.email && (
                                                                <p className="text-xs text-slate-400">{student.email}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Group dropdown */}
                                                <td className="px-5 py-3.5">
                                                    <div className="relative inline-flex items-center gap-2">
                                                        <select
                                                            value={student.groupId || ''}
                                                            onChange={e => handleAssignGroup(student.uid, name, e.target.value)}
                                                            disabled={isSaving}
                                                            className="text-sm border border-slate-200 bg-white rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30 text-slate-700 disabled:opacity-60 appearance-auto"
                                                        >
                                                            <option value="">— Unassigned</option>
                                                            {groups.map(g => (
                                                                <option key={g.id} value={g.id}>{g.name}</option>
                                                            ))}
                                                        </select>
                                                        {isSaving && (
                                                            <div className="w-4 h-4 border-2 border-[#1a9aaa] border-t-transparent rounded-full animate-spin" />
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Access badge */}
                                                <td className="px-5 py-3.5">
                                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accessModeBadgeClass(student.accessMode)}`}>
                                                        {accessModeLabel(student.accessMode)}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-3.5">
                                                    {isUnassigned ? (
                                                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                            Unassigned
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                            Assigned
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── New / Edit Group Modal ── */}
            {showNewGroupModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">
                            {editingGroup ? `Edit "${editingGroup.name}"` : 'Create New Group'}
                        </h3>

                        <div className="mb-4">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                Group Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Morning Class, Group A..."
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30"
                                autoFocus
                            />
                        </div>

                        <div className="mb-6">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                Access
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'writing', label: 'Writing', color: 'blue' },
                                    { value: 'grammar', label: 'Grammar', color: 'violet' },
                                    { value: 'both', label: 'Both', color: 'green' },
                                ] as { value: AccessMode, label: string, color: string }[]).map(opt => (
                                    <button key={opt.value}
                                        onClick={() => setNewGroupAccess(opt.value)}
                                        className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all
                                            ${newGroupAccess === opt.value
                                                ? 'border-[#1a9aaa] bg-[#1a9aaa]/10 text-[#1a9aaa]'
                                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowNewGroupModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSaveGroup}
                                disabled={!newGroupName.trim() || modalSaving}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}>
                                {modalSaving ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </TeacherLayout>
    )
}