import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireUser, requireAdmin } from '../../../lib/authz'

export async function GET() {
  const { error } = await requireUser()
  if (error) return error

  const players = await query('select * from players order by position, name')
  return NextResponse.json({ players })
}

export async function POST(request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { name, position, status } = await request.json()
  if (!name?.trim() || !position) {
    return NextResponse.json({ error: 'Name and position are required' }, { status: 400 })
  }

  const rows = await query(
    `insert into players (name, position, status) values ($1, $2, $3) returning *`,
    [name.trim(), position, status || 'active']
  )
  return NextResponse.json({ player: rows[0] })
}
