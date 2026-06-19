// app/api/sync-match-stats/route.js
//
// Fetches full match data from the National League services API for a given
// match and upserts player stats into player_match_stats.
//
// POST body: { matchId: string, nlMatchId: string }
// Response:  { upserted: number, result: 'W'|'D'|'L', warnings: string[] }

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

const NL_API_BASE = 'https://multi-club-matches.football.web.gc.nationalleagueservices.co.uk/v2'
const FARNBOROUGH_TEAM_ID = 't1044'

async function fetchMatchData(nlMatchId) {
  const res = await fetch(`${NL_API_BASE}/matches/${nlMatchId}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`NL API match fetch failed (${res.status})`)
  const json = await res.json()
  return json.attributes || json.data?.attributes || json
}

function determineResult(matchData) {
  const winnerId = matchData.matchWinnerID
  if (!winnerId) return 'D'
  if (winnerId === FARNBOROUGH_TEAM_ID) return 'W'
  if (winnerId === 'draw' || winnerId === null) return 'D'
  return 'L'
}

function mapPosition(nlPosition) {
  if (!nlPosition) return null
  const p = nlPosition.toLowerCase()
  if (p === 'goalkeeper') return 'GK'
  if (p === 'defender') return 'DEF'
  if (p === 'midfielder') return 'MID'
  if (p === 'striker' || p === 'forward') return 'FWD'
  return null
}

export async function POST(request) {
  try {
    const { matchId, nlMatchId } = await request.json()

    if (!matchId || !nlMatchId) {
      return NextResponse.json({ error: 'matchId and nlMatchId are required' }, { status: 400 })
    }

    const matchData = await fetchMatchData(nlMatchId)
    const db = supabaseAdmin()
    const warnings = []

    // Find Farnborough's team data in matchTeams
    const farnTeam = (matchData.matchTeams || []).find(
      (t) => t.teamID === FARNBOROUGH_TEAM_ID
    )
    if (!farnTeam) throw new Error('Farnborough team data not found in match response')

    // Determine result
    const result = determineResult(matchData)

    // Update match result in DB
    await db.from('matches').update({ result }).eq('id', matchId)

    // Get all players from DB with their nl_player_id
    const { data: dbPlayers } = await db.from('players').select('id, name, position, nl_player_id')

    // Build lookup: nl_player_id → db player
    const playerByNlId = {}
    const playerByName = {}
    for (const p of (dbPlayers || [])) {
      if (p.nl_player_id) playerByNlId[p.nl_player_id] = p
      playerByName[p.name.toLowerCase()] = p
    }

    // Helper to find a DB player from NL player data
    function findPlayer(nlPlayerId, firstName, lastName) {
      // Try by NL ID first
      if (playerByNlId[nlPlayerId]) return playerByNlId[nlPlayerId]
      // Fall back to name matching
      const fullName = `${firstName} ${lastName}`.toLowerCase()
      if (playerByName[fullName]) {
        // Auto-link nl_player_id for future syncs
        const dbPlayer = playerByName[fullName]
        db.from('players').update({ nl_player_id: nlPlayerId }).eq('id', dbPlayer.id)
        return dbPlayer
      }
      return null
    }

    // Build stats map: dbPlayerId → stat object
    const statsMap = {}

    function ensureStat(dbPlayer) {
      if (!statsMap[dbPlayer.id]) {
        statsMap[dbPlayer.id] = {
          match_id: matchId,
          player_id: dbPlayer.id,
          appearance: false,
          played90: false,
          started: false,
          sub_on: false,
          goals: 0,
          assists: 0,
          clean_sheet: false,
          yellow_card: false,
          red_card: false,
        }
      }
      return statsMap[dbPlayer.id]
    }

    // ── Starters ──
    for (const p of (farnTeam.players?.Start || [])) {
      const { playerID, playerName } = p
      const dbPlayer = findPlayer(playerID, playerName.firstName, playerName.lastName)
      if (!dbPlayer) {
        warnings.push(`Starter not found in DB: ${playerName.firstName} ${playerName.lastName}`)
        continue
      }
      const stat = ensureStat(dbPlayer)
      stat.started = true
      stat.appearance = true
      stat.played90 = true // assume played 90 unless subbed off (corrected below)
    }

    // ── Subs on bench (listed but didn't necessarily play) ──
    // We don't mark these as appearance yet — only if they actually came on

    // ── Substitutions made ──
    const subbedOffIds = new Set()
    for (const sub of (farnTeam.events?.subs || [])) {
      const { substitutionEvents } = sub
      if (!substitutionEvents) continue

      const { subOnID, subOffID, subOnPlayer, subOffPlayer } = substitutionEvents

      // Player coming ON
      const subOnName = subOnPlayer?.playerName
      if (subOnName) {
        const dbPlayer = findPlayer(subOnID, subOnName.firstName, subOnName.lastName)
        if (dbPlayer) {
          const stat = ensureStat(dbPlayer)
          stat.sub_on = true
          stat.appearance = true
        } else {
          warnings.push(`Sub on not found in DB: ${subOnName.firstName} ${subOnName.lastName}`)
        }
      }

      // Player coming OFF — mark as not played 90
      const subOffName = subOffPlayer?.playerName
      if (subOffName) {
        const dbPlayer = findPlayer(subOffID, subOffName.firstName, subOffName.lastName)
        if (dbPlayer) {
          subbedOffIds.add(dbPlayer.id)
          if (statsMap[dbPlayer.id]) statsMap[dbPlayer.id].played90 = false
        }
      }
    }

    // ── Goals ──
    for (const goal of (farnTeam.events?.goals || [])) {
      const { goalEvents } = goal
      if (!goalEvents) continue
      const { playerID, player } = goalEvents
      const name = player?.playerName
      if (!name) continue
      const dbPlayer = findPlayer(playerID, name.firstName, name.lastName)
      if (dbPlayer) {
        ensureStat(dbPlayer).goals += 1
      } else {
        warnings.push(`Goal scorer not found in DB: ${name.firstName} ${name.lastName}`)
      }
    }

    // ── Bookings ──
    for (const booking of (farnTeam.events?.bookings || [])) {
      const { bookingEvents } = booking
      if (!bookingEvents) continue
      const { playerID, card, player } = bookingEvents
      const name = player?.playerName
      if (!name) continue
      const dbPlayer = findPlayer(playerID, name.firstName, name.lastName)
      if (dbPlayer) {
        const stat = ensureStat(dbPlayer)
        if (card === 'Yellow') stat.yellow_card = true
        if (card === 'Red' || card === 'RedAfterYellow') stat.red_card = true
      } else {
        warnings.push(`Booked player not found in DB: ${name.firstName} ${name.lastName}`)
      }
    }

    // ── Clean sheet ──
    // Farnborough kept a clean sheet if the home team scored 0
    const homeTeamId = matchData.homeTeamID
    const farnIsHome = homeTeamId === FARNBOROUGH_TEAM_ID
    const opponentTeam = (matchData.matchTeams || []).find(
      (t) => t.teamID !== FARNBOROUGH_TEAM_ID
    )
    const opponentScore = opponentTeam?.score ?? 1
    const cleanSheet = opponentScore === 0

    if (cleanSheet) {
      for (const [playerId, stat] of Object.entries(statsMap)) {
        const dbPlayer = dbPlayers.find((p) => p.id === playerId)
        if (dbPlayer && (dbPlayer.position === 'GK' || dbPlayer.position === 'DEF') && stat.appearance) {
          stat.clean_sheet = true
        }
      }
    }

    // ── Upsert to DB ──
    const rows = Object.values(statsMap)
    if (rows.length === 0) {
      return NextResponse.json({ upserted: 0, result, warnings })
    }

    const { error } = await db
      .from('player_match_stats')
      .upsert(rows, { onConflict: 'match_id,player_id' })

    if (error) throw new Error(error.message)

    return NextResponse.json({ upserted: rows.length, result, warnings })
  } catch (err) {
    console.error('sync-match-stats error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
