import { NextResponse } from 'next/server'
import { query, withTransaction } from '../../../../lib/db'
import { requireAdmin } from '../../../../lib/authz'

export async function PATCH(request, { params }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { result } = await request.json()
  const rows = await query('update matches set result = $1 where id = $2 returning *', [result, params.id])
  return NextResponse.json({ match: rows[0] })
}

export async function DELETE(request, { params }) {
  const { error } = await requireAdmin()
  if (error) return error

  await withTransaction(async (client) => {
    await client.query('delete from player_match_stats where match_id = $1', [params.id])
    await client.query('delete from matches where id = $1', [params.id])
  })
  return NextResponse.json({ success: true })
}
