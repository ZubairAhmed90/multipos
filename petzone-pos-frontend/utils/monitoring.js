/**
 * Monitoring utilities for system health and performance
 */

class MonitoringService {
  constructor() {
    this.metrics = new Map()
    this.alerts = []
    this.isEnabled = true
  }

  // Record a metric
  recordMetric(name, value, tags = {}) {
    if (!this.isEnabled) return

    const timestamp = new Date().toISOString()
    const metric = {
      name,
      value,
      tags,
      timestamp
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    this.metrics.get(name).push(metric)

    // Keep only last 1000 metrics per name
    const metrics = this.metrics.get(name)
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000)
    }
  }

  // Get metrics for a specific name
  getMetrics(name, limit = 100) {
    const metrics = this.metrics.get(name) || []
    return metrics.slice(-limit)
  }

  // Get all metrics
  getAllMetrics() {
    const result = {}
    for (const [name, metrics] of this.metrics) {
      result[name] = metrics
    }
    return result
  }

  // Clear metrics
  clearMetrics(name = null) {
    if (name) {
      this.metrics.delete(name)
    } else {
      this.metrics.clear()
    }
  }

  // Add alert
  addAlert(alert) {
    this.alerts.push({
      ...alert,
      timestamp: new Date().toISOString()
    })
  }

  // Get alerts
  getAlerts(limit = 100) {
    return this.alerts.slice(-limit)
  }

  // Clear alerts
  clearAlerts() {
    this.alerts = []
  }

  // Enable/disable monitoring
  setEnabled(enabled) {
    this.isEnabled = enabled
  }

  // Get system health
  getSystemHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        totalMetrics: this.metrics.size,
        totalAlerts: this.alerts.length,
        activeAlerts: this.alerts.filter(alert => alert.status === 'active').length
      }
    }

    // Check for critical alerts
    const criticalAlerts = this.alerts.filter(alert => 
      alert.severity === 'critical' && alert.status === 'active'
    )

    if (criticalAlerts.length > 0) {
      health.status = 'critical'
    } else if (this.alerts.filter(alert => alert.status === 'active').length > 0) {
      health.status = 'warning'
    }

    return health
  }
}

// Create singleton instance
const monitoringService = new MonitoringService()

// Export service and utilities
export default monitoringService

export const monitoringUtils = {
  // Performance monitoring
  performance: {
    startTimer: (name) => {
      if (typeof performance !== 'undefined') {
        performance.mark(`${name}-start`)
      }
    },

    endTimer: (name) => {
      if (typeof performance !== 'undefined') {
        performance.mark(`${name}-end`)
        performance.measure(name, `${name}-start`, `${name}-end`)
        
        const measures = performance.getEntriesByName(name, 'measure')
        if (measures.length > 0) {
          const duration = measures[measures.length - 1].duration
          monitoringService.recordMetric('performance', duration, { name })
        }
      }
    },

    measureAsync: async (name, fn) => {
      monitoringUtils.performance.startTimer(name)
      try {
        const result = await fn()
        return result
      } finally {
        monitoringUtils.performance.endTimer(name)
      }
    }
  },

  // Error monitoring
  error: {
    capture: (error, context = {}) => {
      monitoringService.addAlert({
        type: 'error',
        severity: 'error',
        message: error.message,
        stack: error.stack,
        context,
        status: 'active'
      })

      monitoringService.recordMetric('error_count', 1, {
        error_type: error.name,
        ...context
      })
    },

    captureAsync: async (fn, context = {}) => {
      try {
        return await fn()
      } catch (error) {
        monitoringUtils.error.capture(error, context)
        throw error
      }
    }
  },

  // Memory monitoring
  memory: {
    getUsage: () => {
      if (typeof performance !== 'undefined' && performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        }
      }
      return null
    },

    recordUsage: () => {
      const usage = monitoringUtils.memory.getUsage()
      if (usage) {
        monitoringService.recordMetric('memory_used', usage.used)
        monitoringService.recordMetric('memory_total', usage.total)
        monitoringService.recordMetric('memory_limit', usage.limit)
      }
    }
  },

  // Network monitoring
  network: {
    recordRequest: (url, method, duration, status) => {
      monitoringService.recordMetric('network_request', duration, {
        url,
        method,
        status
      })
    },

    recordError: (url, method, error) => {
      monitoringService.addAlert({
        type: 'network_error',
        severity: 'warning',
        message: `Network error: ${error.message}`,
        context: { url, method },
        status: 'active'
      })
    }
  }
}

// Health checker
export const healthChecker = {
  getHealthStatus: async () => {
    const health = monitoringService.getSystemHealth()
    return {
      status: health.status,
      timestamp: health.timestamp,
      uptime: process.uptime ? process.uptime() : 0,
      memory: monitoringUtils.memory.getUsage(),
      metrics: health.metrics
    }
  }
}

// Performance monitor
export const performanceMonitor = {
  getMetrics: () => {
    return monitoringService.getAllMetrics()
  },
  
  getPerformanceMetrics: () => {
    if (typeof performance !== 'undefined') {
      return performance.getEntriesByType('measure')
    }
    return []
  },
  
  clearMetrics: () => {
    if (typeof performance !== 'undefined') {
      performance.clearMarks()
      performance.clearMeasures()
    }
  }
}

// Error tracker
export const errorTracker = {
  getErrorStats: () => {
    const alerts = monitoringService.getAlerts()
    const errorAlerts = alerts.filter(alert => alert.type === 'error')
    
    return {
      totalErrors: errorAlerts.length,
      activeErrors: errorAlerts.filter(alert => alert.status === 'active').length,
      recentErrors: errorAlerts.slice(-10)
    }
  },
  
  getErrorMetrics: () => {
    return monitoringService.getMetrics('error_count')
  }
}

// Logger
export const logger = {
  info: (message, context = {}) => {
(`[INFO] ${message}`, context)
    monitoringService.recordMetric('log_info', 1, { message: message.substring(0, 100) })
  },
  
  warn: (message, context = {}) => {
    monitoringService.recordMetric('log_warn', 1, { message: message.substring(0, 100) })
  },
  
  error: (message, context = {}) => {
    monitoringService.recordMetric('log_error', 1, { message: message.substring(0, 100) })
    monitoringUtils.error.capture(new Error(message), context)
  },
  
  debug: (message, context = {}) => {
    if (process.env.NODE_ENV === 'development') {
    }
  }
}

// Auto-monitoring setup
if (typeof window !== 'undefined') {
  // Monitor memory usage every 30 seconds
  setInterval(() => {
    monitoringUtils.memory.recordUsage()
  }, 30000)

  // Monitor unhandled errors
  window.addEventListener('error', (event) => {
    monitoringUtils.error.capture(event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // Monitor unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    monitoringUtils.error.capture(event.reason, {
      type: 'unhandled_promise_rejection'
    })
  })
}