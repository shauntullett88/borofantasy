import 'server-only'
import { NextResponse } from 'next/server'
import { auth } from '../auth'

export async function requireUser() {
  const session = await auth()
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireAdmin() {
  const { session, error } = await requireUser()
  if (error) return { session: null, error }
  if (!session.user.isAdmin) {
    return { session: null, error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { session, error: null }
}
