import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { query } from './lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const rows = await query('select * from users where email = $1', [credentials.email])
        const user = rows[0]
        if (!user) return null
        if (!user.email_verified_at) return null
        if (!user.password_hash) return null

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          teamName: user.team_name,
          isAdmin: user.is_admin,
        }
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
})
