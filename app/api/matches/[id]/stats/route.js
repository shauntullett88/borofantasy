import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import { requireUser, requireAdmin } from '../../../../../lib/authz'

export async function GET(request, { params }) {
  const { error } = await requireUser()
  if (error) return error

  const stats = await query('select * from player_match_stats where match_id = $1', [params.id])
  return NextResponse.json({ stats })
}

export async function PUT(request, { params }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { stats } = await request.json()
  if (!Array.isArray(stats)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const existingRows = await query('select player_id from player_match_stats where match_id = $1', [params.id])
  const existingPlayerIds = new Set(existingRows.map((r) => r.player_id))

  for (const stat of stats) {
    const appearance = stat.appearance || stat.started || stat.sub_on || false
    const hasData = appearance || (stat.goals || 0) > 0 || (stat.assists || 0) > 0 ||
      stat.clean_sheet || stat.started || stat.sub_on || stat.yellow_card || stat.red_card

    // Only skip rows that don't exist yet AND have no data — mirrors the
    // previous "insert only if hasData" behaviour; existing rows always update.
    if (!hasData && !existingPlayerIds.has(stat.player_id)) continue

    await query(
      `insert into player_match_stats
         (match_id, player_id, appearance, played90, goals, assists, clean_sheet, started, sub_on, yellow_card, red_card)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (match_id, player_id) do update set
         appearance = excluded.appearance, played90 = excluded.played90, goals = excluded.goals,
         assists = excluded.assists, clean_sheet = excluded.clean_sheet, started = excluded.started,
         sub_on = excluded.sub_on, yellow_card = excluded.yellow_card, red_card = excluded.red_card`,
      [
        params.id, stat.player_id, appearance, stat.played90 || false,
        parseInt(stat.goals) || 0, parseInt(stat.assists) || 0, stat.clean_sheet || false,
        stat.started || false, stat.sub_on || false, stat.yellow_card || false, stat.red_card || false,
      ]
    )
  }

  return NextResponse.json({ success: true })
}
