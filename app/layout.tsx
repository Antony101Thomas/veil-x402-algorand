import type { ReactNode } from 'react'
import { ThemeProvider } from '../context/ThemeContext'
import { InactivityProvider } from '../components/InactivityProvider'
import { TopBar } from '../components/TopBar'
import './globals.css'

export const metadata = {
  title: 'Veil',
  description: 'Agentic access to paid digital resources.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <InactivityProvider>
            <TopBar />
            {children}
          </InactivityProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}