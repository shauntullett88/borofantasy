import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from './auth.config'

const { auth } = NextAuth(authConfig)

const PROTECTED_PATHS = ['/my-team', '/squad', '/leaderboard', '/admin', '/rules']

export default auth((req) => {
  const isProtected = PROTECTED_PATHS.some((path) => req.nextUrl.pathname.startsWith(path))
  if (isProtected && !req.auth?.user) {
    const loginUrl = new URL('/login', req.nextUrl.origin)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ['/my-team/:path*', '/squad/:path*', '/leaderboard/:path*', '/admin/:path*', '/rules/:path*'],
}
