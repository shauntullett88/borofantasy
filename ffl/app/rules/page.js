'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthContext'
import { getTransferWindowStatus, nextTransferWindow } from '../../lib/game'

function formatUK(date) {
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

const SCORING_ROWS = [
  { event: 'Appearance', starter: '+1', bench: '+1' },
  { event: 'Played 90 minutes', starter: '+2', bench: '+1' },
  { event: 'Goal', starter: '+5', bench: '+2' },
  { event: 'Assist', starter: '+3', bench: '+1' },
  { event: 'Clean sheet (GK / DEF only)', starter: '+2', bench: '+1' },
]

export default function RulesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [windows, setWindows] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    // Walk forward through the next 4 windows using the same logic that
    // actually governs whether transfers are open, so this page can never
    // drift out of sync with the real lock/unlock behaviour.
    const rows = []
    let cursor = new Date()
    const currentStatus = getTransferWindowStatus(cursor)

    if (currentStatus.open) {
      rows.push({ label: currentStatus.label, opens: 'Now (open)', closes: formatUK(currentStatus.closesAt) })
      cursor = currentStatus.closesAt
    }

    for (let i = rows.length; i < 4; i++) {
      const next = nextTransferWindow(cursor)
      rows.push({ label: next.label, opens: formatUK(next.opensAt), closes: formatUK(next.closesAt) })
      cursor = next.closesAt
    }

    setWindows(rows)
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading…</div></div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Rules</h1>
        <p className="text-gray-400 text-sm">Scoring & transfer windows — 2026/27 Season</p>
      </div>

      {/* Scoring */}
      <section className="mb-6">
        <h2 className="text-sm font-bold tracking-widest text-ffc-gold uppercase mb-3">Scoring</h2>
        <div className="bg-ffc-surface rounded-2xl border border-ffc-muted overflow-hidden">
          <div className="grid grid-cols-3 text-xs font-semibold text-gray-400 px-4 py-2 border-b border-ffc-muted">
            <span>Event</span>
            <span className="text-center">Starter</span>
            <span className="text-center">Bench</span>
          </div>
          {SCORING_ROWS.map((row) => (
            <div key={row.event} className="grid grid-cols-3 items-center px-4 py-3 border-b border-ffc-muted last:border-0 text-sm">
              <span>{row.event}</span>
              <span className="text-center text-green-400 font-semibold">{row.starter}</span>
              <span className="text-center text-blue-400 font-semibold">{row.bench}</span>
            </div>
          ))}
        </div>

        <div className="bg-ffc-gold/10 border border-ffc-gold rounded-xl p-3 mt-3 flex items-center gap-3">
          <span className="text-xl">👑</span>
          <p className="text-sm text-ffc-gold">
            Your <strong>captain</strong> earns <strong>double points</strong> — applied after all other scoring for that match.
          </p>
        </div>

        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          Points are calculated automatically whenever the admin enters match stats and your leaderboard total
          updates instantly. Only your captain's points are doubled — bench players never get a captain bonus
          even if marked captain by mistake, since captains must always be chosen from your Starting XI.
        </p>
      </section>

      {/* Transfer windows */}
      <section className="mb-6">
        <h2 className="text-sm font-bold tracking-widest text-ffc-gold uppercase mb-3">Transfer Windows</h2>
        <p className="text-sm text-gray-400 mb-3 leading-relaxed">
          You can only create or change your squad while a transfer window is open. Outside these windows,
          your team is locked exactly as it stands — no swaps, no formation changes, no new captain.
        </p>

        {windows ? (
          <div className="space-y-2">
            {windows.map((w) => (
              <div key={w.label} className="bg-ffc-surface rounded-xl border border-ffc-muted p-3">
                <p className="text-sm font-semibold mb-1">{w.label}</p>
                <p className="text-xs text-gray-400">Opens: <span className="text-white">{w.opens}</span></p>
                <p className="text-xs text-gray-400">Closes: <span className="text-white">{w.closes}</span></p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Loading window dates…</p>
        )}

        <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 mt-3">
          <p className="text-sm text-red-300">
            All windows close at <strong>11:00am UK time</strong> on the closing date. Once closed, your
            squad is locked until the next window opens — also at 11:00am UK time.
          </p>
        </div>
      </section>

      {/* Squad rules */}
      <section className="mb-6">
        <h2 className="text-sm font-bold tracking-widest text-ffc-gold uppercase mb-3">Squad Rules</h2>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex gap-2"><span className="text-ffc-gold">•</span> 11 starting players, arranged on the pitch in your chosen formation</li>
          <li className="flex gap-2"><span className="text-ffc-gold">•</span> 3 substitutes on the bench</li>
          <li className="flex gap-2"><span className="text-ffc-gold">•</span> 1 captain, who must come from your Starting XI</li>
          <li className="flex gap-2"><span className="text-ffc-gold">•</span> No duplicate players across your starters and bench</li>
          <li className="flex gap-2"><span className="text-ffc-gold">•</span> Players marked <span className="text-red-400 font-semibold">Left</span> cannot be selected and must be replaced at the next window</li>
          <li className="flex gap-2"><span className="text-ffc-gold">•</span> Players marked <span className="text-yellow-300 font-semibold">Injured</span> can still be selected but won't score unless they play</li>
        </ul>
      </section>

      <p className="text-xs text-gray-600 text-center">
        Questions about the rules? Ask Shaun.
      </p>
    </div>
  )
}
