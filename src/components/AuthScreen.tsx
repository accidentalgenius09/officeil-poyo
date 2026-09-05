import { useId, useState, type FormEvent } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import type { AuthUser } from '../types'
import { loginAccount, registerAccount } from '../lib/api'
import { trackEvent } from '../lib/analytics'
import { toast } from 'react-hot-toast'

type AuthScreenProps = {
  onAuthenticated: (user: AuthUser) => void
}

type Mode = 'login' | 'register'

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const titleId = useId()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const result =
        mode === 'login'
          ? await loginAccount({ email, password })
          : await registerAccount({ email, password, name })
      trackEvent(mode === 'login' ? 'login' : 'register')
      onAuthenticated(result.user)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="app-bg" aria-hidden="true" />
      <main className="auth-card" aria-labelledby={titleId}>
        <p className="auth-eyebrow">Officeil Poyo?</p>
        <h1 id={titleId} className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="auth-sub">
          Sign in to sync your office visits, leave, and holidays to your own
          cloud data.
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Surjith K"
                maxLength={80}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <span className="auth-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 6 characters' : ''}
                required
                minLength={6}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeSlash size={20} weight="regular" aria-hidden />
                ) : (
                  <Eye size={20} weight="regular" aria-hidden />
                )}
              </button>
            </span>
          </label>

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
      </main>
    </div>
  )
}
