// app/api/sync-fixtures/route.js
//
// Fetches upcoming Farnborough fixtures from the official National League
// services API and upserts them into the matches table.
//
// POST body: { from?: string, to?: string }  (ISO date strings, optional)
// Response:  { upserted: number, fixtures: MatchRow[] }

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireAdmin } from '../../../lib/authz'

const NL_API_BASE = 'https://multi-club-matches.football.web.gc.nationalleagueservices.co.uk/v2'
const FARNBOROUGH_TEAM_ID = 't1044'
const COMPETITION_ID = 372
const SEASON_ID = 2025 // NL uses the season start year

async function fetchFixtures(from, to, page = 1, pageSize = 100) {
  const params = new URLSearchParams({
    seasonID: SEASON_ID,
    competitionID: COMPETITION_ID,
    includePopulatedDates: 'true',
    from: from,
    to: to,
    'page.number': String(page),
    'page.size': String(pageSize),
  })

  const res = await fetch(`${NL_API_BASE}/matches/?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`NL API fixtures failed (${res.status})`)
  return res.json()
}

export async function POST(request) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const body = await request.json().catch(() => ({}))

    // Default: sync full 2025/26 season + upcoming 2026/27 fixtures
    const from = body.from || '2025-08-01T00:00:00Z'
    const to   = body.to   || '2027-05-31T23:59:59Z'
    const page = body.page || 1
    const pageSize = body.pageSize || 100

      // Fetch all pages until we get fewer results than page size
    let allItems = []
    let currentPage = 1
    const size = 100

    while (true) {
      const raw = await fetchFixtures(from, to, currentPage, size)
      const items = Array.isArray(raw) ? raw
        : Array.isArray(raw?.data) ? raw.data
        : []
      allItems = [...allItems, ...items]
      if (items.length < size) break // no more pages
      currentPage++
      if (currentPage > 10) break // safety limit
    }

    const raw = { data: allItems } // normalise for parser below

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

      // Teams are nested as homeTeam.teamID / awayTeam.teamID
      const homeTeamId = match.homeTeam?.teamID || match.homeTeamID
      const awayTeamId = match.awayTeam?.teamID || match.awayTeamID
      const isFarnboroughHome = homeTeamId === FARNBOROUGH_TEAM_ID
      const isFarnboroughAway = awayTeamId === FARNBOROUGH_TEAM_ID
      if (!isFarnboroughHome && !isFarnboroughAway) continue

      const opponent = isFarnboroughHome
        ? (match.awayTeam?.teamName || match.awayTeam?.name)
        : (match.homeTeam?.teamName || match.homeTeam?.name)

      // Date field is kickOffDateUTC e.g. "2026-04-25T11:30:00Z" or "2026-04-25 11:30:00"
      let matchDate
      if (match.kickOffDateUTC) {
        matchDate = match.kickOffDateUTC.split('T')[0].split(' ')[0]
      } else if (match.kickOffUTC) {
        matchDate = match.kickOffUTC.split('T')[0].split(' ')[0]
      } else if (match.timestamp) {
        matchDate = new Date(match.timestamp * 1000).toISOString().split('T')[0]
      } else {
        continue
      }

      const nlMatchId = item.id || match.matchID || match.match_id

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
    for (const r of rows) {
      await query(
        `insert into matches (nl_match_id, opponent, match_date, home, result)
         values ($1, $2, $3, $4, $5)
         on conflict (nl_match_id) do update set
           opponent = excluded.opponent, match_date = excluded.match_date, home = excluded.home`,
        [r.nl_match_id, r.opponent, r.match_date, r.home, r.result]
      )
    }

    return NextResponse.json({ upserted: rows.length, fixtures: rows })
  } catch (err) {
    console.error('sync-fixtures error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
