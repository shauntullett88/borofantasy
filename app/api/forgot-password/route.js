import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { createToken } from '../../../lib/tokens'
import { sendMail } from '../../../lib/mailer'
import { passwordResetEmail } from '../../../lib/passwordResetEmail'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const rows = await query('select id, username, email from users where email = $1', [email])
    const user = rows[0]

    // Always return success — don't reveal whether an email is registered.
    if (user) {
      const rawToken = await createToken(user.id, 'password_reset', 1)
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`
      await sendMail({
        to: user.email,
        subject: 'Reset your Farnborough Fantasy League password',
        html: passwordResetEmail(user.username, resetUrl),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Forgot-password error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
