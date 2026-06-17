'use client'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export default function TopHeader() {
  const pathname = usePathname()
  if (pathname === '/login' || pathname === '/') return null

  return (
    <div className="flex items-center justify-center gap-2 py-2.5 bg-ffc-dark border-b border-ffc-muted/50">
      <div className="w-7 h-7 relative shrink-0">
        <Image src="/badge.png" alt="Farnborough FC" fill className="object-contain" priority />
      </div>
      <span className="font-display text-sm tracking-widest text-white">FARNBOROUGH</span>
      <span className="font-display text-sm tracking-widest text-ffc-gold">FANTASY LEAGUE</span>
    </div>
  )
}
