# Learning Agent

A mobile-first AI assistant that manages multiple learning paths, generates daily study plans, handles task rollovers, and produces weekly progress reviews — all powered by LLaMA 3.3 70B via Groq.

## What the App Does

You paste a learning schedule from any chat conversation (e.g. "teach me React in 30 days"). The AI parses it into structured tracks and tasks, saves it as a learning path, and from that point on:

- Every morning at 6 AM it generates a focused daily plan across all your active paths
- You mark tasks done or skip them from the Today screen
- Missed tasks roll over automatically; tasks rolled over 3+ times get flagged for review
- Every Sunday evening it generates a weekly review with highlights, concerns, and recommendations
- Push notifications remind you to study and alert you to the daily plan

---

## Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 56 + React Native (Android primary) |
| Backend | FastAPI (deployed on Render) |
| Database | Supabase (PostgreSQL + Auth) |
| LLM | Groq API — LLaMA 3.3 70B |
| Agent | LangGraph (server-side only) |
| Scheduling | APScheduler (cron jobs on the backend) |
| Push | Expo Push Notifications |

---

## Project Structure

```
learning-agent/
│
├── render.yaml                        # Render deployment blueprint
├── .gitignore
│
├── backend/                           # FastAPI server
│   ├── main.py                        # App entry point + middleware + router mount
│   ├── requirements.txt               # Pinned Python dependencies
│   ├── schema.sql                     # Full Supabase schema (run once in SQL editor)
│   ├── .env                           # API keys — never committed
│   ├── .env.example                   # Key template for onboarding
│   │
│   ├── migrations/
│   │   ├── 001_push_tokens.sql        # push_tokens table
│   │   └── 002_weekly_reviews.sql     # weekly_reviews table
│   │
│   └── app/
│       ├── deps.py                    # Shared auth dependency (JWT → user_id)
│       │
│       ├── db/
│       │   └── supabase.py            # Supabase client singleton (lru_cache)
│       │
│       ├── models/
│       │   └── schemas.py             # All Pydantic request/response models
│       │
│       ├── routers/
│       │   ├── schedule.py            # POST /api/schedule/parse, /save
│       │   ├── paths.py               # GET/PUT /api/paths, /paths/{id}
│       │   ├── plan.py                # GET /api/plan/today, mark done/skip
│       │   ├── log.py                 # POST /api/log, GET /api/log/weekly
│       │   ├── user.py                # POST /api/user/push-token
│       │   └── review.py              # GET/POST /api/review/weekly, /generate
│       │
│       └── agent/
│           ├── planner.py             # LangGraph daily planner graph (7 nodes)
│           ├── weekly_review.py       # LangGraph weekly review graph (5 nodes)
│           ├── tools.py               # All DB helpers + Groq caller + push sender
│           ├── prompts.py             # DAILY_PLAN_PROMPT, EVENING_PROMPT, WEEKLY_REVIEW_PROMPT
│           └── scheduler.py           # APScheduler: 6AM plan, 10PM check, 9PM Sunday review
│
└── mobile/                            # Expo React Native app
    ├── app.json                        # Expo config (scheme, plugins, bundler)
    ├── package.json                    # Dependencies + "main": "expo-router/entry"
    ├── tsconfig.json                   # Path alias @/ → project root
    ├── babel.config.js                 # babel-preset-expo + reanimated plugin
    ├── metro.config.js                 # Expo Router metro config
    ├── .env                            # EXPO_PUBLIC_* vars (not committed)
    ├── .env.example                    # Env template
    │
    ├── app/                            # Expo Router file-based routing
    │   ├── _layout.tsx                 # Root layout: auth guard + push setup
    │   ├── login.tsx                   # Email / password sign-in + sign-up
    │   ├── path/
    │   │   └── [id].tsx               # Path detail: tracks + task list + progress
    │   └── (tabs)/
    │       ├── _layout.tsx             # Tab bar (Ionicons, dark theme)
    │       ├── index.tsx               # Today screen
    │       ├── paths.tsx               # My Learning Paths screen
    │       ├── import.tsx              # Import from Chat screen
    │       └── log.tsx                 # Quick Log screen
    │
    ├── components/
    │   ├── TaskCard.tsx                # Task row: rollover badge, needs-review badge, Done/Skip
    │   ├── PathCard.tsx                # Path summary: priority, pace, ProgressRing
    │   ├── ProgressRing.tsx            # SVG circular progress indicator
    │   ├── MoodPicker.tsx              # 😊 😐 😴 mood selector
    │   └── WeeklyReviewCard.tsx        # Weekly review: highlights, concerns, recommendations
    │
    ├── hooks/
    │   ├── useAuth.ts                  # Session state + onAuthStateChange
    │   ├── useTodayPlan.ts             # Today's plan with optimistic done/skip
    │   └── usePaths.ts                 # Paths list + updatePriority/updateStatus
    │
    ├── lib/
    │   ├── api.ts                      # All typed FastAPI calls
    │   ├── auth.ts                     # Supabase client (SecureStore adapter)
    │   └── notifications.ts            # Push setup (no-op in Expo Go, active in builds)
    │
    └── constants/
        └── colors.ts                   # Dark theme palette
```

---

## Database Schema

Six core tables in Supabase (RLS enabled on all):

| Table | Purpose |
|---|---|
| `learning_paths` | Top-level paths imported from chat |
| `learning_tracks` | Sections within a path (e.g. "Week 1 — Basics") |
| `learning_tasks` | Atomic tasks within a track |
| `daily_plans` | One plan per user per day |
| `daily_plan_items` | Tasks selected for a given day |
| `daily_logs` | What the user actually logged (time, mood, notes) |
| `push_tokens` | One Expo push token per user |
| `weekly_reviews` | AI-generated weekly summaries |

---

## API Endpoints

```
POST /api/schedule/parse          Parse raw chat text → structured preview (Groq)
POST /api/schedule/save           Save approved schedule as path + tracks + tasks

GET  /api/paths                   List all active learning paths
GET  /api/paths/{id}              Path detail with nested tracks and tasks
PUT  /api/paths/{id}/priority     Update priority (1–5)
PUT  /api/paths/{id}/status       Pause / resume / complete

GET  /api/plan/today              Get today's plan (auto-generates if missing)
POST /api/plan/generate           Force regenerate today's plan
POST /api/plan/item/{id}/done     Mark a plan item done
POST /api/plan/item/{id}/skip     Skip a plan item (no rollover penalty)

POST /api/log                     Log time, mood, notes for a task
GET  /api/log/weekly              Last 7 days of logs grouped by date

POST /api/user/push-token         Register Expo push token

GET  /api/review/weekly           Fetch latest weekly review
POST /api/review/generate         Trigger a new weekly review (Groq)

GET  /health                      Health check (Render uptime monitoring)
```

---

## The AI Agent (LangGraph)

### Daily Planner — runs at 6 AM

```
fetch_user_data → score_tasks → select_tasks → check_fairness → generate_greeting → save_plan → send_notification
```

1. Fetches all active paths and pending tasks
2. Scores each task: `score = (6 - priority) × 10 + rollover_count × 15 + days_behind × 5`
3. Selects highest-scoring tasks within the daily hours budget (default 3h)
4. Fairness check: guarantees at least 1 task per active path
5. Generates a motivational greeting via Groq
6. Saves the plan to Supabase
7. Sends a push notification with the task count

### Evening Check — runs at 10 PM

Marks any still-pending plan items as `missed` and increments `rollover_count`. Tasks with `rollover_count >= 3` are flagged with `needs_review: true`.

### Weekly Review — runs at 9 PM Sunday

```
fetch_week_data → call_llm → validate_recommendations → save_review → notify_user
```

Groq analyses the week's completion rate, pace per path, mood patterns, and generates: summary, highlights, concerns, actionable recommendations (increase priority / reduce scope / pause / continue).

---

## Screens

### Today
Daily plan generated by the AI. Shows each task with estimated time, path label, rollover count (🔄), and needs-review flag (⚠️). Tap Done or Skip; progress bar tracks completion.

### My Paths
All active learning paths with a progress ring, priority badge, and pace label (on track / behind). Long-press to pause or mark complete. Tap to open the path detail with full track and task breakdown.

### Import
Paste any learning schedule from a chat conversation. The AI (via `/api/schedule/parse`) extracts tracks and tasks into a structured preview. Set priority (P1–P5) and save — it becomes a new learning path immediately.

### Log
Quickly log time spent, mood, and notes for any task. The weekly AI review card appears at the top when a review is available, with one-tap Apply buttons for recommendations.

---

## Environment Variables

**Backend (`backend/.env`)**

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=
EXPO_ACCESS_TOKEN=
```

**Mobile (`mobile/.env`)**

```
EXPO_PUBLIC_API_URL=https://your-app.onrender.com
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Running Locally

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Mobile (separate terminal)
cd mobile
npm install --legacy-peer-deps
cp .env.example .env   # set EXPO_PUBLIC_API_URL=http://<your-local-ip>:8001
npx expo start --clear
```

Scan the QR code with Expo Go (Android). Push notifications require a development build (`npx expo run:android`) — they are gracefully disabled in Expo Go.

---

## Deployment

Backend is deployed on Render as a Python web service using `render.yaml`. Set the four environment variables in the Render dashboard after connecting the GitHub repo.

The free tier sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Use the `/health` endpoint to confirm the service is awake.
