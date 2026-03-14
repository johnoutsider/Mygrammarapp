import type { AccessMode } from '@/lib/groupService'

// ─────────────────────────────────────────────
// Route Maps
// ─────────────────────────────────────────────

/** Routes that require writing access */
const WRITING_ROUTES = [
    '/submit-essay',
    '/edit-essay',
    '/my-essays',
    '/feedback',
    '/review',
    '/review-peers',
    '/rubric',
    '/progress/writing',
]

/** Routes that require grammar access */
const GRAMMAR_ROUTES = [
    '/quiz-create',
    '/question-pool',
    '/my-questions',
    '/progress/grammar',
]

/** Routes always accessible regardless of accessMode */
const ALWAYS_ACCESSIBLE = [
    '/dashboard',
    '/messages',
    '/profile',
    '/play',         // live game — always open
    '/progress',     // base progress redirect
]

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Returns true if the given pathname is accessible for the given accessMode */
export function canAccess(pathname: string, accessMode: AccessMode): boolean {
    // Always-accessible routes pass immediately
    if (ALWAYS_ACCESSIBLE.some(r => pathname === r || pathname.startsWith(r + '/'))) {
        return true
    }

    // Writing routes
    if (WRITING_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
        return accessMode === 'writing' || accessMode === 'both'
    }

    // Grammar routes
    if (GRAMMAR_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
        return accessMode === 'grammar' || accessMode === 'both'
    }

    // Unknown routes — allow by default (teacher routes etc. don't pass through here)
    return true
}

/** Returns which section a route belongs to */
export function getRouteSection(pathname: string): 'writing' | 'grammar' | 'general' {
    if (WRITING_ROUTES.some(r => pathname.startsWith(r))) return 'writing'
    if (GRAMMAR_ROUTES.some(r => pathname.startsWith(r))) return 'grammar'
    return 'general'
}

/** Returns the nav groups a student should see based on their accessMode */
export function getVisibleGroups(accessMode: AccessMode): {
    showWriting: boolean
    showGrammar: boolean
} {
    return {
        showWriting: accessMode === 'writing' || accessMode === 'both',
        showGrammar: accessMode === 'grammar' || accessMode === 'both',
    }
}

/** Human-readable label for an accessMode */
export function accessModeLabel(accessMode: AccessMode): string {
    const labels: Record<AccessMode, string> = {
        both: 'Writing & Grammar',
        writing: 'Writing Only',
        grammar: 'Grammar Only',
    }
    return labels[accessMode]
}

/** Tailwind badge colour classes for an accessMode */
export function accessModeBadgeClass(accessMode: AccessMode | undefined): string {
    switch (accessMode) {
        case 'both': return 'bg-green-500/20 text-green-400 border border-green-500/30'
        case 'writing': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        case 'grammar': return 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
        default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
    }
}