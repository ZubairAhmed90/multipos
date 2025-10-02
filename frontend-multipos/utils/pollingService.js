/**
 * Polling service for real-time data updates
 */

// Safe logging utility
const safeLog = (message, ...args) => {
  try {
    if (typeof console !== 'undefined' && console.log) {
      console.log(message, ...args)
    }
  } catch (error) {
    // Silently fail if logging is not available
  }
}

const safeError = (message, ...args) => {
  try {
    if (typeof console !== 'undefined' && console.error) {
      console.error(message, ...args)
    } else if (typeof console !== 'undefined' && console.log) {
      console.log('ERROR:', message, ...args)
    }
  } catch (error) {
    // Silently fail if logging is not available
  }
}

class PollingService {
  constructor() {
    this.intervals = new Map()
    this.timeouts = new Map()
    this.isActive = true
  }

  // Start polling with interval
  startPolling(key, callback, interval = 5000) {
    if (this.intervals.has(key)) {
      this.stopPolling(key)
    }

    // Validate callback is a function
    if (typeof callback !== 'function') {
      safeError('PollingService.startPolling: callback must be a function, received:', typeof callback)
      return null
    }

    const intervalId = setInterval(() => {
      if (this.isActive) {
        try {
          callback()
        } catch (error) {
          safeError('PollingService callback error:', error)
        }
      }
    }, interval)

    this.intervals.set(key, intervalId)
    return intervalId
  }

  // Start polling with timeout
  startTimeout(key, callback, timeout = 5000) {
    if (this.timeouts.has(key)) {
      this.stopTimeout(key)
    }

    // Validate callback is a function
    if (typeof callback !== 'function') {
      safeError('PollingService.startTimeout: callback must be a function, received:', typeof callback)
      return null
    }

    const timeoutId = setTimeout(() => {
      if (this.isActive) {
        try {
          callback()
        } catch (error) {
          safeError('PollingService timeout callback error:', error)
        }
      }
    }, timeout)

    this.timeouts.set(key, timeoutId)
    return timeoutId
  }

  // Stop polling by key
  stopPolling(key) {
    const intervalId = this.intervals.get(key)
    if (intervalId) {
      clearInterval(intervalId)
      this.intervals.delete(key)
    }
  }

  // Stop all polling immediately
  stopAllPolling() {
    this.intervals.forEach((intervalId) => {
      clearInterval(intervalId)
    })
    this.intervals.clear()
    
    this.timeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId)
    })
    this.timeouts.clear()
    
    this.isActive = false
  }

  // Stop timeout by key
  stopTimeout(key) {
    const timeoutId = this.timeouts.get(key)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.timeouts.delete(key)
    }
  }

  // Stop all polling
  stopAll() {
    this.intervals.forEach((intervalId) => {
      clearInterval(intervalId)
    })
    this.timeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId)
    })
    this.intervals.clear()
    this.timeouts.clear()
  }

  // Alias for stopAll (for compatibility)
  stopAllPolling() {
    this.stopAll()
  }

  // Start all polling (placeholder - would need configuration)
  startAllPolling() {
    // This would typically start all configured polling
    // For now, it's a placeholder that doesn't do anything
    safeLog('startAllPolling called - no default polling configured')
  }

  // Pause all polling
  pause() {
    this.isActive = false
  }

  // Resume all polling
  resume() {
    this.isActive = true
  }

  // Get active polling keys
  getActiveKeys() {
    return {
      intervals: Array.from(this.intervals.keys()),
      timeouts: Array.from(this.timeouts.keys())
    }
  }

  // Check if polling is active
  isPollingActive(key) {
    return this.intervals.has(key) || this.timeouts.has(key)
  }

  // Alias for isPollingActive (for compatibility)
  isPolling(key) {
    return this.isPollingActive(key)
  }

  // Get polling status for all keys
  getPollingStatus() {
    const status = {}
    this.intervals.forEach((intervalId, key) => {
      status[key] = {
        active: true,
        type: 'interval',
        id: intervalId
      }
    })
    this.timeouts.forEach((timeoutId, key) => {
      status[key] = {
        active: true,
        type: 'timeout',
        id: timeoutId
      }
    })
    return status
  }

  // Refresh data for a specific key
  async refreshData(key) {
    // This would typically trigger a data refresh
    // Implementation depends on the specific use case
    return Promise.resolve()
  }
}

// Create singleton instance
const pollingService = new PollingService()

// Export service and utilities
export default pollingService

export const createPollingService = () => new PollingService()

export const pollingUtils = {
  // Exponential backoff for failed requests
  exponentialBackoff: (attempt, baseDelay = 1000, maxDelay = 30000) => {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    return delay + Math.random() * 1000 // Add jitter
  },

  // Retry mechanism
  retry: async (fn, maxRetries = 3, delay = 1000) => {
    let lastError
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= 2 // Exponential backoff
        }
      }
    }
    throw lastError
  },

  // Debounced polling
  debouncedPolling: (key, callback, interval = 5000, debounceMs = 1000) => {
    let timeoutId
    let lastCall = 0

    const debouncedCallback = () => {
      const now = Date.now()
      if (now - lastCall < debounceMs) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          lastCall = Date.now()
          callback()
        }, debounceMs)
      } else {
        lastCall = now
        callback()
      }
    }

    return pollingService.startPolling(key, debouncedCallback, interval)
  },

  // Conditional polling
  conditionalPolling: (key, callback, condition, interval = 5000) => {
    const conditionalCallback = () => {
      if (condition()) {
        callback()
      }
    }

    return pollingService.startPolling(key, conditionalCallback, interval)
  }
}