# CLAUDE.md — Project Reference for AI Agents

This file is the authoritative reference for Claude Code agents working on this project.
Read it at the start of every session.

---

## Project Overview

**Name:** MyGrammarApp (package name: `ielts-peer-assessment`)
**Purpose:** IELTS Peer Assessment Platform — educational web app for collaborative English language learning with AI-powered feedback for students, with teacher and admin oversight.

**Roles:** `admin` | `teacher` | `student`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 3.3 |
| Database | Firebase Firestore + Realtime Database |
| Auth | Firebase Auth (Google OAuth only) |
| Storage | Firebase Storage (audio files, docs) |
| AI — Transcription | OpenAI `gpt-4o-mini-transcribe` |
| AI — Speaking Analysis | OpenAI (via `speakingPromptBuilder.ts`) |
| AI — Essay Feedback | Google Gemini |
| Charts | Recharts |
| Animations | Motion, Canvas Confetti |
| Icons | Lucide React |
| PDF | pdf-parse |
| Notifications | Telegram Bot |
| Deployment | Vercel |

---

## Directory Structure

```
app/
├── (admin)/admin/              # Admin dashboard — teacher approval, permissions, stats
├── (student)/
│   ├── (grammar)/              # Quizzes, games, question pools
│   ├── (speaking)/             # Speaking practice, recordings, logs
│   ├── (writing)/              # Essay submissions, peer review
│   ├── dashboard/              # Student home
│   ├── messages/               # Discussion threads
│   ├── profile/                # Student profile
│   └── progress/               # Analytics
├── (teacher)/teacher/
│   ├── class-management/       # Classes, groups, invite codes
│   ├── speaking/               # Speaking assignments + 3-level logs
│   └── [other teacher pages]
├── api/
│   ├── speaking/               # transcribe, analyze, batch-analyze
│   ├── teacher/                # approve-essay, reject-essay
│   ├── cron/                   # scheduler cron
│   ├── scheduler/              # task scheduling, collect-batch
│   ├── notifications/          # push notifications
│   └── telegram/               # Telegram bot webhook
├── auth/signin/
├── join/                       # Join class via invite code
├── pending-approval/           # Teacher waiting for admin approval
└── suspended/                  # Suspended user page

components/
├── TeacherLayout.tsx           # Teacher routing & nav
├── StudentLayout.tsx           # Student routing & nav
├── AdminLayout.tsx             # Admin routing & nav
├── Header.tsx
├── speaking/                   # SpeakingAnalysisCard, etc.
├── teacher/
├── student/
└── game/

lib/
├── firebase.ts                 # Client-side Firebase (Auth, Firestore, Storage, RTDB)
├── firebase-admin.ts           # Server-side Admin SDK (lazy Proxy init)
├── auth.ts                     # UserProfile type, role/permission logic
├── speakingService.ts          # Speaking CRUD, AI analysis, transcription
├── speakingPromptBuilder.ts    # Builds prompts for AI speaking analysis
├── classService.ts             # Class CRUD, invite codes (6-char alphanumeric)
├── groupService.ts             # Group management, access modes
├── adminService.ts             # Teacher approval, audit logs, platform stats
├── gemini.ts                   # Gemini AI integration
├── gameService.ts              # Grammar game logic, scoring, teams
├── peerReviewService.ts        # Peer review workflow
├── accessControl.ts            # Access control utilities
└── telegram.ts                 # Telegram bot

hooks/
├── useAccessGuard.ts
└── useAccessMode.ts
```

---

## Key Data Models

### UserProfile (`lib/auth.ts`)
```typescript
{
  uid, email, name,
  role: 'admin' | 'teacher' | 'student',
  status: 'pending' | 'approved' | 'rejected' | 'suspended',  // teachers only
  permissions: TeacherPermissions,    // teachers only
  classId, groupId, accessMode,       // students only
  classIds: string[],                 // teachers (multiple classes)
  telegramChatId?, telegramUsername?
}
```

### TeacherPermissions
`canCreateClasses`, `canDeleteStudents`, `canUseAITools`, `canHostGames`, `canManageSpeaking`

### Student `accessMode`
`'both'` | `'writing'` | `'grammar'` | `'speaking'`

---

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `users` | All user profiles with role/status |
| `essays` | Student essay submissions |
| `reviews` | Peer & AI reviews |
| `speakingAssignments` | Teacher-created speaking tasks |
| `speakingResponses` | Student audio + transcript + AI analysis |
| `classes` | Class definitions with 6-char invite codes |
| `groups` | Student groups with access modes |
| `topics` | Speaking topics |
| `messages` | Discussion threads with nested replies |
| `settings` | Platform & teacher settings |
| `auditLog` | Admin action audit trail |
| `telegram_links` | User-Telegram account links |
| `scheduledTasks` | Teacher export jobs |
| `progressReports` | Learning analytics reports |
| `ai_detection_logs` | AI detection records |

---

## Authentication Flow

1. Google OAuth popup via Firebase Auth
2. First login → auto-create Firestore `users` document
3. Check `NEXT_PUBLIC_ADMIN_EMAILS` → auto-assign admin role
4. Teachers land on `/pending-approval` until admin approves
5. Suspended/rejected → `/suspended`

---

## Environment Variables

### Public (NEXT_PUBLIC_)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_DATABASE_URL
NEXT_PUBLIC_ADMIN_EMAILS          # comma-separated admin email list
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME # Telegram bot username (default: MyDigitalTwinBot)
NEXT_PUBLIC_APP_URL               # Deployed app URL (default: https://essaypeerreviewapp.web.app)
```

### Server-only
```
OPENAI_API_KEY                    # transcription + speaking analysis
GOOGLE_GEMINI_API_KEY             # essay feedback
GROQ_API_KEY                      # legacy (previously transcription)
FIREBASE_SERVICE_ACCOUNT_JSON     # preferred: full JSON blob
FIREBASE_PROJECT_ID               # or use individual keys:
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Firebase Admin credential resolution order:
1. `FIREBASE_SERVICE_ACCOUNT_JSON`
2. Individual keys (`FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`)
3. Fallback: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

---

## Scheduled Jobs (Vercel Cron — `vercel.json`)

| Schedule | Endpoint | Purpose |
|---------|---------|---------|
| `0 8 * * *` | `/api/cron/scheduler` | Daily task scheduler |
| `0 20 * * *` | `/api/scheduler/collect-batch` | Batch collection |
| `*/15 * * * *` | `/api/speaking/batch-analyze/collect` | Speaking analysis queue |

---

## Speaking Module (Primary Active Development)

**Flow:**
1. Teacher creates assignment with topics → stored in `speakingAssignments`
2. Student records audio → uploaded to Firebase Storage
3. Audio sent to `/api/speaking/transcribe` → OpenAI `gpt-4o-mini-transcribe`
4. Transcript + audio sent to `/api/speaking/analyze` → AI scores on 5 IELTS criteria
5. Result stored in `speakingResponses`
6. Teacher views 3-level log: Overview → Student logs → Individual response analysis

**IELTS Speaking Criteria:**
- Task Response, Fluency & Coherence, Lexical Resource, Grammatical Range, Pronunciation

**Batch Analysis:**
- Queue system via `/api/speaking/batch-analyze/collect` (runs every 15 min)
- Reduces real-time API cost

---

## Important Architecture Notes

- **Firebase Admin uses Proxy pattern** for lazy initialization — don't call it at module-load time outside API routes
- **next.config.js ignores TypeScript & ESLint errors during build** — fix errors properly, don't rely on this
- **Path alias `@/*`** maps to the project root
- **Multi-class teachers:** `classIds[]` array; students have a single `classId`
- **Invite codes:** 6-character alphanumeric, generated in `classService.ts`
- Firestore rules enforce role-based access — always update `firestore.rules` when adding collections

---

## Common Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint check
```

---

## What NOT to Do

- Don't add `// @ts-ignore` or `eslint-disable` to paper over real errors — fix them
- Don't bypass Firestore rules by using admin SDK on the client side
- Don't hardcode API keys — use environment variables
- Don't skip updating `firestore.rules` when adding new collections/operations
- Don't add unnecessary abstractions — keep it simple
