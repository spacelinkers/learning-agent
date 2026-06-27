# Learning Agent — Project Structure

## Folder Structure to Create in VS Code

```
learning-agent/                        ← root folder (open this in VS Code)
│
├── CLAUDE.md                          ← ROOT: project overview + stack
│
├── backend/                           ← FastAPI server
│   ├── CLAUDE.md                      ← BACKEND: schema + endpoints + rules
│   ├── .env                           ← API keys (never commit)
│   ├── .env.example                   ← template for keys
│   ├── requirements.txt               ← Python dependencies
│   ├── main.py                        ← FastAPI app entry point
│   └── app/
│       ├── routers/
│       │   ├── schedule.py            ← parse + save learning paths
│       │   ├── plan.py                ← daily plan CRUD
│       │   ├── log.py                 ← daily log entries
│       │   └── paths.py              ← learning path CRUD
│       ├── agent/
│       │   ├── planner.py             ← LangGraph graph
│       │   ├── tools.py               ← agent tools
│       │   ├── prompts.py             ← all LLM prompts
│       │   └── scheduler.py          ← APScheduler jobs
│       ├── models/
│       │   └── schemas.py             ← Pydantic models
│       └── db/
│           └── supabase.py            ← Supabase client
│
├── mobile/                            ← Expo React Native app
│   ├── CLAUDE.md                      ← MOBILE: screens + components + API
│   ├── .env                           ← Expo public env vars
│   ├── app/
│   │   ├── _layout.tsx                ← navigation layout
│   │   └── (tabs)/
│   │       ├── index.tsx              ← Today's Plan screen
│   │       ├── paths.tsx              ← My Learning Paths screen
│   │       ├── import.tsx             ← Import from Chat screen
│   │       └── log.tsx                ← Quick Log screen
│   ├── components/
│   │   ├── TaskCard.tsx
│   │   ├── PathCard.tsx
│   │   ├── ProgressRing.tsx
│   │   └── MoodPicker.tsx
│   ├── lib/
│   │   ├── api.ts                     ← all FastAPI calls
│   │   ├── auth.ts                    ← Supabase auth
│   │   └── notifications.ts          ← Expo push setup
│   ├── hooks/
│   │   ├── useTodayPlan.ts
│   │   ├── usePaths.ts
│   │   └── useAuth.ts
│   └── constants/
│       └── colors.ts
│
└── agent/                             ← agent logic docs
    └── CLAUDE.md                      ← AGENT: LangGraph graph + scoring + prompts
```

## Setup Order in VS Code

### Step 1 — Create folders
```bash
mkdir learning-agent
cd learning-agent
mkdir -p backend/app/{routers,agent,models,db}
mkdir -p mobile/app/\(tabs\)
mkdir -p mobile/{components,lib,hooks,constants}
mkdir agent
```

### Step 2 — Drop the 4 CLAUDE.md files
```
learning-agent/CLAUDE.md         ← root
learning-agent/backend/CLAUDE.md ← backend
learning-agent/mobile/CLAUDE.md  ← mobile
learning-agent/agent/CLAUDE.md   ← agent
```

### Step 3 — Open in VS Code
```bash
code learning-agent
```

### Step 4 — Start Claude Code
- Open terminal in VS Code
- Run: claude
- Claude Code reads CLAUDE.md automatically

### Step 5 — First Prompt to Claude Code
```
Follow CLAUDE.md. Start Phase 1.
Create backend/app/db/supabase.py and
generate the full Supabase schema SQL.
Then create main.py with FastAPI app skeleton.
```

## Claude Code Session Strategy (saves tokens)

| Session | Focus | CLAUDE.md it reads |
|---|---|---|
| Session 1 | Supabase schema + DB client | root + backend |
| Session 2 | /parse and /schedule endpoints | backend |
| Session 3 | LangGraph planner agent | backend + agent |
| Session 4 | Expo app scaffold + auth | mobile |
| Session 5 | Today screen + mark done | mobile |
| Session 6 | Import screen (paste → parse → save) | mobile |
| Session 7 | Push notifications + scheduler | backend + mobile |

## .gitignore (root)
```
.env
__pycache__/
*.pyc
node_modules/
.expo/
dist/
```
```
