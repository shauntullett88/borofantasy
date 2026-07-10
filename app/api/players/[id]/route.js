import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { requireAdmin } from '../../../../lib/authz'

export async function PATCH(request, { params }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { name, position, status } = await request.json()
  const rows = await query(
    `update players set name = $1, position = $2, status = $3 where id = $4 returning *`,
    [name.trim(), position, status, params.id]
  )
  return NextResponse.json({ player: rows[0] })
}

export async function DELETE(request, { params }) {
  const { error } = await requireAdmin()
  if (error) return error

  await query('delete from players where id = $1', [params.id])
  return NextResponse.json({ success: true })
}
