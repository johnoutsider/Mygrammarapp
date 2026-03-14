'use client'

import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import type { AccessMode } from '@/lib/groupService'

interface AccessModeState {
    accessMode: AccessMode
    groupId: string | null
    groupName: string | null
    loading: boolean
}

/**
 * Returns the current student's accessMode, groupId, and groupName.
 * Uses a real-time Firestore listener — so if the teacher changes
 * the student's group mid-session, the sidebar updates immediately
 * without requiring a re-login.
 */
export function useAccessMode(): AccessModeState {
    const [user] = useAuthState(auth)
    const [state, setState] = useState<AccessModeState>({
        accessMode: 'both',
        groupId: null,
        groupName: null,
        loading: true,
    })

    useEffect(() => {
        if (!user?.uid) {
            setState({ accessMode: 'both', groupId: null, groupName: null, loading: false })
            return
        }

        // Real-time listener on the user doc
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data()
                setState({
                    accessMode: (data.accessMode as AccessMode) || 'both',
                    groupId: data.groupId || null,
                    groupName: data.groupName || null,
                    loading: false,
                })
            } else {
                setState({ accessMode: 'both', groupId: null, groupName: null, loading: false })
            }
        })

        return () => unsub()
    }, [user?.uid])

    return state
}