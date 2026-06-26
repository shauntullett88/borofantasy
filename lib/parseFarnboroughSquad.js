// lib/parseFarnboroughSquad.js
//
// Parses the Farnborough FC men's first-team squad page HTML into a list of
// { name, position } where position is one of GK / DEF / MID / FWD.
//
// The squad page (Touchline "vardy" theme) renders each player as:
//   <div class="player-list-item team-mens-first-team position-defender">
//     <span class="player-first-name">Sam</span>
//     <span class="player-last-name">Okoye</span>
//     <span class="tax tax-position">Defender</span>
//   </div>
// Coaching staff use position-staff and live in a separate list, so they are
// excluded both by scoping to the men's-first-team list and by position check.

import * as cheerio from 'cheerio'

const POSITION_FROM_CLASS = {
  goalkeeper: 'GK',
  defender: 'DEF',
  midfielder: 'MID',
  forward: 'FWD',
}

const NON_PLAYER_CLASSES = new Set(['staff', 'coach', 'manager', 'management', 'official'])

// Fallback: map free-text position labels to our codes
function positionFromText(text) {
  const t = (text || '').toLowerCase()
  if (/goal|keeper|\bgk\b/.test(t)) return 'GK'
  if (/defend|back|\bcb\b|\brb\b|\blb\b/.test(t)) return 'DEF'
  if (/midfield|winger|\bcm\b|\bdm\b|\bam\b/.test(t)) return 'MID'
  if (/forward|striker|attack|\bcf\b|\bst\b/.test(t)) return 'FWD'
  return null
}

export function parseSquadHtml(html) {
  const $ = cheerio.load(html)

  // Prefer the men's first-team list; fall back progressively.
  let items = $('.player-list-mens-first-team .player-list-item')
  if (items.length === 0) items = $('.player-list .player-list-item')
  if (items.length === 0) items = $('.player-list-item')

  const players = []

  items.each((_, el) => {
    const cls = ($(el).attr('class') || '').toLowerCase()
    const match = cls.match(/position-([a-z-]+)/)
    const posKey = match ? match[1] : ''

    if (NON_PLAYER_CLASSES.has(posKey)) return // skip coaching staff etc.

    let position = POSITION_FROM_CLASS[posKey]
    if (!position) {
      position = positionFromText($(el).find('.tax-position').first().text())
    }
    if (!position) return // unknown / not a player

    const first = $(el).find('.player-first-name').first().text().trim()
    const last = $(el).find('.player-last-name').first().text().trim()
    let name = `${first} ${last}`.replace(/\s+/g, ' ').trim()
    if (!name) name = $(el).find('.card-title').first().text().replace(/\s+/g, ' ').trim()
    if (!name) return

    players.push({ name, position })
  })

  // De-duplicate by name (case-insensitive)
  const seen = new Set()
  return players.filter((p) => {
    const key = p.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
