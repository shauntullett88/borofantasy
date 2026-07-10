// app/api/sync-squad/route.js
//
// Aggregates all Farnborough players from synced match data and upserts
// them into the players table. Deduplicates by nl_player_id.
//
// POST body: {} (no params needed)
// Response:  { upserted: number, players: PlayerRow[] }

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireAdmin } from '../../../lib/authz'

const NL_API_BASE = 'https://multi-club-matches.football.web.gc.nationalleagueservices.co.uk/v2'
const FARNBOROUGH_TEAM_ID = 't1044'

function mapPosition(nlPosition, nlSubPosition) {
  const pos = (nlSubPosition || nlPosition || '').toLowerCase()
  if (pos === 'goalkeeper') return 'GK'
  if (pos === 'defender') return 'DEF'
  if (pos === 'midfielder') return 'MID'
  if (pos === 'striker' || pos === 'forward') return 'FWD'
  // Fall back to main position
  const main = (nlPosition || '').toLowerCase()
  if (main === 'goalkeeper') return 'GK'
  if (main === 'defender') return 'DEF'
  if (main === 'midfielder') return 'MID'
  if (main === 'striker' || main === 'forward') return 'FWD'
  if (main === 'substitute') {
    // Use sub position
    if (pos.includes('goal')) return 'GK'
    if (pos.includes('defend')) return 'DEF'
    if (pos.includes('mid')) return 'MID'
    if (pos.includes('forward') || pos.includes('striker')) return 'FWD'
  }
  return 'MID' // safe default
}

export async function POST(request) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const matches = await query('select id, nl_match_id from matches where nl_match_id is not null')

    if (!matches?.length) {
      return NextResponse.json({ error: 'No synced matches found — sync fixtures first' }, { status: 400 })
    }

    // Aggregate players across all matches
    const playerMap = {} // nl_player_id → player data

    for (const match of matches) {
      try {
        const res = await fetch(`${NL_API_BASE}/matches/${match.nl_match_id}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) continue

        const json = await res.json()

        // Handle { data: { attributes: {...} } } or flat response
        const attrs = json?.data?.attributes || json?.attributes || json

        // matchTeams can be at attrs level or nested further
        const matchTeams = attrs?.matchTeams || []

        // Find Farnborough team
        const farnTeam = matchTeams.find(
          (t) => t.teamID === FARNBOROUGH_TEAM_ID
        )

        if (!farnTeam) {
          console.log(`Match ${match.nl_match_id}: no Farnborough team found. Keys:`, Object.keys(attrs || {}))
          continue
        }

        // Process starters and subs
        const startPlayers = Array.isArray(farnTeam.players?.Start) ? farnTeam.players.Start
          : Array.isArray(farnTeam.players) ? farnTeam.players.filter(p => p.playerStatus === 'Start')
          : []
        const subPlayers = Array.isArray(farnTeam.players?.Sub) ? farnTeam.players.Sub
          : Array.isArray(farnTeam.players) ? farnTeam.players.filter(p => p.playerStatus === 'Sub')
          : []
        const allPlayers = [...startPlayers, ...subPlayers]

        for (const p of allPlayers) {
          const { playerID, playerName, playerPosition, playerSubPosition } = p
          if (!playerID || !playerName) continue

          const fullName = `${playerName.firstName} ${playerName.lastName}`.trim()
          const position = mapPosition(playerPosition, playerSubPosition)

          // Keep the most informative position seen (prefer non-Substitute)
          if (!playerMap[playerID] || playerPosition !== 'Substitute') {
            playerMap[playerID] = {
              nl_player_id: playerID,
              name: fullName,
              position,
              status: 'active',
            }
          }
        }
      } catch {
        continue // skip failed match fetches
      }
    }

    const players = Object.values(playerMap)

    if (players.length === 0) {
      return NextResponse.json({ error: 'No players found in match data' }, { status: 400 })
    }

    // Match against existing players by NL id first, then by normalised name —
    // players created by the club-website scrape have no nl_player_id yet, and
    // inserting blindly on nl_player_id conflict would duplicate them.
    const existing = await query('select id, name, nl_player_id from players')
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const byNlId = new Map(existing.filter((p) => p.nl_player_id).map((p) => [p.nl_player_id, p]))
    const byName = new Map(existing.map((p) => [norm(p.name), p]))

    let inserted = 0
    let linked = 0
    let updated = 0

    for (const p of players) {
      const idMatch = byNlId.get(p.nl_player_id)
      if (idMatch) {
        await query('update players set name = $1, position = $2 where id = $3', [p.name, p.position, idMatch.id])
        updated++
        continue
      }

      const nameMatch = byName.get(norm(p.name))
      if (nameMatch) {
        // Existing player (likely from the website scrape) — link the NL id
        await query('update players set nl_player_id = $1, position = $2 where id = $3', [p.nl_player_id, p.position, nameMatch.id])
        linked++
        continue
      }

      await query(
        'insert into players (nl_player_id, name, position, status) values ($1, $2, $3, $4)',
        [p.nl_player_id, p.name, p.position, p.status]
      )
      inserted++
    }

    return NextResponse.json({ upserted: players.length, inserted, linked, updated, players })
  } catch (err) {
    console.error('sync-squad error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
