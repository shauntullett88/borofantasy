export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireAdmin } from '../../../lib/authz'

export async function POST(request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const { title, body, url } = await request.json()
    const subs = await query('select * from push_subscriptions')

    if (subs.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const webpush = (await import('web-push')).default
    webpush.setVapidDetails(
      'mailto:' + process.env.VAPID_EMAIL,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    const payload = JSON.stringify({ title, body, url })
    let sent = 0
    const expired = []

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err) {
        if (err.statusCode === 410) expired.push(sub.id)
      }
    }

    if (expired.length > 0) {
      await query('delete from push_subscriptions where id = any($1)', [expired])
    }

    return NextResponse.json({ sent })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
