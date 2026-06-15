'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthContext'

const navItems = [
  { href: '/my-team', label: 'My Team', icon: '⚽' },
  { href: '/transfers', label: 'Transfers', icon: '🔄' },
  { href: '/leaderboard', label: 'Table', icon: '🏆' },
  { href: '/admin', label: 'Admin', icon: '⚙️', adminOnly: true },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuth()

  const items = navItems.filter((i) => !i.adminOnly || profile?.is_admin)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-ffc-surface border-t border-ffc-muted safe-bottom z-50">
      <div className="flex">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                active ? 'text-ffc-gold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className={active ? 'font-semibold' : ''}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
