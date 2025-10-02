'use client'

import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  Card,
  CardContent,
  Backdrop,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  IconButton,
  Collapse,
} from '@mui/material'
import {
  Refresh,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  ExpandLess,
  Close,
  Schedule,
  TrendingUp,
  Inventory,
  ShoppingCart,
  Dashboard,
  Warehouse,
} from '@mui/icons-material'

// Loading states for different operations
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
}

// Loading types for different operations
export const LOADING_TYPES = {
  PAGE: 'page',
  API: 'api',
  FORM: 'form',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  POLLING: 'polling'
}

// Loading component for different states
export const LoadingIndicator = ({ 
  type = LOADING_TYPES.API, 
  message = 'Loading...', 
  progress = null,
  size = 40,
  color = 'primary'
}) => {
  const getIcon = () => {
    switch (type) {
      case LOADING_TYPES.PAGE:
        return <Dashboard />
      case LOADING_TYPES.API:
        return <TrendingUp />
      case LOADING_TYPES.FORM:
        return <Inventory />
      case LOADING_TYPES.UPLOAD:
        return <ShoppingCart />
      case LOADING_TYPES.DOWNLOAD:
        return <Warehouse />
      case LOADING_TYPES.POLLING:
        return <Schedule />
      default:
        return <TrendingUp />
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
        <CircularProgress size={size} color={color} />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {getIcon()}
        </Box>
      </Box>
      
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {message}
      </Typography>
      
      {progress !== null && (
        <Box sx={{ width: '100%', mt: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            color={color}
          />
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
            {Math.round(progress)}%
          </Typography>
        </Box>
      )}
    </Box>
  )
}

// Loading overlay component
export const LoadingOverlay = ({ 
  open, 
  message = 'Loading...', 
  type = LOADING_TYPES.API,
  progress = null 
}) => {
  return (
    <Backdrop
      sx={{ 
        color: '#fff', 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
      open={open}
    >
      <Card sx={{ maxWidth: 400, mx: 'auto' }}>
        <CardContent>
          <LoadingIndicator 
            type={type} 
            message={message} 
            progress={progress}
            size={60}
          />
        </CardContent>
      </Card>
    </Backdrop>
  )
}

// Loading state manager component
export default function LoadingStateManager() {
  const [loadingStates, setLoadingStates] = useState({})
  const [expandedStates, setExpandedStates] = useState(new Set())
  
  // Get loading states from Redux store
  const inventoryLoading = useSelector((state) => state.inventory.loading)
  const salesLoading = useSelector((state) => state.sales.loading)
  const dashboardLoading = useSelector((state) => state.dashboard.isLoading)
  const warehousesLoading = useSelector((state) => state.warehouses.loading)
  const authLoading = useSelector((state) => state.auth.isLoading)

  // Update loading states
  useEffect(() => {
    setLoadingStates({
      inventory: {
        loading: inventoryLoading,
        type: LOADING_TYPES.API,
        message: 'Loading inventory...',
        icon: <Inventory />
      },
      sales: {
        loading: salesLoading,
        type: LOADING_TYPES.API,
        message: 'Loading sales data...',
        icon: <ShoppingCart />
      },
      dashboard: {
        loading: dashboardLoading,
        type: LOADING_TYPES.PAGE,
        message: 'Loading dashboard...',
        icon: <Dashboard />
      },
      warehouses: {
        loading: warehousesLoading,
        type: LOADING_TYPES.API,
        message: 'Loading warehouses...',
        icon: <Warehouse />
      },
      auth: {
        loading: authLoading,
        type: LOADING_TYPES.API,
        message: 'Authenticating...',
        icon: <CheckCircle />
      }
    })
  }, [inventoryLoading, salesLoading, dashboardLoading, warehousesLoading, authLoading])

  const toggleExpanded = (stateKey) => {
    setExpandedStates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stateKey)) {
        newSet.delete(stateKey)
      } else {
        newSet.add(stateKey)
      }
      return newSet
    })
  }

  const clearState = (stateKey) => {
    setLoadingStates(prev => ({
      ...prev,
      [stateKey]: { ...prev[stateKey], loading: false }
    }))
  }

  const clearAllStates = () => {
    setLoadingStates(prev => {
      const newStates = {}
      Object.keys(prev).forEach(key => {
        newStates[key] = { ...prev[key], loading: false }
      })
      return newStates
    })
  }

  const getLoadingCount = () => {
    return Object.values(loadingStates).filter(state => state.loading).length
  }

  const hasActiveLoading = getLoadingCount() > 0

  if (!hasActiveLoading) {
    return null
  }

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, maxWidth: 400 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              Loading States ({getLoadingCount()})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={clearAllStates}
                disabled={!hasActiveLoading}
              >
                Clear All
              </Button>
              <IconButton size="small">
                <Close />
              </IconButton>
            </Box>
          </Box>

          <List dense>
            {Object.entries(loadingStates).map(([key, state]) => {
              if (!state.loading) return null
              
              const isExpanded = expandedStates.has(key)
              
              return (
                <div key={key}>
                  <ListItem>
                    <ListItemIcon>
                      {state.loading ? (
                        <CircularProgress size={20} />
                      ) : (
                        <CheckCircle color="success" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={state.message}
                      secondary={state.type}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={state.loading ? 'Loading' : 'Complete'}
                        color={state.loading ? 'primary' : 'success'}
                        size="small"
                      />
                      <IconButton
                        size="small"
                        onClick={() => toggleExpanded(key)}
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => clearState(key)}
                      >
                        <Close />
                      </IconButton>
                    </Box>
                  </ListItem>
                  
                  <Collapse in={isExpanded}>
                    <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                      <Typography variant="caption" color="textSecondary">
                        Type: {state.type}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="textSecondary">
                        Started: {new Date().toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </Collapse>
                  
                  <Divider />
                </div>
              )
            })}
          </List>
        </CardContent>
      </Card>
    </Box>
  )
}

// Hook for managing loading states
export const useLoadingState = (initialState = LOADING_STATES.IDLE) => {
  const [state, setState] = useState(initialState)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')

  const setLoading = (loadingMessage = 'Loading...') => {
    setState(LOADING_STATES.LOADING)
    setMessage(loadingMessage)
    setProgress(0)
  }

  const setSuccess = (successMessage = 'Success!') => {
    setState(LOADING_STATES.SUCCESS)
    setMessage(successMessage)
    setProgress(100)
  }

  const setError = (errorMessage = 'Error occurred') => {
    setState(LOADING_STATES.ERROR)
    setMessage(errorMessage)
    setProgress(0)
  }

  const setIdle = () => {
    setState(LOADING_STATES.IDLE)
    setMessage('')
    setProgress(0)
  }

  const updateProgress = (newProgress) => {
    setProgress(Math.min(100, Math.max(0, newProgress)))
  }

  return {
    state,
    progress,
    message,
    isLoading: state === LOADING_STATES.LOADING,
    isSuccess: state === LOADING_STATES.SUCCESS,
    isError: state === LOADING_STATES.ERROR,
    isIdle: state === LOADING_STATES.IDLE,
    setLoading,
    setSuccess,
    setError,
    setIdle,
    updateProgress
  }
}

// Loading wrapper component
export const LoadingWrapper = ({ 
  loading, 
  children, 
  type = LOADING_TYPES.API,
  message = 'Loading...',
  progress = null,
  showOverlay = false 
}) => {
  if (loading) {
    if (showOverlay) {
      return (
        <>
          {children}
          <LoadingOverlay 
            open={loading} 
            message={message} 
            type={type}
            progress={progress}
          />
        </>
      )
    }
    
    return (
      <LoadingIndicator 
        type={type} 
        message={message} 
        progress={progress}
      />
    )
  }

  return children
}

