'use client'
import { useEffect, useState } from 'react'

const EMPTY_MATCH = { opponent: '', match_date: new Date().toISOString().split('T')[0], home: true, result: null }

const EMPTY_STAT = {
  appearance: false, played90: false, goals: 0, assists: 0,
  clean_sheet: false, started: false, sub_on: false, yellow_card: false, red_card: false,
}

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
  const [msgType, setMsgType] = useState('success') // 'success' | 'error'

  // Sync state
  const [syncingFixtures, setSyncingFixtures] = useState(false)
  const [syncingStats, setSyncingStats] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncWarnings, setSyncWarnings] = useState([])

  function showMsg(text, type = 'success') {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(null), 5000)
  }

  async function fetchMatches() {
    const res = await fetch('/api/matches')
    const { matches } = await res.json()
    setMatches(matches || [])
  }

  async function fetchPlayers() {
    const res = await fetch('/api/players')
    const { players } = await res.json()
    setPlayers((players || []).filter((p) => p.status === 'active'))
  }

  useEffect(() => { fetchMatches(); fetchPlayers() }, [])

  async function selectMatch(match) {
    setSelectedMatch(match)
    setSyncWarnings([])
    const res = await fetch(`/api/matches/${match.id}/stats`)
    const { stats } = await res.json()
    const map = {}
    for (const s of (stats || [])) map[s.player_id] = s
    setExistingStats(map)

    const draft = {}
    for (const p of players) {
      draft[p.id] = map[p.id]
        ? {
            appearance: map[p.id].appearance, played90: map[p.id].played90,
            goals: map[p.id].goals, assists: map[p.id].assists,
            clean_sheet: map[p.id].clean_sheet, started: map[p.id].started || false,
            sub_on: map[p.id].sub_on || false, yellow_card: map[p.id].yellow_card || false,
            red_card: map[p.id].red_card || false,
          }
        : { ...EMPTY_STAT }
    }
    setDraftStats(draft)
  }

  // ── Sync Fixtures ──────────────────────────────────────────────────────────

  async function syncFixtures() {
    setSyncingFixtures(true)
    try {
      const res = await fetch('/api/sync-fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        showMsg(`❌ Fixture sync failed: ${data.error}`, 'error')
      } else {
        await fetchMatches()
        showMsg(`✅ ${data.upserted} fixture${data.upserted !== 1 ? 's' : ''} synced from National League`)
      }
    } catch (err) {
      showMsg(`❌ Network error: ${err.message}`, 'error')
    } finally {
      setSyncingFixtures(false)
    }
  }

  // ── Sync Match Stats ───────────────────────────────────────────────────────

  async function syncMatchStats() {
    if (!selectedMatch) return
    if (!selectedMatch.nl_match_id) {
      showMsg('❌ This match has no National League ID — was it created manually? Sync fixtures first to link it.', 'error')
      return
    }
    setSyncingStats(true)
    setSyncWarnings([])
    try {
      const res = await fetch('/api/sync-match-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatch.id, nlMatchId: selectedMatch.nl_match_id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showMsg(`❌ Stats sync failed: ${data.error}`, 'error')
      } else {
        setSyncWarnings(data.warnings || [])
        await selectMatch(selectedMatch) // refresh
        showMsg(`✅ Stats synced — ${data.upserted} players, result: ${data.result}`)
      }
    } catch (err) {
      showMsg(`❌ Network error: ${err.message}`, 'error')
    } finally {
      setSyncingStats(false)
    }
  }

  // ── Sync All Stats ────────────────────────────────────────────────────────

  async function syncAllStats() {
    setSyncingAll(true)
    setSyncWarnings([])
    try {
      const res = await fetch('/api/sync-all-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        showMsg(`❌ Sync failed: ${data.error}`, 'error')
      } else {
        setSyncWarnings(data.warnings || [])
        await fetchMatches()
        showMsg(`✅ ${data.synced} matches synced, ${data.skipped} skipped (no lineup data)`)
      }
    } catch (err) {
      showMsg(`❌ Network error: ${err.message}`, 'error')
    } finally {
      setSyncingAll(false)
    }
  }

  // ── Create match manually ──────────────────────────────────────────────────

  async function createMatch() {
    if (!matchForm.opponent.trim()) return
    setSaving(true)
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opponent: matchForm.opponent.trim(), match_date: matchForm.match_date,
        home: matchForm.home, result: matchForm.result || null,
      }),
    })
    const { match } = await res.json()
    setSaving(false)
    setShowNewMatch(false)
    setMatchForm(EMPTY_MATCH)
    await fetchMatches()
    if (match) selectMatch(match)
  }

  function updateDraft(playerId, field, value) {
    setDraftStats((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }))
  }

  async function saveStats() {
    if (!selectedMatch) return
    setSaving(true)
    const stats = players
      .filter((p) => draftStats[p.id])
      .map((p) => ({ player_id: p.id, ...draftStats[p.id] }))

    await fetch(`/api/matches/${selectedMatch.id}/stats`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats }),
    })

    await selectMatch(selectedMatch)
    setSaving(false)
    showMsg('✅ Stats saved')
  }

  async function deleteMatch(id) {
    if (!confirm('Delete this match and all its stats?')) return
    await fetch(`/api/matches/${id}`, { method: 'DELETE' })
    if (selectedMatch?.id === id) { setSelectedMatch(null); setDraftStats({}) }
    await fetchMatches()
  }

  const positions = ['GK', 'DEF', 'MID', 'FWD']

  return (
    <div>
      {/* Message bar */}
      {msg && (
        <div className={`text-sm rounded-xl p-3 mb-4 border ${
          msgType === 'error'
            ? 'bg-red-900/40 border-red-700 text-red-300'
            : 'bg-green-900/40 border-green-700 text-green-300'
        }`}>{msg}</div>
      )}

      {/* ── Fixture Sync ── */}
      <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-gray-300">National League Fixtures</h2>
            <p className="text-xs text-gray-500 mt-0.5">Auto-import upcoming fixtures</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={syncFixtures}
              disabled={syncingFixtures || syncingAll}
              className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-2"
            >
              {syncingFixtures ? '⏳ Syncing…' : '📅 Sync Fixtures'}
            </button>
            <button
              onClick={syncAllStats}
              disabled={syncingAll || syncingFixtures}
              className="text-xs bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-2"
            >
              {syncingAll ? '⏳ Syncing…' : '⚡ Sync All Stats'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Match selector ── */}
      <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-300">Select Match</h2>
          <button
            onClick={() => setShowNewMatch(!showNewMatch)}
            className="text-xs text-ffc-gold border border-ffc-gold rounded-lg px-3 py-1"
          >
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
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-gray-400 self-center">Result:</span>
              {['W', 'D', 'L'].map((r) => (
                <button key={r} type="button"
                  onClick={() => setMatchForm({ ...matchForm, result: matchForm.result === r ? null : r })}
                  className={`text-xs font-bold px-3 py-1 rounded-lg border transition-colors ${
                    matchForm.result === r
                      ? r === 'W' ? 'bg-green-700 border-green-500 text-white'
                        : r === 'D' ? 'bg-yellow-700 border-yellow-500 text-white'
                        : 'bg-red-800 border-red-600 text-white'
                      : 'border-ffc-muted text-gray-400'
                  }`}
                >
                  {r === 'W' ? 'Win' : r === 'D' ? 'Draw' : 'Loss'}
                </button>
              ))}
            </div>
            <button onClick={createMatch} disabled={saving} className="w-full bg-ffc-red text-white font-bold py-2 rounded-xl text-sm">
              {saving ? 'Creating…' : 'Create Match'}
            </button>
          </div>
        )}

        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {matches.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer border transition-colors ${
                selectedMatch?.id === m.id ? 'border-ffc-gold bg-ffc-gold/10' : 'border-ffc-muted hover:border-gray-500'
              }`}
              onClick={() => selectMatch(m)}
            >
              <span className="flex-1 text-sm">{m.home ? 'vs' : '@'} {m.opponent}</span>
              {m.result && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  m.result === 'W' ? 'bg-green-800 text-green-300' :
                  m.result === 'D' ? 'bg-yellow-800 text-yellow-300' :
                  'bg-red-900 text-red-300'
                }`}>{m.result}</span>
              )}
              {m.nl_match_id && <span className="text-xs text-emerald-500" title="Linked to National League">🔗</span>}
              <span className="text-xs text-gray-400">{new Date(m.match_date).toLocaleDateString('en-GB')}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteMatch(m.id) }} className="text-xs text-red-500 hover:text-red-400 ml-1">✕</button>
            </div>
          ))}
          {matches.length === 0 && <p className="text-gray-500 text-xs text-center py-4">No matches yet — sync fixtures or create manually</p>}
        </div>
      </div>

      {/* ── Selected match actions ── */}
      {selectedMatch && (
        <>
          {/* Sync stats + result picker */}
          <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-300">
                  {selectedMatch.home ? 'vs' : '@'} {selectedMatch.opponent}
                </h2>
                <p className="text-xs text-gray-500">{new Date(selectedMatch.match_date).toLocaleDateString('en-GB')}</p>
              </div>
              {selectedMatch.nl_match_id ? (
                <button
                  onClick={syncMatchStats}
                  disabled={syncingStats}
                  className="text-xs bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-2"
                >
                  {syncingStats ? '⏳ Syncing…' : '⚡ Sync Stats'}
                </button>
              ) : (
                <span className="text-xs text-gray-500 italic">No NL ID — enter manually</span>
              )}
            </div>

            {/* Result picker */}
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-400">Result:</span>
              {['W', 'D', 'L'].map((r) => (
                <button key={r} type="button"
                  onClick={async () => {
                    const newResult = selectedMatch.result === r ? null : r
                    await fetch(`/api/matches/${selectedMatch.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ result: newResult }),
                    })
                    setSelectedMatch({ ...selectedMatch, result: newResult })
                    setMatches((prev) => prev.map((m) => m.id === selectedMatch.id ? { ...m, result: newResult } : m))
                  }}
                  className={`text-xs font-bold px-3 py-1 rounded-lg border transition-colors ${
                    selectedMatch.result === r
                      ? r === 'W' ? 'bg-green-700 border-green-500 text-white'
                        : r === 'D' ? 'bg-yellow-700 border-yellow-500 text-white'
                        : 'bg-red-800 border-red-600 text-white'
                      : 'border-ffc-muted text-gray-400'
                  }`}
                >
                  {r === 'W' ? 'Win' : r === 'D' ? 'Draw' : 'Loss'}
                </button>
              ))}
              {selectedMatch.result && (
                <span className="text-xs text-gray-500 ml-1">
                  {selectedMatch.result === 'W' ? '+2 pts' : selectedMatch.result === 'D' ? '+1 pt' : '-1 pt'} per player
                </span>
              )}
            </div>

            {/* Sync warnings */}
            {syncWarnings.length > 0 && (
              <div className="mt-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-400 mb-1">⚠️ Unmatched players — add to your squad or update names:</p>
                {syncWarnings.map((w, i) => <p key={i} className="text-xs text-yellow-300">{w}</p>)}
              </div>
            )}
          </div>

          {/* ── Manual Stats Entry ── */}
          <div>
            <h2 className="text-sm font-bold text-gray-300 mb-3">Manual / Override Stats</h2>
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
                              <input type="checkbox" checked={stat.started || false} onChange={(e) => updateDraft(player.id, 'started', e.target.checked)} className="accent-ffc-red w-4 h-4" />
                              Started
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-300">
                              <input type="checkbox" checked={stat.sub_on || false} onChange={(e) => updateDraft(player.id, 'sub_on', e.target.checked)} className="accent-ffc-red w-4 h-4" />
                              Sub on
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-300">
                              <input type="checkbox" checked={stat.played90 || false} onChange={(e) => updateDraft(player.id, 'played90', e.target.checked)} className="accent-ffc-red w-4 h-4" />
                              Played 90
                            </label>
                            {(pos === 'GK' || pos === 'DEF') && (
                              <label className="flex items-center gap-2 text-xs text-gray-300">
                                <input type="checkbox" checked={stat.clean_sheet || false} onChange={(e) => updateDraft(player.id, 'clean_sheet', e.target.checked)} className="accent-ffc-red w-4 h-4" />
                                Clean Sheet
                              </label>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-12">Goals</span>
                              <input type="number" min="0" value={stat.goals || 0} onChange={(e) => updateDraft(player.id, 'goals', e.target.value)} className="w-12 bg-ffc-dark border border-ffc-muted rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-ffc-gold" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-12">Assists</span>
                              <input type="number" min="0" value={stat.assists || 0} onChange={(e) => updateDraft(player.id, 'assists', e.target.value)} className="w-12 bg-ffc-dark border border-ffc-muted rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-ffc-gold" />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-300">
                              <input type="checkbox" checked={stat.yellow_card || false} onChange={(e) => updateDraft(player.id, 'yellow_card', e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                              🟨 Yellow
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-300">
                              <input type="checkbox" checked={stat.red_card || false} onChange={(e) => updateDraft(player.id, 'red_card', e.target.checked)} className="accent-red-500 w-4 h-4" />
                              🟥 Red
                            </label>
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
        </>
      )}
    </div>
  )
}
