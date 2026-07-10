'use client'
import { createContext, useContext } from 'react'
import { SessionProvider, useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react'

const AuthContext = createContext({})

function AuthContextBridge({ children }) {
  const { data: session, status } = useSession()
  const loading = status === 'loading'

  const user = session?.user ? { id: session.user.id, email: session.user.email } : null
  const profile = session?.user
    ? {
        id: session.user.id,
        username: session.user.username,
        team_name: session.user.teamName,
        is_admin: session.user.isAdmin,
        email: session.user.email,
      }
    : null

  async function signIn(email, password) {
    const res = await nextAuthSignIn('credentials', { redirect: false, email, password })
    if (res?.error) return { error: { message: res.error } }
    return { data: {} }
  }

  async function signUp(email, password, username, teamName) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, teamName }),
    })
    const json = await res.json()
    if (!res.ok) return { error: { message: json.error } }
    return { data: {}, needsConfirmation: true }
  }

  async function signOut() {
    await nextAuthSignOut({ redirect: false })
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }) {
  return (
    <SessionProvider>
      <AuthContextBridge>{children}</AuthContextBridge>
    </SessionProvider>
  )
}

export const useAuth = () => useContext(AuthContext)
