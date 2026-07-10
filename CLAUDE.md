# Farnborough FC Fantasy League (FFL) — Project Context

## What this is
A Progressive Web App for Farnborough Football Club supporters — a fantasy league
covering squad management, transfers, and a leaderboard, tailored to the NL South context.

## Stack & repo
- **Frontend:** Next.js 14
- **Backend:** Supabase (auth, database, RLS)
- **Hosting:** Vercel (auto-deploys on push)
- **Repo:** `shauntullett88/borofantasy` on GitHub
- **Local dev:** Windows machine, project synced via Egnyte Connect at:
  `C:\Users\Shaun\AppData\Local\Egnyte Connect\offline\657e29cb-3dfb-44c8-ad94-a91977be39e5\cache\Shared\Technical Area\- Apps -\Claude\Farnborough Fantasy App\ffl-app\ffl`
- **Workflow:** edit locally → `git add -A` → commit → push → Vercel deploys automatically

## Current state (built and working)

### Registration & auth
- Registration goes through a server-side API route (`app/api/register/route.js`)
  using the **Supabase service role key** to bypass RLS on profile inserts.
  (Root cause: Supabase's default email confirmation flow leaves no active session,
  so RLS silently blocks the profile insert — service role key on the server route fixes it.)
- Email confirmation is sent via an **Office 365 SMTP relay**
  (`admin@farnboroughfc-fantasy.com`, `smtp.office365.com:587`), configured in
  Supabase Authentication → Emails.
- A branded HTML confirmation email template is in place, using Supabase's
  `{{ .ConfirmationURL }}` variable. Brand colours: `#16213E` (navy), `#F5C842` (gold),
  `#C8102E` (red). The Farnborough badge was deliberately removed from this email.
- The login page shows a friendly message if a user tries to sign in before
  confirming their email.

### Leaderboard & My Team
- Leaderboard shows Name, Team Name, and Points columns, with text wrapping.
- Team names appear beside player names on both the leaderboard and My Team page.
- `profiles` table has a `team_name` column (added via migration SQL).

### Squad scraping
- Live via `/api/scrape-squad-site` calling `lib/parseFarnboroughSquad.js`, which uses
  **cheerio pinned exactly at `"1.0.0-rc.12"` — no caret**. Using `^` resolves to a
  newer cheerio that pulls in `undici`, which Next.js 14's webpack can't parse. Do not
  change this pin without testing the build.
- Squad source: `farnboroughfc.co.uk/teams/mens-first-team/` — a WordPress "Touchline
  (vardy)" theme. Player entries are `div.player-list-item` with position classes;
  names are in `span.player-first-name` / `span.player-last-name`.
- **Note:** `farnboroughfc.co.uk` is not reachable from a bash/sandbox environment —
  it requires an actual browser (e.g. Claude in Chrome, or just a normal browser)
  to inspect or re-scrape the live page.

### PWA / branding
- App icons updated with the new badge across all sizes, navy background `#1A1A2E`
  with safe-zone padding.

### Transfers
- Transfer window deadline set to **8th August, 11:00 UK time**, defined in `lib/game.js`.

## Key learnings (don't relitigate these)
- `.env.local` is gitignored and must be manually recreated on any new machine —
  Vercel's Environment Variables settings are the canonical source of truth for secrets.
- Service role key + server-side route is the correct fix for the RLS/registration issue
  above — don't try to solve it client-side again.
- cheerio must stay pinned at exactly `1.0.0-rc.12` (no `^`).
- Always run `git add -A` before committing when new files have been created —
  this has been missed before.

## On the horizon (not built yet — next up)
1. **Position flexibility** — outfield positions should not be locked (only GK is
   locked); NL South players can play any outfield position.
2. **Squad viewing** — users can click a name on the leaderboard/table to view another
   user's squad, read-only (no editing).
3. **Wildcards** — 3 wildcards allowed per transfer window; wildcard players can be
   drawn from any other NL South team's squad.

## How Claude has been delivering work
- Complete, ready-to-copy files rather than diffs/snippets.
- Supabase schema changes delivered as standalone migration `.sql` files.
- Shaun pastes files into the local Egnyte-synced folder and pushes via git himself.

With Claude Code, this last step should collapse — Claude Code can edit the files
in place in the local folder and run the git commands directly, since it has real
file system and shell access there.
