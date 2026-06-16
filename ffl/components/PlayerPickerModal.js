'use client'
import { useState } from 'react'
import { POSITION_COLORS } from '../lib/game'

const STATUS_BADGE = {
  active: null,
  injured: { label: 'INJ', cls: 'bg-yellow-500 text-black' },
  left: { label: 'LEFT', cls: 'bg-red-600 text-white' },
}

export default function PlayerPickerModal({
  open,
  onClose,
  players,          // all players eligible for this slot (already filtered by position + availability + not-selected)
  requiredPosition, // 'GK' | 'DEF' | 'MID' | 'FWD'
  onPick,           // (player) => void
}) {
  const [search, setSearch] = useState('')

  if (!open) return null

  const filtered = players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-ffc-surface w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col border border-ffc-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-ffc-muted">
          <div>
            <h2 className="font-bold text-sm">Pick a {requiredPosition}</h2>
            <p className="text-xs text-gray-400">{filtered.length} available</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2" type="button">✕</button>
        </div>

        <div className="p-3 border-b border-ffc-muted">
          <input
            type="text"
            autoFocus
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-ffc-dark border border-ffc-muted rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-ffc-gold"
          />
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {filtered.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onPick(player)}
              className="w-full flex items-center gap-3 bg-ffc-dark hover:bg-ffc-muted rounded-xl px-3 py-2.5 border border-ffc-muted transition-colors text-left"
            >
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position]}`}>
                {player.position}
              </span>
              <span className="flex-1 text-sm">{player.name}</span>
              {STATUS_BADGE[player.status] && (
                <span className={`text-xs px-1 rounded ${STATUS_BADGE[player.status].cls}`}>
                  {STATUS_BADGE[player.status].label}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No eligible players found</p>
          )}
        </div>
      </div>
    </div>
  )
}
