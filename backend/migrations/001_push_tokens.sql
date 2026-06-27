-- Migration 001 — Push Tokens
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)

create table if not exists push_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users not null,
  token      text        not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)   -- one active token per user; upsert on re-register
);

alter table push_tokens enable row level security;

create policy "own push_tokens" on push_tokens
  for all using (auth.uid() = user_id);

create index if not exists push_tokens_user_id_idx on push_tokens (user_id);
