'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error); return }
    setDone(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-ffc-surface rounded-2xl p-6 border border-ffc-muted">
        {done ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-3">Password set!</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              You can now sign in with your new password.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-ffc-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-4">Set a new password</h2>
            {error && (
              <div className="bg-red-900/50 border border-red-600 text-red-300 text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-ffc-dark border border-ffc-muted rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-ffc-gold transition-colors"
                  required
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-ffc-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? '…' : 'Set password'}
              </button>
            </form>
          </>
        )}
        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/login" className="text-ffc-gold font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
