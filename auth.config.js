// Edge-safe NextAuth config (no db/bcrypt imports) — used by middleware.js.
// The full config with the Credentials provider + db-backed authorize() lives
// in auth.js, which is only ever imported from Node-runtime API routes.
export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.teamName = user.teamName
        token.isAdmin = user.isAdmin
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.username = token.username
      session.user.teamName = token.teamName
      session.user.isAdmin = token.isAdmin
      return session
    },
  },
}
