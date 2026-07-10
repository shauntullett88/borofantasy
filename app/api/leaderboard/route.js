import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { requireUser } from '../../../lib/authz'
import { calculatePoints } from '../../../lib/game'

export async function GET() {
  const { error } = await requireUser()
  if (error) return error

  const squads = await query(`
    select s.user_id, s.player_id, s.is_bench, s.is_captain, p.position
    from squads s
    join players p on p.id = s.player_id
  `)
  const allStats = await query('select * from player_match_stats')
  const matches = await query('select id, result from matches')
  const users = await query('select id, username, team_name from users')

  const matchResult = {}
  for (const m of matches) matchResult[m.id] = m.result

  const byUser = {}
  for (const sq of squads) {
    if (!byUser[sq.user_id]) byUser[sq.user_id] = []
    byUser[sq.user_id].push(sq)
  }

  const leaderboard = users.map((u) => {
    const userSquad = byUser[u.id] || []
    let totalPoints = 0

    for (const sq of userSquad) {
      const playerStats = allStats.filter((s) => s.player_id === sq.player_id)
      for (const stat of playerStats) {
        const result = matchResult[stat.match_id] || null
        totalPoints += calculatePoints(stat, sq.is_bench, sq.position, sq.is_captain, result)
      }
    }

    return { userId: u.id, username: u.username, teamName: u.team_name, points: totalPoints }
  })

  leaderboard.sort((a, b) => b.points - a.points)

  return NextResponse.json({ entries: leaderboard })
}
