/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Expõe AUTH_SECRET para o Edge Runtime (middleware NextAuth v5)
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '',
  },
}

module.exports = nextConfig
