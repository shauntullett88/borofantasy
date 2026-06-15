'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const EMPTY_MATCH = { opponent: '', match_date: new Date().toISOString().split('T')[0], home: true }

const EMPTY_STAT = { appearance: false, played90: false, goals: 0, assists: 0, clean_sheet: false }

export default function AdminMatches() {
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [existingStats, setExistingStats] = useState({})
  const [draftStats, setDraftStats] = useState({})
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH)
  const [showNewMatch, setShowNewMatch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function fetchMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_date', { ascending: false })
    setMatches(data || [])
  }

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('*').eq('status', 'active').order('position').order('name')
    setPlayers(data || [])
  }

  useEffect(() => { fetchMatches(); fetchPlayers() }, [])

  async function selectMatch(match) {
    setSelectedMatch(match)
    const { data: stats } = await supabase.from('player_match_stats').select('*').eq('match_id', match.id)
    const map = {}
    for (const s of (stats || [])) {
      map[s.player_id] = s
    }
    setExistingStats(map)

    // Init drafts from existing or empty
    const draft = {}
    for (const p of players) {
      draft[p.id] = map[p.id]
        ? { appearance: map[p.id].appearance, played90: map[p.id].played90, goals: map[p.id].goals, assists: map[p.id].assists, clean_sheet: map[p.id].clean_sheet }
        : { ...EMPTY_STAT }
    }
    setDraftStats(draft)
  }

  async function createMatch() {
    if (!matchForm.opponent.trim()) return
    setSaving(true)
    const { data } = await supabase.from('matches').insert({ opponent: matchForm.opponent.trim(), match_date: matchForm.match_date, home: matchForm.home }).select().single()
    setSaving(false)
    setShowNewMatch(false)
    setMatchForm(EMPTY_MATCH)
    await fetchMatches()
    if (data) selectMatch(data)
  }

  function updateDraft(playerId, field, value) {
    setDraftStats((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
  }

  async function saveStats() {
    if (!selectedMatch) return
    setSaving(true)

    for (const player of players) {
      const stat = draftStats[player.id]
      if (!stat) continue

      const existing = existingStats[player.id]
      const payload = {
        match_id: selectedMatch.id,
        player_id: player.id,
        appearance: stat.appearance || false,
        played90: stat.played90 || false,
        goals: parseInt(stat.goals) || 0,
        assists: parseInt(stat.assists) || 0,
        clean_sheet: stat.clean_sheet || false,
      }

      if (existing) {
        await supabase.from('player_match_stats').update(payload).eq('id', existing.id)
      } else {
        // Only insert if there's any data
        const hasData = payload.appearance || payload.played90 || payload.goals > 0 || payload.assists > 0 || payload.clean_sheet
        if (hasData) {
          await supabase.from('player_match_stats').insert(payload)
        }
      }
    }

    // Re-fetch to reflect saved state
    await selectMatch(selectedMatch)
    setSaving(false)
    setMsg('✅ Stats saved')
    setTimeout(() => setMsg(null), 3000)
  }

  async function deleteMatch(id) {
    if (!confirm('Delete this match and all its stats?')) return
    await supabase.from('player_match_stats').delete().eq('match_id', id)
    await supabase.from('matches').delete().eq('id', id)
    if (selectedMatch?.id === id) { setSelectedMatch(null); setDraftStats({}) }
    await fetchMatches()
  }

  const positions = ['GK', 'DEF', 'MID', 'FWD']

  return (
    <div>
      {msg && <div className="bg-green-900/40 border border-green-700 text-green-300 text-sm rounded-xl p-3 mb-4">{msg}</div>}

      {/* Match selector */}
      <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-300">Select Match</h2>
          <button onClick={() => setShowNewMatch(!showNewMatch)} className="text-xs text-ffc-gold border border-ffc-gold rounded-lg px-3 py-1">
            + New Match
          </button>
        </div>

        {showNewMatch && (
          <div className="space-y-2 mb-3 p-3 bg-ffc-dark rounded-xl">
            <input
              type="text"
              placeholder="Opponent name"
              value={matchForm.opponent}
              onChange={(e) => setMatchForm({ ...matchForm, opponent: e.target.value })}
              className="w-full bg-ffc-surface border border-ffc-muted rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-ffc-gold"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={matchForm.match_date}
                onChange={(e) => setMatchForm({ ...matchForm, match_date: e.target.value })}
                className="flex-1 bg-ffc-surface border border-ffc-muted rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-ffc-gold"
              />
              <label className="flex items-center gap-1 text-sm text-gray-300">
                <input type="checkbox" checked={matchForm.home} onChange={(e) => setMatchForm({ ...matchForm, home: e.target.checked })} className="accent-ffc-red" />
                Home
              </label>
            </div>
            <button onClick={createMatch} disabled={saving} className="w-full bg-ffc-red text-white font-bold py-2 rounded-xl text-sm">
              {saving ? 'Creating…' : 'Create Match'}
            </button>
          </div>
        )}

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {matches.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer border transition-colors ${selectedMatch?.id === m.id ? 'border-ffc-gold bg-ffc-gold/10' : 'border-ffc-muted hover:border-gray-500'}`}
              onClick={() => selectMatch(m)}
            >
              <span className="flex-1 text-sm">{m.home ? 'vs' : '@'} {m.opponent}</span>
              <span className="text-xs text-gray-400">{new Date(m.match_date).toLocaleDateString('en-GB')}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMatch(m.id) }}
                className="text-xs text-red-500 hover:text-red-400 ml-1"
              >✕</button>
            </div>
          ))}
          {matches.length === 0 && <p className="text-gray-500 text-xs text-center py-4">No matches yet</p>}
        </div>
      </div>

      {/* Stats entry */}
      {selectedMatch && (
        <div>
          <h2 className="text-sm font-bold text-gray-300 mb-3">
            Stats — {selectedMatch.home ? 'vs' : '@'} {selectedMatch.opponent} ({new Date(selectedMatch.match_date).toLocaleDateString('en-GB')})
          </h2>

          {positions.map((pos) => {
            const posPlayers = players.filter((p) => p.position === pos)
            if (posPlayers.length === 0) return null
            return (
              <div key={pos} className="mb-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{pos}</div>
                <div className="space-y-2">
                  {posPlayers.map((player) => {
                    const stat = draftStats[player.id] || EMPTY_STAT
                    return (
                      <div key={player.id} className="bg-ffc-surface rounded-xl p-3 border border-ffc-muted">
                        <div className="font-semibold text-sm mb-2">{player.name}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <label className="flex items-center gap-2 text-xs text-gray-300">
                            <input
                              type="checkbox"
                              checked={stat.appearance || false}
                              onChange={(e) => updateDraft(player.id, 'appearance', e.target.checked)}
                              className="accent-ffc-red w-4 h-4"
                            />
                            Appeared
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-300">
                            <input
                              type="checkbox"
                              checked={stat.played90 || false}
                              onChange={(e) => updateDraft(player.id, 'played90', e.target.checked)}
                              className="accent-ffc-red w-4 h-4"
                            />
                            Played 90
                          </label>
                          {(pos === 'GK' || pos === 'DEF') && (
                            <label className="flex items-center gap-2 text-xs text-gray-300 col-span-2">
                              <input
                                type="checkbox"
                                checked={stat.clean_sheet || false}
                                onChange={(e) => updateDraft(player.id, 'clean_sheet', e.target.checked)}
                                className="accent-ffc-red w-4 h-4"
                              />
                              Clean Sheet
                            </label>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-12">Goals</span>
                            <input
                              type="number"
                              min="0"
                              value={stat.goals || 0}
                              onChange={(e) => updateDraft(player.id, 'goals', e.target.value)}
                              className="w-12 bg-ffc-dark border border-ffc-muted rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-ffc-gold"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-12">Assists</span>
                            <input
                              type="number"
                              min="0"
                              value={stat.assists || 0}
                              onChange={(e) => updateDraft(player.id, 'assists', e.target.value)}
                              className="w-12 bg-ffc-dark border border-ffc-muted rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-ffc-gold"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button
            onClick={saveStats}
            disabled={saving}
            className="w-full bg-ffc-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors sticky bottom-24"
          >
            {saving ? 'Saving…' : 'Save All Stats'}
          </button>
        </div>
      )}
    </div>
  )
}
