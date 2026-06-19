// app/api/scrape-match/route.js
//
// Fetches recent @FarnboroughFC tweets from a public Nitter instance
// and parses them for match stats. Returns a PREVIEW — does NOT write to DB.
//
// POST body: { matchId: string, matchDate: string, players: Player[] }
// Response:  { parsed: ParsedStats[], tweets: string[], warnings: string[] }

import { NextResponse } from 'next/server'

// Nitter instances to try in order (they go up and down)
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.cz',
]

const FARNBOROUGH_HANDLE = 'FarnboroughFC'

// ─── Fetch tweets from Nitter ────────────────────────────────────────────────

async function fetchTweets(handle) {
  let lastError = null

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/${handle}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FFL-Bot/1.0)' },
        signal: AbortSignal.timeout(7000), // 7s — leaves headroom for Vercel 10s limit
      })

      if (!res.ok) continue

      const html = await res.text()
      return extractTweetsFromHTML(html)
    } catch (err) {
      lastError = err
      continue
    }
  }

  throw new Error(`All Nitter instances failed. Last error: ${lastError?.message}`)
}

function extractTweetsFromHTML(html) {
  // Nitter renders tweets in <div class="tweet-content"> elements
  const tweets = []
  const regex = /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    // Strip HTML tags and decode basic entities
    const text = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length > 5) tweets.push(text)
  }
  return tweets
}

// ─── Fuzzy player name matching ──────────────────────────────────────────────

function normaliseName(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim()
}

function matchPlayerName(tweetText, players) {
  const normTweet = normaliseName(tweetText)
  const matched = []

  for (const player of players) {
    const parts = player.name.split(' ')
    const firstName = normaliseName(parts[0])
    const lastName = normaliseName(parts[parts.length - 1])
    const fullName = normaliseName(player.name)

    // Match on full name, or surname alone (most common in tweets)
    if (
      normTweet.includes(fullName) ||
      normTweet.includes(lastName) ||
      (firstName.length > 3 && normTweet.includes(firstName))
    ) {
      matched.push(player)
    }
  }

  return matched
}

// ─── Tweet parsers ────────────────────────────────────────────────────────────

function parseLineup(tweets, players) {
  const starters = new Set()
  const subs = new Set()
  const warnings = []

  for (const tweet of tweets) {
    const lower = tweet.toLowerCase()

    // Look for lineup tweets: "Starting XI", "Line up", "Team news", "Here's how we line up"
    const isLineupTweet =
      lower.includes('starting xi') ||
      lower.includes('starting lineup') ||
      lower.includes('line up') ||
      lower.includes('line-up') ||
      lower.includes('team news') ||
      lower.includes("here's how we line up") ||
      lower.includes('tonight\'s starting')

    const isSubsTweet =
      lower.includes('substitute') ||
      lower.includes('bench') ||
      lower.includes('subs:')

    if (isLineupTweet && !isSubsTweet) {
      const matched = matchPlayerName(tweet, players)
      for (const p of matched) starters.add(p.id)
    } else if (isSubsTweet) {
      const matched = matchPlayerName(tweet, players)
      for (const p of matched) subs.add(p.id)
    } else if (isLineupTweet) {
      // Combined tweet — treat all as starters (common format)
      const matched = matchPlayerName(tweet, players)
      for (const p of matched) starters.add(p.id)
    }
  }

  if (starters.size === 0) {
    warnings.push('No lineup tweet found — starter/sub data will need manual entry.')
  }

  return { starters, subs, warnings }
}

function parseGoals(tweets, players) {
  const goals = {} // playerId → count
  const warnings = []

  for (const tweet of tweets) {
    const lower = tweet.toLowerCase()

    // Goal indicators
    const isGoalTweet =
      lower.includes('goal') ||
      lower.includes('⚽') ||
      lower.includes('scores') ||
      lower.includes('1-0') || lower.includes('2-0') || lower.includes('2-1') ||
      lower.includes('3-0') || lower.includes('3-1') || lower.includes('3-2') ||
      /\d-\d/.test(lower)

    if (isGoalTweet) {
      const matched = matchPlayerName(tweet, players)
      if (matched.length === 1) {
        goals[matched[0].id] = (goals[matched[0].id] || 0) + 1
      } else if (matched.length > 1) {
        warnings.push(`Ambiguous goal tweet (multiple players matched): "${tweet.slice(0, 80)}…"`)
      }
    }
  }

  return { goals, warnings }
}

function parseAssists(tweets, players) {
  const assists = {} // playerId → count
  const warnings = []

  for (const tweet of tweets) {
    const lower = tweet.toLowerCase()
    const isAssistTweet = lower.includes('assist') || lower.includes('set up by') || lower.includes('laid on by')

    if (isAssistTweet) {
      const matched = matchPlayerName(tweet, players)
      if (matched.length === 1) {
        assists[matched[0].id] = (assists[matched[0].id] || 0) + 1
      } else if (matched.length > 1) {
        warnings.push(`Ambiguous assist tweet (multiple players matched): "${tweet.slice(0, 80)}…"`)
      }
    }
  }

  return { assists, warnings }
}

function parseBookings(tweets, players) {
  const yellowCards = new Set()
  const redCards = new Set()
  const warnings = []

  for (const tweet of tweets) {
    const lower = tweet.toLowerCase()
    const isYellow = lower.includes('yellow card') || lower.includes('booked') || lower.includes('🟨')
    const isRed = lower.includes('red card') || lower.includes('sent off') || lower.includes('🟥')

    if (isYellow || isRed) {
      const matched = matchPlayerName(tweet, players)
      if (matched.length === 1) {
        if (isRed) redCards.add(matched[0].id)
        else yellowCards.add(matched[0].id)
      } else if (matched.length > 1) {
        warnings.push(`Ambiguous card tweet (multiple players matched): "${tweet.slice(0, 80)}…"`)
      } else if (matched.length === 0) {
        warnings.push(`Card tweet found but no player matched: "${tweet.slice(0, 80)}…"`)
      }
    }
  }

  return { yellowCards, redCards, warnings }
}

function parseCleanSheet(tweets) {
  for (const tweet of tweets) {
    const lower = tweet.toLowerCase()
    if (lower.includes('clean sheet') || lower.includes('clean-sheet')) return true

    // Infer from final score — if FFC kept a clean sheet the score ends in " 0" or "-0"
    // e.g. "FT: Farnborough 2-0" or "Full time: 1-0"
    const ftMatch = tweet.match(/(?:ft|full.?time)[^\d]*(\d+)[^\d]+(\d+)/i)
    if (ftMatch) {
      // We don't know which number is ours vs opponent without more context,
      // so flag it as uncertain and let the admin decide
      return null // null = uncertain
    }
  }
  return false
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const { players } = await request.json()

    if (!players?.length) {
      return NextResponse.json({ error: 'players array is required' }, { status: 400 })
    }

    // Fetch tweets
    let tweets
    try {
      tweets = await fetchTweets(FARNBOROUGH_HANDLE)
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }

    if (!tweets.length) {
      return NextResponse.json({ error: 'No tweets found — Nitter may be down. Try again or enter stats manually.' }, { status: 502 })
    }

    // Parse everything
    const { starters, subs, warnings: lineupWarnings } = parseLineup(tweets, players)
    const { goals, warnings: goalWarnings } = parseGoals(tweets, players)
    const { assists, warnings: assistWarnings } = parseAssists(tweets, players)
    const { yellowCards, redCards, warnings: cardWarnings } = parseBookings(tweets, players)
    const cleanSheet = parseCleanSheet(tweets)

    const allWarnings = [...lineupWarnings, ...goalWarnings, ...assistWarnings, ...cardWarnings]

    // Build per-player parsed stats
    const parsed = players.map((player) => {
      const isStarter = starters.has(player.id)
      const isSub = subs.has(player.id)
      const isGkOrDef = player.position === 'GK' || player.position === 'DEF'

      return {
        player_id: player.id,
        player_name: player.name,
        position: player.position,
        started: isStarter,
        sub_on: isSub,
        appearance: isStarter || isSub,
        played90: isStarter && !isSub, // rough heuristic — admin can correct
        goals: goals[player.id] || 0,
        assists: assists[player.id] || 0,
        clean_sheet: isGkOrDef ? (cleanSheet === true) : false,
        yellow_card: yellowCards.has(player.id),
        red_card: redCards.has(player.id),
      }
    })

    return NextResponse.json({
      parsed,
      tweets: tweets.slice(0, 30), // return tweets so admin can review
      warnings: allWarnings,
      cleanSheetUncertain: cleanSheet === null,
    })
  } catch (err) {
    console.error('scrape-match error:', err)
    return NextResponse.json({ error: 'Unexpected error: ' + err.message }, { status: 500 })
  }
}
