import 'server-only'
import crypto from 'crypto'
import { query } from './db'

export function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

export async function createToken(userId, purpose, ttlHours = 24) {
  const { raw, hash } = generateToken()
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
  await query(
    `insert into email_verification_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, $3, $4)`,
    [userId, hash, purpose, expiresAt]
  )
  return raw
}

export async function consumeToken(rawToken, purpose) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const rows = await query(
    `select * from email_verification_tokens where token_hash = $1 and purpose = $2 and expires_at > now()`,
    [hash, purpose]
  )
  const token = rows[0]
  if (!token) return null
  await query(`delete from email_verification_tokens where id = $1`, [token.id])
  return token
}
