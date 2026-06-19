// app/api/scrape-match/route.js
//
// Fetches recent @FarnboroughFC tweets via the official X API v2,
// uses Claude vision to extract player names from goal/card images,
// and parses them for match stats. Returns a PREVIEW — does NOT write to DB.
//
// POST body: { players: Player[] }
// Response:  { parsed: ParsedStats[], tweets: TweetMeta[], warnings: string[] }

import { NextResponse } from 'next/server'

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const FARNBOROUGH_USERNAME = 'FarnboroughFC'

// ─── Fetch tweets + media from X API v2 ──────────────────────────────────────

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

  // Step 2: fetch recent tweets including media fields
  const timelineRes = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets` +
    `?max_results=100` +
    `&exclude=retweets,replies` +
    `&tweet.fields=created_at,text,attachments` +
    `&expansions=attachments.media_keys` +
    `&media.fields=url,preview_image_url,type`,
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
  const tweets = timelineData?.data || []

  // Build media_key → url lookup from the includes
  const mediaMap = {}
  for (const m of (timelineData?.includes?.media || [])) {
    // Photos have url, videos have preview_image_url
    mediaMap[m.media_key] = m.url || m.preview_image_url || null
  }

  // Return tweets with their image URLs attached
  return tweets.map((t) => ({
    text: t.text,
    imageUrls: (t.attachments?.media_keys || [])
      .map((k) => mediaMap[k])
      .filter(Boolean),
  }))
}

// ─── Claude vision: extract player name from a goal/card image ───────────────

async function extractPlayerNameFromImage(imageUrl, context) {
  try {
    // Fetch the image and convert to base64
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(6000) })
    if (!imgRes.ok) return null

    const arrayBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: contentType, data: base64 },
              },
              {
                type: 'text',
                text: `This is a football club social media graphic. Context: "${context}". 
Extract ONLY the player name shown in large text on this image. 
Reply with just the player's full name and nothing else. 
If you cannot see a clear player name, reply with exactly: NONE`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return null
    const data = await res.json()
    const name = data?.content?.[0]?.text?.trim()
    return name && name !== 'NONE' ? name : null
  } catch {
    return null
  }
}

// ─── Fuzzy player name matching ──────────────────────────────────────────────

function normaliseName(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim()
}

function matchPlayerName(text, players) {
  const normText = normaliseName(text)
  const matched = []

  for (const player of players) {
    const parts = player.name.split(' ')
    const firstName = normaliseName(parts[0])
    const lastName = normaliseName(parts[parts.length - 1])
    const fullName = normaliseName(player.name)

    if (
      normText.includes(fullName) ||
      normText.includes(lastName) ||
      (firstName.length > 3 && normText.includes(firstName))
    ) {
      matched.push(player)
    }
  }

  return matched
}

// ─── Event detection helpers ──────────────────────────────────────────────────

function isGoalTweet(text) {
  const lower = text.toLowerCase()
  return (
    lower.includes('goal') ||
    lower.includes('⚽') ||
    lower.includes('scores') ||
    lower.includes('adds a second') ||
    lower.includes('adds another') ||
    lower.includes('skipper') && lower.includes('second') ||
    lower.includes('we lead') ||
    lower.includes("we're ahead") ||
    /\d-\d/.test(lower)
  )
}

function isAssistTweet(text) {
  const lower = text.toLowerCase()
  return lower.includes('assist') || lower.includes('set up by') || lower.includes('teed up')
}

function isYellowCardTweet(text) {
  const lower = text.toLowerCase()
  return lower.includes('yellow card') || lower.includes('booked') || lower.includes('🟨')
}

function isRedCardTweet(text) {
  const lower = text.toLowerCase()
  return lower.includes('red card') || lower.includes('sent off') || lower.includes('🟥')
}

function isLineupTweet(text) {
  const lower = text.toLowerCase()
  return (
    lower.includes('starting xi') ||
    lower.includes('line up') ||
    lower.includes('line-up') ||
    lower.includes('team news') ||
    lower.includes("here's how we line up") ||
    lower.includes("tonight's starting") ||
    lower.includes("this evening's starting") ||
    lower.includes("this afternoon's starting")
  )
}

function isSubsTweet(text) {
  const lower = text.toLowerCase()
  return lower.includes('bench:') || lower.includes('subs:') || lower.includes('substitutes:')
}

function parseCleanSheet(tweets) {
  for (const t of tweets) {
    const lower = t.text.toLowerCase()
    if (lower.includes('clean sheet') || lower.includes('clean-sheet')) return true
    const ftMatch = t.text.match(/(?:ft|full.?time)[^\d]*(\d+)[^\d]+(\d+)/i)
    if (ftMatch) return null
  }
  return false
}

// ─── Main parser ──────────────────────────────────────────────────────────────

async function parseTweets(tweets, players) {
  const goals = {}
  const assists = {}
  const yellowCards = new Set()
  const redCards = new Set()
  const starters = new Set()
  const subs = new Set()
  const warnings = []
  const tweetLog = [] // for the "show tweets" panel

  for (const tweet of tweets) {
    const { text, imageUrls } = tweet
    const lower = text.toLowerCase()
    let logEntry = { text, imageUrls, detectedEvent: null, resolvedPlayer: null }

    // ── Lineup detection (text-based — clubs usually post names in text) ──
    if (isLineupTweet(text) && !isSubsTweet(text)) {
      const matched = matchPlayerName(text, players)
      for (const p of matched) starters.add(p.id)
      logEntry.detectedEvent = 'lineup'
    } else if (isSubsTweet(text)) {
      const matched = matchPlayerName(text, players)
      for (const p of matched) subs.add(p.id)
      logEntry.detectedEvent = 'subs'
    }

    // ── Goal detection ──
    else if (isGoalTweet(text)) {
      logEntry.detectedEvent = 'goal'

      // First try matching from tweet text
      let matched = matchPlayerName(text, players)

      // If no match from text and there's an image, try Claude vision
      if (matched.length === 0 && imageUrls.length > 0) {
        const extractedName = await extractPlayerNameFromImage(imageUrls[0], text)
        if (extractedName) {
          logEntry.resolvedPlayer = extractedName
          matched = matchPlayerName(extractedName, players)
          if (matched.length === 0) {
            warnings.push(`Vision extracted "${extractedName}" from goal image but couldn't match to a player — assign manually.`)
          }
        } else {
          warnings.push(`Goal detected ("${text.slice(0, 60)}…") but player name not found in text or image — assign manually.`)
        }
      } else if (matched.length > 1) {
        warnings.push(`Ambiguous goal tweet (multiple players matched): "${text.slice(0, 80)}…"`)
      }

      if (matched.length === 1) {
        goals[matched[0].id] = (goals[matched[0].id] || 0) + 1
        logEntry.resolvedPlayer = matched[0].name
      }
    }

    // ── Assist detection ──
    else if (isAssistTweet(text)) {
      logEntry.detectedEvent = 'assist'
      let matched = matchPlayerName(text, players)

      if (matched.length === 0 && imageUrls.length > 0) {
        const extractedName = await extractPlayerNameFromImage(imageUrls[0], text)
        if (extractedName) {
          logEntry.resolvedPlayer = extractedName
          matched = matchPlayerName(extractedName, players)
        }
      }

      if (matched.length === 1) {
        assists[matched[0].id] = (assists[matched[0].id] || 0) + 1
        logEntry.resolvedPlayer = matched[0].name
      } else if (matched.length > 1) {
        warnings.push(`Ambiguous assist tweet: "${text.slice(0, 80)}…"`)
      }
    }

    // ── Card detection ──
    else if (isYellowCardTweet(text) || isRedCardTweet(text)) {
      const isRed = isRedCardTweet(text)
      logEntry.detectedEvent = isRed ? 'red_card' : 'yellow_card'
      let matched = matchPlayerName(text, players)

      if (matched.length === 0 && imageUrls.length > 0) {
        const extractedName = await extractPlayerNameFromImage(imageUrls[0], text)
        if (extractedName) {
          logEntry.resolvedPlayer = extractedName
          matched = matchPlayerName(extractedName, players)
        }
      }

      if (matched.length === 1) {
        if (isRed) redCards.add(matched[0].id)
        else yellowCards.add(matched[0].id)
        logEntry.resolvedPlayer = matched[0].name
      } else if (matched.length === 0) {
        warnings.push(`${isRed ? 'Red' : 'Yellow'} card detected but no player matched — assign manually.`)
      }
    }

    tweetLog.push(logEntry)
  }

  return { goals, assists, yellowCards, redCards, starters, subs, warnings, tweetLog }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    if (!TWITTER_BEARER_TOKEN) {
      return NextResponse.json({ error: 'TWITTER_BEARER_TOKEN env var is not set' }, { status: 500 })
    }
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY env var is not set' }, { status: 500 })
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

    const { goals, assists, yellowCards, redCards, starters, subs, warnings, tweetLog } =
      await parseTweets(tweets, players)

    const cleanSheet = parseCleanSheet(tweets)

    if (starters.size === 0) {
      warnings.push('No lineup tweet found — starter/sub data will need manual entry.')
    }

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
      tweetLog,
      warnings,
      cleanSheetUncertain: cleanSheet === null,
    })
  } catch (err) {
    console.error('scrape-match error:', err)
    return NextResponse.json({ error: 'Unexpected error: ' + err.message }, { status: 500 })
  }
}
