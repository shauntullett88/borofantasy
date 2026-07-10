import Link from 'next/link'
import { query } from '../../lib/db'
import { consumeToken } from '../../lib/tokens'
import { sendMail } from '../../lib/mailer'
import { welcomeEmail } from '../../lib/welcomeEmail'

async function verify(token) {
  if (!token) return { ok: false }

  const verified = await consumeToken(token, 'verify_email')
  if (!verified) return { ok: false }

  const rows = await query(
    `update users set email_verified_at = now() where id = $1 returning username, email`,
    [verified.user_id]
  )
  const user = rows[0]
  if (!user) return { ok: false }

  await sendMail({
    to: user.email,
    subject: 'Welcome to the Farnborough Fantasy League!',
    html: welcomeEmail(user.username),
  })

  return { ok: true }
}

export default async function VerifyEmailPage({ searchParams }) {
  const { ok } = await verify(searchParams?.token)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-ffc-surface rounded-2xl p-8 border border-ffc-muted text-center">
        {ok ? (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-3">Email confirmed!</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Your account is ready to go. Log in and start building your squad.
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-3">Link expired or invalid</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              This confirmation link is no longer valid. Please try registering again, or contact an admin.
            </p>
          </>
        )}
        <Link href="/login" className="mt-2 text-ffc-gold text-sm font-semibold hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
