import 'server-only'
import { Pool } from 'pg'

let pool

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL env var')
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true },
    })
  }
  return pool
}

export async function query(text, params) {
  const { rows } = await getPool().query(text, params)
  return rows
}

export async function getClient() {
  return getPool().connect()
}

export async function withTransaction(fn) {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
