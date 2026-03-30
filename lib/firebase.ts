import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
} from 'firebase/firestore'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'


const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123:web:abc',
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

// Check if Firebase is properly configured
export const isFirebaseConfigured = () => {
    return process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'AIzaSyDEMO_KEY_REPLACE_ME'
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)

// Use the modern persistent cache API (replaces deprecated enableIndexedDbPersistence).
// persistentMultipleTabManager allows multiple tabs without "failed-precondition" errors.
const db = typeof window !== 'undefined'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
        }),
    })
    : getFirestore(app)

export const rtdb = getDatabase(app)   // ← ADD this line
export const storage = getStorage(app)
export { app, auth, db }