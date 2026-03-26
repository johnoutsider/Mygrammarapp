'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TeacherLayout from '@/components/TeacherLayout'
import {
    getGroupsByClass, createGroup, updateGroup,
    deleteGroup, assignStudentToGroup, unassignStudent,
    getGroupStudentCounts, getStudentsByClassIds, migrateOrphanGroups,
} from '@/lib/groupService'
import type { Group, StudentProfile, AccessMode } from '@/lib/groupService'
import {
    getTeacherClasses, regenerateInviteCode,
    toggleClassInvite, backfillInviteCode,
    assignStudentToClass, getUnassignedStudents, createClass, type Class,
} from '@/lib/classService'
import { getUserProfile } from '@/lib/auth'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { accessModeBadgeClass, accessModeLabel } from '@/lib/accessControl'
import {
    Copy, Check, Link2, RefreshCw, ChevronDown,
    UserPlus, Search, Plus, X,
} from 'lucide-react'

type FilterAccess = 'all' | AccessMode
type FilterGroup = 'all' | 'unassigned' | string

// ─────────────────────────────────────────────
// Invite Code Card
// ─────────────────────────────────────────────

function InviteCard({
    cls,
    onRegenerate,
    onToggle,
}: {
    cls: Class
    onRegenerate: (classId: string) => Promise<void>
    onToggle: (classId: string, enabled: boolean) => Promise<void>
}) {
    const [copied, setCopied] = useState<'code' | 'link' | null>(null)
    const [regenerating, setRegenerating] = useState(false)
    const [toggling, setToggling] = useState(false)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const inviteLink = `${origin}/join/${cls.inviteCode}`

    const copyText = async (text: string, type: 'code' | 'link') => {
        await navigator.clipboard.writeText(text)
        setCopied(type)
        setTimeout(() => setCopied(null), 2000)
    }

    const handleRegenerate = async () => {
        if (!confirm('Generate a new invite code? The old link will stop working.')) return
        setRegenerating(true)
        await onRegenerate(cls.id)
        setRegenerating(false)
    }

    const handleToggle = async () => {
        setToggling(true)
        await onToggle(cls.id, !cls.inviteEnabled)
        setToggling(false)
    }

    if (!cls.inviteCode) return null

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-[#1a9aaa]" />
                    <span className="text-sm font-bold text-slate-700">Invite Students</span>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={toggling}
                    className={`relative w-10 h-5 rounded-full transition-colors ${cls.inviteEnabled ? 'bg-[#1a9aaa]' : 'bg-gray-200'}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cls.inviteEnabled ? 'translate-x-5' : ''}`} />
                </button>
            </div>

            {cls.inviteEnabled ? (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm font-bold text-slate-800 tracking-widest">
                            {cls.inviteCode}
                        </div>
                        <button onClick={() => copyText(cls.inviteCode, 'code')}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800">
                            {copied === 'code' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button onClick={handleRegenerate} disabled={regenerating}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800"
                            title="Generate new code">
                            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 truncate">
                            {inviteLink}
                        </div>
                        <button onClick={() => copyText(inviteLink, 'link')}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800">
                            {copied === 'link' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-xs text-slate-400">
                        Share this link or code with your students. They sign in once to join, then use normal login.
                    </p>
                </div>
            ) : (
                <p className="text-sm text-slate-400">Invite link is paused. Toggle on to allow students to join.</p>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// Add Existing Student Modal
// ─────────────────────────────────────────────

function AddStudentModal({
    classId,
    onClose,
    onAdded,
}: {
    classId: string
    onClose: () => void
    onAdded: () => void
}) {
    const [pool, setPool] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState<string | null>(null)
    const [added, setAdded] = useState<Set<string>>(new Set())

    useEffect(() => {
        getUnassignedStudents().then(s => { setPool(s); setLoading(false) })
    }, [])

    const filtered = pool.filter(s => {
        if (added.has(s.uid)) return false
        const q = search.toLowerCase()
        return !q ||
            (s.name || '').toLowerCase().includes(q) ||
            (s.displayName || '').toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q)
    })

    const handleAdd = async (student: any) => {
        setAdding(student.uid)
        await assignStudentToClass(student.uid, classId)
        setAdded(prev => new Set([...prev, student.uid]))
        setAdding(null)
        onAdded()
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Add Existing Student</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30"
                            autoFocus
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Showing students not yet assigned to any class.</p>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                    {loading ? (
                        <div className="p-6 text-center text-slate-400 text-sm">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            {search ? 'No students match your search.' : 'No unassigned students found.'}
                        </div>
                    ) : (
                        filtered.map(student => {
                            const name = student.displayName || student.name || student.email || 'Unknown'
                            const isAdding = adding === student.uid
                            return (
                                <div key={student.uid}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}>
                                        {name[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                                        {student.email && <p className="text-xs text-slate-400 truncate">{student.email}</p>}
                                    </div>
                                    <button
                                        onClick={() => handleAdd(student)}
                                        disabled={isAdding}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                                        style={{ backgroundColor: '#1a9aaa' }}>
                                        {isAdding
                                            ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            : <Plus className="w-3 h-3" />}
                                        Add
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>
                <div className="p-4 border-t border-slate-100">
                    <button onClick={onClose}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Create Class Modal
// ─────────────────────────────────────────────

function CreateClassModal({
    teacherId,
    onClose,
    onCreated,
}: {
    teacherId: string
    onClose: () => void
    onCreated: (cls: Class) => void
}) {
    const [name, setName] = useState('')
    const [access, setAccess] = useState<AccessMode>('both')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleCreate = async () => {
        if (!name.trim()) return
        setSaving(true)
        setError('')
        try {
            const newClass = await createClass(name.trim(), access, teacherId)
            onCreated(newClass)
            onClose()
        } catch (err: any) {
            setError(err.message || 'Failed to create class')
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Create New Class</h3>
                <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Class Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Morning Class, IELTS Group A..."
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30"
                        autoFocus
                    />
                </div>
                <div className="mb-6">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Default Access Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { value: 'writing', label: 'Writing' },
                            { value: 'grammar', label: 'Grammar' },
                            { value: 'speaking', label: 'Speaking' },
                            { value: 'both', label: 'All Access' },
                        ] as { value: AccessMode, label: string }[]).map(opt => (
                            <button key={opt.value} onClick={() => setAccess(opt.value)}
                                className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all
                                    ${access === opt.value
                                        ? 'border-[#1a9aaa] bg-[#1a9aaa]/10 text-[#1a9aaa]'
                                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleCreate} disabled={!name.trim() || saving}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}>
                        {saving ? 'Creating...' : 'Create Class'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function ClassManagementPage() {
    const router = useRouter()
    const [user] = useAuthState(auth)

    // Teacher's classes
    const [classes, setClasses] = useState<Class[]>([])
    const [selectedClassId, setSelectedClassId] = useState<string>('')
    const selectedClass = classes.find(c => c.id === selectedClassId) || null

    // Groups and students for selected class
    const [groups, setGroups] = useState<Group[]>([])
    const [students, setStudents] = useState<StudentProfile[]>([])
    const [counts, setCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)

    // Filters
    const [search, setSearch] = useState('')
    const [filterGroup, setFilterGroup] = useState<FilterGroup>('all')
    const [filterAccess, setFilterAccess] = useState<FilterAccess>('all')
    const [savingStudent, setSavingStudent] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    // Modals
    const [showNewGroupModal, setShowNewGroupModal] = useState(false)
    const [editingGroup, setEditingGroup] = useState<Group | null>(null)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupAccess, setNewGroupAccess] = useState<AccessMode>('both')
    const [modalSaving, setModalSaving] = useState(false)
    const [showAddStudentModal, setShowAddStudentModal] = useState(false)
    const [showCreateClassModal, setShowCreateClassModal] = useState(false)

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    // Load teacher's classes on mount
    useEffect(() => {
        if (!user?.uid) return
        getUserProfile(user.uid).then(async profile => {
            if (!profile) { router.push('/'); return }
            const teacherClasses = await getTeacherClasses(user.uid)
            setClasses(teacherClasses)
            if (teacherClasses.length > 0) {
                // Auto-select first class
                setSelectedClassId(teacherClasses[0].id)
            } else {
                setLoading(false)
            }
        })
    }, [user, router])

    // Load groups + students when selected class changes
    const loadClassData = useCallback(async () => {
        if (!selectedClassId || !user?.uid) return
        setLoading(true)
        setFilterGroup('all')

        // Migrate orphan groups to this class (one-time, safe to re-run)
        await migrateOrphanGroups(user.uid, selectedClassId)

        const [g, s, c] = await Promise.all([
            getGroupsByClass(selectedClassId),
            getStudentsByClassIds([selectedClassId]),
            getGroupStudentCounts(selectedClassId),
        ])
        setGroups(g)
        setStudents(s)
        setCounts(c)
        setLoading(false)
    }, [selectedClassId, user?.uid])

    useEffect(() => { loadClassData() }, [loadClassData])

    // Refresh class list (for invite code updates)
    const refreshClasses = useCallback(async () => {
        if (!user?.uid) return
        const updated = await getTeacherClasses(user.uid)
        setClasses(updated)
    }, [user?.uid])

    // ── Invite handlers ──────────────────────────────────────────────────────

    const handleRegenerate = async (classId: string) => {
        await regenerateInviteCode(classId)
        await refreshClasses()
        showToast('New invite code generated')
    }

    const handleToggleInvite = async (classId: string, enabled: boolean) => {
        await toggleClassInvite(classId, enabled)
        await refreshClasses()
        showToast(enabled ? 'Invites enabled' : 'Invites paused')
    }

    // Backfill invite code for legacy classes that don't have one
    useEffect(() => {
        const backfill = async () => {
            for (const cls of classes) {
                if (!cls.inviteCode && cls.id !== 'default-class') {
                    await backfillInviteCode(cls.id)
                }
            }
            if (classes.some(c => !c.inviteCode)) {
                await refreshClasses()
            }
        }
        if (classes.length > 0) backfill()
    }, [classes.length]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Student assignment ───────────────────────────────────────────────────

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
            setStudents(prev => prev.map(s => {
                if (s.uid !== studentId) return s
                if (value === '') return { ...s, groupId: undefined, groupName: undefined, accessMode: 'both' }
                const group = groups.find(g => g.id === value)
                return { ...s, groupId: value, groupName: group?.name, accessMode: group?.accessMode || 'both' }
            }))
            const c = await getGroupStudentCounts(selectedClassId)
            setCounts(c)
        } catch {
            showToast('Failed to update — please try again')
        }
        setSavingStudent(null)
    }

    // ── Group management ────────────────────────────────────────────────────

    const handleUpdateGroupAccess = async (groupId: string, accessMode: AccessMode) => {
        try {
            await updateGroup(groupId, { accessMode })
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, accessMode } : g))
            setStudents(prev => prev.map(s => s.groupId === groupId ? { ...s, accessMode } : s))
            showToast('Group access updated')
        } catch {
            showToast('Failed to update group')
        }
    }

    const handleDeleteGroup = async (group: Group) => {
        if (!confirm(`Delete "${group.name}"? All students will be unassigned.`)) return
        await deleteGroup(group.id)
        setGroups(prev => prev.filter(g => g.id !== group.id))
        setStudents(prev => prev.map(s =>
            s.groupId === group.id ? { ...s, groupId: undefined, groupName: undefined, accessMode: 'both' } : s
        ))
        const c = await getGroupStudentCounts(selectedClassId)
        setCounts(c)
        showToast(`"${group.name}" deleted`)
    }

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
        if (!newGroupName.trim() || !selectedClassId || !user?.uid) return
        setModalSaving(true)
        try {
            if (editingGroup) {
                await updateGroup(editingGroup.id, { name: newGroupName.trim(), accessMode: newGroupAccess })
                setGroups(prev => prev.map(g =>
                    g.id === editingGroup.id ? { ...g, name: newGroupName.trim(), accessMode: newGroupAccess } : g
                ))
                showToast(`"${newGroupName.trim()}" updated`)
            } else {
                const newGroup = await createGroup(newGroupName.trim(), newGroupAccess, selectedClassId, user.uid)
                setGroups(prev => [...prev, newGroup])
                showToast(`"${newGroupName.trim()}" created`)
            }
            setShowNewGroupModal(false)
        } catch {
            showToast('Failed to save group')
        }
        setModalSaving(false)
    }

    // ── Filtered students ─────────────────────────────────────────────────

    const filtered = students.filter(s => {
        const searchHaystack = [
            s.displayName || s.name || '',
            s.email || '',
            s.groupName || '',
        ].join(' ').toLowerCase()
        const matchSearch = searchHaystack.includes(search.toLowerCase())
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
                    <div className="fixed top-5 right-5 z-50 bg-[#1a2535] text-white text-sm px-4 py-3 rounded-xl shadow-xl border border-white/10 flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" /> {toast}
                    </div>
                )}

                {/* Page header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Class Management</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Manage your classes, invite students, and control access</p>
                    </div>
                </div>

                {/* No classes state */}
                {!loading && classes.length === 0 && (
                    <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: 'linear-gradient(135deg, #1a9aaa22, #1a9aaa11)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="#1a9aaa" strokeWidth={1.8} className="w-7 h-7">
                                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <p className="text-slate-700 font-semibold mb-1">No classes yet</p>
                        <p className="text-sm text-slate-400 mb-5">Create your first class to start inviting students.</p>
                        <button
                            onClick={() => setShowCreateClassModal(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}
                        >
                            <Plus className="w-4 h-4" />
                            Create First Class
                        </button>
                    </div>
                )}

                {classes.length > 0 && (
                    <>
                        {/* Class selector */}
                        <div className="flex items-center gap-3 mb-5 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-600">Class:</span>
                                <div className="relative">
                                    <select
                                        value={selectedClassId}
                                        onChange={e => setSelectedClassId(e.target.value)}
                                        className="text-sm font-semibold border border-slate-200 rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30 bg-white text-slate-800 appearance-none cursor-pointer"
                                    >
                                        {classes.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    onClick={() => setShowCreateClassModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    New Class
                                </button>
                                <button
                                    onClick={() => setShowAddStudentModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#1a9aaa] text-[#1a9aaa] hover:bg-[#1a9aaa]/5 transition-colors"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Add Student
                                </button>
                                <button
                                    onClick={openNewGroupModal}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                                    style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}
                                >
                                    <Plus className="w-4 h-4" />
                                    New Group
                                </button>
                            </div>
                        </div>

                        {/* Invite code card */}
                        {selectedClass && (
                            <InviteCard
                                cls={selectedClass}
                                onRegenerate={handleRegenerate}
                                onToggle={handleToggleInvite}
                            />
                        )}

                        {/* Group cards */}
                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
                                {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
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
                                        <div className="flex gap-1 mb-3 flex-wrap">
                                            {(['writing', 'grammar', 'speaking', 'both'] as AccessMode[]).map(mode => (
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

                                {unassignedCount > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                        <p className="font-bold text-amber-700 text-sm mb-1">Unassigned</p>
                                        <p className="text-xs text-amber-600">{unassignedCount} student{unassignedCount > 1 ? 's' : ''} not in a group</p>
                                        <button onClick={() => setFilterGroup('unassigned')}
                                            className="mt-2 text-xs text-amber-700 underline hover:no-underline">
                                            Show them
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Student table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                                    <option value="speaking">Speaking</option>
                                </select>
                                <span className="text-xs text-slate-400 ml-auto">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Loading students...</div>
                            ) : filtered.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    {students.length === 0
                                        ? 'No students in this class yet. Share the invite link above to get started.'
                                        : 'No students match your filters'}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                                                <th className="px-5 py-3">Name</th>
                                                <th className="px-5 py-3">Group</th>
                                                <th className="px-5 py-3">Access</th>
                                                <th className="px-5 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filtered.map(student => {
                                                const isSaving = savingStudent === student.uid
                                                const name = student.displayName || student.name || student.email || 'Unknown'
                                                return (
                                                    <tr key={student.uid} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                                                    style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}>
                                                                    {name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-800">{name}</p>
                                                                    {student.email && <p className="text-xs text-slate-400">{student.email}</p>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <div className="relative inline-flex items-center gap-2">
                                                                <select
                                                                    value={student.groupId || ''}
                                                                    onChange={e => handleAssignGroup(student.uid, name, e.target.value)}
                                                                    disabled={isSaving}
                                                                    className="text-sm border border-slate-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30 text-slate-700 disabled:opacity-60"
                                                                >
                                                                    <option value="">— Unassigned</option>
                                                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                                </select>
                                                                {isSaving && <div className="w-4 h-4 border-2 border-[#1a9aaa] border-t-transparent rounded-full animate-spin" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accessModeBadgeClass(student.accessMode)}`}>
                                                                {accessModeLabel(student.accessMode)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            {!student.groupId ? (
                                                                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Unassigned
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Assigned
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
                    </>
                )}
            </div>

            {/* New / Edit Group Modal */}
            {showNewGroupModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">
                            {editingGroup ? `Edit "${editingGroup.name}"` : 'Create New Group'}
                        </h3>
                        <div className="mb-4">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Group Name</label>
                            <input
                                type="text" placeholder="e.g. Morning Class, Group A..."
                                value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a9aaa]/30"
                                autoFocus
                            />
                        </div>
                        <div className="mb-6">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Access</label>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { value: 'writing', label: 'Writing' },
                                    { value: 'grammar', label: 'Grammar' },
                                    { value: 'speaking', label: 'Speaking' },
                                    { value: 'both', label: 'Both' },
                                ] as { value: AccessMode, label: string }[]).map(opt => (
                                    <button key={opt.value} onClick={() => setNewGroupAccess(opt.value)}
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
                            <button onClick={handleSaveGroup} disabled={!newGroupName.trim() || modalSaving}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #1a9aaa, #127080)' }}>
                                {modalSaving ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Existing Student Modal */}
            {showAddStudentModal && selectedClassId && (
                <AddStudentModal
                    classId={selectedClassId}
                    onClose={() => setShowAddStudentModal(false)}
                    onAdded={loadClassData}
                />
            )}

            {/* Create Class Modal */}
            {showCreateClassModal && user?.uid && (
                <CreateClassModal
                    teacherId={user.uid}
                    onClose={() => setShowCreateClassModal(false)}
                    onCreated={newCls => {
                        setClasses(prev => [...prev, newCls])
                        setSelectedClassId(newCls.id)
                        showToast(`"${newCls.name}" created!`)
                    }}
                />
            )}
        </TeacherLayout>
    )
}
