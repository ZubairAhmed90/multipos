'use client'

import { useState, useCallback } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material'
import {
  Refresh,
  Error,
  CheckCircle,
  Warning,
  Info,
  ExpandMore,
  ExpandLess,
  Close,
  Schedule,
  TrendingUp,
} from '@mui/icons-material'
import errorHandler from '../../utils/errorHandler'

// Retry configuration
export const RETRY_CONFIG = {
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_DELAY: 1000,
  DEFAULT_BACKOFF_MULTIPLIER: 2,
  MAX_DELAY: 30000
}

// Retry status
export const RETRY_STATUS = {
  IDLE: 'idle',
  RETRYING: 'retrying',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

// Retry component
export const RetryButton = ({ 
  onRetry, 
  disabled = false, 
  loading = false,
  maxRetries = RETRY_CONFIG.DEFAULT_MAX_RETRIES,
  delay = RETRY_CONFIG.DEFAULT_DELAY,
  backoffMultiplier = RETRY_CONFIG.DEFAULT_BACKOFF_MULTIPLIER,
  children = 'Retry'
}) => {
  const [retryCount, setRetryCount] = useState(0)
  const [status, setStatus] = useState(RETRY_STATUS.IDLE)
  const [nextRetryDelay, setNextRetryDelay] = useState(delay)

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      setStatus(RETRY_STATUS.FAILED)
      return
    }

    setStatus(RETRY_STATUS.RETRYING)
    setRetryCount(prev => prev + 1)

    try {
      await onRetry()
      setStatus(RETRY_STATUS.SUCCESS)
      setRetryCount(0)
      setNextRetryDelay(delay)
    } catch (error) {
      if (retryCount + 1 >= maxRetries) {
        setStatus(RETRY_STATUS.FAILED)
      } else {
        setStatus(RETRY_STATUS.IDLE)
        setNextRetryDelay(prev => 
          Math.min(prev * backoffMultiplier, RETRY_CONFIG.MAX_DELAY)
        )
      }
    }
  }, [onRetry, retryCount, maxRetries, delay, backoffMultiplier])

  const getButtonColor = () => {
    switch (status) {
      case RETRY_STATUS.SUCCESS:
        return 'success'
      case RETRY_STATUS.FAILED:
        return 'error'
      case RETRY_STATUS.RETRYING:
        return 'primary'
      default:
        return 'primary'
    }
  }

  const getButtonText = () => {
    switch (status) {
      case RETRY_STATUS.SUCCESS:
        return 'Success!'
      case RETRY_STATUS.FAILED:
        return `Failed (${retryCount}/${maxRetries})`
      case RETRY_STATUS.RETRYING:
        return `Retrying... (${retryCount}/${maxRetries})`
      default:
        return retryCount > 0 ? `Retry (${retryCount}/${maxRetries})` : children
    }
  }

  return (
    <Button
      variant="contained"
      color={getButtonColor()}
      startIcon={status === RETRY_STATUS.RETRYING ? <Schedule /> : <Refresh />}
      onClick={handleRetry}
      disabled={disabled || loading || status === RETRY_STATUS.RETRYING}
      sx={{ minWidth: 120 }}
    >
      {getButtonText()}
    </Button>
  )
}

// Retry mechanism component
export const RetryMechanism = ({ 
  error, 
  onRetry, 
  onCancel,
  maxRetries = RETRY_CONFIG.DEFAULT_MAX_RETRIES,
  delay = RETRY_CONFIG.DEFAULT_DELAY,
  backoffMultiplier = RETRY_CONFIG.DEFAULT_BACKOFF_MULTIPLIER,
  showDetails = false
}) => {
  const [retryCount, setRetryCount] = useState(0)
  const [status, setStatus] = useState(RETRY_STATUS.IDLE)
  const [retryHistory, setRetryHistory] = useState([])
  const [isRetrying, setIsRetrying] = useState(false)
  const [nextRetryDelay, setNextRetryDelay] = useState(delay)

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      setStatus(RETRY_STATUS.FAILED)
      return
    }

    setIsRetrying(true)
    setStatus(RETRY_STATUS.RETRYING)
    const attemptNumber = retryCount + 1

    // Add to retry history
    setRetryHistory(prev => [...prev, {
      attempt: attemptNumber,
      timestamp: new Date().toISOString(),
      delay: nextRetryDelay
    }])

    try {
      await onRetry()
      setStatus(RETRY_STATUS.SUCCESS)
      setRetryCount(0)
      setNextRetryDelay(delay)
    } catch (error) {
      setRetryCount(prev => prev + 1)
      
      if (retryCount + 1 >= maxRetries) {
        setStatus(RETRY_STATUS.FAILED)
      } else {
        setStatus(RETRY_STATUS.IDLE)
        setNextRetryDelay(prev => 
          Math.min(prev * backoffMultiplier, RETRY_CONFIG.MAX_DELAY)
        )
      }
    } finally {
      setIsRetrying(false)
    }
  }, [onRetry, retryCount, maxRetries, delay, backoffMultiplier, nextRetryDelay])

  const handleCancel = useCallback(() => {
    setStatus(RETRY_STATUS.CANCELLED)
    if (onCancel) {
      onCancel()
    }
  }, [onCancel])

  const getStatusColor = () => {
    switch (status) {
      case RETRY_STATUS.SUCCESS:
        return 'success'
      case RETRY_STATUS.FAILED:
        return 'error'
      case RETRY_STATUS.RETRYING:
        return 'warning'
      case RETRY_STATUS.CANCELLED:
        return 'info'
      default:
        return 'info'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case RETRY_STATUS.SUCCESS:
        return <CheckCircle />
      case RETRY_STATUS.FAILED:
        return <Error />
      case RETRY_STATUS.RETRYING:
        return <Schedule />
      case RETRY_STATUS.CANCELLED:
        return <Info />
      default:
        return <Warning />
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case RETRY_STATUS.SUCCESS:
        return 'Operation completed successfully!'
      case RETRY_STATUS.FAILED:
        return `Failed after ${retryCount} attempts. Please try again later.`
      case RETRY_STATUS.RETRYING:
        return `Retrying... (Attempt ${retryCount + 1}/${maxRetries})`
      case RETRY_STATUS.CANCELLED:
        return 'Retry cancelled by user.'
      default:
        return 'Ready to retry operation.'
    }
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getStatusIcon()}
          <Typography variant="h6" sx={{ ml: 1 }}>
            Retry Mechanism
          </Typography>
          <Chip
            label={status}
            color={getStatusColor()}
            size="small"
            sx={{ ml: 'auto' }}
          />
        </Box>

        <Alert severity={getStatusColor()} sx={{ mb: 2 }}>
          <AlertTitle>{getStatusMessage()}</AlertTitle>
          {error && (
            <Typography variant="body2">
              Error: {error.message || 'Unknown error occurred'}
            </Typography>
          )}
        </Alert>

        {status === RETRY_STATUS.RETRYING && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Retrying in {nextRetryDelay}ms...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={handleRetry}
            disabled={isRetrying || status === RETRY_STATUS.SUCCESS}
            color={getStatusColor()}
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={isRetrying}
          >
            Cancel
          </Button>
        </Box>

        {showDetails && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Retry Details
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Max Retries"
                  secondary={maxRetries}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Current Attempt"
                  secondary={retryCount}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Next Delay"
                  secondary={`${nextRetryDelay}ms`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Backoff Multiplier"
                  secondary={backoffMultiplier}
                />
              </ListItem>
            </List>

            {retryHistory.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Retry History
                </Typography>
                <List dense>
                  {retryHistory.map((retry, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <TrendingUp />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Attempt ${retry.attempt}`}
                        secondary={`${new Date(retry.timestamp).toLocaleTimeString()} (${retry.delay}ms delay)`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

// Hook for retry functionality
export const useRetry = (operation, config = {}) => {
  const {
    maxRetries = RETRY_CONFIG.DEFAULT_MAX_RETRIES,
    delay = RETRY_CONFIG.DEFAULT_DELAY,
    backoffMultiplier = RETRY_CONFIG.DEFAULT_BACKOFF_MULTIPLIER
  } = config

  const [retryCount, setRetryCount] = useState(0)
  const [status, setStatus] = useState(RETRY_STATUS.IDLE)
  const [isRetrying, setIsRetrying] = useState(false)

  const executeWithRetry = useCallback(async (...args) => {
    let lastError = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setRetryCount(attempt)
        setStatus(RETRY_STATUS.RETRYING)
        setIsRetrying(true)
        
        const result = await operation(...args)
        
        setStatus(RETRY_STATUS.SUCCESS)
        setRetryCount(0)
        setIsRetrying(false)
        
        return result
      } catch (error) {
        lastError = error
        
        if (attempt < maxRetries) {
          const delayMs = delay * Math.pow(backoffMultiplier, attempt)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }
    
    setStatus(RETRY_STATUS.FAILED)
    setIsRetrying(false)
    throw lastError
  }, [operation, maxRetries, delay, backoffMultiplier])

  const reset = useCallback(() => {
    setRetryCount(0)
    setStatus(RETRY_STATUS.IDLE)
    setIsRetrying(false)
  }, [])

  return {
    executeWithRetry,
    retryCount,
    status,
    isRetrying,
    reset,
    canRetry: retryCount < maxRetries,
    isSuccess: status === RETRY_STATUS.SUCCESS,
    isFailed: status === RETRY_STATUS.FAILED
  }
}

// Retry wrapper for API calls
export const withRetry = (apiCall, config = {}) => {
  return async (...args) => {
    const retryConfig = errorHandler.createRetryConfig(
      errorHandler.classifyError().type,
      config.maxRetries
    )
    
    return errorHandler.executeRetry(
      () => apiCall(...args),
      retryConfig,
      { apiCall: apiCall.name || 'Unknown API Call' }
    )
  }
}

export default RetryMechanism
