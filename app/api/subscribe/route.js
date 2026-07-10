export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireUser } from '../../../lib/authz'

export async function POST(request) {
  const { session, error } = await requireUser()
  if (error) return error

  try {
    const { subscription } = await request.json()

    await query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
       values ($1, $2, $3, $4)
       on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      [session.user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const { error } = await requireUser()
  if (error) return error

  try {
    const { endpoint } = await request.json()
    await query('delete from push_subscriptions where endpoint = $1', [endpoint])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
