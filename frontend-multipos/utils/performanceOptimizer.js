/**
 * Performance optimization utilities for React components
 */

// Debounce function
export const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Throttle function
export const throttle = (func, limit) => {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Memoization helper
export const memoize = (fn) => {
  const cache = new Map()
  return (...args) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

// Performance monitoring
export const performanceMonitor = {
  start: (label) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-start`)
    }
  },
  
  end: (label) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-end`)
      performance.measure(label, `${label}-start`, `${label}-end`)
    }
  },
  
  getMetrics: () => {
    if (typeof performance !== 'undefined') {
      return performance.getEntriesByType('measure')
    }
    return []
  },
  
  clear: () => {
    if (typeof performance !== 'undefined') {
      performance.clearMarks()
      performance.clearMeasures()
    }
  }
}

// Component optimization helpers
export const optimizationHelpers = {
  // Shallow comparison for props
  shallowEqual: (obj1, obj2) => {
    if (obj1 === obj2) return true
    if (obj1 == null || obj2 == null) return false
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false
    
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    
    if (keys1.length !== keys2.length) return false
    
    for (let key of keys1) {
      if (obj1[key] !== obj2[key]) return false
    }
    
    return true
  },
  
  // Deep comparison for objects
  deepEqual: (obj1, obj2) => {
    if (obj1 === obj2) return true
    if (obj1 == null || obj2 == null) return false
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false
    
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    
    if (keys1.length !== keys2.length) return false
    
    for (let key of keys1) {
      if (!keys2.includes(key)) return false
      if (!deepEqual(obj1[key], obj2[key])) return false
    }
    
    return true
  },
  
  // Create stable reference for objects
  createStableReference: (obj) => {
    const ref = { current: obj }
    return ref
  }
}

// Bundle size optimization
export const bundleOptimization = {
  // Lazy load components
  lazyLoad: (importFunc) => {
    return React.lazy(importFunc)
  },
  
  // Code splitting helper
  codeSplit: (chunkName, importFunc) => {
    return importFunc().then(module => {
      if (typeof window !== 'undefined' && window.__webpack_require__) {
        window.__webpack_require__.e(chunkName)
      }
      return module
    })
  }
}

// Memory management
export const memoryManagement = {
  // Cleanup function registry
  cleanupRegistry: new Set(),
  
  // Register cleanup function
  registerCleanup: (cleanupFn) => {
    memoryManagement.cleanupRegistry.add(cleanupFn)
  },
  
  // Execute all cleanup functions
  cleanup: () => {
    memoryManagement.cleanupRegistry.forEach(cleanupFn => {
      try {
        cleanupFn()
      } catch (error) {
      }
    })
    memoryManagement.cleanupRegistry.clear()
  },
  
  // Memory usage monitoring
  getMemoryUsage: () => {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      }
    }
    return null
  }
}

export default {
  debounce,
  throttle,
  memoize,
  performanceMonitor,
  optimizationHelpers,
  bundleOptimization,
  memoryManagement
}