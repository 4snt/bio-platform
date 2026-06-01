'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
