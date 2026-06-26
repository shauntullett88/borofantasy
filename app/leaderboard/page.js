'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import { supabase } from '../../lib/supabase'
import { calculatePoints } from '../../lib/game'

export default function LeaderboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    async function fetchLeaderboard() {
      setFetching(true)

      const { data: squads } = await supabase
        .from('squads')
        .select('user_id, player_id, is_bench, is_captain, players(*)')

      const { data: allStats } = await supabase
        .from('player_match_stats')
        .select('*')

      // Fetch matches so we can look up result per match_id
      const { data: matches } = await supabase
        .from('matches')
        .select('id, result')

      const { data: profiles } = await supabase.from('profiles').select('id, username')

      if (!squads || !profiles) { setFetching(false); return }

      // Build a match result lookup: matchId → result ('W'|'D'|'L'|null)
      const matchResult = {}
      for (const m of (matches || [])) matchResult[m.id] = m.result

      // Group squads by user
      const byUser = {}
      for (const sq of squads) {
        if (!byUser[sq.user_id]) byUser[sq.user_id] = []
        byUser[sq.user_id].push(sq)
      }

      const leaderboard = profiles.map((profile) => {
        const userSquad = byUser[profile.id] || []
        let totalPoints = 0

        for (const sq of userSquad) {
          const player = sq.players
          const playerStats = allStats?.filter((s) => s.player_id === sq.player_id) || []
          for (const stat of playerStats) {
            const result = matchResult[stat.match_id] || null
            totalPoints += calculatePoints(stat, sq.is_bench, player?.position, sq.is_captain, result)
          }
        }

        return { userId: profile.id, username: profile.username, points: totalPoints }
      })

      leaderboard.sort((a, b) => b.points - a.points)
      setEntries(leaderboard)
      setFetching(false)
    }

    fetchLeaderboard()
  }, [user])

  if (loading || fetching) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading table…</div></div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-gray-400 text-sm">2026/27 Season</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-gray-400">No scores yet. Stats will appear here once matches are entered.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const isMe = entry.userId === user?.id
            const isTop = idx === 0

            return (
              <div
                key={entry.userId}
                className={`flex items-center gap-4 rounded-2xl px-4 py-3 border transition-all ${
                  isTop
                    ? 'bg-ffc-gold/[0.04] border-ffc-gold/40'
                    : isMe
                    ? 'bg-ffc-red/10 border-ffc-red'
                    : 'bg-ffc-surface border-ffc-muted'
                }`}
              >
                <div className="w-8 text-center">
                  <span className={`font-bold text-sm ${isTop ? 'text-white' : 'text-gray-400'}`}>{idx + 1}</span>
                </div>

                <div className="flex-1">
                  <span className={`font-semibold ${isMe ? 'text-red-300' : 'text-white'}`}>
                    {entry.username}
                  </span>
                  {isMe && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                </div>

                <div className="text-right">
                  <span className="text-xl font-bold text-white">
                    {entry.points}
                  </span>
                  <span className="text-gray-400 text-xs ml-1">pts</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
