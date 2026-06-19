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
const SEASON_ID = 2025 // NL uses the season start year

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

    // Default: sync the full 2025/26 season (August 2025 → May 2026)
    // plus upcoming 2026/27 fixtures
    const from = body.from || '2025-08-01T00:00:00Z'
    const to   = body.to   || '2027-05-31T23:59:59Z'

    const raw = await fetchFixtures(from, to)
    const db = supabaseAdmin()

    // Handle various response shapes:
    // - array of tournament groups (expected)
    // - { data: [...] }
    // - { matches: [...] }
    // - single object with matches
    // The NL API returns { data: [ {type, id, attributes}, ... ], meta, links }
    // Each item in data has attributes containing the match info
    const matchItems = Array.isArray(raw) ? raw
      : Array.isArray(raw?.data) ? raw.data
      : []

    // Debug: log first item shape to Vercel logs
    if (matchItems.length > 0) {
      const sample = matchItems[0]
      const attrs = sample?.attributes || sample
      console.log('NL API sample item keys:', Object.keys(attrs || {}))
      console.log('NL API homeTeamID:', attrs?.homeTeamID, 'awayTeamID:', attrs?.awayTeamID)
      console.log('NL API homeTeam:', JSON.stringify(attrs?.homeTeam)?.slice(0, 100))
    } else {
      console.log('NL API returned 0 items. Raw keys:', Object.keys(raw || {}))
      console.log('Raw sample:', JSON.stringify(raw).slice(0, 500))
    }

    const rows = []
    for (const item of matchItems) {
      // Support both flat match objects and nested attributes
      const match = item?.attributes || item

      const homeTeamId = match.homeTeamID || match.home_team?.team_id
      const awayTeamId = match.awayTeamID || match.away_team?.team_id
      const isFarnboroughHome = homeTeamId === FARNBOROUGH_TEAM_ID
      const isFarnboroughAway = awayTeamId === FARNBOROUGH_TEAM_ID
      if (!isFarnboroughHome && !isFarnboroughAway) continue

      const opponent = isFarnboroughHome
        ? (match.awayTeam?.teamName || match.away_team?.name)
        : (match.homeTeam?.teamName || match.home_team?.name)

      // kickOffUTC is "2026-04-25 11:30:00" or timestamp in seconds
      let matchDate
      if (match.kickOffUTC) {
        matchDate = match.kickOffUTC.split(' ')[0]
      } else if (match.timestamp) {
        matchDate = new Date(match.timestamp * 1000).toISOString().split('T')[0]
      } else {
        continue
      }

      const nlMatchId = match.matchID || item.id || match.match_id

      rows.push({
        nl_match_id: nlMatchId,
        opponent: opponent,
        match_date: matchDate,
        home: isFarnboroughHome,
        result: null,
      })
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
