'use client'

import { Box, CircularProgress, Typography } from '@mui/material'

const LoadingScreen = ({ message = 'Loading...' }) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: 2,
      background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 50%, #f0f4ff 100%)'
    }}>
      <CircularProgress size={40} />
      <Typography variant="h6" sx={{ color: '#667eea' }}>
        {message}
      </Typography>
    </Box>
  )
}

export default LoadingScreen
