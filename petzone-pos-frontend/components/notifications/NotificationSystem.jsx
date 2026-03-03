'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Slide,
  Box,
  Typography,
  Button,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material'
import {
  Close,
  CheckCircle,
  Error,
  Warning,
  Info,
  Refresh,
  ExpandMore,
  ExpandLess,
  Notifications,
  NotificationsOff,
} from '@mui/icons-material'
import { addError, clearError, dismissError } from '../../app/store/slices/errorSlice'

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

// Notification severity levels
export const NOTIFICATION_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
}

// Default notification configuration
const DEFAULT_CONFIG = {
  autoHideDuration: 6000,
  maxNotifications: 5,
  position: 'top-right',
  enableSound: false,
  enableVibration: false
}

// Notification component
const Notification = ({ 
  notification, 
  onClose, 
  onRetry, 
  onExpand, 
  isExpanded 
}) => {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case NOTIFICATION_SEVERITY.CRITICAL:
        return 'error'
      case NOTIFICATION_SEVERITY.HIGH:
        return 'error'
      case NOTIFICATION_SEVERITY.MEDIUM:
        return 'warning'
      case NOTIFICATION_SEVERITY.LOW:
        return 'info'
      default:
        return 'info'
    }
  }

  const getIcon = (type, severity) => {
    if (type === NOTIFICATION_TYPES.ERROR || severity === NOTIFICATION_SEVERITY.CRITICAL) {
      return <Error />
    }
    if (type === NOTIFICATION_TYPES.WARNING || severity === NOTIFICATION_SEVERITY.MEDIUM) {
      return <Warning />
    }
    if (type === NOTIFICATION_TYPES.SUCCESS) {
      return <CheckCircle />
    }
    return <Info />
  }

  const handleRetry = () => {
    if (onRetry && notification.retryAction) {
      onRetry(notification.retryAction)
    }
  }

  const handleExpand = () => {
    if (onExpand) {
      onExpand(notification.id)
    }
  }

  return (
    <Alert
      severity={getSeverityColor(notification.severity)}
      icon={getIcon(notification.type, notification.severity)}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {notification.retryAction && (
            <IconButton
              size="small"
              onClick={handleRetry}
              color="inherit"
              title="Retry"
            >
              <Refresh fontSize="small" />
            </IconButton>
          )}
          {notification.details && (
            <IconButton
              size="small"
              onClick={handleExpand}
              color="inherit"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => onClose(notification.id)}
            color="inherit"
            title="Close"
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      }
      sx={{ mb: 1 }}
    >
      <AlertTitle>{notification.title}</AlertTitle>
      <Typography variant="body2">{notification.message}</Typography>
      
      {notification.details && (
        <Collapse in={isExpanded}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="textSecondary">
              Details:
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {notification.details}
            </Typography>
          </Box>
        </Collapse>
      )}
      
      {notification.timestamp && (
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          {new Date(notification.timestamp).toLocaleTimeString()}
        </Typography>
      )}
    </Alert>
  )
}

// Main notification system component
export default function NotificationSystem({ config = DEFAULT_CONFIG }) {
  const dispatch = useDispatch()
  const { errors, currentError } = useSelector((state) => state.errors)
  const [notifications, setNotifications] = useState([])
  const [expandedNotifications, setExpandedNotifications] = useState(new Set())
  const [isEnabled, setIsEnabled] = useState(true)

  // Convert errors to notifications
  useEffect(() => {
    if (currentError && isEnabled) {
      const notification = {
        id: currentError.timestamp,
        type: NOTIFICATION_TYPES.ERROR,
        severity: currentError.severity,
        title: 'Error Occurred',
        message: currentError.userMessage,
        details: currentError.originalError?.message,
        timestamp: currentError.timestamp,
        retryAction: currentError.suggestedActions?.includes('RETRY') ? 
          () => handleRetry(currentError) : null
      }
      
      setNotifications(prev => [notification, ...prev.slice(0, config.maxNotifications - 1)])
    }
  }, [currentError, isEnabled, config.maxNotifications, handleRetry])

  // Auto-hide notifications
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.autoHide !== false) {
        const timer = setTimeout(() => {
          handleClose(notification.id)
        }, config.autoHideDuration)
        
        return () => clearTimeout(timer)
      }
    })
  }, [notifications, config.autoHideDuration, handleClose])

  const handleClose = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    dispatch(dismissError(notificationId))
  }, [dispatch])

  const handleRetry = useCallback((error) => {
    // Implement retry logic based on error type
('Retrying operation for error:', error)
    // This would typically dispatch a retry action
  }, [])

  const handleExpand = useCallback((notificationId) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev)
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId)
      } else {
        newSet.add(notificationId)
      }
      return newSet
    })
  }, [])

  const clearAllNotifications = () => {
    setNotifications([])
    dispatch(clearAllErrors())
  }

  const toggleNotifications = () => {
    setIsEnabled(prev => !prev)
  }

  if (!isEnabled) {
    return (
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}>
        <IconButton
          onClick={toggleNotifications}
          color="primary"
          title="Enable Notifications"
        >
          <NotificationsOff />
        </IconButton>
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, maxWidth: 400 }}>
      {/* Notification Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Chip
          icon={<Notifications />}
          label={`${notifications.length} notifications`}
          color="primary"
          size="small"
        />
        <Button
          size="small"
          onClick={clearAllNotifications}
          disabled={notifications.length === 0}
        >
          Clear All
        </Button>
        <IconButton
          size="small"
          onClick={toggleNotifications}
          title="Disable Notifications"
        >
          <NotificationsOff />
        </IconButton>
      </Box>

      {/* Notifications List */}
      <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            notification={notification}
            onClose={handleClose}
            onRetry={handleRetry}
            onExpand={handleExpand}
            isExpanded={expandedNotifications.has(notification.id)}
          />
        ))}
      </Box>
    </Box>
  )
}

// Hook for creating notifications
export const useNotifications = () => {
  const dispatch = useDispatch()

  const showNotification = useCallback((notification) => {
    const notificationData = {
      id: Date.now().toString(),
      type: notification.type || NOTIFICATION_TYPES.INFO,
      severity: notification.severity || NOTIFICATION_SEVERITY.MEDIUM,
      title: notification.title || 'Notification',
      message: notification.message || '',
      details: notification.details,
      timestamp: new Date().toISOString(),
      retryAction: notification.retryAction,
      autoHide: notification.autoHide !== false
    }

    // This would dispatch to a notification slice
    // dispatch(addNotification(notificationData))
    
    return notificationData.id
  }, [])

  const showSuccess = useCallback((message, title = 'Success') => {
    return showNotification({
      type: NOTIFICATION_TYPES.SUCCESS,
      severity: NOTIFICATION_SEVERITY.LOW,
      title,
      message
    })
  }, [showNotification])

  const showError = useCallback((message, title = 'Error') => {
    return showNotification({
      type: NOTIFICATION_TYPES.ERROR,
      severity: NOTIFICATION_SEVERITY.HIGH,
      title,
      message
    })
  }, [showNotification])

  const showWarning = useCallback((message, title = 'Warning') => {
    return showNotification({
      type: NOTIFICATION_TYPES.WARNING,
      severity: NOTIFICATION_SEVERITY.MEDIUM,
      title,
      message
    })
  }, [showNotification])

  const showInfo = useCallback((message, title = 'Info') => {
    return showNotification({
      type: NOTIFICATION_TYPES.INFO,
      severity: NOTIFICATION_SEVERITY.LOW,
      title,
      message
    })
  }, [showNotification])

  return {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}

