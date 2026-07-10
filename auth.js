import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { query } from './lib/db'

class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email_not_verified'
}

class PasswordNotSetError extends CredentialsSignin {
  code = 'password_not_set'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const rows = await query('select * from users where email = $1', [credentials.email])
        const user = rows[0]
        if (!user) return null

        if (!user.email_verified_at) throw new EmailNotVerifiedError()
        if (!user.password_hash) throw new PasswordNotSetError()

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
