import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'officeil-theme'

function getPreferredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    const mode = getPreferredTheme()
    applyTheme(mode)
    return mode
  })

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  function toggle() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle${isDark ? ' is-dark' : ' is-light'}`}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-sky" aria-hidden="true">
        <span className="theme-stars">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="theme-cloud theme-cloud-a" />
        <span className="theme-cloud theme-cloud-b" />
      </span>
      <span className="theme-orb" aria-hidden="true">
        <span className="theme-sun" />
        <span className="theme-moon" />
      </span>
    </button>
  )
}
