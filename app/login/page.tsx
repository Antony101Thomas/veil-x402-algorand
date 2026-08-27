'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { writeSession } from '@/lib/session'

type Mode = 'signin' | 'signup'
type Role = 'agent' | 'admin'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('agent')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      setMessage('Account created! You can now sign in.')
      setMode('signin')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Sign in failed')
        return
      }

      // Write session cookie on client side for session.ts compatibility
      writeSession({ handle: data.user.handle, role: data.user.role })

      router.push(data.user.role === 'admin' ? '/admin' : '/agent')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    setError(null)
    setMessage(null)

    if (!email) {
      setError('Enter your email above first, then click "Forgot password".')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send reset email')
        return
      }

      setMessage(data.message || 'Password reset email sent — check your inbox.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h1>

      <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={{ display: 'block', width: '100%', marginBottom: 12 }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            style={{ display: 'block', width: '100%', marginBottom: 12 }}
          />
        </label>

        {mode === 'signup' && (
          <label>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={{ display: 'block', width: '100%', marginBottom: 12 }}
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        )}

        <button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign In'
              : 'Create account'}
        </button>
      </form>

      {mode === 'signin' && (
        <button
          onClick={handleForgotPassword}
          disabled={loading}
          style={{ marginTop: 8, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}
        >
          Forgot password?
        </button>
      )}

      <p style={{ marginTop: 16 }}>
        {mode === 'signin' ? (
          <>
            No account?{' '}
            <button onClick={() => { setMode('signup'); setError(null); setMessage(null) }} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button onClick={() => { setMode('signin'); setError(null); setMessage(null) }} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              Sign in
            </button>
          </>
        )}
      </p>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
    </div>
  )
}
