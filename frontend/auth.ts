import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const API = process.env.API_URL ?? "http://localhost:8000"
const ALLOWED_DOMAIN = "@ufvjm.edu.br"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { hd: "ufvjm.edu.br" } },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      return !!profile?.email?.endsWith(ALLOWED_DOMAIN)
    },
    async jwt({ token, account }) {
      if (account?.access_token) {
        const res = await fetch(`${API}/api/v1/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: account.access_token }),
        })
        if (res.ok) {
          const data = await res.json()
          token.accessToken = data.access_token
          token.role        = data.role
          token.userEmail   = data.email
          token.userName    = data.name
        } else {
          token.error = res.status === 403 ? "NotInvited" : "AuthError"
        }
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.role        = token.role as string
      session.error       = token.error as string | undefined
      session.userEmail   = token.userEmail as string
      session.userName    = token.userName as string
      return session
    },
  },
  pages: { signIn: "/login", error: "/login" },
  // NextAuth v5 usa AUTH_SECRET; fallback para NEXTAUTH_SECRET por compatibilidade
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
})
