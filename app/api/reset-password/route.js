import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '../../../lib/db'
import { consumeToken } from '../../../lib/tokens'

export async function POST(request) {
  try {
    const { token, password } = await request.json()
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const consumed = await consumeToken(token, 'password_reset')
    if (!consumed) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await query(
      `update users set password_hash = $1, email_verified_at = coalesce(email_verified_at, now()) where id = $2`,
      [passwordHash, consumed.user_id]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset-password error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
