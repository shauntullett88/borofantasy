'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import { supabase } from '../../lib/supabase'
import { calculatePoints } from '../../lib/game'
import { DEFAULT_FORMATION, buildSlots } from '../../lib/formations'
import PitchFormation from '../../components/PitchFormation'
import PlayerCard from '../../components/PlayerCard'

export default function MyTeamPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [formation, setFormation] = useState(DEFAULT_FORMATION)
  const [pitchSlots, setPitchSlots] = useState(Array(11).fill(null))
  const [captainId, setCaptainId] = useState(null)
  const [bench, setBench] = useState([])
  const [pointsByPlayer, setPointsByPlayer] = useState({})
  const [totalPoints, setTotalPoints] = useState(0)
  const [hasSquad, setHasSquad] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const fetchSquad = useCallback(async () => {
    if (!user) return
    setFetching(true)

    const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle()
    const savedFormation = settings?.formation || DEFAULT_FORMATION
    setFormation(savedFormation)

    const { data: squadData } = await supabase
      .from('squads')
      .select('*, players(*)')
      .eq('user_id', user.id)

    if (!squadData || squadData.length === 0) {
      setHasSquad(false)
      setFetching(false)
      return
    }
    setHasSquad(true)

    const playerIds = squadData.map((s) => s.player_id)

    const { data: statsData } = await supabase
      .from('player_match_stats')
      .select('*')
      .in('player_id', playerIds)

    // Fetch matches so we can look up result per match_id
    const { data: matches } = await supabase
      .from('matches')
      .select('id, result')

    // Build a match result lookup: matchId → result ('W'|'D'|'L'|null)
    const matchResult = {}
    for (const m of (matches || [])) matchResult[m.id] = m.result

    const pointsMap = {}
    for (const sq of squadData) {
      const player = sq.players
      const thisPlayerStats = statsData?.filter((s) => s.player_id === sq.player_id) || []
      let total = 0
      for (const stat of thisPlayerStats) {
        const result = matchResult[stat.match_id] || null
        total += calculatePoints(stat, sq.is_bench, player.position, sq.is_captain, result)
      }
      pointsMap[sq.player_id] = total
    }

    setPointsByPlayer(pointsMap)
    setTotalPoints(Object.values(pointsMap).reduce((a, b) => a + b, 0))

    const starters = squadData.filter((s) => !s.is_bench)
    const benchRows = squadData.filter((s) => s.is_bench)

    const slotsDef = buildSlots(savedFormation)
    const newPitch = Array(11).fill(null)
    const placed = new Set()

    for (const sq of starters) {
      if (sq.slot_index != null && slotsDef[sq.slot_index] && slotsDef[sq.slot_index].line === sq.players.position && !placed.has(sq.slot_index)) {
        newPitch[sq.slot_index] = sq.players
        placed.add(sq.slot_index)
      }
    }
    for (const sq of starters) {
      if ([...placed].some((i) => newPitch[i]?.id === sq.players.id)) continue
      const openIdx = slotsDef.findIndex((s, i) => s.line === sq.players.position && !newPitch[i])
      if (openIdx !== -1) {
        newPitch[openIdx] = sq.players
        placed.add(openIdx)
      }
    }

    setPitchSlots(newPitch)
    setBench(benchRows.map((s) => s.players))
    const cap = starters.find((s) => s.is_captain)
    setCaptainId(cap?.player_id || null)
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

  const slotsDef = buildSlots(formation)
  const pitchSlotsForDisplay = slotsDef.map((s, i) => ({
    player: pitchSlots[i],
    isCaptain: pitchSlots[i]?.id === captainId,
  }))

  const allUnavailable = [...pitchSlots.filter(Boolean), ...bench].filter((p) => p.status !== 'active')

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{profile?.username || 'My Team'}</h1>
          <p className="text-gray-400 text-sm">2026/27 Season — {formation}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-ffc-gold">{totalPoints}</div>
          <div className="text-xs text-gray-400">total points</div>
        </div>
      </div>

      {!hasSquad ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">⚽</div>
          <h2 className="text-xl font-bold mb-2">No Squad Yet</h2>
          <p className="text-gray-400 text-sm mb-6">Head to Transfers to pick your team</p>
          <button
            onClick={() => router.push('/transfers')}
            className="bg-ffc-red text-white font-bold px-6 py-3 rounded-xl"
            type="button"
          >
            Pick Your Squad
          </button>
        </div>
      ) : (
        <>
          <PitchFormation
            formation={formation}
            slots={pitchSlotsForDisplay}
            showPoints
            pointsByPlayer={pointsByPlayer}
            readOnly
          />

          <div className="bg-ffc-muted/40 rounded-2xl p-4 border border-ffc-muted mt-4">
            <div className="text-center text-xs text-gray-400 font-semibold tracking-widest uppercase mb-3">Bench</div>
            <div className="grid grid-cols-1 gap-2">
              {bench.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isCaptain={false}
                  showPoints
                  points={pointsByPlayer[player.id]}
                  compact
                />
              ))}
            </div>
          </div>

          {allUnavailable.length > 0 && (
            <div className="mt-4 bg-red-900/40 border border-red-700 rounded-xl p-3 text-sm text-red-300">
              ⚠️ You have unavailable players. Replace them in the next transfer window.
            </div>
          )}
        </>
      )}
    </div>
  )
}
