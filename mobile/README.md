# Mobile — Expo + React Native

Android-first mobile app built with Expo SDK 56, Expo Router (file-based navigation), and TypeScript. Dark theme throughout. All data goes through the FastAPI backend — Supabase and Groq are never called directly from the app.

---

## Running Locally

### Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) installed on your Android phone
- Backend running locally or deployed on Render
- Phone and laptop on the **same WiFi network**

### Steps

```bash
cd mobile
npm install --legacy-peer-deps
cp .env.example .env
```

Fill in `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8001    # your laptop's local IP + backend port
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Find your laptop's local IP:
```bash
# Linux / Mac
ip addr show | grep "inet " | grep -v 127
# or
hostname -I
```

Start Metro bundler:
```bash
npx expo start --clear
```

Scan the QR code with Expo Go. The app loads over WiFi.

> **Note:** `--clear` is required after any change to `.env`, `babel.config.js`, or `metro.config.js` to bust the Metro cache.

### Port reference

| Port | What runs there |
|---|---|
| `8081` | Metro bundler (Expo's JS compiler — your laptop) |
| `8001` | FastAPI backend (your laptop, local dev) |
| — | Supabase (cloud, no local port) |

---

## Environment Variables

All mobile env vars must be prefixed with `EXPO_PUBLIC_` to be bundled into the app at build time.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | FastAPI base URL (no trailing slash) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (not service key) |

These are baked into the JS bundle at build time — changing them requires a rebuild or `npx expo start --clear` in dev.

---

## Deploying (Production Build)

Expo Go is for development only. For production (or to enable push notifications), you need a native build.

### Option A — EAS Build (recommended)

[EAS Build](https://docs.expo.dev/build/introduction/) is Expo's cloud build service.

```bash
npm install -g eas-cli
eas login                    # log in with your Expo account
eas build:configure          # creates eas.json
```

Before building, set production env vars in EAS:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://learning-agent-api.onrender.com
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_...
```

Build the Android APK:
```bash
eas build --platform android --profile preview
```

This produces a `.apk` you can install directly on any Android device, or an `.aab` for Google Play.

### Option B — Local build (requires Android Studio)

```bash
npx expo run:android
```

This compiles and installs directly to a connected device or emulator. Also enables push notifications during development.

### After deploying backend to Render

Update `EXPO_PUBLIC_API_URL` from the local IP to the Render URL:

```
EXPO_PUBLIC_API_URL=https://learning-agent-api.onrender.com
```

Then rebuild or restart with `--clear`.

---

## Project Structure

```
mobile/
├── app.json                    Expo config — scheme, plugins, package name
├── package.json                "main": "expo-router/entry" — required for file routing
├── tsconfig.json               Path alias @/ → project root
├── babel.config.js             babel-preset-expo + reanimated plugin (must be last)
├── metro.config.js             getDefaultConfig(__dirname) — required for Expo Router
├── .env                        Runtime env vars (never committed)
│
├── app/                        Expo Router file-based routing
│   ├── _layout.tsx             Root layout: auth guard + push notification setup
│   ├── login.tsx               Sign-in / sign-up screen
│   ├── path/
│   │   └── [id].tsx            Dynamic path detail screen
│   └── (tabs)/
│       ├── _layout.tsx         Tab bar configuration
│       ├── index.tsx           Today screen
│       ├── paths.tsx           My Learning Paths screen
│       ├── import.tsx          Import from Chat screen
│       └── log.tsx             Quick Log screen
│
├── components/
│   ├── TaskCard.tsx            Task row with badges, Done/Skip buttons
│   ├── PathCard.tsx            Path summary with ProgressRing and pace
│   ├── ProgressRing.tsx        SVG circular progress indicator
│   ├── MoodPicker.tsx          😊 😐 😴 mood selector
│   └── WeeklyReviewCard.tsx    Weekly AI review with Apply buttons
│
├── hooks/
│   ├── useAuth.ts              Session state from Supabase
│   ├── useTodayPlan.ts         Today's plan with optimistic updates
│   └── usePaths.ts             Paths list with update actions
│
├── lib/
│   ├── api.ts                  All TypeScript types + FastAPI call wrappers
│   ├── auth.ts                 Supabase client (SecureStore adapter)
│   └── notifications.ts        Push setup with Expo Go guard
│
└── constants/
    └── colors.ts               Dark theme colour palette
```

---

## Code Implementation Reference

### Routing — Expo Router

File path maps directly to URL:

| File | Route | Notes |
|---|---|---|
| `app/_layout.tsx` | `/` (root) | Wraps everything — auth guard lives here |
| `app/login.tsx` | `/login` | Outside tabs — shown when unauthenticated |
| `app/(tabs)/index.tsx` | `/` (tab) | Today screen |
| `app/(tabs)/paths.tsx` | `/paths` | Paths list |
| `app/(tabs)/import.tsx` | `/import` | Import screen |
| `app/(tabs)/log.tsx` | `/log` | Log screen |
| `app/path/[id].tsx` | `/path/:id` | Dynamic path detail |

The `(tabs)` folder name is a **route group** — it creates the tab bar without adding `tabs` to the URL. `[id]` is a dynamic segment, accessed via `useLocalSearchParams<{ id: string }>()`.

---

### Auth Guard — `app/_layout.tsx`

```typescript
function AuthGuard() {
  const { session, loading } = useAuth()
  const router   = useRouter()
  const segments = useSegments()

  // Redirect unauthenticated users to /login, authenticated away from it
  useEffect(() => {
    if (loading) return
    const onLoginScreen = segments[0] === 'login'
    if (!session && !onLoginScreen) router.replace('/login')
    if ( session &&  onLoginScreen) router.replace('/')
  }, [session, loading])

  // Register push token once per session (no-op in Expo Go)
  useEffect(() => {
    if (session && !pushRegistered.current) {
      pushRegistered.current = true
      setupPushNotifications()
    }
    if (!session) pushRegistered.current = false
  }, [session])

  return <Slot />   // renders the matched child route
}
```

`useSegments()` returns the current URL path as an array — e.g. `['login']` or `['(tabs)', 'index']`. The guard redirects without knowing the specific route, only whether the user is on the login screen or not.

`useRef(false)` for `pushRegistered` prevents calling `setupPushNotifications()` on every re-render — it fires once after login and resets on logout.

---

### Supabase Auth — `lib/auth.ts`

```typescript
const SecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, val: string) => SecureStore.setItemAsync(key, val),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,   // persists JWT in device's secure enclave
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,     // required for React Native (no window.location)
  },
})
```

`expo-secure-store` stores the session token in the Android Keystore (encrypted hardware-backed storage). `detectSessionInUrl: false` disables Supabase's web-only URL parsing behaviour.

Sign-up passes `emailRedirectTo` so the confirmation email deep-links back into the app:
```typescript
export const signUp = (email: string, pw: string) =>
  supabase.auth.signUp({
    email, password: pw,
    options: { emailRedirectTo: 'learning-agent://login' },
  })
```

---

### Session Hook — `hooks/useAuth.ts`

```typescript
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load persisted session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Subscribe to future auth events (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading }
}
```

Two-step initialisation: load the cached session immediately, then stay subscribed to changes. The `loading` flag prevents the auth guard from redirecting before the cached session is resolved.

---

### API Client — `lib/api.ts`

Single `apiCall` function used by all endpoints:

```typescript
async function apiCall<T = unknown>(endpoint: string, method = 'GET', body?: object): Promise<T> {
  const token = await getSupabaseToken()      // reads from SecureStore
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,       // Supabase JWT — verified by backend
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail ?? `API error ${res.status}`)
  }
  return res.json() as T
}
```

`BASE_URL` comes from `process.env.EXPO_PUBLIC_API_URL` — no trailing slash. All endpoint paths start with `/api/...`.

Key typed endpoints:
```typescript
export const api = {
  getTodayPlan:   ()                              => apiCall<TodayPlan>('/api/plan/today'),
  markDone:       (id: string)                    => apiCall(`/api/plan/item/${id}/done`, 'POST'),
  skipTask:       (id: string)                    => apiCall(`/api/plan/item/${id}/skip`, 'POST'),
  parsePlan:      (text: string)                  => apiCall<SchedulePreview>('/api/schedule/parse', 'POST', { raw_text: text }),
  savePlan:       (s: SchedulePreview, p: number) => apiCall('/api/schedule/save', 'POST', { approved_schedule: s, priority: p }),
  getPaths:       ()                              => apiCall<LearningPath[]>('/api/paths'),
  getPath:        (id: string)                    => apiCall<PathDetail>(`/api/paths/${id}`),
  updatePriority: (id: string, priority: number)  => apiCall(`/api/paths/${id}/priority`, 'PUT', { priority }),
  updateStatus:   (id: string, status: string)    => apiCall(`/api/paths/${id}/status`, 'PUT', { status }),
  logTask:        (data: LogData)                 => apiCall('/api/log', 'POST', data),
  getWeeklyReview: ()                             => apiCall<WeeklyReview | null>('/api/review/weekly'),
}
```

---

### Optimistic Updates — `hooks/useTodayPlan.ts`

Done and skip update local state instantly before the API call resolves. If the API fails, `refresh()` reverts to server truth:

```typescript
const markDone = useCallback(async (itemId: string) => {
  // 1 — update UI immediately
  setPlan(prev => prev && {
    ...prev,
    items: prev.items.map(i => i.item_id === itemId ? { ...i, status: 'done' } : i),
  })
  try {
    await api.markDone(itemId)       // 2 — confirm with backend
  } catch {
    refresh()                        // 3 — revert on failure
  }
}, [refresh])
```

This makes the app feel instant on good connections and degrades gracefully on slow ones.

---

### Push Notifications — `lib/notifications.ts`

Push notifications were removed from Expo Go in SDK 53. All notification code uses dynamic imports guarded by an Expo Go check:

```typescript
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient'

export async function setupPushNotifications(): Promise<void> {
  if (IS_EXPO_GO) return    // silent no-op in Expo Go

  const Notifications = await import('expo-notifications')   // dynamic import
  // ... request permission, get token, POST to /api/user/push-token
}

export function registerNotificationTapListener(onTap: () => void): () => void {
  if (IS_EXPO_GO) return () => {}

  let sub: { remove(): void } | null = null
  import('expo-notifications').then(Notifications => {
    sub = Notifications.addNotificationResponseReceivedListener(onTap)
  })
  return () => sub?.remove()
}
```

Static imports of `expo-notifications` crash in Expo Go even if never called — dynamic imports load the module lazily after the guard check passes.

Push notifications work fully in development builds (`npx expo run:android`) and production builds.

---

### TaskCard — `components/TaskCard.tsx`

Renders one item from the daily plan. Three visual states:

| State | `item.status` | Visual |
|---|---|---|
| Active | `pending` | Full opacity, Done + Skip buttons visible |
| Done | `done` | 60% opacity, "✓ Completed" line, no buttons |
| Skipped | `missed` | 45% opacity, "— Skipped" line, no buttons |

Badges are conditionally rendered:
```typescript
{item.is_rollover && <Badge color={colors.rollover}>🔄 Rollover</Badge>}
{item.needs_review && <Badge color={colors.danger}>⚠️ Needs review</Badge>}
```

`is_rollover` — task was in yesterday's plan and not completed.
`needs_review` — `rollover_count >= 3`, computed server-side.

---

### Import Screen — `app/(tabs)/import.tsx`

Two-step flow with independent loading states:

```typescript
const [parsing, setParsing] = useState(false)   // Groq call in progress
const [saving,  setSaving]  = useState(false)   // save to Supabase in progress
const [preview, setPreview] = useState<SchedulePreview | null>(null)

// Step 1: Parse
async function handleParse() {
  setParsing(true)
  const result = await api.parsePlan(rawText)   // POST /api/schedule/parse
  setPreview(result)
}

// Step 2: Save (only available after successful parse)
async function handleSave() {
  setSaving(true)
  await api.savePlan(preview, priority)          // POST /api/schedule/save
  router.replace('/(tabs)/paths')
}
```

The Parse button is disabled while `parsing` or when input is empty. The Save button only renders after `preview` is set.

---

### Path Detail — `app/path/[id].tsx`

Dynamic route — reads the path ID from the URL:

```typescript
const { id } = useLocalSearchParams<{ id: string }>()

useEffect(() => {
  api.getPath(id).then(setPath)     // GET /api/paths/:id — nested tracks + tasks
}, [id])
```

The response is `PathDetail` — a `LearningPath` with `learning_tracks: LearningTrack[]`, each track containing `learning_tasks: LearningTask[]`. Progress is computed client-side:

```typescript
const totalTasks = path.learning_tracks.reduce((n, t) => n + t.learning_tasks.length, 0)
const doneTasks  = path.learning_tracks.reduce(
  (n, t) => n + t.learning_tasks.filter(tk => tk.status === 'completed').length, 0
)
const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
```

---

### Configuration Files

**`tsconfig.json`** — enables the `@/` path alias:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "ignoreDeprecations": "6.0"
  }
}
```

`@/components/TaskCard` resolves to `./components/TaskCard`. Metro uses `baseUrl` from tsconfig automatically.

**`babel.config.js`** — `react-native-reanimated/plugin` must be the last plugin:
```js
module.exports = function(api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],   // always last
  }
}
```

**`package.json`** — `"main"` must point to Expo Router's entry:
```json
{
  "main": "expo-router/entry"
}
```

Without this, Expo looks for `App.tsx` and the router never initialises.

**`app.json`** — key fields:
```json
{
  "scheme": "learning-agent",       // deep link scheme — learning-agent://
  "web": { "bundler": "metro" },    // required for Expo Router
  "plugins": ["expo-router", "expo-secure-store", "expo-notifications", ...],
  "experiments": { "typedRoutes": true }
}
```

`scheme` is used by Supabase auth email confirmation links (`learning-agent://login`). `typedRoutes` enables TypeScript autocomplete for all route paths.

---

### Colour Palette — `constants/colors.ts`

```typescript
export const colors = {
  primary:  '#6366F1',   // indigo    — buttons, active states, primary text accents
  success:  '#22C55E',   // green     — on-track pace, done status
  warning:  '#F59E0B',   // yellow    — slight delay pace
  danger:   '#EF4444',   // red       — behind pace, needs-review badge
  rollover: '#8B5CF6',   // purple    — rollover badge
  bg:       '#0F172A',   // dark navy — screen background
  card:     '#1E293B',   // slate     — card/input background
  text:     '#F1F5F9',   // near-white — primary text
  muted:    '#64748B',   // slate-500 — secondary text, placeholders
}
```
