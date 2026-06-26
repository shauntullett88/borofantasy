// ─── Scoring ─────────────────────────────────────────────────────────────────
//
// Scoring rules:
//   Start (in opening XI)     +2 pts
//   Sub on                    +1 pt
//   Goal                     +10 pts
//   Win (if played)           +2 pts
//   Loss (if played)          -1 pt
//   Draw (if played)           0 pts
//   Clean sheet (GK/DEF only) +2 pts  (only if played)
//   Yellow card               -1 pt
//   Red card                  -5 pts
//   Captain                    x2 (applied after all other points)
//   Bench (did not play)        0 pts

export function calculatePoints(stats, isBench, position, isCaptain, result) {
  // Bench players who didn't come on score nothing
  if (isBench && !stats.sub_on) return 0

  let points = 0

  const played = stats.started || stats.sub_on || stats.appearance

  if (!played) return 0

  // Appearance points
  if (stats.started) points += 2
  if (stats.sub_on)  points += 1

  // Goals
  points += (stats.goals || 0) * 10

  // Win / Loss (only if the player actually played)
  if (result === 'W') points += 2
  if (result === 'L') points -= 1
  if (result === 'D') points += 1
  // Draw = +1

  // Clean sheet (GK and DEF only, only if played)
  if ((position === 'GK' || position === 'DEF') && stats.clean_sheet) {
    points += 2
  }

  // Bookings
  if (stats.yellow_card) points -= 1
  if (stats.red_card)    points -= 5

  // Captain doubles total points
  if (isCaptain) points *= 2

  return points
}

// ─── Transfer windows ─────────────────────────────────────────────────────────
// Windows open at 11:00 UK time on the start date and close at 11:00 UK time
// on the end date. UK time automatically accounts for BST/GMT.
//
// Season timeline (repeats every year from the August lock):
//   Pre-season:      app launch  → Aug 8 11:00 UK   (one-off, first season only)
//   October window:  Oct 1 11:00 UK → Oct 7 11:00 UK
//   January window:  Jan 1 11:00 UK → Jan 7 11:00 UK
//   March window:    Mar 1 11:00 UK → Mar 7 11:00 UK
//   (then locked until the following Aug 7, when the cycle repeats next season)

const SEASON_START_YEAR = 2026

function ukTimeToUTC(year, month, day, hourUK = 11) {
  const isBST = isLikelyBST(year, month, day)
  const utcHour = hourUK - (isBST ? 1 : 0)
  return new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0))
}

function isLikelyBST(year, month, day) {
  if (month > 3 && month < 10) return true
  if (month === 3) return day >= lastSundayOfMonth(year, 3)
  if (month === 10) return day < lastSundayOfMonth(year, 10)
  return false
}

function lastSundayOfMonth(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const lastDate = new Date(Date.UTC(year, month - 1, lastDay))
  return lastDay - lastDate.getUTCDay()
}

function buildSeasonWindows(seasonYear) {
  const isFirstSeason = seasonYear === SEASON_START_YEAR
  return [
    ...(isFirstSeason ? [{
      label: 'Pre-season',
      opensAt: null,
      closesAt: ukTimeToUTC(seasonYear, 8, 8),
    }] : []),
    {
      label: 'October window',
      opensAt: ukTimeToUTC(seasonYear, 10, 1),
      closesAt: ukTimeToUTC(seasonYear, 10, 7),
    },
    {
      label: 'January window',
      opensAt: ukTimeToUTC(seasonYear + 1, 1, 1),
      closesAt: ukTimeToUTC(seasonYear + 1, 1, 7),
    },
    {
      label: 'March window',
      opensAt: ukTimeToUTC(seasonYear + 1, 3, 1),
      closesAt: ukTimeToUTC(seasonYear + 1, 3, 7),
    },
  ]
}

function relevantWindows(now) {
  const year = now.getFullYear()
  const seasons = [year - 1, year, year + 1].filter((y) => y >= SEASON_START_YEAR)
  const all = seasons.flatMap(buildSeasonWindows)
  return all.sort((a, b) => (a.opensAt ?? new Date(0)) - (b.opensAt ?? new Date(0)))
}

export function getTransferWindowStatus(now = new Date()) {
  const windows = relevantWindows(now)

  for (const w of windows) {
    const afterOpen = w.opensAt ? now >= w.opensAt : true
    const beforeClose = now < w.closesAt
    if (afterOpen && beforeClose) {
      return { open: true, label: w.label, opensAt: w.opensAt, closesAt: w.closesAt }
    }
  }

  return { open: false, label: null, opensAt: null, closesAt: null }
}

export function isTransferWindowOpen(now = new Date()) {
  return getTransferWindowStatus(now).open
}

export function nextTransferWindow(now = new Date()) {
  const windows = relevantWindows(now).filter((w) => w.opensAt)
  const upcoming = windows.find((w) => w.opensAt > now)
  return upcoming || windows[windows.length - 1]
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

// ─── Squad validation ─────────────────────────────────────────────────────────

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
