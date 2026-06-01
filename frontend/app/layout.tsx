import type { Metadata } from 'next'
import './globals.css'
import { SessionProviderWrapper } from '@/components/ui/SessionProviderWrapper'
import { AppShell } from '@/components/ui/AppShell'
import { ThemeProvider } from '@/components/ui/ThemeProvider'

export const metadata: Metadata = {
  title: 'Bio-Platform',
  description: 'Plataforma de análise de micobioma e transcriptômica',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem>
          <SessionProviderWrapper>
            <AppShell>
              {children}
            </AppShell>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  )
}
