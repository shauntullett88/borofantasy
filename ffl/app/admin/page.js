'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import AdminPlayers from './AdminPlayers'
import AdminMatches from './AdminMatches'

const TABS = [
  { id: 'players', label: 'Players' },
  { id: 'matches', label: 'Match Stats' },
]

export default function AdminPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState('players')

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login')
      else if (profile && !profile.is_admin) router.push('/my-team')
    }
  }, [user, profile, loading, router])

  if (loading || !profile) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading…</div></div>
  }

  if (!profile.is_admin) return null

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-gray-400 text-sm">Farnborough FC 2026/27</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ffc-surface rounded-xl p-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${tab === t.id ? 'bg-ffc-red text-white' : 'text-gray-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'players' && <AdminPlayers />}
      {tab === 'matches' && <AdminMatches />}
    </div>
  )
}
