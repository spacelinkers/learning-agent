-- Migration 002 — Weekly Reviews
-- Run in Supabase SQL Editor after migration 001

create table if not exists weekly_reviews (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users not null,
  week_start       date        not null,
  week_end         date        not null,
  summary          text,
  highlights       jsonb       default '[]',
  concerns         jsonb       default '[]',
  recommendations  jsonb       default '[]',   -- [{path_id, path_title, action, reason}]
  next_week_focus  text,
  encouragement    text,
  raw_llm          jsonb,
  created_at       timestamptz default now(),
  unique (user_id, week_start)
);

alter table weekly_reviews enable row level security;

create policy "own weekly_reviews" on weekly_reviews
  for all using (auth.uid() = user_id);

create index if not exists weekly_reviews_user_week_idx on weekly_reviews (user_id, week_start desc);
