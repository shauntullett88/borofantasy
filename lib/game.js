// ─── Scoring ────────────────────────────────────────────────────────────────

export function calculatePoints(stats, isBench, position, isCaptain) {
  let points = 0

  if (isBench) {
    if (stats.played90) points += 1
    if (stats.appearance) points += 1
    points += (stats.goals || 0) * 2
    points += (stats.assists || 0) * 1
    if ((position === 'GK' || position === 'DEF') && stats.clean_sheet) {
      points += 1
    }
  } else {
    if (stats.played90) points += 2
    if (stats.appearance) points += 1
    points += (stats.goals || 0) * 5
    points += (stats.assists || 0) * 3
    if ((position === 'GK' || position === 'DEF') && stats.clean_sheet) {
      points += 2
    }
  }

  if (isCaptain) points *= 2

  return points
}

// ─── Transfer window ─────────────────────────────────────────────────────────

export function isTransferWindowOpen() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  return (
    (month === 10 && day === 1) ||
    (month === 1 && day === 1) ||
    (month === 3 && day === 1)
  )
}

export function nextTransferWindow() {
  const now = new Date()
  const year = now.getFullYear()
  const windows = [
    new Date(year, 0, 1),   // Jan 1
    new Date(year, 2, 1),   // Mar 1
    new Date(year, 9, 1),   // Oct 1
    new Date(year + 1, 0, 1), // Jan 1 next year
  ]
  return windows.find((d) => d > now) || windows[windows.length - 1]
}

// ─── Position helpers ─────────────────────────────────────────────────────────

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
export const STATUSES = ['active', 'injured', 'left']

export const POSITION_COLORS = {
  GK: 'bg-yellow-500 text-black',
  DEF: 'bg-blue-600 text-white',
  MID: 'bg-green-600 text-white',
  FWD: 'bg-red-600 text-white',
}

// ─── Squad validation ────────────────────────────────────────────────────────

export function validateSquad(starters, bench, captainId) {
  const errors = []

  if (starters.length !== 11) errors.push('You must select exactly 11 starting players')
  if (bench.length !== 3) errors.push('You must select exactly 3 bench players')

  const allIds = [...starters.map((p) => p.id), ...bench.map((p) => p.id)]
  const unique = new Set(allIds)
  if (unique.size !== allIds.length) errors.push('Duplicate players detected')

  if (!captainId) errors.push('You must select a captain')
  if (captainId && !starters.find((p) => p.id === captainId)) {
    errors.push('Captain must be in the starting XI')
  }

  const unavailable = [...starters, ...bench].filter((p) => p.status !== 'active')
  if (unavailable.length > 0) {
    errors.push(`Cannot select unavailable players: ${unavailable.map((p) => p.name).join(', ')}`)
  }

  return errors
}

// Validates that each starter's position matches the line of the pitch
// slot they've been placed in (slots come from lib/formations.js)
export function validateFormationSlots(slotAssignments, formationSlots) {
  const errors = []

  for (let i = 0; i < formationSlots.length; i++) {
    const required = formationSlots[i].line
    const player = slotAssignments[i]
    if (player && player.position !== required) {
      errors.push(`${player.name} (${player.position}) cannot be placed in a ${required} slot`)
    }
  }

  return errors
}
