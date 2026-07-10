import { NextResponse } from 'next/server'
import { query, withTransaction } from '../../../lib/db'
import { requireUser } from '../../../lib/authz'
import { isTransferWindowOpen } from '../../../lib/game'

export async function GET() {
  const { session, error } = await requireUser()
  if (error) return error

  const players = await query('select * from players order by name')
  const settingsRows = await query('select * from user_settings where user_id = $1', [session.user.id])
  const formation = settingsRows[0]?.formation || '4-4-2'

  const squadRows = await query(
    `select s.id, s.user_id, s.player_id, s.is_bench, s.is_captain, s.slot_index,
            p.id as p_id, p.name as p_name, p.position as p_position, p.status as p_status
     from squads s
     join players p on p.id = s.player_id
     where s.user_id = $1`,
    [session.user.id]
  )

  const squad = squadRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    player_id: row.player_id,
    is_bench: row.is_bench,
    is_captain: row.is_captain,
    slot_index: row.slot_index,
    players: { id: row.p_id, name: row.p_name, position: row.p_position, status: row.p_status },
  }))

  const playerIds = squad.map((s) => s.player_id)
  const stats = playerIds.length
    ? await query('select * from player_match_stats where player_id = any($1)', [playerIds])
    : []
  const matches = await query('select id, result from matches')

  return NextResponse.json({ players, formation, squad, stats, matches })
}

export async function PUT(request) {
  const { session, error } = await requireUser()
  if (error) return error

  if (!isTransferWindowOpen()) {
    return NextResponse.json({ error: 'The transfer window is closed' }, { status: 403 })
  }

  const { formation, rows } = await request.json()
  if (!formation || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    await withTransaction(async (client) => {
      await client.query('delete from squads where user_id = $1', [session.user.id])

      for (const row of rows) {
        await client.query(
          `insert into squads (user_id, player_id, is_bench, is_captain, slot_index)
           values ($1, $2, $3, $4, $5)`,
          [session.user.id, row.player_id, !!row.is_bench, !!row.is_captain, row.slot_index ?? null]
        )
      }

      await client.query(
        `insert into user_settings (user_id, formation, updated_at)
         values ($1, $2, now())
         on conflict (user_id) do update set formation = excluded.formation, updated_at = now()`,
        [session.user.id, formation]
      )
    })
  } catch (err) {
    console.error('Save squad error:', err)
    return NextResponse.json({ error: 'Failed to save squad. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
