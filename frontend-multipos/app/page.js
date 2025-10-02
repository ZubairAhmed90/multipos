'use client'

import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
} from '@mui/material'
import {
  ShoppingCart,
  People,
  Inventory,
  TrendingUp,
} from '@mui/icons-material'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useSelector((state) => state.auth)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Small delay to ensure auth state is fully updated
      setTimeout(() => {
        router.push('/dashboard')
      }, 100)
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Typography variant="h6">Loading...</Typography>
      </Box>
    )
  }

  if (isAuthenticated) {
    return null // Will redirect to dashboard
  }

  const features = [
    {
      title: 'Point of Sale',
      description: 'Complete POS system for your business',
      icon: <ShoppingCart sx={{ fontSize: 40 }} />,
    },
    {
      title: 'Customer Management',
      description: 'Manage your customer database efficiently',
      icon: <People sx={{ fontSize: 40 }} />,
    },
    {
      title: 'Inventory Control',
      description: 'Track and manage your inventory',
      icon: <Inventory sx={{ fontSize: 40 }} />,
    },
    {
      title: 'Analytics & Reports',
      description: 'Get insights into your business performance',
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
    },
  ]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 8,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h2" component="h1" gutterBottom>
              MultiPOS
            </Typography>
            <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 4 }}>
              Modern Point of Sale System
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Streamline your business operations with our comprehensive POS solution
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push('/login')}
                sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
              >
                Sign In
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => router.push('/register')}
                sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                Sign Up
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom>
          Features
        </Typography>
        <Typography variant="h6" textAlign="center" color="textSecondary" sx={{ mb: 6 }}>
          Everything you need to run your business efficiently
        </Typography>
        
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card sx={{ height: '100%', textAlign: 'center' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box sx={{ bgcolor: 'grey.100', py: 6 }}>
        <Container maxWidth="md">
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom>
              Ready to get started?
            </Typography>
            <Typography variant="h6" color="textSecondary" sx={{ mb: 4 }}>
              Create your account and start managing your business today
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push('/register')}
            >
              Get Started Now
            </Button>
          </Paper>
        </Container>
      </Box>
    </Box>
  )
}
