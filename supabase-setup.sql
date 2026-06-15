-- ═══════════════════════════════════════════════════════════════
-- FARNBOROUGH FANTASY LEAGUE — Supabase Setup
-- Run this ONCE in the Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════

-- 1. PROFILES (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null unique,
  email text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can read all profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);


-- 2. PLAYERS
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  status text not null default 'active' check (status in ('active', 'injured', 'left')),
  created_at timestamptz default now()
);

alter table players enable row level security;
create policy "Anyone can read players" on players for select using (true);
create policy "Admins can insert players" on players for insert using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can update players" on players for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete players" on players for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);


-- 3. SQUADS (one row per player slot per user)
create table if not exists squads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  is_bench boolean default false,
  is_captain boolean default false,
  created_at timestamptz default now(),
  unique(user_id, player_id)
);

alter table squads enable row level security;
create policy "Users can read all squads" on squads for select using (true);
create policy "Users can manage own squad" on squads for insert with check (auth.uid() = user_id);
create policy "Users can update own squad" on squads for update using (auth.uid() = user_id);
create policy "Users can delete own squad" on squads for delete using (auth.uid() = user_id);


-- 4. MATCHES
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  opponent text not null,
  match_date date not null,
  home boolean default true,
  created_at timestamptz default now()
);

alter table matches enable row level security;
create policy "Anyone can read matches" on matches for select using (true);
create policy "Admins can insert matches" on matches for insert using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can update matches" on matches for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete matches" on matches for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);


-- 5. PLAYER MATCH STATS
create table if not exists player_match_stats (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  appearance boolean default false,
  played90 boolean default false,
  goals integer default 0,
  assists integer default 0,
  clean_sheet boolean default false,
  created_at timestamptz default now(),
  unique(match_id, player_id)
);

alter table player_match_stats enable row level security;
create policy "Anyone can read stats" on player_match_stats for select using (true);
create policy "Admins can insert stats" on player_match_stats for insert using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can update stats" on player_match_stats for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete stats" on player_match_stats for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);


-- 6. PUSH SUBSCRIPTIONS
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;
create policy "Users can manage own subscriptions" on push_subscriptions for all using (auth.uid() = user_id);
-- Service role bypasses RLS for admin push sends


-- ═══════════════════════════════════════════════════════════════
-- MAKE SHAUN AN ADMIN
-- Run AFTER Shaun has registered his account
-- Replace with Shaun's actual email address
-- ═══════════════════════════════════════════════════════════════
-- update profiles set is_admin = true where email = 'shaun@example.com';
