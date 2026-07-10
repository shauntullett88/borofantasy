'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '../../components/AuthContext'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isRegister) {
      if (!username.trim()) { setError('Name is required'); setLoading(false); return }
      if (!teamName.trim()) { setError('Team name is required'); setLoading(false); return }
      const { error, needsConfirmation } = await signUp(email, password, username.trim(), teamName.trim())
      if (error) { setError(error.message); setLoading(false); return }
      if (needsConfirmation) { setConfirmed(true); setLoading(false); return }
    } else {
      const { error } = await signIn(email, password)
      if (error) {
        const code = error.message ?? ''
        if (code === 'email_not_verified') {
          setError('Please confirm your email first — check your inbox for the link we sent you.')
        } else if (code === 'password_not_set') {
          setError('Please set a password for your account first — use "Forgot password?" below.')
        } else {
          setError('Invalid email or password')
        }
        setLoading(false)
        return
      }
      router.push('/my-team')
    }
    setLoading(false)
  }

  // "Check your email" screen shown after successful registration
  if (confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-ffc-surface rounded-2xl p-8 border border-ffc-muted text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-white mb-3">Check your email!</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            We've sent a confirmation link to <span className="text-ffc-gold font-semibold">{email}</span>.
            Click the link in the email to confirm your account and start building your squad.
          </p>
          <p className="text-gray-600 text-xs">
            Can't find it? Check your spam folder.
          </p>
          <button
            onClick={() => { setConfirmed(false); setIsRegister(false) }}
            className="mt-6 text-ffc-gold text-sm font-semibold hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 mx-auto mb-3 relative">
          <Image src="/badge.png" alt="Farnborough FC" fill className="object-contain" priority />
        </div>
        <h1 className="font-display text-3xl tracking-wider text-white">FARNBOROUGH</h1>
        <p className="text-ffc-gold font-semibold tracking-widest text-sm">FANTASY LEAGUE</p>
        <p className="text-gray-400 text-xs mt-1">2026 / 2027 Season</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-ffc-surface rounded-2xl p-6 border border-ffc-muted">
        <h2 className="text-lg font-bold mb-4">{isRegister ? 'Create Account' : 'Sign In'}</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-600 text-red-300 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Shaun2026"
                className="w-full bg-ffc-dark border border-ffc-muted rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-ffc-gold transition-colors"
                required
              />
            </div>
          )}

          {isRegister && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Shaun's Stars"
                className="w-full bg-ffc-dark border border-ffc-muted rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-ffc-gold transition-colors"
                required
              />
            </div>
          )}

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

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-ffc-dark border border-ffc-muted rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-ffc-gold transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ffc-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? '…' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="text-ffc-gold font-semibold hover:underline"
          >
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </p>

        {!isRegister && (
          <p className="text-center text-sm mt-2">
            <Link href="/forgot-password" className="text-gray-500 hover:underline">
              Forgot password?
            </Link>
          </p>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-6 text-center">
        Private league — invite only
      </p>
    </div>
  )
}
