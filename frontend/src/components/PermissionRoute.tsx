import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface PermissionRouteProps {
  children: React.ReactNode
  permission: string
}

export default function PermissionRoute({ children, permission }: PermissionRouteProps) {
  const { user } = useAuth()
  const location = useLocation()

  const hasPermission = user?.permissions?.[permission] !== false

  if (!hasPermission) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />
  }

  return <>{children}</>
}
