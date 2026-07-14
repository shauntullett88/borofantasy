import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireUser, requireAdmin } from '../../../lib/authz'

export async function GET() {
  const { error } = await requireUser()
  if (error) return error

  const matches = await query('select * from matches order by match_date asc')
  return NextResponse.json({ matches })
}

export async function POST(request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { opponent, match_date, home, result } = await request.json()
  if (!opponent?.trim() || !match_date) {
    return NextResponse.json({ error: 'Opponent and date are required' }, { status: 400 })
  }

  const rows = await query(
    `insert into matches (opponent, match_date, home, result) values ($1, $2, $3, $4) returning *`,
    [opponent.trim(), match_date, home !== false, result || null]
  )
  return NextResponse.json({ match: rows[0] })
}
