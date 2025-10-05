'use client'

import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Container,
  useTheme,
  InputAdornment,
  IconButton,
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
} from '@mui/icons-material'
import { loginUser, clearError } from '../store/slices/authSlice'

const schema = yup.object({
  email: yup.string()
    .email('Please enter a valid email address')
    .required('Email address is required'),
  password: yup.string()
    .min(6, 'Password must be at least 6 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('Password is required'),
})

export default function LoginPage() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const router = useRouter()
  const { isLoading, error, isAuthenticated, user } = useSelector((state) => state.auth)
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  })

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Add a small delay to ensure auth state is fully updated
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, user, router])

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError())
    }
  }, [dispatch])

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const onSubmit = (data) => {
    // Clear any existing error before submitting
    dispatch(clearError())
    dispatch(loginUser(data))
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      background: theme.palette.mode === 'dark'
        ? 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 50%, #2d2d2d 100%)'
        : 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 50%, #f0f4ff 100%)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)'
          : 'radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.05) 0%, transparent 50%)',
        pointerEvents: 'none',
      }
    }}>
      <Container component="main" maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4,
          }}
        >
          <Box 
            sx={{ 
              padding: 4, 
              width: '100%',
              borderRadius: '24px',
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(26, 26, 46, 0.9) 0%, rgba(22, 33, 62, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 249, 255, 0.9) 100%)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                : '0 16px 48px rgba(102, 126, 234, 0.2), 0 0 0 1px rgba(102, 126, 234, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: theme.palette.mode === 'dark'
                  ? 'radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.1) 0%, transparent 50%)'
                  : 'radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.05) 0%, transparent 50%)',
                pointerEvents: 'none',
              }
            }}
          >
            <Box sx={{ textAlign: 'center', mb: 4, position: 'relative', zIndex: 1 }}>
              <Typography 
                component="h1" 
                variant="h3" 
                gutterBottom
                sx={{
                  fontWeight: 700,
                  letterSpacing: '1px',
                  background: theme.palette.mode === 'dark' 
                    ? 'linear-gradient(45deg, #ffffff 30%, #e3f2fd 90%)'
                    : 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                MultiPOS
              </Typography>
              <Typography 
                variant="h5" 
                component="h2" 
                gutterBottom
                sx={{
                  fontWeight: 600,
                  color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
                }}
              >
                Welcome Back
              </Typography>
              <Typography 
                variant="body1" 
                sx={{
                  color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                }}
              >
                Sign in to your account to continue
              </Typography>
            </Box>

            {/* Form validation errors */}
            {(errors.email || errors.password) && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3, 
                  borderRadius: '12px',
                  background: theme.palette.mode === 'dark'
                    ? 'rgba(211, 47, 47, 0.12)'
                    : 'rgba(211, 47, 47, 0.06)',
                  border: `2px solid ${theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.35)' : 'rgba(211, 47, 47, 0.25)'}`,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 4px 16px rgba(211, 47, 47, 0.15)'
                    : '0 4px 16px rgba(211, 47, 47, 0.1)',
                  '& .MuiAlert-icon': {
                    color: theme.palette.error.main,
                    fontSize: '1.4rem',
                  },
                  '& .MuiAlert-message': {
                    fontWeight: 500,
                    fontSize: '0.95rem',
                  }
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Form Validation Error
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Please fix the form errors below to continue.
                </Typography>
              </Alert>
            )}

            {/* API error messages */}
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3, 
                  borderRadius: '12px',
                  background: theme.palette.mode === 'dark'
                    ? 'rgba(211, 47, 47, 0.15)'
                    : 'rgba(211, 47, 47, 0.08)',
                  border: `2px solid ${theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.4)' : 'rgba(211, 47, 47, 0.3)'}`,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 4px 16px rgba(211, 47, 47, 0.2)'
                    : '0 4px 16px rgba(211, 47, 47, 0.15)',
                  '& .MuiAlert-icon': {
                    color: theme.palette.error.main,
                    fontSize: '1.5rem',
                  },
                  '& .MuiAlert-message': {
                    fontWeight: 500,
                    fontSize: '1rem',
                  }
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Login Failed
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {error}
                </Typography>
              </Alert>
            )}

            <Box 
              component="form" 
              onSubmit={handleSubmit(onSubmit)} 
              sx={{ position: 'relative', zIndex: 1 }}
            >
              <TextField
                {...register('email')}
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                error={!!errors.email}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.palette.mode === 'dark'
                        ? '0 4px 12px rgba(102, 126, 234, 0.2)'
                        : '0 4px 12px rgba(102, 126, 234, 0.15)',
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.palette.mode === 'dark'
                        ? '0 8px 24px rgba(102, 126, 234, 0.3)'
                        : '0 8px 24px rgba(102, 126, 234, 0.2)',
                    },
                    '&.Mui-error': {
                      borderColor: theme.palette.error.main,
                      boxShadow: `0 0 0 2px ${theme.palette.error.main}20`,
                    }
                  }
                }}
              />
              <TextField
                {...register('password')}
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePasswordVisibility}
                        edge="end"
                        sx={{ 
                          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                          '&:hover': {
                            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                          }
                        }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.palette.mode === 'dark'
                        ? '0 4px 12px rgba(102, 126, 234, 0.2)'
                        : '0 4px 12px rgba(102, 126, 234, 0.15)',
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.palette.mode === 'dark'
                        ? '0 8px 24px rgba(102, 126, 234, 0.3)'
                        : '0 8px 24px rgba(102, 126, 234, 0.2)',
                    },
                    '&.Mui-error': {
                      borderColor: theme.palette.error.main,
                      boxShadow: `0 0 0 2px ${theme.palette.error.main}20`,
                    }
                  }
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isLoading}
                sx={{
                  mt: 2,
                  mb: 2,
                  py: 1.5,
                  borderRadius: '12px',
                  background: theme.palette.mode === 'dark'
                    ? 'linear-gradient(45deg, #667eea, #764ba2)'
                    : 'linear-gradient(45deg, #667eea, #764ba2)',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 4px 16px rgba(102, 126, 234, 0.4)'
                    : '0 4px 16px rgba(102, 126, 234, 0.3)',
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '0 8px 24px rgba(102, 126, 234, 0.5)'
                      : '0 8px 24px rgba(102, 126, 234, 0.4)',
                  },
                  '&:disabled': {
                    opacity: 0.6,
                  }
                }}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{
                  color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                }}>
                  Contact your administrator for account access
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}