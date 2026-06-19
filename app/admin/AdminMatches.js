'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const EMPTY_MATCH = { opponent: '', match_date: new Date().toISOString().split('T')[0], home: true, result: null }

const EMPTY_STAT = {
  appearance: false,
  played90: false,
  goals: 0,
  assists: 0,
  clean_sheet: false,
  started: false,
  sub_on: false,
  yellow_card: false,
  red_card: false,
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

  // Scrape state
  const [scraping, setScraping] = useState(false)
  const [scrapePreview, setScrapePreview] = useState(null) // { parsed, tweets, warnings, cleanSheetUncertain }
  const [scrapeError, setScrapeError] = useState(null)
  const [showTweets, setShowTweets] = useState(false)
  const [committing, setCommitting] = useState(false)

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
    setScrapePreview(null)
    setScrapeError(null)
    const { data: stats } = await supabase.from('player_match_stats').select('*').eq('match_id', match.id)
    const map = {}
    for (const s of (stats || [])) map[s.player_id] = s
    setExistingStats(map)

    const draft = {}
    for (const p of players) {
      draft[p.id] = map[p.id]
        ? {
            appearance: map[p.id].appearance,
            played90: map[p.id].played90,
            goals: map[p.id].goals,
            assists: map[p.id].assists,
            clean_sheet: map[p.id].clean_sheet,
            started: map[p.id].started || false,
            sub_on: map[p.id].sub_on || false,
            yellow_card: map[p.id].yellow_card || false,
            red_card: map[p.id].red_card || false,
          }
        : { ...EMPTY_STAT }
    }
    setDraftStats(draft)
  }

  async function createMatch() {
    if (!matchForm.opponent.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('matches')
      .insert({ opponent: matchForm.opponent.trim(), match_date: matchForm.match_date, home: matchForm.home, result: matchForm.result || null })
      .select()
      .single()
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

  // ─── Scrape ───────────────────────────────────────────────────────────────

  async function scrapeTwitter() {
    if (!selectedMatch) return
    setScraping(true)
    setScrapeError(null)
    setScrapePreview(null)
    setShowTweets(false)

    try {
      const res = await fetch('/api/scrape-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players }),
      })
      const data = await res.json()

      if (!res.ok) {
        setScrapeError(data.error || 'Scrape failed')
      } else {
        setScrapePreview(data)
      }
    } catch (err) {
      setScrapeError('Network error: ' + err.message)
    } finally {
      setScraping(false)
    }
  }

  function updatePreviewStat(playerId, field, value) {
    setScrapePreview((prev) => ({
      ...prev,
      parsed: prev.parsed.map((s) =>
        s.player_id === playerId ? { ...s, [field]: value } : s
      ),
    }))
  }

  async function commitScrapedStats() {
    if (!scrapePreview || !selectedMatch) return
    setCommitting(true)

    try {
      const res = await fetch('/api/commit-scraped-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          stats: scrapePreview.parsed,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setScrapeError(data.error || 'Commit failed')
      } else {
        setScrapePreview(null)
        await selectMatch(selectedMatch) // refresh draft from DB
        setMsg(`✅ Scraped stats saved (${data.upserted} players)`)
        setTimeout(() => setMsg(null), 4000)
      }
    } catch (err) {
      setScrapeError('Network error: ' + err.message)
    } finally {
      setCommitting(false)
    }
  }

  // ─── Manual save ──────────────────────────────────────────────────────────

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
        appearance: stat.appearance || stat.started || stat.sub_on || false,
        played90: stat.played90 || false,
        goals: parseInt(stat.goals) || 0,
        assists: parseInt(stat.assists) || 0,
        clean_sheet: stat.clean_sheet || false,
        started: stat.started || false,
        sub_on: stat.sub_on || false,
        yellow_card: stat.yellow_card || false,
        red_card: stat.red_card || false,
      }

      if (existing) {
        await supabase.from('player_match_stats').update(payload).eq('id', existing.id)
      } else {
        const hasData =
          payload.appearance || payload.played90 || payload.goals > 0 ||
          payload.assists > 0 || payload.clean_sheet || payload.started ||
          payload.sub_on || payload.yellow_card || payload.red_card
        if (hasData) {
          await supabase.from('player_match_stats').insert(payload)
        }
      }
    }

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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {msg && (
        <div className="bg-green-900/40 border border-green-700 text-green-300 text-sm rounded-xl p-3 mb-4">
          {msg}
        </div>
      )}

      {/* Match selector */}
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
                <input
                  type="checkbox"
                  checked={matchForm.home}
                  onChange={(e) => setMatchForm({ ...matchForm, home: e.target.checked })}
                  className="accent-ffc-red"
                />
                Home
              </label>
            </div>
            <button
              onClick={createMatch}
              disabled={saving}
              className="w-full bg-ffc-red text-white font-bold py-2 rounded-xl text-sm"
            >
              {saving ? 'Creating…' : 'Create Match'}
            </button>
          </div>
        )}

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {matches.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer border transition-colors ${
                selectedMatch?.id === m.id
                  ? 'border-ffc-gold bg-ffc-gold/10'
                  : 'border-ffc-muted hover:border-gray-500'
              }`}
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
          {matches.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-4">No matches yet</p>
          )}
        </div>
      </div>

      {/* ── Twitter Scrape Section ── */}
      {selectedMatch && (
        <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-sm font-bold text-gray-300">Auto-fill from Twitter</h2>
              <p className="text-xs text-gray-500 mt-0.5">Scrapes @FarnboroughFC — review before saving</p>
            </div>
            <button
              onClick={scrapeTwitter}
              disabled={scraping}
              className="text-xs bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-2 flex items-center gap-1.5"
            >
              {scraping ? (
                <>
                  <span className="animate-spin">⏳</span> Scraping…
                </>
              ) : (
                <>🐦 Scrape Twitter</>
              )}
            </button>
          </div>

          {scrapeError && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs rounded-xl p-3 mt-2">
              ⚠️ {scrapeError}
            </div>
          )}

          {scrapePreview && (
            <div className="mt-3 space-y-3">
              {/* Warnings */}
              {scrapePreview.warnings?.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3">
                  <p className="text-xs font-bold text-yellow-400 mb-1">⚠️ Needs review:</p>
                  {scrapePreview.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-300">{w}</p>
                  ))}
                </div>
              )}

              {scrapePreview.cleanSheetUncertain && (
                <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-2">
                  <p className="text-xs text-yellow-300">⚠️ Clean sheet status uncertain — check the final score and tick manually below.</p>
                </div>
              )}

              {/* Per-player preview — only show players with any data */}
              <div className="space-y-2">
                {scrapePreview.parsed
                  .filter((s) => s.appearance || s.goals > 0 || s.assists > 0 || s.yellow_card || s.red_card)
                  .map((stat) => (
                    <div key={stat.player_id} className="bg-ffc-dark rounded-xl p-3 border border-ffc-muted">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">{stat.player_name}</span>
                        <span className="text-xs text-gray-500">{stat.position}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {/* Started / Sub on */}
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={stat.started}
                            onChange={(e) => updatePreviewStat(stat.player_id, 'started', e.target.checked)}
                            className="accent-ffc-red w-4 h-4"
                          />
                          Started
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={stat.sub_on}
                            onChange={(e) => updatePreviewStat(stat.player_id, 'sub_on', e.target.checked)}
                            className="accent-ffc-red w-4 h-4"
                          />
                          Sub on
                        </label>

                        {/* Goals / Assists */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12">Goals</span>
                          <input
                            type="number"
                            min="0"
                            value={stat.goals}
                            onChange={(e) => updatePreviewStat(stat.player_id, 'goals', parseInt(e.target.value) || 0)}
                            className="w-12 bg-ffc-surface border border-ffc-muted rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-ffc-gold"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12">Assists</span>
                          <input
                            type="number"
                            min="0"
                            value={stat.assists}
                            onChange={(e) => updatePreviewStat(stat.player_id, 'assists', parseInt(e.target.value) || 0)}
                            className="w-12 bg-ffc-surface border border-ffc-muted rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-ffc-gold"
                          />
                        </div>

                        {/* Cards */}
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={stat.yellow_card}
                            onChange={(e) => updatePreviewStat(stat.player_id, 'yellow_card', e.target.checked)}
                            className="accent-yellow-400 w-4 h-4"
                          />
                          🟨 Yellow
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={stat.red_card}
                            onChange={(e) => updatePreviewStat(stat.player_id, 'red_card', e.target.checked)}
                            className="accent-red-500 w-4 h-4"
                          />
                          🟥 Red
                        </label>

                        {/* Clean sheet (GK/DEF only) */}
                        {(stat.position === 'GK' || stat.position === 'DEF') && (
                          <label className="flex items-center gap-2 text-xs text-gray-300 col-span-2">
                            <input
                              type="checkbox"
                              checked={stat.clean_sheet}
                              onChange={(e) => updatePreviewStat(stat.player_id, 'clean_sheet', e.target.checked)}
                              className="accent-ffc-red w-4 h-4"
                            />
                            Clean Sheet
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Tweet log */}
              <button
                onClick={() => setShowTweets((v) => !v)}
                className="text-xs text-gray-500 underline"
              >
                {showTweets ? 'Hide' : 'Show'} tweet log ({scrapePreview.tweetLog?.length})
              </button>
              {showTweets && (
                <div className="bg-ffc-dark rounded-xl p-3 space-y-2 max-h-64 overflow-y-auto">
                  {scrapePreview.tweetLog?.filter(t => t.detectedEvent).map((t, i) => (
                    <div key={i} className="border-b border-ffc-muted/30 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          t.detectedEvent === 'goal' ? 'bg-green-800 text-green-300' :
                          t.detectedEvent === 'yellow_card' ? 'bg-yellow-800 text-yellow-300' :
                          t.detectedEvent === 'red_card' ? 'bg-red-900 text-red-300' :
                          t.detectedEvent === 'assist' ? 'bg-blue-900 text-blue-300' :
                          'bg-gray-800 text-gray-400'
                        }`}>
                          {t.detectedEvent === 'goal' ? '⚽ Goal' :
                           t.detectedEvent === 'yellow_card' ? '🟨 Yellow' :
                           t.detectedEvent === 'red_card' ? '🟥 Red' :
                           t.detectedEvent === 'assist' ? '👟 Assist' :
                           t.detectedEvent}
                        </span>
                        {t.resolvedPlayer && (
                          <span className="text-xs text-white font-semibold">{t.resolvedPlayer}</span>
                        )}
                        {t.imageUrls?.length > 0 && (
                          <span className="text-xs text-sky-400">📷 vision used</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{t.text.slice(0, 100)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Commit / Discard */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={commitScrapedStats}
                  disabled={committing}
                  className="flex-1 bg-ffc-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
                >
                  {committing ? 'Saving…' : '✅ Confirm & Save Scraped Stats'}
                </button>
                <button
                  onClick={() => setScrapePreview(null)}
                  className="px-4 text-xs text-gray-400 border border-ffc-muted rounded-xl hover:border-gray-500"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual Stats Entry ── */}
      {selectedMatch && (
        <div>
          <h2 className="text-sm font-bold text-gray-300 mb-3">
            Manual Stats — {selectedMatch.home ? 'vs' : '@'} {selectedMatch.opponent} ({new Date(selectedMatch.match_date).toLocaleDateString('en-GB')})
          </h2>

          {/* Result picker for selected match */}
          <div className="flex gap-2 mb-4 items-center">
            <span className="text-xs text-gray-400">Result:</span>
            {['W', 'D', 'L'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={async () => {
                  const newResult = selectedMatch.result === r ? null : r
                  await supabase.from('matches').update({ result: newResult }).eq('id', selectedMatch.id)
                  setSelectedMatch({ ...selectedMatch, result: newResult })
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
                              checked={stat.started || false}
                              onChange={(e) => updateDraft(player.id, 'started', e.target.checked)}
                              className="accent-ffc-red w-4 h-4"
                            />
                            Started
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-300">
                            <input
                              type="checkbox"
                              checked={stat.sub_on || false}
                              onChange={(e) => updateDraft(player.id, 'sub_on', e.target.checked)}
                              className="accent-ffc-red w-4 h-4"
                            />
                            Sub on
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
                            <label className="flex items-center gap-2 text-xs text-gray-300">
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
                          <label className="flex items-center gap-2 text-xs text-gray-300">
                            <input
                              type="checkbox"
                              checked={stat.yellow_card || false}
                              onChange={(e) => updateDraft(player.id, 'yellow_card', e.target.checked)}
                              className="accent-yellow-400 w-4 h-4"
                            />
                            🟨 Yellow
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-300">
                            <input
                              type="checkbox"
                              checked={stat.red_card || false}
                              onChange={(e) => updateDraft(player.id, 'red_card', e.target.checked)}
                              className="accent-red-500 w-4 h-4"
                            />
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
      )}
    </div>
  )
}
