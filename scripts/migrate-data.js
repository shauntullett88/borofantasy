// One-off data migration: Supabase Postgres -> Azure Postgres.
// Usage: SUPABASE_DIRECT_URL=... DATABASE_URL=... node scripts/migrate-data.js
//
// Copies profiles+auth.users -> users (password_hash left NULL), and players
// as-is. Generates a password-reset token per migrated user and writes
// scripts/reset-tokens.json (gitignored) for the follow-up email step.

const { Pool } = require('pg')
const crypto = require('crypto')
const fs = require('fs')

async function main() {
  const source = new Pool({ connectionString: process.env.SUPABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
  const target = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } })

  try {
    const { rows: profiles } = await source.query(`
      select p.id, p.username, p.team_name, p.email, p.is_admin, p.created_at, u.email_confirmed_at
      from profiles p
      join auth.users u on u.id = p.id
    `)
    const { rows: players } = await source.query(`
      select id, name, position, status, nl_player_id, created_at from players
    `)

    console.log(`Fetched ${profiles.length} users, ${players.length} players from Supabase.`)

    const resetTokens = []

    for (const p of profiles) {
      await target.query(
        `insert into users (id, username, team_name, email, is_admin, email_verified_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do nothing`,
        [p.id, p.username, p.team_name, p.email, p.is_admin, p.email_confirmed_at, p.created_at]
      )

      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) // 14 days

      await target.query(
        `insert into email_verification_tokens (user_id, token_hash, purpose, expires_at)
         values ($1, $2, 'password_reset', $3)`,
        [p.id, tokenHash, expiresAt]
      )

      resetTokens.push({ email: p.email, username: p.username, token: rawToken })
    }

    for (const pl of players) {
      await target.query(
        `insert into players (id, name, position, status, nl_player_id, created_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [pl.id, pl.name, pl.position, pl.status, pl.nl_player_id, pl.created_at]
      )
    }

    fs.writeFileSync('scripts/reset-tokens.json', JSON.stringify(resetTokens, null, 2))
    console.log(`Migrated ${profiles.length} users and ${players.length} players.`)
    console.log('Password-reset tokens written to scripts/reset-tokens.json (send these via email, then delete the file).')
  } finally {
    await source.end()
    await target.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
