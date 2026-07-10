import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'

export async function GET(request) {
  const email = new URL(request.url).searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const rows = await query('select email_verified_at, password_hash from users where email = $1', [email])
  const user = rows[0]

  return NextResponse.json({
    exists: !!user,
    verified: !!user?.email_verified_at,
    hasPassword: !!user?.password_hash,
  })
}
