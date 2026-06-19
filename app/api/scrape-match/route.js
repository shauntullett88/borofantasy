// app/api/scrape-match/route.js
//
// Fetches recent @FarnboroughFC tweets via the official X API v2
// and parses them for match stats. Returns a PREVIEW — does NOT write to DB.
//
// POST body: { players: Player[] }
// Response:  { parsed: ParsedStats[], tweets: string[], warnings: string[] }

import { NextResponse } from 'next/server'

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN
const FARNBOROUGH_USERNAME = 'FarnboroughFC'

// ─── Fetch tweets from X API v2 ──────────────────────────────────────────────

async function fetchTweets() {
  // Step 1: resolve username → user ID
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${FARNBOROUGH_USERNAME}`,
    {
      headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    }
  )

  if (!userRes.ok) {
    const err = await userRes.text()
    throw new Error(`X API user lookup failed (${userRes.status}): ${err}`)
  }

  const userData = await userRes.json()
  const userId = userData?.data?.id
  if (!userId) throw new Error('Could not resolve @FarnboroughFC user ID')

  // Step 2: fetch their recent tweets (up to 100, excluding retweets and replies)
  const timelineRes = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?max_results=100&exclude=retweets,replies&tweet.fields=created_at,text`,
    {
      headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    }
  )

  if (!timelineRes.ok) {
    const err = await timelineRes.text()
    throw new Error(`X API timeline fetch failed (${timelineRes.status}): ${err}`)
  }

  const timelineData = await timelineRes.json()
  return (timelineData?.data || []).map((t) => t.text)
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

    const isLineupTweet =
      lower.includes('starting xi') ||
      lower.includes('starting lineup') ||
      lower.includes('line up') ||
      lower.includes('line-up') ||
      lower.includes('team news') ||
      lower.includes("here's how we line up") ||
      lower.includes('tonight\'s starting') ||
      lower.includes('this evening\'s starting') ||
      lower.includes('this afternoon\'s starting')

    const isSubsTweet =
      lower.includes('substitute') ||
      lower.includes('bench:') ||
      lower.includes('subs:')

    if (isLineupTweet && !isSubsTweet) {
      const matched = matchPlayerName(tweet, players)
      for (const p of matched) starters.add(p.id)
    } else if (isSubsTweet) {
      const matched = matchPlayerName(tweet, players)
      for (const p of matched) subs.add(p.id)
    } else if (isLineupTweet) {
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
  const goals = {}
  const warnings = []

  for (const tweet of tweets) {
    const lower = tweet.toLowerCase()

    const isGoalTweet =
      lower.includes('goal') ||
      lower.includes('⚽') ||
      lower.includes('scores') ||
      lower.includes('we\'re ahead') ||
      lower.includes('we lead') ||
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
  const assists = {}
  const warnings = []

  for (const tweet of tweets) {
    const lower = tweet.toLowerCase()
    const isAssistTweet =
      lower.includes('assist') ||
      lower.includes('set up by') ||
      lower.includes('laid on by') ||
      lower.includes('teed up')

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
      } else {
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

    // Try to infer from FT score — look for a 0 on the opponent side
    // Farnborough tweets tend to be "FT: Farnborough 2-0 Opponent"
    const ftMatch = tweet.match(/(?:ft|full.?time)[^\d]*(\d+)[^\d]+(\d+)/i)
    if (ftMatch) return null // uncertain — let admin decide
  }
  return false
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    if (!TWITTER_BEARER_TOKEN) {
      return NextResponse.json({ error: 'TWITTER_BEARER_TOKEN env var is not set' }, { status: 500 })
    }

    const { players } = await request.json()
    if (!players?.length) {
      return NextResponse.json({ error: 'players array is required' }, { status: 400 })
    }

    let tweets
    try {
      tweets = await fetchTweets()
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }

    if (!tweets.length) {
      return NextResponse.json({ error: 'No tweets returned from X API.' }, { status: 502 })
    }

    const { starters, subs, warnings: lineupWarnings } = parseLineup(tweets, players)
    const { goals, warnings: goalWarnings } = parseGoals(tweets, players)
    const { assists, warnings: assistWarnings } = parseAssists(tweets, players)
    const { yellowCards, redCards, warnings: cardWarnings } = parseBookings(tweets, players)
    const cleanSheet = parseCleanSheet(tweets)

    const allWarnings = [...lineupWarnings, ...goalWarnings, ...assistWarnings, ...cardWarnings]

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
        played90: isStarter && !isSub,
        goals: goals[player.id] || 0,
        assists: assists[player.id] || 0,
        clean_sheet: isGkOrDef ? (cleanSheet === true) : false,
        yellow_card: yellowCards.has(player.id),
        red_card: redCards.has(player.id),
      }
    })

    return NextResponse.json({
      parsed,
      tweets: tweets.slice(0, 50),
      warnings: allWarnings,
      cleanSheetUncertain: cleanSheet === null,
    })
  } catch (err) {
    console.error('scrape-match error:', err)
    return NextResponse.json({ error: 'Unexpected error: ' + err.message }, { status: 500 })
  }
}
