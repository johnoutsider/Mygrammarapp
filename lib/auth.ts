import { auth, db } from './firebase'
import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TeacherPermissions {
    canCreateClasses: boolean
    canDeleteStudents: boolean
    canUseAITools: boolean
    canHostGames: boolean
    canManageSpeaking: boolean
    maxStudents?: number
    maxClasses?: number
}

export const DEFAULT_TEACHER_PERMISSIONS: TeacherPermissions = {
    canCreateClasses: true,
    canDeleteStudents: true,
    canUseAITools: true,
    canHostGames: true,
    canManageSpeaking: true,
}

export interface UserProfile {
    uid: string
    email: string
    name: string
    displayName?: string
    role: 'admin' | 'teacher' | 'student'
    createdAt: Date

    // ── Account status (teachers only) ──
    status?: 'pending' | 'approved' | 'suspended' | 'rejected'
    approvedBy?: string
    approvedAt?: Date
    suspendedAt?: Date
    suspendedReason?: string
    rejectedReason?: string
    lastActiveAt?: Date
    permissions?: TeacherPermissions

    // ── Student fields ──
    classId: string          // single class per student, 'default-class' until assigned
    groupId?: string         // group within the class (for access control)
    groupName?: string
    profileGroupName?: string
    accessMode?: 'both' | 'writing' | 'grammar' | 'speaking'  // derived from group

    // ── Teacher fields ──
    classIds?: string[]      // teacher can manage multiple classes

    // ── Optional integrations ──
    telegramChatId?: string
    telegramUsername?: string
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

export async function signInWithGoogle(): Promise<UserProfile | null> {
    try {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })

        const result = await signInWithPopup(auth, provider)
        const user = result.user

        const userDoc = await getDoc(doc(db, 'users', user.uid))

        if (!userDoc.exists()) {
            const email = user.email || ''
            // Check if this email is pre-approved as admin
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
            const isAdminEmail = adminEmails.includes(email.toLowerCase())

            const newProfile: UserProfile = {
                uid: user.uid,
                email,
                name: user.displayName || 'User',
                displayName: user.displayName || 'User',
                role: isAdminEmail ? 'admin' : 'student',
                status: isAdminEmail ? 'approved' : undefined,
                classId: 'default-class',
                accessMode: 'both',
                createdAt: new Date(),
            }
            await setDoc(doc(db, 'users', user.uid), newProfile)
            return newProfile
        }

        return userDoc.data() as UserProfile
    } catch (error: any) {
        console.error('Sign in error:', error)

        if (error.code === 'auth/popup-closed-by-user') {
            console.log('User closed the popup')
        } else if (error.code === 'auth/unauthorized-domain') {
            alert('ERROR: This domain is not authorized in Firebase Console')
        } else if (error.code === 'auth/configuration-not-found') {
            alert('ERROR: Google Sign-In is not properly configured in Firebase Console')
        } else if (error.code === 'auth/operation-not-allowed') {
            alert('ERROR: Google Sign-In is not enabled in Firebase Console')
        }

        return null
    }
}

/**
 * Signs in with Google and requests teacher access.
 * - New users → created with role:'teacher', status:'pending'
 * - Existing students → upgraded to role:'teacher', status:'pending'
 * - Existing teachers/admins → returned as-is
 */
export async function signInWithGoogleAsTeacher(): Promise<UserProfile | null> {
    try {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })

        const result = await signInWithPopup(auth, provider)
        const user = result.user
        const email = user.email || ''

        const userDocRef = doc(db, 'users', user.uid)
        const userDoc = await getDoc(userDocRef)

        if (!userDoc.exists()) {
            // Brand new user — create as pending teacher
            const newProfile: UserProfile = {
                uid: user.uid,
                email,
                name: user.displayName || 'Teacher',
                displayName: user.displayName || 'Teacher',
                role: 'teacher',
                status: 'pending',
                classId: 'default-class',
                classIds: [],
                createdAt: new Date(),
            }
            await setDoc(userDocRef, newProfile)
            return newProfile
        }

        const existing = userDoc.data() as UserProfile

        // Already teacher or admin — return as-is
        if (existing.role === 'teacher' || existing.role === 'admin') {
            return existing
        }

        // Existing student — request upgrade to teacher
        const updatedProfile: UserProfile = {
            ...existing,
            role: 'teacher',
            status: 'pending',
            classIds: [],
        }
        await setDoc(userDocRef, { role: 'teacher', status: 'pending', classIds: [] }, { merge: true })
        return updatedProfile
    } catch (error: any) {
        console.error('Teacher sign in error:', error)
        return null
    }
}

export async function signOut(): Promise<void> {
    try {
        await firebaseSignOut(auth)
    } catch (error) {
        console.error('Sign out error:', error)
    }
}

// ─────────────────────────────────────────────
// Profile reads
// ─────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid))
        if (userDoc.exists()) {
            return userDoc.data() as UserProfile
        }
        return null
    } catch (error) {
        console.error('Get user profile error:', error)
        return null
    }
}

// ─────────────────────────────────────────────
// Role management
// ─────────────────────────────────────────────

export async function updateUserRole(
    uid: string,
    role: 'admin' | 'teacher' | 'student',
    approvedBy?: string
): Promise<void> {
    try {
        const updates: Partial<UserProfile> = { role }

        if (role === 'teacher') {
            updates.classIds = []
            updates.status = 'approved'
            updates.permissions = DEFAULT_TEACHER_PERMISSIONS
            if (approvedBy) {
                updates.approvedBy = approvedBy
                updates.approvedAt = new Date()
            }
        } else if (role === 'admin') {
            updates.status = 'approved'
        } else if (role === 'student') {
            // Demoting — clear teacher fields
            updates.status = undefined
            updates.permissions = undefined
            updates.classIds = undefined
        }

        await setDoc(doc(db, 'users', uid), updates, { merge: true })
    } catch (error) {
        console.error('Update user role error:', error)
    }
}

// ─────────────────────────────────────────────
// Teacher class helpers
// ─────────────────────────────────────────────

/** Add a classId to a teacher's classIds array */
export async function addClassToTeacher(teacherId: string, classId: string): Promise<void> {
    await updateDoc(doc(db, 'users', teacherId), {
        classIds: arrayUnion(classId),
    })
}

/** Returns the classIds a teacher manages — safe for use in Firestore 'in' queries */
export async function getTeacherClassIds(teacherId: string): Promise<string[]> {
    const profile = await getUserProfile(teacherId)
    if (!profile || profile.role !== 'teacher') return []
    return profile.classIds || []
}

// ─────────────────────────────────────────────
// Role checks (lightweight, no extra Firestore read)
// ─────────────────────────────────────────────

export function isAdmin(profile: UserProfile | null): boolean {
    return profile?.role === 'admin'
}

export function isTeacher(profile: UserProfile | null): boolean {
    return profile?.role === 'teacher' || profile?.role === 'admin'
}

export function isStudent(profile: UserProfile | null): boolean {
    return profile?.role === 'student'
}
