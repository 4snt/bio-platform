import "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    role?: string
    error?: string
    userEmail?: string
    userName?: string
  }
}
