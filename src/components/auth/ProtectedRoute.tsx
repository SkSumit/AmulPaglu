import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'

const LOADING_MESSAGES = [
  'Consulting the butter oracle…',
  'Counting Amul cows…',
  'Fetching cheese from the mountains…',
  'Asking the milkman nicely…',
  'Translating moo into data…',
  'Warming up the ice cream machine…',
  'Churning fresh data for you…',
  'The cows are working on it…',
]

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, isLoading } = useAuth()
  const location = useLocation()
  const [msgIndex, setMsgIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGES.length)
  )

  useEffect(() => {
    if (!isLoading) return
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 1800)
    return () => clearInterval(id)
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amul-red border-t-transparent" />
        <p className="animate-pulse text-sm text-[hsl(var(--muted-foreground))]">
          {LOADING_MESSAGES[msgIndex]}
        </p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
