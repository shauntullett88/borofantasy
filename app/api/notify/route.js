import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function POST(request) {
  try {
    const { title, body, url } = await request.json()
    const db = supabaseAdmin()

    // Get all push subscriptions
    const { data: subs } = await db.from('push_subscriptions').select('*')

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    // Use web-push
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

    // Clean expired subscriptions
    if (expired.length > 0) {
      await db.from('push_subscriptions').delete().in('id', expired)
    }

    return NextResponse.json({ sent })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
