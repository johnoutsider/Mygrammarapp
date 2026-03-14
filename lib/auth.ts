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

export interface UserProfile {
    uid: string
    email: string
    name: string
    displayName?: string
    role: 'admin' | 'teacher' | 'student'
    createdAt: Date

    // ── Student fields ──
    classId: string          // single class per student, 'default-class' until assigned
    groupId?: string         // group within the class (for access control)
    groupName?: string
    accessMode?: 'both' | 'writing' | 'grammar'  // derived from group

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
            // New user — student by default, placed in default-class for full access
            const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                name: user.displayName || 'Student',
                displayName: user.displayName || 'Student',
                role: 'student',
                classId: 'default-class',   // full access until teacher assigns to a real class
                accessMode: 'both',          // full access by default
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
    role: 'admin' | 'teacher' | 'student'
): Promise<void> {
    try {
        const updates: Partial<UserProfile> = { role }

        // When promoting to teacher, initialise classIds array
        if (role === 'teacher') {
            updates.classIds = ['default-class']
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
    return profile.classIds || ['default-class']
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