'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../components/AuthContext'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/my-team' : '/login')
    }
  }, [user, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <img
          src="/badge.png"
          alt="Farnborough Football Club"
          className="w-20 h-20 mx-auto mb-4 animate-pulse"
        />
        <div className="text-ffc-gold font-display text-2xl tracking-widest">FFL</div>
        <div className="text-gray-400 text-sm mt-2">Loading…</div>
      </div>
    </div>
  )
}
