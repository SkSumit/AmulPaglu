import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface AdminRouteProps {
  children: React.ReactNode
}

/**
 * Renders children only when the authenticated user has is_admin = true on
 * their profile row (server-side flag). All other users are redirected to
 * the dashboard. This component must always be nested inside <ProtectedRoute>.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { profile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amul-red border-t-transparent" />
      </div>
    )
  }

  // Deliberately check the server-side profile flag, never a client-side variable
  if (!profile?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
