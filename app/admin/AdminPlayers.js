'use client'
import { useEffect, useState } from 'react'
import { POSITIONS, STATUSES, POSITION_COLORS } from '../../lib/game'

const EMPTY_FORM = { name: '', position: 'GK', status: 'active' }

export default function AdminPlayers() {
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [scrapingSite, setScrapingSite] = useState(false)
  const [msg, setMsg] = useState(null)
  const [msgType, setMsgType] = useState('success')

  function showMsg(text, type = 'success') {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(null), 5000)
  }

  async function fetchPlayers() {
    const res = await fetch('/api/players')
    const { players } = await res.json()
    setPlayers(players || [])
  }

  useEffect(() => { fetchPlayers() }, [])

  function startEdit(player) {
    setEditId(player.id)
    setForm({ name: player.name, position: player.position, status: player.status })
  }

  function cancelEdit() {
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  async function savePlayer() {
    if (!form.name.trim()) return
    setSaving(true)
    if (editId) {
      await fetch(`/api/players/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), position: form.position, status: form.status }),
      })
      showMsg('✅ Player updated')
    } else {
      await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), position: form.position, status: form.status }),
      })
      showMsg('✅ Player added')
    }
    cancelEdit()
    await fetchPlayers()
    setSaving(false)
  }

  async function deletePlayer(id) {
    if (!confirm('Remove this player? This cannot be undone.')) return
    await fetch(`/api/players/${id}`, { method: 'DELETE' })
    await fetchPlayers()
  }

  async function syncSquad() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        showMsg(`❌ Squad sync failed: ${data.error}`, 'error')
      } else {
        await fetchPlayers()
        showMsg(`✅ ${data.upserted} players synced from National League`)
      }
    } catch (err) {
      showMsg(`❌ Network error: ${err.message}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function scrapeSiteSquad() {
    setScrapingSite(true)
    try {
      const res = await fetch('/api/scrape-squad-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        showMsg(`❌ Scrape failed: ${data.error}`, 'error')
      } else {
        await fetchPlayers()
        showMsg(`✅ ${data.scraped} players from the club site — ${data.inserted} added, ${data.updated} updated`)
      }
    } catch (err) {
      showMsg(`❌ Network error: ${err.message}`, 'error')
    } finally {
      setScrapingSite(false)
    }
  }

  const filtered = players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  const byPosition = POSITIONS.reduce((acc, pos) => {
    acc[pos] = filtered.filter((p) => p.position === pos)
    return acc
  }, {})

  return (
    <div>
      {msg && (
        <div className={`text-sm rounded-xl p-3 mb-4 border ${
          msgType === 'error'
            ? 'bg-red-900/40 border-red-700 text-red-300'
            : 'bg-green-900/40 border-green-700 text-green-300'
        }`}>{msg}</div>
      )}

      {/* Sync Squad from NL */}
      <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-gray-300">National League Squad</h2>
            <p className="text-xs text-gray-500 mt-0.5">Import players from synced match data</p>
          </div>
          <button
            onClick={syncSquad}
            disabled={syncing}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-2"
          >
            {syncing ? '⏳ Syncing…' : '👥 Sync Squad'}
          </button>
        </div>
      </div>

      {/* Scrape squad from the official club website */}
      <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-gray-300">Club Website Squad</h2>
            <p className="text-xs text-gray-500 mt-0.5">Scrape names &amp; positions from farnboroughfc.co.uk</p>
          </div>
          <button
            onClick={scrapeSiteSquad}
            disabled={scrapingSite}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-2"
          >
            {scrapingSite ? '⏳ Scraping…' : '🌐 Scrape Squad'}
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      <div className="bg-ffc-surface rounded-2xl p-4 border border-ffc-muted mb-4">
        <h2 className="text-sm font-bold mb-3 text-gray-300">{editId ? 'Edit Player' : 'Add Player'}</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Player name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-ffc-dark border border-ffc-muted rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-ffc-gold text-sm"
          />
          <div className="flex gap-3">
            <select
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="flex-1 bg-ffc-dark border border-ffc-muted rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-ffc-gold text-sm"
            >
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="flex-1 bg-ffc-dark border border-ffc-muted rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-ffc-gold text-sm"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={savePlayer}
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-ffc-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving…' : editId ? 'Update Player' : 'Add Player'}
            </button>
            {editId && (
              <button onClick={cancelEdit} className="px-4 py-2.5 border border-ffc-muted text-gray-400 rounded-xl text-sm">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search players…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-ffc-surface border border-ffc-muted rounded-xl px-4 py-2.5 text-white placeholder-gray-500 mb-3 focus:outline-none focus:border-ffc-gold text-sm"
      />

      <p className="text-xs text-gray-500 mb-3">{filtered.length} players</p>

      {/* Player list grouped by position */}
      {POSITIONS.map((pos) => {
        const posPlayers = byPosition[pos]
        if (!posPlayers?.length) return null
        return (
          <div key={pos} className="mb-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{pos}</div>
            <div className="space-y-2">
              {posPlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-3 bg-ffc-surface rounded-xl px-3 py-3 border border-ffc-muted">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position]}`}>
                    {player.position}
                  </span>
                  <span className={`flex-1 text-sm font-medium ${
                    player.status === 'left' ? 'text-red-400 line-through' :
                    player.status === 'injured' ? 'text-yellow-300' : ''
                  }`}>
                    {player.name}
                  </span>
                  {player.nl_player_id && (
                    <span className="text-xs text-emerald-500 shrink-0" title="Linked to National League">🔗</span>
                  )}
                  <span className={`text-xs shrink-0 ${
                    player.status === 'active' ? 'text-green-400' :
                    player.status === 'injured' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {player.status}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(player)} className="text-xs text-blue-400 border border-blue-800 rounded px-2 py-1">Edit</button>
                    <button onClick={() => deletePlayer(player.id)} className="text-xs text-red-400 border border-red-900 rounded px-2 py-1">Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-8">
          No players found — sync squad or add manually
        </p>
      )}
    </div>
  )
}
