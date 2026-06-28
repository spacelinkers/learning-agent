# Learning Agent — Project Root

## Vision
Mobile-first AI agent that tracks multiple learning paths, generates daily focus plans, handles rollovers, and accepts learning schedules imported from pasted chat conversations.

## Stack
| Layer | Tool | Notes |
|---|---|---|
| Mobile | Expo + React Native | Android primary |
| Backend | FastAPI | Deployed on Render (free tier) |
| Database | Supabase (PostgreSQL) | Free tier |
| LLM | Groq API (LLaMA 3.3 70B) | Free tier |
| Agent | LangGraph | Server-side only, in backend/app/agent/ |
| Auth | Supabase Auth | JWT tokens |
| Push | Expo Push Notifications | Dev/production builds only (not Expo Go) |

## Project Structure
```
learning-agent/
├── CLAUDE.md               ← this file
├── README.md               ← project overview
├── FEATURES.md             ← implemented + planned features list
├── render.yaml             ← Render Blueprint (auto-deploy backend)
├── backend/
│   ├── CLAUDE.md
│   ├── README.md
│   ├── main.py
│   ├── requirements.txt    ← pinned versions
│   └── app/
│       ├── deps.py         ← get_user_id dependency (JWT validation)
│       ├── routers/
│       │   ├── schedule.py ← /api/schedule/parse + /save
│       │   ├── paths.py    ← /api/paths CRUD + DELETE
│       │   ├── plan.py     ← /api/plan/today, /generate, item done/skip
│       │   ├── log.py      ← /api/log POST + /weekly GET
│       │   ├── user.py     ← /api/user/push-token
│       │   └── review.py   ← /api/review/weekly + /generate
│       ├── agent/
│       │   ├── README.md
│       │   ├── planner.py      ← LangGraph daily plan graph
│       │   ├── weekly_review.py← LangGraph weekly review graph
│       │   ├── tools.py        ← all Supabase + Groq tool calls
│       │   ├── prompts.py      ← LLM prompt strings
│       │   └── scheduler.py    ← APScheduler (3 cron jobs)
│       ├── models/
│       │   └── schemas.py  ← Pydantic models
│       └── db/
│           └── supabase.py ← Supabase client singleton
├── mobile/
│   ├── CLAUDE.md
│   ├── README.md
│   ├── app.json            ← Expo config (icon, splash, scheme, plugins)
│   ├── eas.json            ← EAS Build config (preview APK profile)
│   ├── assets/
│   │   ├── icon.png            ← 1024×1024 launcher icon
│   │   ├── adaptive-icon.png   ← Android adaptive icon foreground
│   │   └── splash.png          ← splash screen
│   └── (Expo project — see mobile/CLAUDE.md for full structure)
└── agent/
    └── CLAUDE.md           ← agent architecture reference doc
```

## Environment Variables
```
# backend/.env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=

# mobile/.env
EXPO_PUBLIC_API_URL=https://learning-agent-api.onrender.com
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Deployment
- **Backend**: Render free tier, auto-deploys on `git push origin main:master`
  - Render watches the `master` branch; push with `git push origin main:master`
- **Mobile**: EAS Build — `eas build --profile preview --platform android`
  - Produces a direct-install APK (no Play Store needed)

## Build Phases — All Completed
- ✅ Phase 1: Supabase schema + seed data
- ✅ Phase 2: FastAPI — /parse and /schedule endpoints
- ✅ Phase 3: LangGraph daily planner agent
- ✅ Phase 4: Expo mobile app (Today, Paths, Import, Log screens)
- ✅ Phase 5: Push notifications + rollover logic
- ✅ Phase 6: Weekly review agent

## Key Rules
- Never hardcode API keys
- All agent logic runs server-side only
- Mobile only calls FastAPI — never Groq/Supabase directly
- Use async/await throughout FastAPI
- Supabase RLS enabled on all tables
- Rate limit: 5 parses per user per hour (Groq free-tier guard)
