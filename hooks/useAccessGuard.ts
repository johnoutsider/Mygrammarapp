'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAccessMode } from '@/hooks/useAccessMode'
import { canAccess } from '@/lib/accessControl'

/**
 * Drop this hook at the top of any protected student page.
 * If the student's accessMode does not permit the current route,
 * they are silently redirected to /dashboard.
 *
 * Usage:
 *   export default function SubmitEssayPage() {
 *       useAccessGuard()
 *       ...
 *   }
 */
export function useAccessGuard(): void {
    const router = useRouter()
    const pathname = usePathname()
    const { accessMode, loading } = useAccessMode()

    useEffect(() => {
        // Wait until accessMode is loaded before checking
        if (loading) return

        if (!canAccess(pathname, accessMode)) {
            router.replace('/dashboard')
        }
    }, [pathname, accessMode, loading, router])
}