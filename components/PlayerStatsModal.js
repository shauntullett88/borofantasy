'use client'
import { useEffect, useState } from 'react'
import { calculatePoints } from '../lib/game'
import { POSITION_COLORS } from '../lib/game'

const RESULT_STYLE = {
  W: 'bg-green-800 text-green-300',
  D: 'bg-yellow-800 text-yellow-300',
  L: 'bg-red-900 text-red-300',
}

export default function PlayerStatsModal({ player, isCaptain, isBench, onClose }) {
  const [stats, setStats] = useState([])
  const [matches, setMatches] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!player) return

    async function load() {
      setLoading(true)

      const res = await fetch(`/api/player-stats/${player.id}`)
      const { stats: statsData, matches: matchData } = await res.json()

      const matchMap = {}
      for (const m of (matchData || [])) matchMap[m.id] = m

      setStats(statsData || [])
      setMatches(matchMap)
      setLoading(false)
    }

    load()
  }, [player])

  if (!player) return null

  const posColor = POSITION_COLORS[player.position] || 'bg-gray-600 text-white'

  // Season totals
  const totalGoals = stats.reduce((a, s) => a + (s.goals || 0), 0)
  const totalAssists = stats.reduce((a, s) => a + (s.assists || 0), 0)
  const totalAppearances = stats.filter((s) => s.appearance || s.started || s.sub_on).length
  const totalStarted = stats.filter((s) => s.started).length
  const totalSubOn = stats.filter((s) => s.sub_on).length
  const totalYellow = stats.filter((s) => s.yellow_card).length
  const totalRed = stats.filter((s) => s.red_card).length
  const totalCleanSheets = stats.filter((s) => s.clean_sheet).length

  const totalPoints = stats.reduce((acc, stat) => {
    const match = matches[stat.match_id]
    return acc + calculatePoints(stat, isBench, player.position, isCaptain, match?.result || null)
  }, 0)

  // Sort stats by match date descending
  const sortedStats = [...stats].sort((a, b) => {
    const dateA = matches[a.match_id]?.match_date || ''
    const dateB = matches[b.match_id]?.match_date || ''
    return dateB.localeCompare(dateA)
  }).filter((s) => s.appearance || s.started || s.sub_on || s.goals > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-ffc-dark rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

        {/* Player header */}
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-sm font-bold px-2.5 py-1 rounded ${posColor}`}>
            {player.position}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{player.name}</h2>
              {isCaptain && <span className="text-sm">👑</span>}
            </div>
            <p className="text-xs text-gray-400">{totalAppearances} appearances this season</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-ffc-gold">{totalPoints}</div>
            <div className="text-xs text-gray-400">pts</div>
          </div>
        </div>

        {/* Season stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Goals', value: totalGoals, color: 'text-green-400' },
            { label: 'Assists', value: totalAssists, color: 'text-blue-400' },
            { label: 'Started', value: totalStarted, color: 'text-white' },
            { label: 'Sub on', value: totalSubOn, color: 'text-white' },
            { label: '🟨 Yellow', value: totalYellow, color: 'text-yellow-400' },
            { label: '🟥 Red', value: totalRed, color: 'text-red-400' },
            ...(player.position === 'GK' || player.position === 'DEF'
              ? [{ label: 'Clean sheets', value: totalCleanSheets, color: 'text-sky-400' }]
              : []),
          ].map((item) => (
            <div key={item.label} className="bg-ffc-surface rounded-xl p-2.5 text-center border border-ffc-muted">
              <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-tight">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Points breakdown */}
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Match by Match</h3>

        {loading ? (
          <p className="text-gray-500 text-sm text-center py-4">Loading…</p>
        ) : sortedStats.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No appearances yet</p>
        ) : (
          <div className="space-y-2">
            {sortedStats.map((stat) => {
              const match = matches[stat.match_id]
              if (!match) return null
              const pts = calculatePoints(stat, isBench, player.position, isCaptain, match.result || null)
              const date = new Date(match.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

              return (
                <div key={stat.id} className="bg-ffc-surface rounded-xl px-3 py-2.5 border border-ffc-muted flex items-center gap-3">
                  {/* Result badge */}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${RESULT_STYLE[match.result] || 'bg-gray-700 text-gray-400'}`}>
                    {match.result || '?'}
                  </span>

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {match.home ? 'vs' : '@'} {match.opponent}
                    </div>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {stat.started && <span className="text-xs text-gray-400">Started</span>}
                      {stat.sub_on && <span className="text-xs text-gray-400">Sub on</span>}
                      {stat.goals > 0 && <span className="text-xs text-green-400">⚽ {stat.goals}</span>}
                      {stat.assists > 0 && <span className="text-xs text-blue-400">🅰️ {stat.assists}</span>}
                      {stat.clean_sheet && <span className="text-xs text-sky-400">🧤 CS</span>}
                      {stat.yellow_card && <span className="text-xs text-yellow-400">🟨</span>}
                      {stat.red_card && <span className="text-xs text-red-400">🟥</span>}
                    </div>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-gray-500 shrink-0">{date}</span>

                  {/* Points */}
                  <span className={`text-sm font-bold shrink-0 ${pts >= 0 ? 'text-ffc-gold' : 'text-red-400'}`}>
                    {pts > 0 ? '+' : ''}{pts}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl border border-ffc-muted text-gray-400 text-sm font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  )
}
