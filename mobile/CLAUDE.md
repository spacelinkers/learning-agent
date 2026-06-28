# Mobile — Expo + React Native

## Stack
- **Expo SDK 53** — React Native, Expo Router (file-based routing)
- **Supabase JS** — auth only (JWT token → sent to FastAPI)
- **EAS Build** — cloud APK builds for local distribution
- Android primary; dark theme throughout

## Project Structure
```
mobile/
├── app.json              ← Expo config (icon, splash, scheme, plugins, EAS projectId)
├── eas.json              ← EAS Build profiles (preview = APK, production = AAB)
├── .env                  ← EXPO_PUBLIC_* vars (never commit secrets)
├── assets/
│   ├── icon.png          ← 1024×1024 launcher icon (indigo-violet gradient + neural net)
│   ├── adaptive-icon.png ← Android adaptive icon foreground
│   └── splash.png        ← splash screen (dark bg, centered icon)
├── app/
│   ├── _layout.tsx       ← root layout: AuthGuard + push notification setup
│   ├── login.tsx         ← sign-in / sign-up screen
│   ├── (tabs)/
│   │   ├── _layout.tsx   ← tab bar config (Today, Paths, Import, Log)
│   │   ├── index.tsx     ← Today screen (daily plan)
│   │   ├── paths.tsx     ← My Learning Paths list
│   │   ├── import.tsx    ← Parse + editable preview + approve
│   │   └── log.tsx       ← Quick log screen
│   └── path/
│       └── [id].tsx      ← Path detail (tracks, tasks, progress)
├── components/
│   ├── TaskCard.tsx       ← single task in daily plan (done/skip actions)
│   ├── PathCard.tsx       ← path summary card (press → detail, long-press → options)
│   ├── ProgressRing.tsx   ← circular progress indicator (SVG-based)
│   ├── MoodPicker.tsx     ← 3-emoji mood selector
│   └── WeeklyReviewCard.tsx ← weekly review summary display
├── lib/
│   ├── api.ts            ← all FastAPI calls + TypeScript types
│   ├── auth.ts           ← Supabase auth helpers (SecureStore adapter)
│   └── notifications.ts  ← Expo push setup (no-op guard in Expo Go)
├── hooks/
│   ├── useAuth.ts        ← session state + sign-in/sign-up/sign-out
│   ├── useTodayPlan.ts   ← today plan state + markDone/skipTask
│   └── usePaths.ts       ← paths list + updatePriority/updateStatus/deletePath
└── constants/
    └── colors.ts         ← design tokens
```

## Screens

### _layout.tsx (Root)
- `AuthGuard` component handles redirect: no session → `/login`, session → `/`
- Calls `setupPushNotifications()` once per session (no-op in Expo Go)
- Registers notification tap listener (navigates to Today tab)

### login.tsx
- Email + password sign-in and sign-up
- `signUp` passes `emailRedirectTo: 'learning-agent://login'` for deep-link confirmation

### (tabs)/index.tsx — Today
- Loads `useTodayPlan` → `GET /api/plan/today`
- Auto-generates plan if none exists for today (backend handles it)
- FlatList of `TaskCard` — Done / Skip buttons
- Progress bar: done/total tasks

### (tabs)/paths.tsx — My Learning Paths
- FlatList of `PathCard`
- Tap → `router.push('/path/{id}')` → detail screen
- Long-press → Alert with: Pause/Resume, Mark Complete, Delete (double-confirm)
- FAB → Import tab

### (tabs)/import.tsx — Import
- Paste raw learning plan text → `POST /api/schedule/parse`
- Editable preview: path title, track titles/days, task titles/descriptions/hours
- Add/delete tracks and tasks
- Start date picker (native `DateTimePicker` on Android)
- Priority selector (1–5)
- Approve → `POST /api/schedule/save`
- Rate limit: backend returns 429 after 5 parses/hour; shown as error message

### (tabs)/log.tsx — Quick Log
- Select task from dropdown, enter time + notes + mood
- `POST /api/log`

### path/[id].tsx — Path Detail
- `GET /api/paths/{id}` → path + tracks + tasks (nested Supabase join)
- Header: title, priority, status, completion %
- Tracks expand to show task rows; tap task to expand description
- Back button + Android hardware back → `router.replace('/(tabs)/paths')`
  (uses `BackHandler` to intercept the Android gesture/hardware back)

## API Client (lib/api.ts)

All calls go through `apiCall()` which attaches the Supabase JWT:

```typescript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL  // e.g. https://learning-agent-api.onrender.com

async function apiCall<T>(endpoint: string, method = 'GET', body?: object): Promise<T>
```

Error handling unpacks FastAPI validation errors (detail can be string or array):
```typescript
const detail = (err as any).detail
const message = !detail ? `API error ${res.status}`
  : typeof detail === 'string' ? detail
  : Array.isArray(detail) ? detail.map((d: any) => d.msg ?? JSON.stringify(d)).join(', ')
  : JSON.stringify(detail)
```

### Full endpoint list
```typescript
export const api = {
  // Plan
  getTodayPlan:    ()                             → TodayPlan
  generatePlan:    ()                             → POST /api/plan/generate
  markDone:        (id)                           → POST /api/plan/item/{id}/done
  skipTask:        (id)                           → POST /api/plan/item/{id}/skip

  // Schedule import
  parsePlan:       (text)                         → SchedulePreview
  savePlan:        (schedule, priority, startDate?) → POST /api/schedule/save

  // Paths
  getPaths:        ()                             → LearningPath[]
  getPath:         (id)                           → PathDetail (with tracks + tasks)
  updatePriority:  (id, priority)                 → PUT /api/paths/{id}/priority
  updateStatus:    (id, status)                   → PUT /api/paths/{id}/status
  deletePath:      (id)                           → DELETE /api/paths/{id}

  // Log
  logTask:         (data)                         → POST /api/log
  getWeeklySummary: ()                            → GET /api/log/weekly

  // User
  savePushToken:   (token)                        → POST /api/user/push-token

  // Weekly review
  getWeeklyReview:  ()                            → WeeklyReview | null
  triggerReview:    ()                            → POST /api/review/generate
}
```

## Auth (lib/auth.ts)
- Supabase JS client with `SecureStore` adapter (tokens stored in device keychain)
- `detectSessionInUrl: false` (React Native has no URL bar)
- `getSupabaseToken()` → returns JWT for Authorization header

## Push Notifications (lib/notifications.ts)
```typescript
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient'

export async function setupPushNotifications(): Promise<void> {
  if (IS_EXPO_GO) return   // ← Expo Go removed remote push in SDK 53; guard prevents crash
  // ... register + send token to POST /api/user/push-token
}
```

## Colors (constants/colors.ts)
```typescript
export const colors = {
  primary:  '#6366F1',   // indigo
  success:  '#22C55E',   // green  — on track
  warning:  '#F59E0B',   // yellow — slight delay
  danger:   '#EF4444',   // red    — behind
  rollover: '#8B5CF6',   // purple — rolled-over task
  bg:       '#0F172A',   // dark background
  card:     '#1E293B',   // card background
  text:     '#F1F5F9',   // primary text
  muted:    '#64748B',   // secondary text
}
```

## EAS Build (local distribution)
```json
// eas.json
{
  "build": {
    "preview":    { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  }
}
```

Build command:
```bash
eas build --profile preview --platform android --non-interactive --no-wait
```
Download the APK from the Expo dashboard link and install directly on Android.

## Environment (.env)
```
EXPO_PUBLIC_API_URL=https://learning-agent-api.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://...supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

## Rules
- Never call Groq or Supabase DB directly from mobile — all data via FastAPI
- Auth token stored in `expo-secure-store`, never in AsyncStorage
- Optimistic UI for mark-done (update state before API confirms, revert on error)
- Handle 429 rate limit errors and display the retry countdown message from the backend
- `BackHandler` must be used on any screen navigated to via `router.push` (non-tab) to
  control where Android hardware back lands
