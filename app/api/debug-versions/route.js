import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function readVersion(pkg) {
  try {
    const p = path.join(process.cwd(), 'node_modules', pkg, 'package.json')
    return JSON.parse(fs.readFileSync(p, 'utf8')).version
  } catch (e) {
    return 'ERR: ' + e.message
  }
}

// Only simple numeric webpack chunk filenames (e.g. "712.js") are allowed —
// blocks any path traversal via the query param.
const SAFE_CHUNK_NAME = /^[0-9]+\.js$/

export async function GET(request) {
  // Auth itself is what's under investigation, so this can't use requireAdmin()
  // (circular). Gated by a one-off secret instead; route is deleted once diagnosed.
  const providedSecret = request.headers.get('x-debug-secret')
  if (!process.env.DEBUG_SECRET || providedSecret !== process.env.DEBUG_SECRET) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const inspect = url.searchParams.get('inspect')

  if (inspect) {
    if (!SAFE_CHUNK_NAME.test(inspect)) {
      return NextResponse.json({ error: 'invalid chunk name' }, { status: 400 })
    }
    try {
      const filePath = path.join(process.cwd(), '.next', 'server', 'chunks', inspect)
      const content = fs.readFileSync(filePath, 'utf8')
      const line = parseInt(url.searchParams.get('line') || '1', 10)
      const col = parseInt(url.searchParams.get('col') || '0', 10)
      const lines = content.split('\n')
      const targetLine = lines[line - 1] || ''
      const start = Math.max(0, col - 300)
      const end = Math.min(targetLine.length, col + 300)
      return NextResponse.json({
        lineLength: targetLine.length,
        snippet: targetLine.slice(start, end),
        offsetInSnippet: col - start,
      })
    } catch (e) {
      return NextResponse.json({ error: e.message })
    }
  }

  return NextResponse.json({
    nodeVersion: process.version,
    platform: process.platform,
    authCoreVersion: readVersion('@auth/core'),
    nextAuthVersion: readVersion('next-auth'),
    nextVersion: readVersion('next'),
    pgVersion: readVersion('pg'),
    bcryptjsVersion: readVersion('bcryptjs'),
  })
}
