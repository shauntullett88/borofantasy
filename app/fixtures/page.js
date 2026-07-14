'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import HomeAwayBadge from '../../components/HomeAwayBadge'

const RESULT_STYLE = {
  W: 'bg-green-800 text-green-300',
  D: 'bg-yellow-800 text-yellow-300',
  L: 'bg-red-900 text-red-300',
}

export default function FixturesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [matches, setMatches] = useState([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    async function fetchMatches() {
      setFetching(true)
      const res = await fetch('/api/matches')
      const { matches } = await res.json()
      setMatches(matches || [])
      setFetching(false)
    }
    fetchMatches()
  }, [user])

  if (loading || fetching) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading fixtures…</div></div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <p className="text-gray-400 text-sm">2026/27 Season</p>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-gray-400">No fixtures yet — check back soon.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-ffc-surface rounded-xl px-4 py-3 border border-ffc-muted">
              <HomeAwayBadge home={m.home} />
              <span className="flex-1 text-sm font-medium">{m.opponent}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              {m.result ? (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${RESULT_STYLE[m.result] || 'bg-gray-700 text-gray-400'}`}>
                  {m.result}
                </span>
              ) : (
                <span className="text-xs text-gray-600 shrink-0">—</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
