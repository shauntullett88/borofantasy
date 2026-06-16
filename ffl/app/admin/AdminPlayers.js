'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { POSITIONS, STATUSES, POSITION_COLORS } from '../../lib/game'

const EMPTY_FORM = { name: '', position: 'GK', status: 'active' }

export default function AdminPlayers() {
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers(data || [])
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
      await supabase.from('players').update({ name: form.name.trim(), position: form.position, status: form.status }).eq('id', editId)
      setMsg('✅ Player updated')
    } else {
      await supabase.from('players').insert({ name: form.name.trim(), position: form.position, status: form.status })
      setMsg('✅ Player added')
    }

    cancelEdit()
    await fetchPlayers()
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  async function deletePlayer(id) {
    if (!confirm('Remove this player? This cannot be undone.')) return
    await supabase.from('players').delete().eq('id', id)
    await fetchPlayers()
  }

  const filtered = players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {msg && <div className="bg-green-900/40 border border-green-700 text-green-300 text-sm rounded-xl p-3 mb-4">{msg}</div>}

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

      <p className="text-xs text-gray-500 mb-2">{filtered.length} players</p>

      {/* Player list */}
      <div className="space-y-2">
        {filtered.map((player) => (
          <div key={player.id} className="flex items-center gap-3 bg-ffc-surface rounded-xl px-3 py-3 border border-ffc-muted">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position]}`}>
              {player.position}
            </span>
            <span className={`flex-1 text-sm font-medium ${player.status === 'left' ? 'text-red-400 line-through' : player.status === 'injured' ? 'text-yellow-300' : ''}`}>
              {player.name}
            </span>
            <span className={`text-xs shrink-0 ${player.status === 'active' ? 'text-green-400' : player.status === 'injured' ? 'text-yellow-400' : 'text-red-400'}`}>
              {player.status}
            </span>
            <div className="flex gap-1">
              <button onClick={() => startEdit(player)} className="text-xs text-blue-400 border border-blue-800 rounded px-2 py-1">Edit</button>
              <button onClick={() => deletePlayer(player.id)} className="text-xs text-red-400 border border-red-900 rounded px-2 py-1">Del</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No players found</p>}
      </div>
    </div>
  )
}
