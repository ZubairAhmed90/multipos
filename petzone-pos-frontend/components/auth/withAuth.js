'use client'

import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'
import { initializeAuth } from '../../app/store/slices/authSlice'
import { Box, CircularProgress, Typography } from '@mui/material'

export default function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    const dispatch = useDispatch()
    const router = useRouter()
    const { isAuthenticated, isLoading, token } = useSelector((state) => state.auth)

    useEffect(() => {
      // Initialize auth state on mount
      dispatch(initializeAuth())
    }, [dispatch])

    useEffect(() => {
      // Redirect to login if not authenticated and not loading
      // Add a small delay to prevent race conditions
      if (!isLoading && !isAuthenticated && !token) {
        const timer = setTimeout(() => {
          router.push('/login')
        }, 100)
        return () => clearTimeout(timer)
      }
    }, [isAuthenticated, isLoading, token, router])

    // Show loading spinner while checking authentication
    if (isLoading || (!isAuthenticated && !token)) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" color="textSecondary">
            Checking authentication...
          </Typography>
        </Box>
      )
    }

    // If not authenticated, don't render the component (redirect will happen)
    if (!isAuthenticated) {
      return null
    }

    // Render the protected component
    return <WrappedComponent {...props} />
  }
}
