'use client'

import React from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material'
import {
  Error,
  Refresh,
  BugReport,
  ExpandMore,
  ExpandLess,
  Close,
  Warning
} from '@mui/icons-material'
import errorHandler from '../../utils/errorHandler'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: null
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    const errorDetails = errorHandler.handleError(error, {
      type: 'REACT_ERROR_BOUNDARY',
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'Unknown'
    })

    this.setState({
      error,
      errorInfo,
      errorId: errorDetails.timestamp
    })

    // Log to console for debugging
    console.group('🚨 React Error Boundary')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Component Stack:', errorInfo.componentStack)
    console.groupEnd()
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: null
    })
  }

  handleReportError = () => {
    const { error, errorInfo } = this.state
    const errorReport = {
      error: error?.toString(),
      errorInfo: errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }

    // In a real application, you would send this to an error reporting service
    console.log('Error Report:', errorReport)
    
    // Example: Send to error reporting service
    // errorReportingService.reportError(errorReport)
  }

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }))
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state
      const { fallback, showRetry = true, showReport = true } = this.props

      // Custom fallback component
      if (fallback) {
        return fallback(error, errorInfo, this.handleRetry)
      }

      // Default error UI
      return (
        <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Error color="error" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h5" color="error" gutterBottom>
                    Something went wrong
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    An unexpected error occurred in this component.
                  </Typography>
                </Box>
              </Box>

              <Alert severity="error" sx={{ mb: 3 }}>
                <AlertTitle>Error Details</AlertTitle>
                <Typography variant="body2">
                  {error?.message || 'An unknown error occurred'}
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                {showRetry && (
                  <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={this.handleRetry}
                  >
                    Try Again
                  </Button>
                )}
                
                {showReport && (
                  <Button
                    variant="outlined"
                    startIcon={<BugReport />}
                    onClick={this.handleReportError}
                  >
                    Report Error
                  </Button>
                )}
              </Box>

              {/* Error Details */}
              <Box>
                <Button
                  startIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
                  onClick={this.toggleDetails}
                  size="small"
                >
                  {showDetails ? 'Hide' : 'Show'} Technical Details
                </Button>
                
                <Collapse in={showDetails}>
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="warning">
                      <AlertTitle>Technical Information</AlertTitle>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        This information is for developers and support staff.
                      </Typography>
                      
                      {error && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Error Message:
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontFamily: 'monospace', 
                              backgroundColor: 'grey.100', 
                              p: 1, 
                              borderRadius: 1 
                            }}
                          >
                            {error.toString()}
                          </Typography>
                        </Box>
                      )}
                      
                      {errorInfo && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Component Stack:
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontFamily: 'monospace', 
                              backgroundColor: 'grey.100', 
                              p: 1, 
                              borderRadius: 1,
                              maxHeight: 200,
                              overflow: 'auto'
                            }}
                          >
                            {errorInfo.componentStack}
                          </Typography>
                        </Box>
                      )}
                    </Alert>
                  </Box>
                </Collapse>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for error boundary context
export const useErrorBoundary = () => {
  const [error, setError] = React.useState(null)
  
  const resetError = React.useCallback(() => {
    setError(null)
  }, [])
  
  const captureError = React.useCallback((error) => {
    setError(error)
  }, [])
  
  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])
  
  return { captureError, resetError }
}

// Error boundary for specific error types
export const ApiErrorBoundary = ({ children, onApiError }) => {
  return (
    <ErrorBoundary
      name="ApiErrorBoundary"
      fallback={(error, errorInfo, retry) => (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            <AlertTitle>API Error</AlertTitle>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Failed to load data from the server. Please check your connection and try again.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={retry}
            >
              Retry
            </Button>
          </Alert>
        </Box>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

// Error boundary for form validation
export const FormErrorBoundary = ({ children, onValidationError }) => {
  return (
    <ErrorBoundary
      name="FormErrorBoundary"
      fallback={(error, errorInfo, retry) => (
        <Box sx={{ p: 2 }}>
          <Alert severity="warning">
            <AlertTitle>Form Error</AlertTitle>
            <Typography variant="body2" sx={{ mb: 2 }}>
              There was an error processing the form. Please check your input and try again.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={retry}
            >
              Reset Form
            </Button>
          </Alert>
        </Box>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary
