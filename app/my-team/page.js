'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import { supabase } from '../../lib/supabase'
import { calculatePoints } from '../../lib/game'
import PlayerCard from '../../components/PlayerCard'

export default function MyTeamPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [squad, setSquad] = useState(null)
  const [totalPoints, setTotalPoints] = useState(0)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const fetchSquad = useCallback(async () => {
    if (!user) return
    setFetching(true)

    // Get user's squad
    const { data: squadData } = await supabase
      .from('squads')
      .select('*, players(*)')
      .eq('user_id', user.id)

    if (!squadData || squadData.length === 0) {
      setSquad(null)
      setFetching(false)
      return
    }

    // Get all match stats for these players
    const playerIds = squadData.map((s) => s.player_id)
    const { data: statsData } = await supabase
      .from('player_match_stats')
      .select('*')
      .in('player_id', playerIds)

    // Calculate total points per player
    const pointsByPlayer = {}
    for (const sq of squadData) {
      const player = sq.players
      const thisPlayerStats = statsData?.filter((s) => s.player_id === sq.player_id) || []
      let total = 0
      for (const stat of thisPlayerStats) {
        total += calculatePoints(stat, sq.is_bench, player.position, sq.is_captain)
      }
      pointsByPlayer[sq.player_id] = total
    }

    const starters = squadData.filter((s) => !s.is_bench)
    const bench = squadData.filter((s) => s.is_bench)

    setSquad({ starters, bench, pointsByPlayer })
    setTotalPoints(Object.values(pointsByPlayer).reduce((a, b) => a + b, 0))
    setFetching(false)
  }, [user])

  useEffect(() => {
    if (user) fetchSquad()
  }, [user, fetchSquad])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading your team…</div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{profile?.username || 'My Team'}</h1>
          <p className="text-gray-400 text-sm">2026/27 Season</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-ffc-gold">{totalPoints}</div>
          <div className="text-xs text-gray-400">total points</div>
        </div>
      </div>

      {!squad ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">⚽</div>
          <h2 className="text-xl font-bold mb-2">No Squad Yet</h2>
          <p className="text-gray-400 text-sm mb-6">Head to Transfers to pick your team</p>
          <button
            onClick={() => router.push('/transfers')}
            className="bg-ffc-red text-white font-bold px-6 py-3 rounded-xl"
          >
            Pick Your Squad
          </button>
        </div>
      ) : (
        <>
          {/* Pitch visual */}
          <div className="bg-ffc-pitch rounded-2xl p-4 mb-6 border border-ffc-pitch-light">
            <div className="text-center text-xs text-green-300 font-semibold tracking-widest uppercase mb-3">Starting XI</div>
            <div className="grid grid-cols-1 gap-2">
              {squad.starters.map((sq) => (
                <PlayerCard
                  key={sq.player_id}
                  player={sq.players}
                  isCaptain={sq.is_captain}
                  showPoints
                  points={squad.pointsByPlayer[sq.player_id]}
                  compact
                />
              ))}
            </div>
          </div>

          {/* Bench */}
          <div className="bg-ffc-muted/40 rounded-2xl p-4 border border-ffc-muted">
            <div className="text-center text-xs text-gray-400 font-semibold tracking-widest uppercase mb-3">Bench</div>
            <div className="grid grid-cols-1 gap-2">
              {squad.bench.map((sq) => (
                <PlayerCard
                  key={sq.player_id}
                  player={sq.players}
                  isCaptain={false}
                  showPoints
                  points={squad.pointsByPlayer[sq.player_id]}
                  compact
                />
              ))}
            </div>
          </div>

          {/* Alert for unavailable players */}
          {[...squad.starters, ...squad.bench].some((sq) => sq.players.status !== 'active') && (
            <div className="mt-4 bg-red-900/40 border border-red-700 rounded-xl p-3 text-sm text-red-300">
              ⚠️ You have unavailable players. Replace them in the next transfer window.
            </div>
          )}
        </>
      )}
    </div>
  )
}
