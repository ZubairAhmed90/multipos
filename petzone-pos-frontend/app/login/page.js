'use client'

import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Grid,
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
  const [sessionMessage, setSessionMessage] = useState(null)
  
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

  // Surface session-expired messages coming from global auth handling
  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedMessage = sessionStorage.getItem('authMessage')
    if (storedMessage) {
      setSessionMessage(storedMessage)
      sessionStorage.removeItem('authMessage')
    }
  }, [])

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
      px: { xs: 2, sm: 3 },
      py: { xs: 4, sm: 6 },
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)'
          : 'radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.07) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.07) 0%, transparent 50%)',
        pointerEvents: 'none',
      }
    }}>
      <Container component="main" maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid
          container
          spacing={0}
          sx={{
            borderRadius: { xs: '24px', md: '32px' },
            overflow: 'hidden',
            minHeight: { xs: 'auto', md: 560 },
            boxShadow: theme.palette.mode === 'dark'
              ? '0 32px 80px rgba(0, 0, 0, 0.55)'
              : '0 32px 80px rgba(102, 126, 234, 0.25)',
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(102,126,234,0.15)'}`,
            backdropFilter: 'blur(18px)',
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.92) 0%, rgba(31, 41, 55, 0.92) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(244, 246, 255, 0.95) 100%)'
          }}
        >
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              display: { xs: 'none', md: 'flex' },
              position: 'relative',
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
              alignItems: 'center',
              justifyContent: 'center',
              p: { md: 6, lg: 8 }
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.25) 0%, transparent 60%), radial-gradient(circle at 75% 75%, rgba(14,165,233,0.25) 0%, transparent 55%)',
                opacity: theme.palette.mode === 'dark' ? 0.35 : 0.45,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <Box
              sx={{
                position: 'relative',
                textAlign: 'center',
                color: 'common.white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                maxWidth: 360,
                zIndex: 1,
              }}
            >
              <Box
                sx={{
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: '85%',
                    height: '85%',
                  }}
                >
                  <Image
                    src="/petzonelogo.png"
                    alt="PetzonePOS logo"
                    priority
                    fill
                    sizes="220px"
                    style={{
                      objectFit: 'contain',
                      filter: theme.palette.mode === 'dark'
                        ? 'drop-shadow(0 12px 24px rgba(0,0,0,0.45))'
                        : 'drop-shadow(0 12px 24px rgba(37, 99, 235, 0.35))',
                    }}
                  />
                </Box>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                Welcome to PetzonePOS
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.85, lineHeight: 1.7 }}>
                Streamline your branches, warehouses, and sales operations from one intelligent hub.
              </Typography>
            </Box>
          </Grid>

          <Grid
            item
            xs={12}
            md={6}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 4, sm: 6, md: 7 },
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(30, 41, 59, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 249, 255, 0.95) 100%)',
            }}
          >
            <Box sx={{ width: '100%', maxWidth: 420 }}>
              <Box sx={{ textAlign: { xs: 'center', md: 'left' }, mb: 4 }}>
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
                  Sign In
                </Typography>
                <Typography
                  variant="h5"
                  component="h2"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'rgba(15, 23, 42, 0.9)',
                  }}
                >
                  Welcome Back
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(15, 23, 42, 0.6)',
                  }}
                >
                  Enter your credentials to access your Petzone workspace.
                </Typography>
              </Box>

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

              {sessionMessage && (
                <Alert
                  severity="warning"
                  sx={{
                    mb: 3,
                    borderRadius: '12px',
                    background: theme.palette.mode === 'dark'
                      ? 'rgba(255, 193, 7, 0.12)'
                      : 'rgba(255, 193, 7, 0.08)',
                    border: `2px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 193, 7, 0.35)' : 'rgba(255, 193, 7, 0.25)'}`,
                    boxShadow: theme.palette.mode === 'dark'
                      ? '0 4px 16px rgba(255, 193, 7, 0.2)'
                      : '0 4px 16px rgba(255, 193, 7, 0.15)',
                    '& .MuiAlert-icon': {
                      color: theme.palette.warning.main,
                      fontSize: '1.5rem',
                    },
                    '& .MuiAlert-message': {
                      fontWeight: 500,
                      fontSize: '1rem',
                    }
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Session ended
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {sessionMessage}
                  </Typography>
                </Alert>
              )}

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
                      borderRadius: '14px',
                      transition: 'all 0.3s ease',
                      background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(17, 25, 40, 0.82) 0%, rgba(29, 36, 54, 0.9) 100%)'
                        : 'linear-gradient(135deg, rgba(244, 247, 255, 0.96) 0%, rgba(248, 250, 255, 0.98) 100%)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.22)'}`,
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                      '&:hover': {
                        boxShadow: theme.palette.mode === 'dark'
                          ? '0 8px 20px rgba(102, 126, 234, 0.22)'
                          : '0 8px 20px rgba(102, 126, 234, 0.16)',
                      },
                      '&.Mui-focused': {
                        borderColor: 'transparent',
                        boxShadow: theme.palette.mode === 'dark'
                          ? '0 12px 28px rgba(102, 126, 234, 0.28)'
                          : '0 12px 28px rgba(102, 126, 234, 0.2)',
                        background: theme.palette.mode === 'dark'
                          ? 'linear-gradient(135deg, rgba(21, 32, 52, 0.9) 0%, rgba(30, 42, 60, 0.96) 100%)'
                          : 'linear-gradient(135deg, rgba(241, 244, 255, 0.98) 0%, rgba(248, 250, 255, 1) 100%)',
                      },
                      '&.Mui-error': {
                        boxShadow: `0 0 0 2px ${theme.palette.error.main}1f`,
                      },
                      '& fieldset': {
                        border: 'none',
                      },
                      '& .MuiOutlinedInput-input': {
                        background: 'transparent',
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
                      borderRadius: '14px',
                      transition: 'all 0.3s ease',
                      background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(17, 25, 40, 0.82) 0%, rgba(29, 36, 54, 0.9) 100%)'
                        : 'linear-gradient(135deg, rgba(244, 247, 255, 0.96) 0%, rgba(248, 250, 255, 0.98) 100%)',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.22)'}`,
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                      '&:hover': {
                        boxShadow: theme.palette.mode === 'dark'
                          ? '0 8px 20px rgba(102, 126, 234, 0.22)'
                          : '0 8px 20px rgba(102, 126, 234, 0.16)',
                      },
                      '&.Mui-focused': {
                        borderColor: 'transparent',
                        boxShadow: theme.palette.mode === 'dark'
                          ? '0 12px 28px rgba(102, 126, 234, 0.28)'
                          : '0 12px 28px rgba(102, 126, 234, 0.2)',
                        background: theme.palette.mode === 'dark'
                          ? 'linear-gradient(135deg, rgba(21, 32, 52, 0.9) 0%, rgba(30, 42, 60, 0.96) 100%)'
                          : 'linear-gradient(135deg, rgba(241, 244, 255, 0.98) 0%, rgba(248, 250, 255, 1) 100%)',
                      },
                      '&.Mui-error': {
                        boxShadow: `0 0 0 2px ${theme.palette.error.main}1f`,
                      },
                      '& fieldset': {
                        border: 'none',
                      },
                      '& .MuiOutlinedInput-input': {
                        background: 'transparent',
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
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}