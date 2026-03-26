'use client'

import React, { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { getClasses, updateClass, generateInviteCode, addTeacherToClass, removeTeacherFromClass, type Class } from '@/lib/classService'
import { getGroupsByClass, createGroup, deleteGroup, type Group } from '@/lib/groupService'
import { getTeachers } from '@/lib/adminService'
import type { AccessMode } from '@/lib/groupService'
import type { UserProfile } from '@/lib/auth'
import {
    Building2, Search, ChevronDown, ChevronRight,
    Plus, Trash2, Check, Loader2, X, UserPlus,
} from 'lucide-react'

const ACCESS_MODES: { value: AccessMode; label: string; color: string }[] = [
    { value: 'both',     label: 'All Access', color: 'bg-blue-50 text-blue-700' },
    { value: 'writing',  label: 'Writing',    color: 'bg-purple-50 text-purple-700' },
    { value: 'grammar',  label: 'Grammar',    color: 'bg-green-50 text-green-700' },
    { value: 'speaking', label: 'Speaking',   color: 'bg-orange-50 text-orange-700' },
]

function accessColor(mode?: string) {
    return ACCESS_MODES.find(m => m.value === mode)?.color ?? 'bg-gray-100 text-gray-500'
}
function accessLabel(mode?: string) {
    return ACCESS_MODES.find(m => m.value === mode)?.label ?? (mode || 'All Access')
}

// ─── Expanded detail row ──────────────────────────────────────────────────────

function ClassDetail({ cls, adminUid, allTeachers, onSubjectUpdated, onTeachersUpdated }: {
    cls: Class
    adminUid: string
    allTeachers: UserProfile[]
    onSubjectUpdated: (classId: string, subject: AccessMode) => void
    onTeachersUpdated: (classId: string, teacherIds: string[]) => void
}) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loadingGroups, setLoadingGroups] = useState(true)

    const [subject, setSubject] = useState<AccessMode>(cls.subject)
    const [savingSubject, setSavingSubject] = useState(false)
    const [subjectSaved, setSubjectSaved] = useState(false)

    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupAccess, setNewGroupAccess] = useState<AccessMode>('both')
    const [creatingGroup, setCreatingGroup] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Teacher assignment
    const [teacherIds, setTeacherIds] = useState<string[]>(cls.teacherIds || [])
    const [selectedTeacherId, setSelectedTeacherId] = useState('')
    const [addingTeacher, setAddingTeacher] = useState(false)
    const [removingTeacherId, setRemovingTeacherId] = useState<string | null>(null)

    const unassignedTeachers = allTeachers.filter(t => !teacherIds.includes(t.uid))

    useEffect(() => {
        getGroupsByClass(cls.id).then(g => { setGroups(g); setLoadingGroups(false) })
    }, [cls.id])

    const handleSaveSubject = async () => {
        if (subject === cls.subject) return
        setSavingSubject(true)
        await updateClass(cls.id, { subject })
        onSubjectUpdated(cls.id, subject)
        setSavingSubject(false)
        setSubjectSaved(true)
        setTimeout(() => setSubjectSaved(false), 2000)
    }

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return
        setCreatingGroup(true)
        const g = await createGroup(newGroupName.trim(), newGroupAccess, cls.id, adminUid)
        setGroups(prev => [...prev, g])
        setNewGroupName('')
        setNewGroupAccess('both')
        setCreatingGroup(false)
    }

    const handleDeleteGroup = async (group: Group) => {
        if (!confirm(`Delete group "${group.name}"? Students will be unassigned.`)) return
        setDeletingId(group.id)
        await deleteGroup(group.id)
        setGroups(prev => prev.filter(g => g.id !== group.id))
        setDeletingId(null)
    }

    const handleAddTeacher = async () => {
        if (!selectedTeacherId) return
        setAddingTeacher(true)
        await addTeacherToClass(cls.id, selectedTeacherId)
        const updated = [...teacherIds, selectedTeacherId]
        setTeacherIds(updated)
        onTeachersUpdated(cls.id, updated)
        setSelectedTeacherId('')
        setAddingTeacher(false)
    }

    const handleRemoveTeacher = async (teacherId: string) => {
        if (!confirm('Remove this teacher from the class?')) return
        setRemovingTeacherId(teacherId)
        await removeTeacherFromClass(cls.id, teacherId)
        const updated = teacherIds.filter(id => id !== teacherId)
        setTeacherIds(updated)
        onTeachersUpdated(cls.id, updated)
        setRemovingTeacherId(null)
    }

    return (
        <tr>
            <td colSpan={4} className="p-0 border-b border-gray-100">
                <div className="bg-slate-50 border-t border-indigo-100 px-6 py-5 space-y-6">

                    {/* ── Teachers ── */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Teachers
                        </p>
                        <div className="space-y-2">
                            {teacherIds.length === 0 && (
                                <p className="text-sm text-gray-400">No teachers assigned yet.</p>
                            )}
                            {teacherIds.map(tid => {
                                const teacher = allTeachers.find(t => t.uid === tid)
                                const name = teacher?.displayName || teacher?.name || teacher?.email || tid
                                return (
                                    <div key={tid}
                                        className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-100 shadow-sm">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                                            {name[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                                            {teacher?.email && <p className="text-xs text-gray-400 truncate">{teacher.email}</p>}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveTeacher(tid)}
                                            disabled={removingTeacherId === tid}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                        >
                                            {removingTeacherId === tid
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <X className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                )
                            })}

                            {/* Add teacher row */}
                            <div className="flex items-center gap-2 mt-2">
                                <select
                                    value={selectedTeacherId}
                                    onChange={e => setSelectedTeacherId(e.target.value)}
                                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                >
                                    <option value="">
                                        {unassignedTeachers.length === 0 ? 'No more teachers available' : 'Add a teacher...'}
                                    </option>
                                    {unassignedTeachers.map(t => (
                                        <option key={t.uid} value={t.uid}>
                                            {t.displayName || t.name || t.email}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleAddTeacher}
                                    disabled={!selectedTeacherId || addingTeacher}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                                >
                                    {addingTeacher
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <UserPlus className="w-3.5 h-3.5" />}
                                    Assign
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Subject ── */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Default Subject (Access Mode)
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                            {ACCESS_MODES.map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => setSubject(m.value)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all
                                        ${subject === m.value
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                            <button
                                onClick={handleSaveSubject}
                                disabled={subject === cls.subject || savingSubject}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                            >
                                {savingSubject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {subjectSaved && <Check className="w-3.5 h-3.5" />}
                                {subjectSaved ? 'Saved!' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {/* ── Groups ── */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Groups
                        </p>

                        {loadingGroups ? (
                            <p className="text-sm text-gray-400 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading groups...
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {groups.length === 0 && (
                                    <p className="text-sm text-gray-400">No groups yet. Create one below.</p>
                                )}
                                {groups.map(g => (
                                    <div key={g.id}
                                        className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-100 shadow-sm">
                                        <span className="flex-1 text-sm font-medium text-gray-800">{g.name}</span>
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accessColor(g.accessMode)}`}>
                                            {accessLabel(g.accessMode)}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteGroup(g)}
                                            disabled={deletingId === g.id}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                        >
                                            {deletingId === g.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                ))}

                                {/* Create group inline form */}
                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <input
                                        type="text"
                                        placeholder="New group name..."
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                                        className="flex-1 min-w-[160px] text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                    />
                                    <select
                                        value={newGroupAccess}
                                        onChange={e => setNewGroupAccess(e.target.value as AccessMode)}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    >
                                        {ACCESS_MODES.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleCreateGroup}
                                        disabled={!newGroupName.trim() || creatingGroup}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                                    >
                                        {creatingGroup
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Plus className="w-3.5 h-3.5" />}
                                        Add Group
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </td>
        </tr>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminClassesPage() {
    const [user] = useAuthState(auth)
    const [classes, setClasses] = useState<Class[]>([])
    const [filtered, setFiltered] = useState<Class[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [allTeachers, setAllTeachers] = useState<UserProfile[]>([])

    // Create class modal
    const [showCreate, setShowCreate] = useState(false)
    const [newClassName, setNewClassName] = useState('')
    const [newClassSubject, setNewClassSubject] = useState<AccessMode>('both')
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        Promise.all([
            getClasses(),
            getTeachers({ status: 'approved' }),
        ]).then(([data, teachers]) => {
            const real = data.filter(c => c.id !== 'default-class')
            setClasses(real)
            setFiltered(real)
            setAllTeachers(teachers)
            setLoading(false)
        })
    }, [])

    useEffect(() => {
        if (!search.trim()) { setFiltered(classes); return }
        const q = search.toLowerCase()
        setFiltered(classes.filter(c => c.name.toLowerCase().includes(q)))
    }, [search, classes])

    const handleSubjectUpdated = (classId: string, subject: AccessMode) => {
        setClasses(prev => prev.map(c => c.id === classId ? { ...c, subject } : c))
    }

    const handleTeachersUpdated = (classId: string, teacherIds: string[]) => {
        setClasses(prev => prev.map(c => c.id === classId ? { ...c, teacherIds } : c))
    }

    const toggleExpand = (classId: string) => {
        setExpandedId(prev => prev === classId ? null : classId)
    }

    const handleCreateClass = async () => {
        if (!newClassName.trim()) return
        setCreating(true)
        const inviteCode = generateInviteCode()
        const ref = await addDoc(collection(db, 'classes'), {
            name: newClassName.trim(),
            subject: newClassSubject,
            teacherIds: [],
            inviteCode,
            inviteEnabled: true,
            createdAt: serverTimestamp(),
        })
        const newCls: Class = {
            id: ref.id,
            name: newClassName.trim(),
            subject: newClassSubject,
            teacherIds: [],
            inviteCode,
            inviteEnabled: true,
        }
        setClasses(prev => [...prev, newCls])
        setNewClassName('')
        setNewClassSubject('both')
        setShowCreate(false)
        setCreating(false)
        setExpandedId(ref.id)   // auto-expand so admin can add groups right away
    }

    return (
        <AdminLayout title="All Classes">
            <div className="p-6 max-w-5xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">All Classes</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {classes.length} classes · click a row to manage its subject and groups
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                    >
                        <Plus className="w-4 h-4" />
                        New Class
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search classes..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-10 text-center">
                            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No classes found</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="w-8 px-4 py-3" />
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Class Name</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Subject</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Teachers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(cls => {
                                    const expanded = expandedId === cls.id
                                    return (
                                        <React.Fragment key={cls.id}>
                                            <tr
                                                onClick={() => toggleExpand(cls.id)}
                                                className={`cursor-pointer transition-colors border-b border-gray-50
                                                    ${expanded ? 'bg-indigo-50/40' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-4 py-4 text-gray-400">
                                                    {expanded
                                                        ? <ChevronDown className="w-4 h-4 text-indigo-500" />
                                                        : <ChevronRight className="w-4 h-4" />}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                            style={{ backgroundColor: expanded ? '#e0e7ff' : '#eef2ff' }}>
                                                            <Building2 className={`w-4 h-4 ${expanded ? 'text-indigo-600' : 'text-indigo-500'}`} />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">{cls.name}</div>
                                                            <div className="text-xs text-gray-400">ID: {cls.id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`capitalize text-xs px-2 py-1 rounded-full font-medium ${accessColor(cls.subject)}`}>
                                                        {accessLabel(cls.subject)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-gray-500 text-xs hidden md:table-cell">
                                                    {cls.teacherIds?.length || 0} teacher{cls.teacherIds?.length !== 1 ? 's' : ''}
                                                </td>
                                            </tr>
                                            {expanded && user?.uid && (
                                                <ClassDetail
                                                    cls={cls}
                                                    adminUid={user.uid}
                                                    allTeachers={allTeachers}
                                                    onSubjectUpdated={handleSubjectUpdated}
                                                    onTeachersUpdated={handleTeachersUpdated}
                                                />
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Create Class Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-900">Create New Class</h3>
                            <button onClick={() => setShowCreate(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                Class Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Morning Class, IELTS Group A..."
                                value={newClassName}
                                onChange={e => setNewClassName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateClass()}
                                autoFocus
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Default Subject
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {ACCESS_MODES.map(m => (
                                    <button key={m.value} onClick={() => setNewClassSubject(m.value)}
                                        className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all
                                            ${newClassSubject === m.value
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowCreate(false)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleCreateClass}
                                disabled={!newClassName.trim() || creating}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                {creating ? 'Creating...' : 'Create Class'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
