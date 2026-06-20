// app/api/sync-all-stats/route.js
//
// Loops through all matches with an nl_match_id and syncs stats for each.
// Skips matches with no player data (early season without lineups).
//
// POST body: {} 
// Response:  { synced: number, skipped: number, warnings: string[] }

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

const NL_API_BASE = 'https://multi-club-matches.football.web.gc.nationalleagueservices.co.uk/v2'
const FARNBOROUGH_TEAM_ID = 't1044'

function mapPosition(nlPosition, nlSubPosition) {
  const pos = (nlSubPosition || nlPosition || '').toLowerCase()
  if (pos.includes('goal')) return 'GK'
  if (pos.includes('defend')) return 'DEF'
  if (pos.includes('mid')) return 'MID'
  if (pos.includes('forward') || pos.includes('striker')) return 'FWD'
  return 'MID'
}

function determineResult(attrs) {
  const winnerId = attrs.matchWinnerID || attrs.matchWinner?.teamID
  if (!winnerId) {
    // Check scores
    const farnTeam = (attrs.matchTeams || []).find(t => t.teamID === FARNBOROUGH_TEAM_ID)
    const oppTeam = (attrs.matchTeams || []).find(t => t.teamID !== FARNBOROUGH_TEAM_ID)
    if (!farnTeam || !oppTeam) return null
    if (farnTeam.score > oppTeam.score) return 'W'
    if (farnTeam.score < oppTeam.score) return 'L'
    return 'D'
  }
  if (winnerId === FARNBOROUGH_TEAM_ID) return 'W'
  if (winnerId === 'draw') return 'D'
  return 'L'
}

export async function POST(request) {
  try {
    const db = supabaseAdmin()

    // Get all matches with nl_match_id
    const { data: matches, error: matchErr } = await db
      .from('matches')
      .select('id, nl_match_id, opponent, match_date')
      .not('nl_match_id', 'is', null)
      .order('match_date', { ascending: true })

    if (matchErr) throw new Error(matchErr.message)
    if (!matches?.length) {
      return NextResponse.json({ error: 'No synced matches found' }, { status: 400 })
    }

    // Get all players with nl_player_id
    const { data: dbPlayers } = await db.from('players').select('id, name, position, nl_player_id')

    const playerByNlId = {}
    const playerByName = {}
    for (const p of (dbPlayers || [])) {
      if (p.nl_player_id) playerByNlId[p.nl_player_id] = p
      playerByName[p.name.toLowerCase()] = p
    }

    function findPlayer(nlPlayerId, firstName, lastName) {
      if (playerByNlId[nlPlayerId]) return playerByNlId[nlPlayerId]
      const fullName = `${firstName} ${lastName}`.toLowerCase()
      if (playerByName[fullName]) {
        const dbPlayer = playerByName[fullName]
        // Auto-link for future syncs
        db.from('players').update({ nl_player_id: nlPlayerId }).eq('id', dbPlayer.id)
        playerByNlId[nlPlayerId] = dbPlayer
        return dbPlayer
      }
      return null
    }

    let synced = 0
    let skipped = 0
    const allWarnings = []

    for (const match of matches) {
      try {
        const res = await fetch(`${NL_API_BASE}/matches/${match.nl_match_id}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) { skipped++; continue }

        const json = await res.json()
        const attrs = json?.data?.attributes || json?.attributes || json

        const farnTeam = (attrs?.matchTeams || []).find(t => t.teamID === FARNBOROUGH_TEAM_ID)
        if (!farnTeam) { skipped++; continue }

        const startPlayers = Array.isArray(farnTeam.players?.Start) ? farnTeam.players.Start : []
        const subPlayers = Array.isArray(farnTeam.players?.Sub) ? farnTeam.players.Sub : []

        if (startPlayers.length === 0) { skipped++; continue }

        // Determine result
        const result = determineResult(attrs)
        if (result) {
          await db.from('matches').update({ result }).eq('id', match.id)
        }

        // Determine clean sheet
        const oppTeam = (attrs?.matchTeams || []).find(t => t.teamID !== FARNBOROUGH_TEAM_ID)
        const cleanSheet = (oppTeam?.score ?? 1) === 0

        // Build stats map
        const statsMap = {}

        function ensureStat(dbPlayer) {
          if (!statsMap[dbPlayer.id]) {
            statsMap[dbPlayer.id] = {
              match_id: match.id,
              player_id: dbPlayer.id,
              appearance: false, played90: false,
              started: false, sub_on: false,
              goals: 0, assists: 0,
              clean_sheet: false,
              yellow_card: false, red_card: false,
            }
          }
          return statsMap[dbPlayer.id]
        }

        // Starters
        for (const p of startPlayers) {
          const { playerID, playerName } = p
          if (!playerName) continue
          const dbPlayer = findPlayer(playerID, playerName.firstName, playerName.lastName)
          if (!dbPlayer) {
            allWarnings.push(`${match.opponent}: starter not found — ${playerName.firstName} ${playerName.lastName}`)
            continue
          }
          const stat = ensureStat(dbPlayer)
          stat.started = true
          stat.appearance = true
          stat.played90 = true
          if (cleanSheet && (dbPlayer.position === 'GK' || dbPlayer.position === 'DEF')) {
            stat.clean_sheet = true
          }
        }

        // Subs made
        for (const sub of (farnTeam.events?.subs || [])) {
          const { substitutionEvents } = sub
          if (!substitutionEvents) continue
          const { subOnID, subOffID, subOnPlayer, subOffPlayer } = substitutionEvents

          const onName = subOnPlayer?.playerName
          if (onName) {
            const dbPlayer = findPlayer(subOnID, onName.firstName, onName.lastName)
            if (dbPlayer) {
              const stat = ensureStat(dbPlayer)
              stat.sub_on = true
              stat.appearance = true
            }
          }

          const offName = subOffPlayer?.playerName
          if (offName) {
            const dbPlayer = findPlayer(subOffID, offName.firstName, offName.lastName)
            if (dbPlayer && statsMap[dbPlayer.id]) {
              statsMap[dbPlayer.id].played90 = false
            }
          }
        }

        // Goals
        for (const goal of (farnTeam.events?.goals || [])) {
          const { goalEvents } = goal
          if (!goalEvents) continue
          const { playerID, player } = goalEvents
          const name = player?.playerName
          if (!name) continue
          const dbPlayer = findPlayer(playerID, name.firstName, name.lastName)
          if (dbPlayer) ensureStat(dbPlayer).goals += 1
          else allWarnings.push(`${match.opponent}: goal scorer not found — ${name.firstName} ${name.lastName}`)
        }

        // Bookings
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
          }
        }

        // Upsert stats
        const rows = Object.values(statsMap)
        if (rows.length > 0) {
          await db.from('player_match_stats').upsert(rows, { onConflict: 'match_id,player_id' })
        }

        synced++
      } catch {
        skipped++
        continue
      }
    }

    return NextResponse.json({ synced, skipped, warnings: allWarnings })
  } catch (err) {
    console.error('sync-all-stats error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
