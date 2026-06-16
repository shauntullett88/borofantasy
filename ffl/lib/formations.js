// ─── Formation definitions ────────────────────────────────────────────────────
// Each formation is an ordered array of rows from GK to FWD.
// Each row: { line: 'GK'|'DEF'|'MID'|'FWD', count: number }
// Slot indices are assigned in this same order (0 = GK, then DEF.., MID.., FWD..)

export const FORMATIONS = {
  '4-4-2':   [{ line: 'GK', count: 1 }, { line: 'DEF', count: 4 }, { line: 'MID', count: 4 }, { line: 'FWD', count: 2 }],
  '4-3-3':   [{ line: 'GK', count: 1 }, { line: 'DEF', count: 4 }, { line: 'MID', count: 3 }, { line: 'FWD', count: 3 }],
  '4-5-1':   [{ line: 'GK', count: 1 }, { line: 'DEF', count: 4 }, { line: 'MID', count: 5 }, { line: 'FWD', count: 1 }],
  '3-5-2':   [{ line: 'GK', count: 1 }, { line: 'DEF', count: 3 }, { line: 'MID', count: 5 }, { line: 'FWD', count: 2 }],
  '3-4-3':   [{ line: 'GK', count: 1 }, { line: 'DEF', count: 3 }, { line: 'MID', count: 4 }, { line: 'FWD', count: 3 }],
  '5-3-2':   [{ line: 'GK', count: 1 }, { line: 'DEF', count: 5 }, { line: 'MID', count: 3 }, { line: 'FWD', count: 2 }],
  '5-4-1':   [{ line: 'GK', count: 1 }, { line: 'DEF', count: 5 }, { line: 'MID', count: 4 }, { line: 'FWD', count: 1 }],
  '4-2-3-1': [{ line: 'GK', count: 1 }, { line: 'DEF', count: 4 }, { line: 'MID', count: 2 }, { line: 'MID', count: 3 }, { line: 'FWD', count: 1 }],
}

export const DEFAULT_FORMATION = '4-4-2'

// Flat array of 11 slot descriptors: [{ idx, line }, ...] in GK→FWD order
export function buildSlots(formationKey) {
  const rows = FORMATIONS[formationKey] || FORMATIONS[DEFAULT_FORMATION]
  const slots = []
  let idx = 0
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      slots.push({ idx: idx++, line: row.line })
    }
  }
  return slots
}

// Rows grouped for rendering top (FWD) → bottom (GK) on screen,
// each row carrying the slot indices that belong to it.
export function getDisplayRows(formationKey) {
  const rows = FORMATIONS[formationKey] || FORMATIONS[DEFAULT_FORMATION]
  let cursor = 0
  const rowSlotMap = rows.map((row) => {
    const indices = []
    for (let i = 0; i < row.count; i++) indices.push(cursor++)
    return { line: row.line, indices }
  })
  return [...rowSlotMap].reverse() // FWD displayed at top
}

// Given a formation and a position, return all slot indices that can hold it
export function eligibleSlotIndices(formationKey, position) {
  const slots = buildSlots(formationKey)
  return slots.filter((s) => s.line === position).map((s) => s.idx)
}

// Count how many slots of each line exist in a formation
export function lineCounts(formationKey) {
  const rows = FORMATIONS[formationKey] || FORMATIONS[DEFAULT_FORMATION]
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const row of rows) counts[row.line] += row.count
  return counts
}
