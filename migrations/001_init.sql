-- ═══════════════════════════════════════════════════════════════
-- FARNBOROUGH FANTASY LEAGUE — Azure Postgres schema
-- Replaces Supabase's split (auth.users + profiles) with a single
-- `users` table, and drops all RLS — authorization now lives in
-- application code (see lib/authz.js). Run once against a fresh
-- Azure Database for PostgreSQL Flexible Server (PG16+).
-- ═══════════════════════════════════════════════════════════════

-- 1. USERS (replaces Supabase's auth.users + profiles)
create table users (
  id                uuid primary key default gen_random_uuid(),
  username          text not null unique,
  team_name         text,
  email             text not null unique,
  password_hash     text,                 -- null until migrated user completes password reset
  is_admin          boolean not null default false,
  email_verified_at timestamptz,
  created_at        timestamptz not null default now()
);

-- 2. EMAIL VERIFICATION / PASSWORD RESET TOKENS
create table email_verification_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  purpose    text not null check (purpose in ('verify_email', 'password_reset')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_email_verification_tokens_user_id on email_verification_tokens(user_id);


-- 3. PLAYERS
create table players (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  position      text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  status        text not null default 'active' check (status in ('active', 'injured', 'left')),
  nl_player_id  text,
  created_at    timestamptz not null default now()
);


-- 4. SQUADS (one row per player slot per user)
create table squads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  is_bench    boolean default false,
  is_captain  boolean default false,
  slot_index  integer,
  created_at  timestamptz not null default now(),
  unique(user_id, player_id)
);


-- 5. USER SETTINGS (chosen formation per user)
create table user_settings (
  user_id     uuid primary key references users(id) on delete cascade,
  formation   text not null default '4-4-2',
  updated_at  timestamptz not null default now()
);


-- 6. MATCHES
create table matches (
  id            uuid primary key default gen_random_uuid(),
  opponent      text not null,
  match_date    date not null,
  home          boolean default true,
  result        text,
  nl_match_id   text,
  created_at    timestamptz not null default now()
);


-- 7. PLAYER MATCH STATS
create table player_match_stats (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  appearance    boolean default false,
  played90      boolean default false,
  started       boolean default false,
  sub_on        boolean default false,
  goals         integer default 0,
  assists       integer default 0,
  clean_sheet   boolean default false,
  yellow_card   boolean default false,
  red_card      boolean default false,
  created_at    timestamptz not null default now(),
  unique(match_id, player_id)
);


-- 8. PUSH SUBSCRIPTIONS
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);


-- ═══════════════════════════════════════════════════════════════
-- MAKE SHAUN AN ADMIN
-- Run AFTER the data-migration script has seeded `users`.
-- ═══════════════════════════════════════════════════════════════
-- update users set is_admin = true where email = 'shaun@example.com';
