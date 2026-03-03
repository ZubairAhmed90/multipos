'use client'

import React from 'react'
import { useSelector } from 'react-redux'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Box, Typography, Paper, Button } from '@mui/material'

const DirectDashboard = () => {
  const { user, isAuthenticated, isLoading, token, refreshToken } = useSelector((state) => state.auth)

('DirectDashboard - Auth state:', { user, isAuthenticated, isLoading, token, refreshToken })

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Direct Dashboard Access
        </Typography>
        
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Authentication Status</Typography>
          <Typography><strong>isLoading:</strong> {isLoading ? 'true' : 'false'}</Typography>
          <Typography><strong>isAuthenticated:</strong> {isAuthenticated ? 'true' : 'false'}</Typography>
          <Typography><strong>hasUser:</strong> {user ? 'true' : 'false'}</Typography>
          <Typography><strong>hasToken:</strong> {token ? 'true' : 'false'}</Typography>
          <Typography><strong>hasRefreshToken:</strong> {refreshToken ? 'true' : 'false'}</Typography>
          {user && (
            <>
              <Typography><strong>User Role:</strong> {user.role}</Typography>
              <Typography><strong>User Name:</strong> {user.name}</Typography>
            </>
          )}
        </Paper>

        <Typography variant="body1" color="success.main">
          ✅ If you can see this page, the dashboard layout works correctly!
        </Typography>
      </Box>
    </DashboardLayout>
  )
}

export default DirectDashboard





