'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material'
import { usePermissions } from '../../hooks/usePermissions'
import { fetchBranchSettings } from '../../app/store/slices/branchesSlice'

/**
 * RouteGuard component for protecting routes based on user roles and permissions
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render if user has access
 * @param {string|string[]} props.allowedRoles - Role(s) that can access this route
 * @param {string} props.requiredPermission - Specific permission required
 * @param {boolean} props.requireAuth - If true, user must be authenticated (default: true)
 * @param {boolean} props.loadBranchSettings - If true, load branch settings (default: false)
 */
const RouteGuard = ({ 
  children, 
  allowedRoles, 
  requiredPermission,
  requireAuth = true,
  loadBranchSettings = false
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  
  const { user, isAuthenticated, isLoading } = useSelector((state) => state.auth)
  const { branchSettings, isLoading: branchLoading } = useSelector((state) => state.branches)
  
  const { 
    hasRoleHierarchy, 
    hasPermission, 
    canAccessPath,
    isAdmin 
  } = usePermissions()

  useEffect(() => {
    // Redirect to login if not authenticated and auth is required
    if (requireAuth && !isAuthenticated && !isLoading) {
      router.push('/login')
      return
    }

    // Load branch settings if required and user is authenticated
    if (loadBranchSettings && isAuthenticated && user?.branchId && !branchSettings && user?.role !== 'CASHIER') {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }, [isAuthenticated, isLoading, requireAuth, loadBranchSettings, user?.branchId, user?.role, branchSettings, dispatch, router])

  // Show loading spinner while checking authentication
  if (requireAuth && isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}
      >
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Checking authentication...</Typography>
      </Box>
    )
  }

  // Show loading spinner while loading branch settings
  if (loadBranchSettings && branchLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}
      >  
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading branch settings...</Typography>
      </Box>
    )
  }

  // Check if user has access to current path
  if (requireAuth && isAuthenticated && !canAccessPath(pathname)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          }
        >
          You don&apos;t have permission to access this page.
        </Alert>
      </Box>
    )
  }

  // Check role-based access
  if (allowedRoles && !hasRoleHierarchy(allowedRoles)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="warning" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          }
        >
          Your role doesn&apos;t have access to this page.
        </Alert>
      </Box>
    )
  }

  // Check specific permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="warning" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          }
        >
          You don&apos;t have the required permission for this page.
        </Alert>
      </Box>
    )
  }

  // All checks passed, render children
  return children
}

export default RouteGuard
