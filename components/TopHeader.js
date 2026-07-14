'use client'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthContext'

export default function TopHeader() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  if (pathname === '/login' || pathname === '/') return null

  async function handleSignOut() {
    await signOut()
    // Hard navigation so the fresh (logged-out) session state is read from
    // the server rather than a stale client cache — same reasoning as the
    // sign-in redirect.
    window.location.href = '/login'
  }

  return (
    <div className="relative flex items-center justify-center gap-2 py-2.5 bg-ffc-dark border-b border-ffc-muted/50">
      <div className="w-7 h-7 relative shrink-0">
        <Image src="/badge.png" alt="Farnborough FC" fill className="object-contain" priority />
      </div>
      <span className="font-display text-sm tracking-widest text-white">FARNBOROUGH</span>
      <span className="font-display text-sm tracking-widest text-ffc-gold">FANTASY LEAGUE</span>
      {user && (
        <button
          onClick={handleSignOut}
          className="absolute right-4 text-xs text-gray-400 hover:text-white border border-ffc-muted rounded-lg px-2.5 py-1 transition-colors"
          type="button"
        >
          Sign out
        </button>
      )}
    </div>
  )
}
