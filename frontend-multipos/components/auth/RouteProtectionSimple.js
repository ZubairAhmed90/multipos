'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { Box, Typography, CircularProgress, Button } from '@mui/material'
import { initializeAuth } from '../../app/store/slices/authSlice'

const RouteProtection = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  const { user, isAuthenticated, isLoading } = useSelector((state) => state.auth)

  // Initialize authentication on mount
  useEffect(() => {
    dispatch(initializeAuth())
  }, [dispatch])

  // Track if auth initialization has completed
  const [authInitialized, setAuthInitialized] = useState(false)
  
  useEffect(() => {
    // Mark as initialized when we have a definitive auth state
    if (!isLoading) {
      setAuthInitialized(true)
    }
  }, [isLoading, isAuthenticated, user])

  // Memoize auth state to prevent unnecessary re-renders
  const authState = useMemo(() => ({
    pathname,
    isLoading,
    isAuthenticated,
    hasUser: !!user,
    userRole: user?.role
  }), [pathname, isLoading, isAuthenticated, user])

  useEffect(() => {
    // Skip protection for login/register pages
    if (pathname === '/login' || pathname === '/register') {
      return
    }

    // Don't redirect if still loading or auth not initialized
    if (isLoading || !authInitialized) {
      return
    }

    // If not authenticated, go to login
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    // If authenticated but no user data, wait
    if (isAuthenticated && !user) {
      return
    }

    // If we're on dashboard and have user, allow access
    if (pathname === '/dashboard' && user) {
      return
    }

    // If we're on root path and authenticated, go to dashboard
    if (pathname === '/' && isAuthenticated && user) {
      router.replace('/dashboard')
      return
    }
  }, [authState, pathname, user, isAuthenticated, isLoading, authInitialized, router])

  // Show loading while checking authentication
  if (isLoading || !authInitialized) {
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
        <Typography variant="h6">Checking authentication...</Typography>
        <Typography variant="body2" color="textSecondary">
          {isLoading ? 'Initializing...' : 'Loading...'}
        </Typography>
      </Box>
    )
  }

  // Show loading while redirecting to login
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
        <Typography variant="body2" color="textSecondary">
          Please wait while we redirect you to the login page
        </Typography>
      </Box>
    )
  }

  // Show loading while redirecting to dashboard
  if (isAuthenticated && user && pathname === '/') {
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
        <Typography variant="body2" color="textSecondary">
          Welcome back, {user.name}!
        </Typography>
        <Button 
          variant="outlined" 
          onClick={() => window.location.href = '/dashboard'}
          sx={{ mt: 2 }}
        >
          Go to Dashboard
        </Button>
      </Box>
    )
  }

  return children
}

export default RouteProtection



