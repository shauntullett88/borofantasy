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
import { supabaseAdmin } from '../../../lib/supabase'
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
  try {
    const players = await fetchSquad()
    return NextResponse.json({ scraped: players.length, players })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const scraped = await fetchSquad()
    if (scraped.length === 0) {
      return NextResponse.json(
        { error: 'No players found on the squad page — the page layout may have changed.' },
        { status: 400 }
      )
    }

    const db = supabaseAdmin()
    const { data: existing, error: readErr } = await db
      .from('players')
      .select('id, name, position, status')
    if (readErr) throw new Error(readErr.message)

    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const byName = new Map((existing || []).map((p) => [norm(p.name), p]))

    let updated = 0
    const toInsert = []

    for (const p of scraped) {
      const match = byName.get(norm(p.name))
      if (match) {
        // Update position only if it changed; leave status untouched.
        if (match.position !== p.position) {
          const { error } = await db.from('players').update({ position: p.position }).eq('id', match.id)
          if (error) throw new Error(error.message)
          updated++
        }
      } else {
        toInsert.push({ name: p.name, position: p.position, status: 'active' })
      }
    }

    if (toInsert.length > 0) {
      const { error } = await db.from('players').insert(toInsert)
      if (error) throw new Error(error.message)
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
