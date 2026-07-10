import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '../../../lib/db'
import { createToken } from '../../../lib/tokens'
import { sendMail } from '../../../lib/mailer'
import { confirmationEmail } from '../../../lib/confirmationEmail'

export async function POST(request) {
  try {
    const { email, password, username, teamName } = await request.json()

    if (!email || !password || !username || !teamName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    let userId
    try {
      const rows = await query(
        `insert into users (username, team_name, email, password_hash)
         values ($1, $2, $3, $4)
         returning id`,
        [username.trim(), teamName.trim(), email, passwordHash]
      )
      userId = rows[0].id
    } catch (err) {
      if (err.code === '23505') {
        return NextResponse.json({ error: 'That name or email is already taken — please choose another' }, { status: 400 })
      }
      throw err
    }

    const rawToken = await createToken(userId, 'verify_email', 24)
    const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${rawToken}`

    await sendMail({
      to: email,
      subject: 'Confirm your Farnborough Fantasy League account',
      html: confirmationEmail(username.trim(), confirmUrl),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
