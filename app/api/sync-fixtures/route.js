// app/api/sync-fixtures/route.js
//
// Fetches upcoming Farnborough fixtures from the official National League
// services API and upserts them into the matches table.
//
// POST body: { from?: string, to?: string }  (ISO date strings, optional)
// Response:  { upserted: number, fixtures: MatchRow[] }

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

const NL_API_BASE = 'https://multi-club-matches.football.web.gc.nationalleagueservices.co.uk/v2'
const FARNBOROUGH_TEAM_ID = 't1044'
const COMPETITION_ID = 372
const SEASON_ID = 2025

async function fetchFixtures(from, to) {
  const params = new URLSearchParams({
    seasonID: SEASON_ID,
    competitionID: COMPETITION_ID,
    includePopulatedDates: 'true',
    from: from,
    to: to,
    'page.number': '1',
    'page.size': '50',
  })

  const res = await fetch(`${NL_API_BASE}/matches/?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`NL API fixtures failed (${res.status})`)
  return res.json()
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))

    // Default: sync from today to end of season
    const from = body.from || new Date().toISOString().split('T')[0] + 'T00:00:00Z'
    const to   = body.to   || '2026-05-31T23:59:59Z'

    const data = await fetchFixtures(from, to)
    const db = supabaseAdmin()

    // data is an array of tournament groups, each with a matches array
    const rows = []
    for (const group of (data || [])) {
      for (const match of (group.matches || [])) {
        const isFarnboroughHome = match.home_team?.team_id === FARNBOROUGH_TEAM_ID
        const isFarnboroughAway = match.away_team?.team_id === FARNBOROUGH_TEAM_ID
        if (!isFarnboroughHome && !isFarnboroughAway) continue

        const opponent = isFarnboroughHome
          ? match.away_team?.name
          : match.home_team?.name

        const matchDate = new Date(match.timestamp * 1000).toISOString().split('T')[0]

        rows.push({
          nl_match_id: match.match_id,
          opponent: opponent,
          match_date: matchDate,
          home: isFarnboroughHome,
          result: null, // will be filled in after match
        })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ upserted: 0, fixtures: [] })
    }

    // Upsert on nl_match_id so re-syncing is safe
    const { error } = await db
      .from('matches')
      .upsert(rows, { onConflict: 'nl_match_id', ignoreDuplicates: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({ upserted: rows.length, fixtures: rows })
  } catch (err) {
    console.error('sync-fixtures error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
