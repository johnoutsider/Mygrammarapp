'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { getPlatformSettings, updatePlatformSettings, type PlatformSettings } from '@/lib/adminService'
import { DEFAULT_TEACHER_PERMISSIONS, type TeacherPermissions, getUserProfile, type UserProfile } from '@/lib/auth'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { Save, CheckCircle, Plus, X } from 'lucide-react'

const PERMISSION_LABELS: { key: keyof TeacherPermissions; label: string }[] = [
    { key: 'canCreateClasses', label: 'Create Classes' },
    { key: 'canDeleteStudents', label: 'Delete Students' },
    { key: 'canUseAITools', label: 'AI Tools' },
    { key: 'canHostGames', label: 'Host Games' },
    { key: 'canManageSpeaking', label: 'Speaking Module' },
]

export default function PlatformSettingsPage() {
    const [user] = useAuthState(auth)
    const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null)
    const [settings, setSettings] = useState<PlatformSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [newAdminEmail, setNewAdminEmail] = useState('')

    useEffect(() => {
        if (user?.uid) getUserProfile(user.uid).then(setAdminProfile)
    }, [user])

    useEffect(() => {
        getPlatformSettings().then(s => {
            setSettings(s)
            setLoading(false)
        })
    }, [])

    const handleSave = async () => {
        if (!settings || !adminProfile) return
        setSaving(true)
        await updatePlatformSettings(settings, adminProfile.uid, adminProfile.displayName || adminProfile.name)
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const toggleDefaultPerm = (key: keyof TeacherPermissions) => {
        if (!settings || typeof settings.defaultPermissions[key] !== 'boolean') return
        setSettings(s => s ? {
            ...s,
            defaultPermissions: { ...s.defaultPermissions, [key]: !s.defaultPermissions[key] }
        } : s)
    }

    const addAdminEmail = () => {
        const email = newAdminEmail.trim().toLowerCase()
        if (!email || !settings) return
        if (settings.adminEmails.includes(email)) { setNewAdminEmail(''); return }
        setSettings(s => s ? { ...s, adminEmails: [...s.adminEmails, email] } : s)
        setNewAdminEmail('')
    }

    const removeAdminEmail = (email: string) => {
        setSettings(s => s ? { ...s, adminEmails: s.adminEmails.filter(e => e !== email) } : s)
    }

    if (loading || !settings) {
        return (
            <AdminLayout title="Platform Settings">
                <div className="p-6 flex justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full" />
                </div>
            </AdminLayout>
        )
    }

    return (
        <AdminLayout title="Platform Settings">
            <div className="p-6 max-w-2xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Configure global platform behaviour</p>
                    </div>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm">
                        {saved
                            ? <><CheckCircle className="w-4 h-4" /> Saved</>
                            : saving
                                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                : <><Save className="w-4 h-4" /> Save Changes</>
                        }
                    </button>
                </div>

                {/* Registration */}
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Registration</h2>

                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                        <div>
                            <p className="text-sm font-medium text-gray-800">Require Approval for New Teachers</p>
                            <p className="text-xs text-gray-400 mt-0.5">New teacher sign-ups need admin approval before accessing the platform</p>
                        </div>
                        <button onClick={() => setSettings(s => s ? { ...s, requireApproval: !s.requireApproval } : s)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${settings.requireApproval ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.requireApproval ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-800 mb-0.5">Platform Name</p>
                        <p className="text-xs text-gray-400 mb-2">Shown in the app header and emails</p>
                        <input type="text" value={settings.platformName}
                            onChange={e => setSettings(s => s ? { ...s, platformName: e.target.value } : s)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                </div>

                {/* Admin emails */}
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Admin Emails</h2>
                    <p className="text-xs text-gray-500">Users signing in with these emails are automatically granted admin role.</p>

                    <div className="flex gap-2">
                        <input type="email" value={newAdminEmail}
                            onChange={e => setNewAdminEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addAdminEmail()}
                            placeholder="admin@example.com"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        <button onClick={addAdminEmail}
                            className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {settings.adminEmails.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No admin emails configured</p>
                    ) : (
                        <div className="space-y-2">
                            {settings.adminEmails.map(email => (
                                <div key={email} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-700">{email}</span>
                                    <button onClick={() => removeAdminEmail(email)}
                                        className="text-gray-400 hover:text-red-500 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Default permissions */}
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Default Teacher Permissions</h2>
                    <p className="text-xs text-gray-500">These permissions are applied to all newly approved teachers.</p>
                    <div className="space-y-3">
                        {PERMISSION_LABELS.map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                                <p className="text-sm font-medium text-gray-800">{label}</p>
                                <button onClick={() => toggleDefaultPerm(key)}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${settings.defaultPermissions[key] ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.defaultPermissions[key] ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
