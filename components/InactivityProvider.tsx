'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clearSession, readSession } from '@/lib/session'

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const LAST_ACTIVITY_KEY = 'veil-last-activity'

export function InactivityProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [showInactivityToast, setShowInactivityToast] = useState(false)

  useEffect(() => {
    // Record current activity time
    function resetActivity() {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      }
    }

    // Check if session has expired due to inactivity
    function checkInactivity() {
      const session = readSession()
      if (!session) return

      const lastRaw = localStorage.getItem(LAST_ACTIVITY_KEY)
      const lastActivity = lastRaw ? parseInt(lastRaw, 10) : Date.now()
      const now = Date.now()

      if (now - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        clearSession()
        localStorage.removeItem(LAST_ACTIVITY_KEY)
        setShowInactivityToast(true)
        if (typeof window !== 'undefined' && pathname !== '/login') {
          window.location.href = '/login?reason=inactivity'
        }
      }
    }

    // Set initial activity time on mount if none exists
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      resetActivity()
    }

    // Listen for user interaction events
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown']
    const handleUserActivity = () => {
      resetActivity()
    }

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true })
    })

    // Listen for tab visibility / focus changes
    window.addEventListener('visibilitychange', checkInactivity)
    window.addEventListener('focus', checkInactivity)

    // Interval check every 3 seconds
    const interval = setInterval(checkInactivity, 3000)

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity)
      })
      window.removeEventListener('visibilitychange', checkInactivity)
      window.removeEventListener('focus', checkInactivity)
      clearInterval(interval)
    }
  }, [pathname, router])

  return (
    <>
      {children}
    </>
  )
}
