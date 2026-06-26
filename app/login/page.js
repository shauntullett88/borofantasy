'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '../../components/AuthContext'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isRegister) {
      if (!username.trim()) { setError('Name is required'); setLoading(false); return }
      if (!teamName.trim()) { setError('Team name is required'); setLoading(false); return }
      const { error } = await signUp(email, password, username.trim(), teamName.trim())
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/my-team')
    } else {
      const { error } = await signIn(email, password)
      if (error) { setError('Invalid email or password'); setLoading(false); return }
      router.push('/my-team')
    }
    setLoading(false)
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
      </div>

      <p className="text-xs text-gray-600 mt-6 text-center">
        Private league — invite only
      </p>
    </div>
  )
}
