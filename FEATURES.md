# Features

## How to add a new feature

1. **Backend** — add route in `backend/app/routers/`, register in `backend/main.py`
2. **Schema** — if new table needed, create `backend/migrations/00N_name.sql` and run in Supabase SQL Editor
3. **Mobile type** — add TypeScript type + `api.*` method in `mobile/lib/api.ts`
4. **Screen/component** — add file in `mobile/app/` or `mobile/components/`
5. **Agent** — if LLM logic needed, add node in `backend/app/agent/planner.py` or `weekly_review.py`
6. **Push** — send via `tools.send_notification(user_id, title, body)` from any agent node or router

---

## Implemented

### Auth
- [x] Email + password sign-in
- [x] Email + password sign-up with confirmation email
- [x] Deep-link redirect from confirmation email back to app (`learning-agent://login`)
- [x] Session persisted in device secure storage (Android Keystore via expo-secure-store)
- [x] Auto-redirect: unauthenticated → `/login`, authenticated → Today tab
- [x] Sign out

### Import
- [x] Paste raw chat conversation text
- [x] AI parses text into structured tracks + tasks (Groq / LLaMA 3.3 70B)
- [x] Preview extracted tracks before saving (title, estimated days, task count)
- [x] Set priority P1–P5 before saving
- [x] Save as full learning path hierarchy (path → tracks → tasks) in Supabase

### Learning Paths
- [x] List all active paths
- [x] Path detail screen — tracks and tasks with status dots and rollover count
- [x] Progress bar per path (completed tasks / total tasks)
- [x] Pause a path (excluded from daily plan while paused)
- [x] Resume a paused path
- [x] Mark path as complete
- [x] Update priority (P1–P5)

### Daily Plan
- [x] Auto-generated every morning at 6 AM by LangGraph agent
- [x] Auto-generated on first app open of the day if scheduler missed
- [x] Task scoring: `(6 - priority) × 10 + rollover_count × 15 + days_behind × 5`
- [x] Fairness rule — at least 1 task per active path per day
- [x] Hours budget (default 3h/day) respected when selecting tasks
- [x] Force-regenerate plan via `POST /api/plan/generate`
- [x] Mark task done (updates task status to `completed`)
- [x] Skip task (marks as missed, no rollover penalty)
- [x] Progress bar on Today screen (done / total tasks)
- [x] Rollover badge 🔄 on tasks carried over from yesterday
- [x] Needs-review badge ⚠️ when `rollover_count >= 3`

### Rollover & Pace
- [x] Evening check at 10 PM marks uncompleted plan items as `missed`
- [x] Each missed item increments `rollover_count` on the underlying task
- [x] Pace calculated per path: `on_track` / `slight_delay` / `behind`
- [x] Days-behind computed from start date + estimated days + completion percentage

### Logging
- [x] Log time spent (minutes) for any task
- [x] Attach mood: 😊 good / 😐 okay / 😴 tired
- [x] Optional notes
- [x] Weekly log summary grouped by date (`GET /api/log/weekly`)

### Weekly Review
- [x] AI-generated every Sunday at 9 PM (LangGraph + Groq)
- [x] Summary of the week
- [x] Highlights — specific achievements
- [x] Concerns — specific problem areas
- [x] Recommendations per path: `increase_priority` / `reduce_scope` / `pause` / `continue`
- [x] Next-week focus message
- [x] Encouragement line
- [x] Apply button on recommendations (calls `updatePriority` / `updateStatus`)
- [x] Hallucination guard — filters LLM-invented path UUIDs before saving

### Push Notifications
- [x] Morning notification with today's task count (6 AM)
- [x] Evening summary notification (10 PM)
- [x] Weekly review notification (Sunday 9 PM)
- [x] Tap notification → opens Today tab
- [x] Graceful no-op in Expo Go (push requires development/production build)

---

## Not Implemented — Ideas for Future

### Auth
- [ ] Google / GitHub OAuth sign-in
- [ ] Forgot password flow
- [ ] Delete account + data

### Learning Paths
- [ ] Manual path creation (without AI parse — enter tracks and tasks by hand)
- [ ] Edit an existing path title, track, or task
- [ ] Reorder tracks within a path
- [ ] Reorder tasks within a track
- [ ] Archive a path (soft delete, hidden from all views)
- [ ] Path templates (e.g. "Learn Python in 30 days" pre-filled)

### Daily Plan
- [ ] User-configurable hours budget (currently hardcoded to 3h)
- [ ] User-configurable study time window (currently hardcoded to 6 AM)
- [ ] Drag-to-reorder tasks within the Today screen
- [ ] Carry a note from log into the next day's plan for that task
- [ ] Show LLM-generated `focus_hint` and per-task `tip` from `DAILY_PLAN_PROMPT` output (currently generated but not displayed)
- [ ] Mark multiple tasks done at once

### Import
- [ ] Edit track titles or task names in the preview before saving
- [ ] Remove individual tracks from the preview before saving
- [ ] Import from URL (fetch page content and parse)
- [ ] Import from file (PDF / text)
- [ ] Re-parse an existing path (update schedule if the plan changed)

### Logging
- [ ] Log a task not in today's plan (free-form log)
- [ ] Edit or delete a log entry
- [ ] View full log history beyond 7 days
- [ ] Streak counter — consecutive days with at least one log

### Statistics & Progress
- [ ] Per-path completion chart (bar or line graph over time)
- [ ] Weekly minutes heatmap (like GitHub contributions)
- [ ] Mood trend chart over time
- [ ] Estimated completion date per path based on current pace

### Weekly Review
- [ ] Manually trigger a review at any time (button on Log screen — already has `triggerReview()` in api.ts but no UI)
- [ ] Review history — list of past weekly reviews
- [ ] Share weekly review as image or text

### Notifications
- [ ] User-configurable notification times
- [ ] Opt out of specific notification types (morning / evening / weekly)
- [ ] Midday reminder if no tasks completed by noon
- [ ] Milestone notification — "You completed 50% of [path]!"

### Offline
- [ ] Cache today's plan locally so it's readable without network
- [ ] Queue log entries locally when offline, sync when back online

### Settings Screen
- [ ] Daily hours budget slider
- [ ] Notification time pickers
- [ ] Notification on/off toggles per type
- [ ] Theme toggle (light / dark)
- [ ] Sign out button

### Agent / AI
- [ ] Per-path hours budget (different paths get different time allocations)
- [ ] Adaptive scheduling — agent learns from mood and completion patterns
- [ ] Mid-week check-in agent (Wednesday summary + nudge)
- [ ] Task difficulty estimation from description (affects hours estimate)
- [ ] Groq prompt for personalized `tip` shown per task on Today screen

### Backend / Infrastructure
- [ ] Rate limiting on `/api/schedule/parse` (Groq calls are expensive)
- [ ] User preferences table (hours budget, notification times, timezone)
- [ ] Timezone-aware cron jobs (currently all jobs fire at server UTC time)
- [ ] Webhook from Supabase Auth on user delete → clean up all user data
- [ ] API versioning (`/api/v1/...`)
