// app/api/scrape-squad-site/route.js
//
// Scrapes the official Farnborough FC men's first-team squad page for player
// names and positions, and upserts them into the players table.
//
// GET  -> preview only (parses the page, returns players, writes nothing)
// POST -> imports: inserts new players, updates positions of existing ones.
//         Non-destructive: never deletes players and never marks anyone "left".
//
// Response (POST): { scraped, inserted, updated, players: [{name, position}] }

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireAdmin } from '../../../lib/authz'
import { parseSquadHtml } from '../../../lib/parseFarnboroughSquad'

const SQUAD_URL = 'https://farnboroughfc.co.uk/teams/mens-first-team/'

async function fetchSquad() {
  const res = await fetch(SQUAD_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; FFLBot/1.0; +https://farnboroughfc.co.uk)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Squad page returned ${res.status}`)
  const html = await res.text()
  return parseSquadHtml(html)
}

export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const players = await fetchSquad()
    return NextResponse.json({ scraped: players.length, players })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const scraped = await fetchSquad()
    if (scraped.length === 0) {
      return NextResponse.json(
        { error: 'No players found on the squad page — the page layout may have changed.' },
        { status: 400 }
      )
    }

    const existing = await query('select id, name, position, status from players')

    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const byName = new Map(existing.map((p) => [norm(p.name), p]))

    let updated = 0
    const toInsert = []

    for (const p of scraped) {
      const match = byName.get(norm(p.name))
      if (match) {
        // Update position only if it changed; leave status untouched.
        if (match.position !== p.position) {
          await query('update players set position = $1 where id = $2', [p.position, match.id])
          updated++
        }
      } else {
        toInsert.push({ name: p.name, position: p.position, status: 'active' })
      }
    }

    for (const p of toInsert) {
      await query('insert into players (name, position, status) values ($1, $2, $3)', [p.name, p.position, p.status])
    }

    return NextResponse.json({
      scraped: scraped.length,
      inserted: toInsert.length,
      updated,
      players: scraped,
    })
  } catch (err) {
    console.error('scrape-squad-site error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
