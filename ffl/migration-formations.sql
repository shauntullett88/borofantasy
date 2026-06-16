-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Add formation support to existing database
-- Run this if you ALREADY ran supabase-setup.sql before
-- (skip this if setting up fresh — it's already in supabase-setup.sql)
-- ═══════════════════════════════════════════════════════════════

-- Add slot_index to squads (tracks exact pitch position for starters)
alter table squads add column if not exists slot_index integer;

-- New table to store each user's chosen formation
create table if not exists user_settings (
  user_id uuid references profiles(id) on delete cascade primary key,
  formation text not null default '4-4-2',
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

drop policy if exists "Users can read all settings" on user_settings;
create policy "Users can read all settings" on user_settings for select using (true);

drop policy if exists "Users can insert own settings" on user_settings;
create policy "Users can insert own settings" on user_settings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on user_settings;
create policy "Users can update own settings" on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
