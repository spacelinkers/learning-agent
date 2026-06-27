-- ============================================================
-- Learning Agent — Supabase Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- ============================================================

-- Learning Paths (imported from chat or added manually)
create table learning_paths (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  title         text not null,
  priority      int  default 3,             -- 1=highest, 5=lowest
  status        text default 'active',      -- active/paused/completed/archived
  estimated_days int,
  start_date    date,
  target_date   date,
  source        text default 'chat_import', -- chat_import/manual
  created_at    timestamptz default now()
);

-- Tracks (ordered modules within a path)
create table learning_tracks (
  id             uuid primary key default gen_random_uuid(),
  path_id        uuid references learning_paths on delete cascade not null,
  title          text not null,
  estimated_days int,
  sequence_order int,
  status         text default 'pending'     -- pending/active/completed
);

-- Atomic tasks within a track
create table learning_tasks (
  id               uuid primary key default gen_random_uuid(),
  track_id         uuid references learning_tracks on delete cascade not null,
  path_id          uuid references learning_paths not null,
  title            text not null,
  description      text,
  estimated_hours  float default 1.0,
  sequence_order   int,
  status           text default 'pending',  -- pending/suggested/completed/skipped
  suggested_date   date,
  completed_date   date,
  rollover_count   int default 0            -- incremented each time the task is missed
);

-- Daily generated plans (one per user per day)
create table daily_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users not null,
  date               date not null,
  total_hours_budget float default 3.0,
  status             text default 'active', -- active/completed
  generated_at       timestamptz default now(),
  unique (user_id, date)
);

-- Items scheduled inside a daily plan
create table daily_plan_items (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid references daily_plans on delete cascade not null,
  task_id         uuid references learning_tasks not null,
  path_id         uuid references learning_paths not null,
  suggested_order int,
  is_rollover     boolean default false,
  status          text default 'pending'    -- pending/done/missed
);

-- What the user actually logs after completing work
create table daily_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  task_id             uuid references learning_tasks,
  path_id             uuid references learning_paths,
  date                date,
  time_spent_minutes  int,
  notes               text,
  mood                text,                 -- good/okay/tired
  logged_at           timestamptz default now()
);

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table learning_paths    enable row level security;
alter table learning_tracks   enable row level security;
alter table learning_tasks    enable row level security;
alter table daily_plans       enable row level security;
alter table daily_plan_items  enable row level security;
alter table daily_logs        enable row level security;

-- learning_paths: direct user_id column
create policy "own learning_paths" on learning_paths
  for all using (auth.uid() = user_id);

-- learning_tracks: owned via their parent path
create policy "own learning_tracks" on learning_tracks
  for all using (
    auth.uid() = (
      select user_id from learning_paths where id = path_id
    )
  );

-- learning_tasks: owned via their parent path
create policy "own learning_tasks" on learning_tasks
  for all using (
    auth.uid() = (
      select user_id from learning_paths where id = path_id
    )
  );

-- daily_plans: direct user_id column
create policy "own daily_plans" on daily_plans
  for all using (auth.uid() = user_id);

-- daily_plan_items: owned via their parent daily plan
create policy "own daily_plan_items" on daily_plan_items
  for all using (
    auth.uid() = (
      select user_id from daily_plans where id = plan_id
    )
  );

-- daily_logs: direct user_id column
create policy "own daily_logs" on daily_logs
  for all using (auth.uid() = user_id);

-- ============================================================
-- Indexes (performance)
-- ============================================================

create index on learning_paths    (user_id, status);
create index on learning_tracks   (path_id, sequence_order);
create index on learning_tasks    (track_id, sequence_order);
create index on learning_tasks    (path_id, status);
create index on learning_tasks    (rollover_count);
create index on daily_plans       (user_id, date);
create index on daily_plan_items  (plan_id, suggested_order);
create index on daily_logs        (user_id, date);
