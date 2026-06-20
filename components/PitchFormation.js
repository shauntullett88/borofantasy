'use client'
import { FORMATIONS, getDisplayRows } from '../lib/formations'

const STATUS_DOT = {
  active: '',
  injured: '🟡',
  left: '🔴',
}

const POS_AVATAR_COLOR = {
  GK: 'bg-yellow-400 text-black',
  DEF: 'bg-blue-500 text-white',
  MID: 'bg-green-500 text-white',
  FWD: 'bg-red-500 text-white',
}

function PlayerToken({ player, isCaptain, points, showPoints, onClick, slotLine }) {
  if (!player) {
    return (
      <button onClick={onClick} className="flex flex-col items-center gap-0.5 w-16 group" type="button">
        <div className="w-11 h-11 rounded-full border-2 border-dashed border-white/30 group-hover:border-ffc-gold flex items-center justify-center transition-colors">
          <span className="text-white/30 group-hover:text-ffc-gold text-lg transition-colors">+</span>
        </div>
        <span className="text-white/30 text-xs">{slotLine}</span>
      </button>
    )
  }

  const status = player.status || 'active'
  const posColor = POS_AVATAR_COLOR[player.position] || 'bg-gray-500 text-white'
  const initials = player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 w-16 group relative" type="button">
      {isCaptain && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">👑</span>}
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all group-hover:scale-105 ${
          isCaptain ? 'border-ffc-gold' : status === 'left' ? 'border-red-500' : status === 'injured' ? 'border-yellow-400' : 'border-white/20'
        } ${posColor}`}
      >
        {initials}
      </div>
      <span
        className={`text-xs font-semibold text-center leading-tight max-w-[64px] truncate ${
          status === 'left' ? 'text-red-400' : status === 'injured' ? 'text-yellow-300' : 'text-white'
        }`}
      >
        {player.name.split(' ').pop()}
      </span>
      {showPoints ? (
        <span className="text-xs text-ffc-gold font-bold">{points ?? 0}pts</span>
      ) : (
        status !== 'active' && <span className="text-xs">{STATUS_DOT[status]}</span>
      )}
    </button>
  )
}

export default function PitchFormation({
  formation,
  onFormationChange,
  slots,            // array of 11: { player: Player|null, isCaptain: boolean }
  onSlotClick,       // (slotIndex) => void
  showPoints = false,
  pointsByPlayer = {},
  readOnly = false,
}) {
  const displayRows = getDisplayRows(formation)

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Formation picker */}
      {!readOnly && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 px-1">
          {Object.keys(FORMATIONS).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFormationChange(f)}
              className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${
                formation === f
                  ? 'bg-ffc-gold text-black border-ffc-gold'
                  : 'border-white/20 text-gray-300 hover:border-white/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Pitch */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #1a5c32 0%, #1e6b3a 25%, #1a5c32 50%, #1e6b3a 75%, #1a5c32 100%)',
          minHeight: '420px',
        }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 420" preserveAspectRatio="none">
          <circle cx="150" cy="210" r="40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <line x1="10" y1="210" x2="290" y2="210" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <circle cx="150" cy="210" r="2" fill="rgba(255,255,255,0.2)" />
          <rect x="75" y="10" width="150" height="55" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <rect x="75" y="355" width="150" height="55" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <rect x="110" y="10" width="80" height="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <rect x="110" y="388" width="80" height="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <rect x="10" y="10" width="280" height="400" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        </svg>

        <div className="relative z-10 flex flex-col justify-around h-full py-4 gap-1" style={{ minHeight: '420px' }}>
          {displayRows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex justify-around items-center px-2">
              {row.indices.map((slotIdx) => {
                const slot = slots[slotIdx] || { player: null, isCaptain: false }
                return (
                  <PlayerToken
                    key={slotIdx}
                    player={slot.player}
                    isCaptain={slot.isCaptain}
                    slotLine={row.line}
                    showPoints={showPoints}
                    points={slot.player ? pointsByPlayer[slot.player.id] ?? 0 : 0}
                    onClick={() => onSlotClick && onSlotClick(slotIdx)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
