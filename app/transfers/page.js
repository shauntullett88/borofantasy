'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import { supabase } from '../../lib/supabase'
import { isTransferWindowOpen, validateSquad, POSITIONS, POSITION_COLORS } from '../../lib/game'
import PlayerCard from '../../components/PlayerCard'

const STATUS_BADGE = {
  active: null,
  injured: { label: 'INJ', cls: 'bg-yellow-500 text-black' },
  left: { label: 'LEFT', cls: 'bg-red-600 text-white' },
}

export default function TransfersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const windowOpen = isTransferWindowOpen()

  const [players, setPlayers] = useState([])
  const [starters, setStarters] = useState([])
  const [bench, setBench] = useState([])
  const [captainId, setCaptainId] = useState(null)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const fetchData = useCallback(async () => {
    if (!user) return
    const { data: allPlayers } = await supabase.from('players').select('*').order('name')
    setPlayers(allPlayers || [])

    const { data: squadData } = await supabase
      .from('squads')
      .select('*, players(*)')
      .eq('user_id', user.id)

    if (squadData?.length > 0) {
      setStarters(squadData.filter((s) => !s.is_bench).map((s) => s.players))
      setBench(squadData.filter((s) => s.is_bench).map((s) => s.players))
      const cap = squadData.find((s) => s.is_captain)
      setCaptainId(cap?.player_id || null)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  const allSelected = [...starters, ...bench]
  const selectedIds = new Set(allSelected.map((p) => p.id))

  const filtered = players.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchPos = posFilter === 'ALL' || p.position === posFilter
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
    return matchSearch && matchPos && matchStatus
  })

  function addPlayer(player) {
    if (selectedIds.has(player.id)) return
    if (starters.length < 11) {
      setStarters((prev) => [...prev, player])
    } else if (bench.length < 3) {
      setBench((prev) => [...prev, player])
    }
  }

  function removePlayer(playerId) {
    setStarters((prev) => prev.filter((p) => p.id !== playerId))
    setBench((prev) => prev.filter((p) => p.id !== playerId))
    if (captainId === playerId) setCaptainId(null)
  }

  function moveToBench(playerId) {
    const player = starters.find((p) => p.id === playerId)
    if (!player || bench.length >= 3) return
    setStarters((prev) => prev.filter((p) => p.id !== playerId))
    setBench((prev) => [...prev, player])
    if (captainId === playerId) setCaptainId(null)
  }

  function moveToStart(playerId) {
    const player = bench.find((p) => p.id === playerId)
    if (!player || starters.length >= 11) return
    setBench((prev) => prev.filter((p) => p.id !== playerId))
    setStarters((prev) => [...prev, player])
  }

  async function saveSquad() {
    const errs = validateSquad(starters, bench, captainId)
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setSaving(true)

    // Delete existing squad
    await supabase.from('squads').delete().eq('user_id', user.id)

    // Insert new
    const rows = [
      ...starters.map((p) => ({
        user_id: user.id,
        player_id: p.id,
        is_bench: false,
        is_captain: p.id === captainId,
      })),
      ...bench.map((p) => ({
        user_id: user.id,
        player_id: p.id,
        is_bench: true,
        is_captain: false,
      })),
    ]

    const { error } = await supabase.from('squads').insert(rows)
    if (error) {
      setErrors(['Failed to save squad. Please try again.'])
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading…</div></div>

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <h1 className="text-2xl font-bold mb-1">Transfers</h1>
      <p className="text-gray-400 text-sm mb-4">
        {windowOpen ? 'Window is open — build your squad' : 'Window closed — you can preview but not save'}
      </p>

      {/* Current squad summary */}
      <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-gray-400">Starting XI</span>
          <span className={starters.length === 11 ? 'text-green-400' : 'text-ffc-gold'}>{starters.length}/11</span>
        </div>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-gray-400">Bench</span>
          <span className={bench.length === 3 ? 'text-green-400' : 'text-ffc-gold'}>{bench.length}/3</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Captain</span>
          <span className={captainId ? 'text-ffc-gold' : 'text-red-400'}>
            {captainId ? (allSelected.find((p) => p.id === captainId)?.name || '—') : 'Not set'}
          </span>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 mb-4">
          {errors.map((e, i) => <p key={i} className="text-red-300 text-sm">{e}</p>)}
        </div>
      )}

      {saved && (
        <div className="bg-green-900/40 border border-green-700 rounded-xl p-3 mb-4">
          <p className="text-green-300 text-sm">✅ Squad saved!</p>
        </div>
      )}

      {/* Starters */}
      <div className="bg-ffc-pitch/60 rounded-2xl p-3 border border-ffc-pitch mb-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xs font-bold tracking-widest text-green-300 uppercase">Starting XI</h2>
          <span className="text-xs text-gray-400">{starters.length}/11</span>
        </div>
        {starters.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">Select players below</p>
        ) : (
          <div className="space-y-1.5">
            {starters.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-ffc-surface/60 rounded-lg px-3 py-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position]}`}>{p.position}</span>
                <span className={`flex-1 text-sm ${p.status === 'left' ? 'text-red-400 line-through' : p.status === 'injured' ? 'text-yellow-300' : ''}`}>{p.name}</span>
                {captainId === p.id && <span className="text-xs">👑</span>}
                {STATUS_BADGE[p.status] && (
                  <span className={`text-xs px-1 rounded ${STATUS_BADGE[p.status].cls}`}>{STATUS_BADGE[p.status].label}</span>
                )}
                <div className="flex gap-1">
                  {captainId !== p.id && (
                    <button onClick={() => setCaptainId(p.id)} className="text-xs text-ffc-gold border border-ffc-gold rounded px-1.5 py-0.5">C</button>
                  )}
                  <button onClick={() => moveToBench(p.id)} disabled={bench.length >= 3} className="text-xs text-blue-400 border border-blue-700 rounded px-1.5 py-0.5 disabled:opacity-30">→B</button>
                  <button onClick={() => removePlayer(p.id)} className="text-xs text-red-400 border border-red-800 rounded px-1.5 py-0.5">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bench */}
      <div className="bg-ffc-muted/30 rounded-2xl p-3 border border-ffc-muted mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase">Bench</h2>
          <span className="text-xs text-gray-400">{bench.length}/3</span>
        </div>
        {bench.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">Add up to 3 bench players</p>
        ) : (
          <div className="space-y-1.5">
            {bench.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-ffc-surface/60 rounded-lg px-3 py-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position]}`}>{p.position}</span>
                <span className={`flex-1 text-sm ${p.status === 'left' ? 'text-red-400 line-through' : p.status === 'injured' ? 'text-yellow-300' : ''}`}>{p.name}</span>
                {STATUS_BADGE[p.status] && (
                  <span className={`text-xs px-1 rounded ${STATUS_BADGE[p.status].cls}`}>{STATUS_BADGE[p.status].label}</span>
                )}
                <div className="flex gap-1">
                  <button onClick={() => moveToStart(p.id)} disabled={starters.length >= 11} className="text-xs text-blue-400 border border-blue-700 rounded px-1.5 py-0.5 disabled:opacity-30">→XI</button>
                  <button onClick={() => removePlayer(p.id)} className="text-xs text-red-400 border border-red-800 rounded px-1.5 py-0.5">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={saveSquad}
        disabled={!windowOpen || saving}
        className="w-full bg-ffc-red hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl mb-6 transition-colors"
      >
        {saving ? 'Saving…' : !windowOpen ? '🔒 Window Closed' : 'Save Squad'}
      </button>

      {/* Player picker */}
      <div>
        <h2 className="text-lg font-bold mb-3">All Players</h2>

        {/* Filters */}
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-ffc-surface border border-ffc-muted rounded-xl px-4 py-2.5 text-white placeholder-gray-500 mb-3 focus:outline-none focus:border-ffc-gold text-sm"
        />
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${posFilter === pos ? 'bg-ffc-gold text-black border-ffc-gold' : 'border-ffc-muted text-gray-300'}`}
            >
              {pos}
            </button>
          ))}
          <div className="w-px bg-ffc-muted mx-1" />
          {['ALL', 'active', 'injured', 'left'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${statusFilter === s ? 'bg-white text-black border-white' : 'border-ffc-muted text-gray-300'}`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((player) => {
            const alreadySelected = selectedIds.has(player.id)
            const full = starters.length >= 11 && bench.length >= 3
            return (
              <div key={player.id} className={`flex items-center gap-3 bg-ffc-surface rounded-xl px-3 py-2.5 border ${alreadySelected ? 'border-ffc-pitch opacity-60' : 'border-ffc-muted'}`}>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position]}`}>{player.position}</span>
                <span className={`flex-1 text-sm ${player.status === 'left' ? 'text-red-400 line-through' : player.status === 'injured' ? 'text-yellow-300' : ''}`}>{player.name}</span>
                {STATUS_BADGE[player.status] && (
                  <span className={`text-xs px-1 rounded ${STATUS_BADGE[player.status].cls}`}>{STATUS_BADGE[player.status].label}</span>
                )}
                <button
                  onClick={() => addPlayer(player)}
                  disabled={alreadySelected || player.status !== 'active' || full}
                  className="shrink-0 text-xs bg-ffc-pitch hover:bg-ffc-pitch-light disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  {alreadySelected ? '✓' : player.status !== 'active' ? '—' : 'Add'}
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No players match your filters</p>
          )}
        </div>
      </div>
    </div>
  )
}
