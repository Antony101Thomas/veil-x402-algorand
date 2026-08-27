'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Missing reset token. Please use the link from your email.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to reset password')
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Set a new password</h1>

      {!token && !success && (
        <p style={{ color: 'red' }}>
          Invalid reset link. Please request a new password reset from the{' '}
          <a href="/login" style={{ textDecoration: 'underline' }}>login page</a>.
        </p>
      )}

      {success ? (
        <p style={{ color: 'green' }}>
          Password updated. Redirecting to sign in…
        </p>
      ) : token ? (
        <form onSubmit={handleSubmit}>
          <label>
            New password
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

          <label>
            Confirm new password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              style={{ display: 'block', width: '100%', marginBottom: 12 }}
            />
          </label>

          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Updating…' : 'Update password'}
          </button>

          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
      ) : null}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
