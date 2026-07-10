import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { requireUser } from '../../../../lib/authz'

export async function GET(request, { params }) {
  const { error } = await requireUser()
  if (error) return error

  const stats = await query('select * from player_match_stats where player_id = $1', [params.playerId])
  const matches = await query('select id, opponent, match_date, home, result from matches')

  return NextResponse.json({ stats, matches })
}
