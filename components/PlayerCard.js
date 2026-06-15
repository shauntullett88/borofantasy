import { POSITION_COLORS } from '../lib/game'

const STATUS_STYLES = {
  active: '',
  injured: 'border-yellow-500 opacity-80',
  left: 'border-red-600 opacity-70',
}

const STATUS_BADGE = {
  active: null,
  injured: { label: 'INJ', cls: 'bg-yellow-500 text-black' },
  left: { label: 'LEFT', cls: 'bg-red-600 text-white' },
}

export default function PlayerCard({
  player,
  isCaptain,
  onSelect,
  onRemove,
  onSetCaptain,
  compact = false,
  showPoints = false,
  points,
}) {
  const status = player.status || 'active'
  const badge = STATUS_BADGE[status]
  const posColor = POSITION_COLORS[player.position] || 'bg-gray-600 text-white'

  return (
    <div
      className={`relative bg-ffc-surface rounded-xl border ${
        isCaptain ? 'border-ffc-gold' : status === 'left' ? 'border-red-600' : status === 'injured' ? 'border-yellow-500' : 'border-ffc-muted'
      } ${compact ? 'p-3' : 'p-4'} transition-all`}
    >
      {/* Captain crown */}
      {isCaptain && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm">👑</span>
      )}

      <div className="flex items-center gap-3">
        {/* Position badge */}
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${posColor} shrink-0`}>
          {player.position}
        </span>

        {/* Name */}
        <span className={`flex-1 font-semibold text-sm truncate ${status === 'left' ? 'text-red-400 line-through' : status === 'injured' ? 'text-yellow-300' : 'text-white'}`}>
          {player.name}
        </span>

        {/* Status badge */}
        {badge && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>
            {badge.label}
          </span>
        )}

        {/* Points */}
        {showPoints && (
          <span className="text-ffc-gold font-bold text-sm shrink-0">{points ?? 0}pts</span>
        )}
      </div>

      {/* Actions */}
      {(onRemove || onSetCaptain) && (
        <div className="flex gap-2 mt-2">
          {onSetCaptain && !isCaptain && status === 'active' && (
            <button
              onClick={() => onSetCaptain(player.id)}
              className="text-xs text-ffc-gold border border-ffc-gold rounded px-2 py-0.5 hover:bg-ffc-gold hover:text-black transition-colors"
            >
              Set Captain
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(player.id)}
              className="text-xs text-red-400 border border-red-800 rounded px-2 py-0.5 hover:bg-red-900 transition-colors ml-auto"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Select button */}
      {onSelect && (
        <button
          onClick={() => onSelect(player)}
          disabled={status !== 'active'}
          className="mt-2 w-full text-xs bg-ffc-pitch hover:bg-ffc-pitch-light disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-1.5 font-semibold transition-colors"
        >
          {status !== 'active' ? 'Unavailable' : 'Select'}
        </button>
      )}
    </div>
  )
}
