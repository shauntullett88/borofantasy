# ⚽ Farnborough Fantasy League

Private fantasy football app for Farnborough FC — 2026/2027 Season.

**Tech stack:** Next.js 14 + Tailwind CSS + Supabase + Vercel  
**PWA:** Installable to phone home screen, push notifications, offline caching

---

## 🚀 Setup Guide (step by step)

### Step 1 — Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it `farnborough-fantasy` (or anything you like)
3. Once created, go to **SQL Editor** and paste + run the entire contents of `supabase-setup.sql`
4. From **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`

### Step 2 — VAPID keys (for push notifications)

In your terminal:
```bash
npx web-push generate-vapid-keys
```
Copy the output into your env vars.

### Step 3 — Environment variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

### Step 4 — Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

### Step 5 — GitHub + Vercel deployment

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your GitHub repo
3. In Vercel project settings → **Environment Variables**, add all the same vars from `.env.local`
4. Deploy — Vercel auto-deploys on every push to `main`

### Step 6 — Make Shaun an admin

1. Shaun registers an account via the app
2. In Supabase → **SQL Editor**, run:
```sql
update profiles set is_admin = true where email = 'shaun@hisactual.email';
```

---

## 📱 Features

### User features
- Register / login with email + password
- **My Team** — view your squad, starters vs bench clearly separated, captain highlighted with 👑
- **Transfers** — pick players, drag between XI and bench, set captain
- **Leaderboard** — live cumulative points, ranked with medals
- **PWA** — installable to phone home screen, works offline, push notifications

### Admin features (Shaun only)
- **Player management** — add, edit (name/position/status), delete players entirely via UI
- **Match stats entry** — create matches, enter stats per player (appearance, played90, goals, assists, clean sheet)
- Points calculated automatically in JS — no SQL triggers

### Transfer windows
Transfers only allowed on: **October 1**, **January 1**, **March 1**  
Outside these dates the Save button is locked. Players marked "left" are shown in red with strikethrough.

### Scoring
| Event | Starter | Bench |
|-------|---------|-------|
| Appearance | +1 | +1 |
| Played 90 mins | +2 | +1 |
| Goal | +5 | +2 |
| Assist | +3 | +1 |
| Clean sheet (GK/DEF) | +2 | +1 |
| Captain | 2× total | — |

---

## 📂 Project structure

```
app/
  layout.js          — root layout, PWA meta, service worker init
  page.js            — redirect to login or my-team
  login/page.js      — sign in / register
  my-team/page.js    — squad view with points
  transfers/page.js  — squad builder with player search/filter
  leaderboard/page.js — ranked points table
  admin/
    page.js          — admin tab wrapper (players + matches)
    AdminPlayers.js  — add/edit/delete players
    AdminMatches.js  — match creation + per-player stats entry
  api/
    notify/route.js  — send push notifications to all users
    subscribe/route.js — save/delete push subscriptions

components/
  AuthContext.js     — user auth state, signIn/signUp/signOut
  BottomNav.js       — mobile tab bar
  TransferBanner.js  — open/closed banner at top of every page
  PlayerCard.js      — reusable player card with status/captain styling
  PWAInstall.js      — "Add to home screen" prompt

lib/
  supabase.js        — Supabase client (anon + admin)
  game.js            — calculatePoints(), isTransferWindowOpen(), validateSquad()

public/
  manifest.json      — PWA manifest
  sw.js              — service worker (caching + push)
  icons/             — add icon-192.png and icon-512.png here

supabase-setup.sql   — run once to create all tables + RLS policies
```

---

## 🔔 Push notifications

Notifications fire when:
- Admin saves match stats (trigger manually from admin panel or via cron)
- Transfer window opens (set up a cron job or Vercel cron hitting `/api/notify`)

To send a notification manually via API:
```bash
curl -X POST https://your-app.vercel.app/api/notify \
  -H "Content-Type: application/json" \
  -d '{"title":"Stats Updated","body":"Gameweek points are in!","url":"/leaderboard"}'
```

---

## 🖼️ Icons

Add these to `/public/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Use the Farnborough FC badge or your own FFL logo.

---

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Admin operations gated by `is_admin = true` in profiles
- Service role key only used server-side (API routes), never exposed to client
- No raw SQL — all queries via `@supabase/supabase-js` client methods
