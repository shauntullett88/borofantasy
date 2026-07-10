// app/api/commit-scraped-stats/route.js
//
// Takes the admin-confirmed scraped stats and upserts them into player_match_stats.
//
// POST body: { matchId: string, stats: ParsedStat[] }
// Response:  { ok: true, upserted: number }

import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireAdmin } from '../../../lib/authz'

export async function POST(request) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const { matchId, stats } = await request.json()

    if (!matchId || !stats?.length) {
      return NextResponse.json({ error: 'matchId and stats are required' }, { status: 400 })
    }

    const rows = stats.filter((s) =>
      s.appearance || s.started || s.sub_on || s.goals > 0 || s.assists > 0 || s.clean_sheet || s.yellow_card || s.red_card
    )

    for (const s of rows) {
      await query(
        `insert into player_match_stats
           (match_id, player_id, appearance, played90, goals, assists, clean_sheet, started, sub_on, yellow_card, red_card)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (match_id, player_id) do update set
           appearance = excluded.appearance, played90 = excluded.played90, goals = excluded.goals,
           assists = excluded.assists, clean_sheet = excluded.clean_sheet, started = excluded.started,
           sub_on = excluded.sub_on, yellow_card = excluded.yellow_card, red_card = excluded.red_card`,
        [
          matchId, s.player_id, s.appearance || s.started || s.sub_on || false, s.played90 || false,
          parseInt(s.goals) || 0, parseInt(s.assists) || 0, s.clean_sheet || false,
          s.started || false, s.sub_on || false, s.yellow_card || false, s.red_card || false,
        ]
      )
    }

    return NextResponse.json({ ok: true, upserted: rows.length })
  } catch (err) {
    console.error('commit-scraped-stats error:', err)
    return NextResponse.json({ error: 'Unexpected error: ' + err.message }, { status: 500 })
  }
}
