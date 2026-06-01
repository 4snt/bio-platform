'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div style={{ width: 32, height: 32 }} />
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--text-2)',
        transition: 'all 150ms ease',
      }}
      title="Alternar tema"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-h)'
        e.currentTarget.style.color = 'var(--text)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--text-2)'
      }}
    >
      {theme === 'dark' ? (
        <Sun size={16} />
      ) : (
        <Moon size={16} />
      )}
    </button>
  )
}
