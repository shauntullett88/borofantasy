'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-ffc-surface rounded-2xl p-6 border border-ffc-muted">
        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-white mb-3">Check your email</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              If an account exists for <span className="text-ffc-gold font-semibold">{email}</span>, we've sent a password reset link.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-4">Forgot password</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-ffc-dark border border-ffc-muted rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-ffc-gold transition-colors"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ffc-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? '…' : 'Send reset link'}
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
