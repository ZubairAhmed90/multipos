import { store } from '../app/store'

class ErrorHandler {
  constructor() {
    this.errorTypes = {
      NETWORK_ERROR: 'NETWORK_ERROR',
      AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
      AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      SERVER_ERROR: 'SERVER_ERROR',
      CLIENT_ERROR: 'CLIENT_ERROR',
      TIMEOUT_ERROR: 'TIMEOUT_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    }
    
    this.errorSeverity = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL'
    }
    
    this.errorActions = {
      RETRY: 'RETRY',
      REDIRECT: 'REDIRECT',
      NOTIFY: 'NOTIFY',
      LOG: 'LOG',
      IGNORE: 'IGNORE'
    }
  }

  // Classify error type based on error object
  classifyError(error) {
    if (!error) return { type: this.errorTypes.UNKNOWN_ERROR, severity: this.errorSeverity.MEDIUM }

    // Network errors
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return { type: this.errorTypes.NETWORK_ERROR, severity: this.errorSeverity.HIGH }
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return { type: this.errorTypes.TIMEOUT_ERROR, severity: this.errorSeverity.MEDIUM }
    }

    // HTTP status code errors
    if (error.response) {
      const status = error.response.status
      
      if (status === 401) {
        return { type: this.errorTypes.AUTHENTICATION_ERROR, severity: this.errorSeverity.HIGH }
      }
      
      if (status === 403) {
        return { type: this.errorTypes.AUTHORIZATION_ERROR, severity: this.errorSeverity.HIGH }
      }
      
      if (status >= 400 && status < 500) {
        return { type: this.errorTypes.CLIENT_ERROR, severity: this.errorSeverity.MEDIUM }
      }
      
      if (status >= 500) {
        return { type: this.errorTypes.SERVER_ERROR, severity: this.errorSeverity.HIGH }
      }
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.message?.includes('validation')) {
      return { type: this.errorTypes.VALIDATION_ERROR, severity: this.errorSeverity.LOW }
    }

    return { type: this.errorTypes.UNKNOWN_ERROR, severity: this.errorSeverity.MEDIUM }
  }

  // Get user-friendly error message
  getUserFriendlyMessage(error, errorType) {
    const messages = {
      [this.errorTypes.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection.',
      [this.errorTypes.AUTHENTICATION_ERROR]: 'Your session has expired. Please log in again.',
      [this.errorTypes.AUTHORIZATION_ERROR]: 'You do not have permission to perform this action.',
      [this.errorTypes.VALIDATION_ERROR]: 'Please check your input and try again.',
      [this.errorTypes.SERVER_ERROR]: 'Server error occurred. Please try again later.',
      [this.errorTypes.CLIENT_ERROR]: 'Invalid request. Please check your input.',
      [this.errorTypes.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
      [this.errorTypes.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
    }

    return messages[errorType] || messages[this.errorTypes.UNKNOWN_ERROR]
  }

  // Get suggested actions for error
  getSuggestedActions(errorType, severity) {
    const actions = []

    switch (errorType) {
      case this.errorTypes.NETWORK_ERROR:
        actions.push(this.errorActions.RETRY)
        actions.push(this.errorActions.NOTIFY)
        break
      
      case this.errorTypes.AUTHENTICATION_ERROR:
        actions.push(this.errorActions.REDIRECT)
        actions.push(this.errorActions.NOTIFY)
        break
      
      case this.errorTypes.AUTHORIZATION_ERROR:
        actions.push(this.errorActions.REDIRECT)
        actions.push(this.errorActions.NOTIFY)
        break
      
      case this.errorTypes.VALIDATION_ERROR:
        actions.push(this.errorActions.NOTIFY)
        break
      
      case this.errorTypes.SERVER_ERROR:
        actions.push(this.errorActions.RETRY)
        actions.push(this.errorActions.NOTIFY)
        break
      
      case this.errorTypes.TIMEOUT_ERROR:
        actions.push(this.errorActions.RETRY)
        actions.push(this.errorActions.NOTIFY)
        break
      
      default:
        actions.push(this.errorActions.NOTIFY)
        actions.push(this.errorActions.LOG)
    }

    return actions
  }

  // Handle error with full context
  handleError(error, context = {}) {
    const errorInfo = this.classifyError(error)
    const userMessage = this.getUserFriendlyMessage(error, errorInfo.type)
    const suggestedActions = this.getSuggestedActions(errorInfo.type, errorInfo.severity)

    const errorDetails = {
      ...errorInfo,
      originalError: error,
      userMessage,
      suggestedActions,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    }

    // Log error for debugging
    this.logError(errorDetails)

    // Dispatch error to Redux store
    this.dispatchError(errorDetails)

    return errorDetails
  }

  // Log error for debugging
  logError(errorDetails) {

    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry, LogRocket, etc.
      // this.sendToErrorTrackingService(errorDetails)
    }
  }

  // Dispatch error to Redux store
  dispatchError(errorDetails) {
    // This would dispatch to a global error slice
    // store.dispatch(addError(errorDetails))
  }

  // Create retry configuration
  createRetryConfig(errorType, maxRetries = 3) {
    const retryConfigs = {
      [this.errorTypes.NETWORK_ERROR]: {
        maxRetries: 3,
        delay: 1000,
        backoffMultiplier: 2
      },
      [this.errorTypes.TIMEOUT_ERROR]: {
        maxRetries: 2,
        delay: 2000,
        backoffMultiplier: 1.5
      },
      [this.errorTypes.SERVER_ERROR]: {
        maxRetries: 2,
        delay: 3000,
        backoffMultiplier: 2
      },
      [this.errorTypes.AUTHENTICATION_ERROR]: {
        maxRetries: 0, // Don't retry auth errors
        delay: 0,
        backoffMultiplier: 1
      },
      [this.errorTypes.AUTHORIZATION_ERROR]: {
        maxRetries: 0, // Don't retry auth errors
        delay: 0,
        backoffMultiplier: 1
      }
    }

    return retryConfigs[errorType] || {
      maxRetries: 1,
      delay: 1000,
      backoffMultiplier: 1
    }
  }

  // Execute retry logic
  async executeRetry(operation, retryConfig, context = {}) {
    let lastError = null
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation()
        if (attempt > 0) {
(`✅ Retry successful on attempt ${attempt + 1}`)
        }
        return result
      } catch (error) {
        lastError = error
        
        if (attempt < retryConfig.maxRetries) {
          const delay = retryConfig.delay * Math.pow(retryConfig.backoffMultiplier, attempt)
(`⏳ Retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // All retries failed
    const errorDetails = this.handleError(lastError, { ...context, retryAttempts: retryConfig.maxRetries })
    throw errorDetails
  }

  // Handle API errors specifically
  handleApiError(error, apiContext = {}) {
    const errorDetails = this.handleError(error, {
      type: 'API_ERROR',
      ...apiContext
    })

    // Special handling for specific API errors
    if (error.response?.data?.message) {
      errorDetails.userMessage = error.response.data.message
    }

    return errorDetails
  }

  // Handle form validation errors
  handleValidationError(errors, formContext = {}) {
    const errorDetails = {
      type: this.errorTypes.VALIDATION_ERROR,
      severity: this.errorSeverity.LOW,
      userMessage: 'Please correct the following errors:',
      validationErrors: errors,
      context: {
        type: 'FORM_VALIDATION',
        ...formContext
      },
      timestamp: new Date().toISOString()
    }

    this.logError(errorDetails)
    this.dispatchError(errorDetails)

    return errorDetails
  }

  // Clear all errors
  clearErrors() {
    // This would dispatch to clear errors in Redux store
    // store.dispatch(clearErrors())
  }

  // Get error statistics
  getErrorStats() {
    // This would return error statistics from Redux store
    return {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recentErrors: []
    }
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler()

export default errorHandler
