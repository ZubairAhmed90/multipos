'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSelector } from 'react-redux'
import { Box, Typography, CircularProgress, Button } from '@mui/material'
import { isPathAccessibleForRole } from '../../config/menuConfig'

const RouteProtection = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading } = useSelector((state) => state.auth)
  const [timeoutReached, setTimeoutReached] = useState(false)

  // Timeout mechanism to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        setTimeoutReached(true)
      }
    }, 5000) // 5 second timeout

    return () => clearTimeout(timer)
  }, [isLoading])

  useEffect(() => {

    // Skip protection for login/register pages
    if (pathname === '/login' || pathname === '/register') {
      return
    }

    // Don't redirect if still loading (unless timeout reached)
    if (isLoading && !timeoutReached) {
      return
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    // If authenticated but no user data, wait a bit more
    if (isAuthenticated && !user) {
      return
    }

    // If we're on dashboard and have user data, allow access
    if (pathname === '/dashboard' && user) {
      return
    }

    // Check if user has access to current path
    if (user?.role && !isPathAccessibleForRole(pathname, user.role)) {
      // Only redirect if not already on dashboard to prevent infinite loops
      if (pathname !== '/dashboard') {
        router.replace('/dashboard')
      }
      return
    }

  }, [pathname, user?.role, isAuthenticated, isLoading, user, timeoutReached, router])

  // Show timeout error if loading takes too long
  if (timeoutReached && isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <Typography variant="h6" color="error">
          Loading timeout - Authentication may be stuck
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
        >
          Reload Page
        </Button>
      </Box>
    )
  }

  // Show loading while checking authentication or waiting for user data
  if (isLoading || (isAuthenticated && !user)) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="h6">
          {isLoading ? 'Initializing...' : 'Loading user data...'}
        </Typography>
      </Box>
    )
  }

  // Show loading while redirecting
  if (!isAuthenticated && pathname !== '/login' && pathname !== '/register') {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="h6">Redirecting to login...</Typography>
      </Box>
    )
  }

  // Check if user has access to current path (only show if user data is loaded)
  if (user?.role && !isPathAccessibleForRole(pathname, user.role)) {
    // Show loading while redirecting instead of access denied screen
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="h6">Redirecting to dashboard...</Typography>
        <Button 
          variant="outlined" 
          onClick={() => window.location.href = '/dashboard'}
          sx={{ mt: 2 }}
        >
          Force Go to Dashboard
        </Button>
      </Box>
    )
  }

  return children
}

export default RouteProtection
