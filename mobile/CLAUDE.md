# Mobile — Expo + React Native

## Setup
```bash
npx create-expo-app mobile --template blank-typescript
cd mobile
npx expo install expo-notifications expo-secure-store
npm install @supabase/supabase-js axios react-native-paper
npm install @react-navigation/native @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
```

## Structure
```
mobile/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx        # Today screen
│   │   ├── paths.tsx        # My Learning Paths
│   │   ├── import.tsx       # Import from chat
│   │   └── log.tsx          # Quick log
│   └── _layout.tsx
├── components/
│   ├── TaskCard.tsx         # single task in daily plan
│   ├── PathCard.tsx         # learning path summary card
│   ├── ProgressRing.tsx     # circular progress indicator
│   └── MoodPicker.tsx       # 3-emoji mood selector
├── lib/
│   ├── api.ts               # all FastAPI calls
│   ├── auth.ts              # Supabase auth helpers
│   └── notifications.ts     # Expo push setup
├── hooks/
│   ├── useTodayPlan.ts
│   ├── usePaths.ts
│   └── useAuth.ts
└── constants/
    └── colors.ts
```

## API Client (lib/api.ts)
```typescript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL  // Render URL

async function apiCall(endpoint: string, method = 'GET', body?: object) {
  const token = await getSupabaseToken()
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  return res.json()
}

export const api = {
  getTodayPlan: () => apiCall('/api/plan/today'),
  markDone: (id: string) => apiCall(`/api/plan/item/${id}/done`, 'POST'),
  skipTask: (id: string) => apiCall(`/api/plan/item/${id}/skip`, 'POST'),
  parsePlan: (text: string) => apiCall('/api/schedule/parse', 'POST', { raw_text: text }),
  savePlan: (schedule: object, priority: number) =>
    apiCall('/api/schedule/save', 'POST', { approved_schedule: schedule, priority }),
  getPaths: () => apiCall('/api/paths'),
  updatePriority: (id: string, priority: number) =>
    apiCall(`/api/paths/${id}/priority`, 'PUT', { priority }),
  logTask: (data: object) => apiCall('/api/log', 'POST', data),
  getWeeklySummary: () => apiCall('/api/log/weekly'),
}
```

## Screens

### 1. Today Screen (tabs/index.tsx)
```
State: todayPlan (from GET /api/plan/today)

UI:
- Header: "Good morning! X tasks today"
- Greeting from agent (motivational line)
- FlatList of TaskCard components
  - 🔄 badge if is_rollover
  - path color indicator
  - estimated time
  - [Done] [Skip] buttons
- Bottom: completion progress bar
```

### 2. My Paths Screen (tabs/paths.tsx)
```
State: paths (from GET /api/paths)

UI:
- FlatList of PathCard
  - title, priority badge
  - ProgressRing (completion %)
  - status color: green/yellow/red
  - pace label: "On track" / "2 days behind"
- Long press → reorder priority
- Tap → path detail (tracks + tasks list)
- FAB: + Import New Path
```

### 3. Import Screen (tabs/import.tsx)
```
State: rawText, parsedPreview, priority, isLoading

Flow:
1. TextInput (multiline, paste chat here)
2. [✨ Parse with AI] button → POST /api/schedule/parse
3. Loading spinner during parse
4. Preview list of extracted tracks (editable)
   - each track: title, days, subtopics count
   - [Edit] [Remove] per track
5. Priority selector (1-5 slider)
6. [✅ Approve & Save] → POST /api/schedule/save
7. Success → navigate to Paths screen
```

### 4. Quick Log Screen (tabs/log.tsx)
```
State: selectedTask, notes, mood, timeSpent

UI:
- Dropdown: select completed task (from today's plan)
- TextInput: notes (optional)
- MoodPicker: 😊 😐 😴
- TimeSpent: number input (minutes)
- [Log It] button → POST /api/log
```

## Colors (constants/colors.ts)
```typescript
export const colors = {
  primary: '#6366F1',      // indigo
  success: '#22C55E',      // green - on track
  warning: '#F59E0B',      // yellow - slight delay
  danger: '#EF4444',       // red - behind
  rollover: '#8B5CF6',     // purple - rolled over task
  bg: '#0F172A',           // dark background
  card: '#1E293B',         // card background
  text: '#F1F5F9',         // primary text
  muted: '#64748B',        // secondary text
}
```

## Push Notifications (lib/notifications.ts)
```typescript
// Call on app first launch
async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return
  const token = await Notifications.getExpoPushTokenAsync()
  // send token to backend → POST /api/user/push-token
  return token.data
}
```

## Environment
```
# mobile/.env
EXPO_PUBLIC_API_URL=https://your-app.onrender.com
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Rules
- Never call Groq or Supabase directly from mobile
- All data goes through FastAPI backend
- Store auth token in expo-secure-store (not AsyncStorage)
- Use optimistic UI for mark-done (update state before API confirms)
- Handle offline gracefully — queue logs locally if no network
