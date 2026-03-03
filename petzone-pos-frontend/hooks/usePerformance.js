'use client'

import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import performanceOptimizer from '../utils/performanceOptimizer'

// Hook for memoized selectors
export const useMemoizedSelector = (selector, deps = []) => {
  return useSelector(useMemo(() => selector, deps))
}

// Hook for debounced values
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook for throttled values
export const useThrottle = (value, delay) => {
  const [throttledValue, setThrottledValue] = useState(value)
  const lastExecuted = useRef(Date.now())

  useEffect(() => {
    if (Date.now() >= lastExecuted.current + delay) {
      lastExecuted.current = Date.now()
      setThrottledValue(value)
    } else {
      const timer = setTimeout(() => {
        lastExecuted.current = Date.now()
        setThrottledValue(value)
      }, delay - (Date.now() - lastExecuted.current))

      return () => clearTimeout(timer)
    }
  }, [value, delay])

  return throttledValue
}

// Hook for performance monitoring
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0)
  const startTime = useRef(Date.now())

  useEffect(() => {
    renderCount.current++
    const renderTime = Date.now() - startTime.current
    
    if (process.env.NODE_ENV === 'development') {
    }
    
    startTime.current = Date.now()
  })

  return {
    renderCount: renderCount.current,
    componentName
  }
}

// Hook for intersection observer (lazy loading)
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = performanceOptimizer.createIntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      options
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [options, hasIntersected])

  return { ref, isIntersecting, hasIntersected }
}

// Hook for virtual scrolling
export const useVirtualScroll = (items, itemHeight, containerHeight, overscan = 5) => {
  const [scrollTop, setScrollTop] = useState(0)

  const virtualItems = useMemo(() => {
    const { startIndex, endIndex } = performanceOptimizer.calculateVirtualScrollItems(
      containerHeight,
      itemHeight,
      scrollTop,
      overscan
    )

    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      index: startIndex + index,
      top: (startIndex + index) * itemHeight
    }))
  }, [items, itemHeight, containerHeight, scrollTop, overscan])

  const totalHeight = items.length * itemHeight

  return {
    virtualItems,
    totalHeight,
    setScrollTop
  }
}

// Hook for cached API calls
export const useCachedApiCall = (key, apiCall, options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)

    try {
      const result = await performanceOptimizer.cachedApiCall(
        key,
        apiCall,
        { ...options, forceRefresh }
      )
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [key, apiCall, options])

  useEffect(() => {
    execute()
  }, [execute])

  return {
    data,
    loading,
    error,
    refetch: () => execute(true)
  }
}

// Hook for Redux state caching
export const useCachedReduxState = (selector, cacheKey) => {
  const [cachedData, setCachedData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const currentData = useSelector(selector)

  useEffect(() => {
    // Try to get cached data first
    const cached = performanceOptimizer.getCachedReduxState(cacheKey)
    if (cached) {
      setCachedData(cached)
      setIsLoading(false)
    } else {
      // Cache current data
      performanceOptimizer.cacheReduxState(cacheKey, currentData)
      setCachedData(currentData)
      setIsLoading(false)
    }
  }, [currentData, cacheKey])

  return {
    data: cachedData || currentData,
    isLoading,
    isCached: !!cachedData
  }
}

// Hook for performance metrics
export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(performanceOptimizer.getPerformanceMetrics())
    }

    updateMetrics()
    const interval = setInterval(updateMetrics, 5000)

    return () => clearInterval(interval)
  }, [])

  return metrics
}

// Hook for memory monitoring
export const useMemoryMonitor = () => {
  const [memoryUsage, setMemoryUsage] = useState(null)

  useEffect(() => {
    const updateMemoryUsage = () => {
      setMemoryUsage(performanceOptimizer.getMemoryUsage())
    }

    updateMemoryUsage()
    const interval = setInterval(updateMemoryUsage, 10000)

    return () => clearInterval(interval)
  }, [])

  return memoryUsage
}

// Hook for optimized callbacks
export const useOptimizedCallback = (callback, deps) => {
  return useCallback(callback, deps)
}

// Hook for optimized memo
export const useOptimizedMemo = (factory, deps) => {
  return useMemo(factory, deps)
}

// Hook for component lazy loading
export const useLazyComponent = (importFunc) => {
  const [Component, setComponent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    importFunc()
      .then(module => {
        setComponent(() => module.default)
        setLoading(false)
      })
      .catch(err => {
        setError(err)
        setLoading(false)
      })
  }, [importFunc])

  return { Component, loading, error }
}

// Hook for image lazy loading
export const useLazyImage = (src, options = {}) => {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const { ref, isIntersecting } = useIntersectionObserver(options)

  useEffect(() => {
    if (isIntersecting && src) {
      const img = new Image()
      img.onload = () => setLoaded(true)
      img.onerror = () => setError(true)
      img.src = src
    }
  }, [isIntersecting, src])

  return {
    ref,
    loaded,
    error,
    src: isIntersecting ? src : null
  }
}

// Hook for performance optimization
export const usePerformanceOptimization = (componentName) => {
  const renderCount = useRef(0)
  const startTime = useRef(Date.now())

  useEffect(() => {
    renderCount.current++
    const renderTime = Date.now() - startTime.current
    
    performanceOptimizer.startTimer(`${componentName}_render`)
    
    return () => {
      performanceOptimizer.endTimer(`${componentName}_render`)
    }
  })

  const optimizeRender = useCallback((fn) => {
    return performanceOptimizer.measurePerformance(fn, `${componentName}_render`)
  }, [componentName])

  const optimizeAsync = useCallback(async (fn) => {
    return performanceOptimizer.measureAsyncPerformance(fn, `${componentName}_async`)
  }, [componentName])

  return {
    renderCount: renderCount.current,
    optimizeRender,
    optimizeAsync
  }
}

// Hook for cache management
export const useCacheManagement = () => {
  const clearCache = useCallback((pattern) => {
    performanceOptimizer.clearCache(pattern)
  }, [])

  const getCacheStats = useCallback(() => {
    return {
      size: performanceOptimizer.cache.size,
      metrics: performanceOptimizer.getPerformanceMetrics()
    }
  }, [])

  return {
    clearCache,
    getCacheStats
  }
}

export default {
  useMemoizedSelector,
  useDebounce,
  useThrottle,
  usePerformanceMonitor,
  useIntersectionObserver,
  useVirtualScroll,
  useCachedApiCall,
  useCachedReduxState,
  usePerformanceMetrics,
  useMemoryMonitor,
  useOptimizedCallback,
  useOptimizedMemo,
  useLazyComponent,
  useLazyImage,
  usePerformanceOptimization,
  useCacheManagement
}
