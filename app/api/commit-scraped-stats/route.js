// app/api/commit-scraped-stats/route.js
//
// Takes the admin-confirmed scraped stats and upserts them into player_match_stats.
// Uses the Supabase service role key so it can bypass RLS from the server side.
//
// POST body: { matchId: string, stats: ParsedStat[] }
// Response:  { ok: true, upserted: number }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client — can bypass RLS. Never expose this key client-side.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export async function POST(request) {
  try {
    const { matchId, stats } = await request.json()

    if (!matchId || !stats?.length) {
      return NextResponse.json({ error: 'matchId and stats are required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Build upsert rows — only include players with at least some data
    const rows = stats
      .filter((s) => s.appearance || s.started || s.sub_on || s.goals > 0 || s.assists > 0 || s.clean_sheet || s.yellow_card || s.red_card)
      .map((s) => ({
        match_id: matchId,
        player_id: s.player_id,
        appearance: s.appearance || s.started || s.sub_on,
        played90: s.played90 || false,
        goals: parseInt(s.goals) || 0,
        assists: parseInt(s.assists) || 0,
        clean_sheet: s.clean_sheet || false,
        started: s.started || false,
        sub_on: s.sub_on || false,
        yellow_card: s.yellow_card || false,
        red_card: s.red_card || false,
      }))

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0 })
    }

    const { error } = await supabase
      .from('player_match_stats')
      .upsert(rows, { onConflict: 'match_id,player_id' })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, upserted: rows.length })
  } catch (err) {
    console.error('commit-scraped-stats error:', err)
    return NextResponse.json({ error: 'Unexpected error: ' + err.message }, { status: 500 })
  }
}
