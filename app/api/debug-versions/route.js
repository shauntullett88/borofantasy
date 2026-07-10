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

export async function GET() {
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
