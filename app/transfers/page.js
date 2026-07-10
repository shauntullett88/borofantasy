'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import { validateSquad, validateFormationSlots, getTransferWindowStatus, POSITION_COLORS } from '../../lib/game'
import { DEFAULT_FORMATION, buildSlots } from '../../lib/formations'
import PitchFormation from '../../components/PitchFormation'
import PlayerPickerModal from '../../components/PlayerPickerModal'

function formatUK(date) {
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

export default function TransfersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const windowStatus = getTransferWindowStatus()
  const windowOpen = windowStatus.open

  const [allPlayers, setAllPlayers] = useState([])
  const [formation, setFormation] = useState(DEFAULT_FORMATION)
  // pitchSlots[i] = player object or null, indexed to match buildSlots(formation)
  const [pitchSlots, setPitchSlots] = useState(Array(11).fill(null))
  const [captainId, setCaptainId] = useState(null)
  const [bench, setBench] = useState([null, null, null])

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState(null) // { type: 'pitch'|'bench', index }

  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const fetchData = useCallback(async () => {
    if (!user) return
    setFetching(true)

    const res = await fetch('/api/squad')
    const { players, formation: savedFormationRaw, squad: squadData } = await res.json()
    setAllPlayers(players || [])

    const savedFormation = savedFormationRaw || DEFAULT_FORMATION
    setFormation(savedFormation)

    if (squadData?.length > 0) {
      const slots = buildSlots(savedFormation)
      const newPitch = Array(11).fill(null)
      const newBench = [null, null, null]

      const starters = squadData.filter((s) => !s.is_bench)
      const benchRows = squadData.filter((s) => s.is_bench)

      // Place starters: prefer stored slot_index if it still fits the formation's line for that position
      const placed = new Set()
      for (const sq of starters) {
        if (sq.slot_index != null && slots[sq.slot_index] && slots[sq.slot_index].line === sq.players.position && !placed.has(sq.slot_index)) {
          newPitch[sq.slot_index] = sq.players
          placed.add(sq.slot_index)
        }
      }
      // Place any starters that didn't get a valid stored slot into the first open matching slot
      for (const sq of starters) {
        if ([...placed].some((i) => newPitch[i]?.id === sq.players.id)) continue
        const openIdx = slots.findIndex((s, i) => s.line === sq.players.position && !newPitch[i])
        if (openIdx !== -1) {
          newPitch[openIdx] = sq.players
          placed.add(openIdx)
        }
      }

      benchRows.forEach((sq, i) => { if (i < 3) newBench[i] = sq.players })

      setPitchSlots(newPitch)
      setBench(newBench)
      const cap = starters.find((s) => s.is_captain)
      setCaptainId(cap?.player_id || null)
    }

    setFetching(false)
  }, [user])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  const slots = buildSlots(formation)
  const selectedIds = new Set([...pitchSlots.filter(Boolean).map((p) => p.id), ...bench.filter(Boolean).map((p) => p.id)])

  function changeFormation(newFormation) {
    const newSlots = buildSlots(newFormation)
    const newPitch = Array(11).fill(null)
    const displaced = []

    // Re-place every currently-selected starter into the first open slot
    // in the new formation that matches their position.
    const currentPlayers = pitchSlots.filter(Boolean)
    const used = new Set()
    for (const player of currentPlayers) {
      const idx = newSlots.findIndex((s, i) => s.line === player.position && !used.has(i))
      if (idx !== -1) {
        newPitch[idx] = player
        used.add(idx)
      } else {
        displaced.push(player)
      }
    }

    setFormation(newFormation)
    setPitchSlots(newPitch)
    if (displaced.length > 0) {
      setErrors([`${displaced.map((p) => p.name).join(', ')} don't fit the new formation and were removed. Re-add them from the bench or player list.`])
    } else {
      setErrors([])
    }
    if (captainId && !newPitch.some((p) => p?.id === captainId)) {
      setCaptainId(null)
    }
  }

  function openPickerForPitch(slotIndex) {
    setPickerTarget({ type: 'pitch', index: slotIndex })
    setPickerOpen(true)
  }

  function openPickerForBench(benchIndex) {
    setPickerTarget({ type: 'bench', index: benchIndex })
    setPickerOpen(true)
  }

  function handleRemoveFromSlot(target) {
    if (target.type === 'pitch') {
      const removed = pitchSlots[target.index]
      const next = [...pitchSlots]
      next[target.index] = null
      setPitchSlots(next)
      if (removed && captainId === removed.id) setCaptainId(null)
    } else {
      const next = [...bench]
      next[target.index] = null
      setBench(next)
    }
  }

  function handlePick(player) {
    if (!pickerTarget) return
    if (pickerTarget.type === 'pitch') {
      const next = [...pitchSlots]
      next[pickerTarget.index] = player
      setPitchSlots(next)
    } else {
      const next = [...bench]
      next[pickerTarget.index] = player
      setBench(next)
    }
    setPickerOpen(false)
    setPickerTarget(null)
  }

  function eligiblePlayersForTarget() {
    if (!pickerTarget) return []
    if (pickerTarget.type === 'pitch') {
      const requiredLine = slots[pickerTarget.index]?.line
      return allPlayers.filter((p) => p.position === requiredLine && p.status === 'active' && !selectedIds.has(p.id))
    }
    // Bench accepts any position
    return allPlayers.filter((p) => p.status === 'active' && !selectedIds.has(p.id))
  }

  async function saveSquad() {
    const starters = pitchSlots.filter(Boolean)
    const benchPlayers = bench.filter(Boolean)
    const errs = [
      ...validateSquad(starters, benchPlayers, captainId),
      ...validateFormationSlots(pitchSlots, slots),
    ]
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setSaving(true)

    const rows = [
      ...pitchSlots.map((player, idx) => player ? {
        player_id: player.id,
        is_bench: false,
        is_captain: player.id === captainId,
        slot_index: idx,
      } : null).filter(Boolean),
      ...bench.map((player) => player ? {
        player_id: player.id,
        is_bench: true,
        is_captain: false,
        slot_index: null,
      } : null).filter(Boolean),
    ]

    const res = await fetch('/api/squad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formation, rows }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setErrors([json.error || 'Failed to save squad. Please try again.'])
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const requiredLineForPicker = pickerTarget?.type === 'pitch' ? slots[pickerTarget.index]?.line : 'Any'
  const pitchSlotsForDisplay = slots.map((s, i) => ({
    player: pitchSlots[i],
    isCaptain: pitchSlots[i]?.id === captainId,
  }))

  if (loading || fetching) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading…</div></div>
  }

  const startersFilled = pitchSlots.filter(Boolean).length
  const benchFilled = bench.filter(Boolean).length

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <h1 className="text-2xl font-bold mb-1">Transfers</h1>
      <p className="text-gray-400 text-sm mb-4">
        {windowOpen
          ? `Window is open — closes ${formatUK(windowStatus.closesAt)} (UK time)`
          : 'Window closed — you can preview but not save'}
      </p>

      {/* Status row */}
      <div className="flex gap-3 mb-4 text-sm">
        <div className="flex-1 bg-ffc-surface rounded-xl p-3 border border-ffc-muted text-center">
          <div className={startersFilled === 11 ? 'text-green-400 font-bold' : 'text-ffc-gold font-bold'}>{startersFilled}/11</div>
          <div className="text-xs text-gray-400">Starting XI</div>
        </div>
        <div className="flex-1 bg-ffc-surface rounded-xl p-3 border border-ffc-muted text-center">
          <div className={benchFilled === 3 ? 'text-green-400 font-bold' : 'text-ffc-gold font-bold'}>{benchFilled}/3</div>
          <div className="text-xs text-gray-400">Bench</div>
        </div>
        <div className="flex-1 bg-ffc-surface rounded-xl p-3 border border-ffc-muted text-center">
          <div className={captainId ? 'text-ffc-gold font-bold' : 'text-red-400 font-bold'}>{captainId ? '👑' : '—'}</div>
          <div className="text-xs text-gray-400">Captain</div>
        </div>
      </div>

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

      {/* Pitch with formation picker */}
      <div className="mb-2">
        <p className="text-xs text-gray-400 mb-1.5 px-1">Tap a position to add or change a player. Tap a filled spot for options.</p>
        <PitchFormation
          formation={formation}
          onFormationChange={changeFormation}
          slots={pitchSlotsForDisplay}
          onSlotClick={openPickerForPitch}
        />
      </div>

      {/* Selected starter quick-actions (captain / remove) */}
      {startersFilled > 0 && (
        <div className="bg-ffc-surface/60 rounded-2xl p-3 border border-ffc-muted mb-4 space-y-1.5">
          {pitchSlots.map((player, idx) => player && (
            <div key={player.id} className="flex items-center gap-2 bg-ffc-dark/60 rounded-lg px-3 py-2">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[player.position]}`}>{player.position}</span>
              <span className="flex-1 text-sm">{player.name}</span>
              {captainId === player.id && <span className="text-xs">👑</span>}
              <div className="flex gap-1">
                {captainId !== player.id && (
                  <button onClick={() => setCaptainId(player.id)} className="text-xs text-ffc-gold border border-ffc-gold rounded px-1.5 py-0.5" type="button">C</button>
                )}
                <button onClick={() => handleRemoveFromSlot({ type: 'pitch', index: idx })} className="text-xs text-red-400 border border-red-800 rounded px-1.5 py-0.5" type="button">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bench */}
      <div className="bg-ffc-muted/30 rounded-2xl p-3 border border-ffc-muted mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase">Bench</h2>
          <span className="text-xs text-gray-400">{benchFilled}/3</span>
        </div>
        <div className="space-y-1.5">
          {bench.map((player, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-ffc-surface/60 rounded-lg px-3 py-2">
              {player ? (
                <>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[player.position]}`}>{player.position}</span>
                  <span className="flex-1 text-sm">{player.name}</span>
                  <button onClick={() => handleRemoveFromSlot({ type: 'bench', index: idx })} className="text-xs text-red-400 border border-red-800 rounded px-1.5 py-0.5" type="button">✕</button>
                </>
              ) : (
                <button onClick={() => openPickerForBench(idx)} className="flex-1 text-left text-sm text-gray-500" type="button">
                  + Add bench player
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={saveSquad}
        disabled={!windowOpen || saving}
        className="w-full bg-ffc-red hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl mb-6 transition-colors"
        type="button"
      >
        {saving ? 'Saving…' : !windowOpen ? '🔒 Window Closed' : 'Save Squad'}
      </button>

      <PlayerPickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerTarget(null) }}
        players={eligiblePlayersForTarget()}
        requiredPosition={requiredLineForPicker}
        onPick={handlePick}
      />
    </div>
  )
}
