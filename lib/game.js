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

// ─── Transfer windows ─────────────────────────────────────────────────────────
// Windows open at 11:00 UK time on the start date and close at 11:00 UK time
// on the end date. UK time automatically accounts for BST/GMT.
//
// Season timeline (repeats every year from the August lock):
//   Pre-season:      app launch  → Aug 7 11:00 UK   (one-off, first season only)
//   October window:  Oct 1 11:00 UK → Oct 7 11:00 UK
//   January window:  Jan 1 11:00 UK → Jan 7 11:00 UK
//   March window:    Mar 1 11:00 UK → Mar 7 11:00 UK
//   (then locked until the following Aug 7, when the cycle repeats next season)

// The season "starts" being locked again each year on Aug 7. Anything between
// Mar 7 and the following Aug 7 with no other window active is just closed —
// there is no second pre-season window after the first year.
const SEASON_START_YEAR = 2026 // first year this app is used — adjust if redeployed for a new season start

function ukTimeToUTC(year, month, day, hourUK = 11) {
  const isBST = isLikelyBST(year, month, day)
  const utcHour = hourUK - (isBST ? 1 : 0)
  return new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0))
}

function isLikelyBST(year, month, day) {
  // BST runs from the last Sunday in March to the last Sunday in October.
  // Mar 1 and Oct 7 (the only edge dates we use) always fall outside BST,
  // so this simple month-based check is safe for our fixed window dates.
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

// Builds the ordered list of all windows for a given "season year" (the year
// whose August defines that season's lock-in date), e.g. seasonYear=2026 covers
// the window that runs Aug 7 2026 → the following Aug 7 2027.
function buildSeasonWindows(seasonYear) {
  const isFirstSeason = seasonYear === SEASON_START_YEAR
  return [
    // Pre-season only exists for the very first season (no prior Aug 7 lock to follow)
    ...(isFirstSeason ? [{
      label: 'Pre-season',
      opensAt: null, // always open from app launch
      closesAt: ukTimeToUTC(seasonYear, 8, 7),
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

// Returns all windows across a span of seasons wide enough to safely cover "now"
function relevantWindows(now) {
  const year = now.getFullYear()
  // Build windows for the previous, current, and next season-year to be safe
  // around year boundaries, then sort chronologically.
  const seasons = [year - 1, year, year + 1].filter((y) => y >= SEASON_START_YEAR)
  const all = seasons.flatMap(buildSeasonWindows)
  return all.sort((a, b) => (a.opensAt ?? new Date(0)) - (b.opensAt ?? new Date(0)))
}

// Returns { open: boolean, label, opensAt, closesAt } for "now"
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

// Returns the next upcoming window's { opensAt, closesAt, label }. If a window
// is currently open, returns the one that opens after the current one closes.
export function nextTransferWindow(now = new Date()) {
  const windows = relevantWindows(now).filter((w) => w.opensAt) // skip pre-season for "next" lookups
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
