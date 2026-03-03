import { useEffect, useRef, useCallback } from 'react'
import { useDispatch } from 'react-redux'

/**
 * Custom hook for auto-polling API endpoints
 * @param {Function} fetchAction - Redux action to dispatch
 * @param {number} interval - Polling interval in milliseconds (default: 30000)
 * @param {boolean} enabled - Whether polling is enabled (default: true)
 * @param {Array} dependencies - Dependencies to watch for changes
 * @returns {Object} - { isPolling, startPolling, stopPolling, lastUpdate }
 */
export const useAutoPolling = (
  fetchAction, 
  interval = 30000, 
  enabled = true, 
  dependencies = []
) => {
  const dispatch = useDispatch()
  const intervalRef = useRef(null)
  const lastUpdateRef = useRef(null)
  const isPollingRef = useRef(false)

  const startPolling = useCallback(() => {
    if (intervalRef.current) return // Already polling
    
    isPollingRef.current = true
    lastUpdateRef.current = new Date()
    
    // Initial fetch
    dispatch(fetchAction())
    
    // Set up interval
    intervalRef.current = setInterval(() => {
      dispatch(fetchAction())
      lastUpdateRef.current = new Date()
    }, interval)
  }, [dispatch, fetchAction, interval])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      isPollingRef.current = false
    }
  }, [])

  const togglePolling = useCallback(() => {
    if (isPollingRef.current) {
      stopPolling()
    } else {
      startPolling()
    }
  }, [startPolling, stopPolling])

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      startPolling()
    } else {
      stopPolling()
    }
    
    return () => stopPolling()
  }, [enabled, startPolling, stopPolling, ...dependencies])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return {
    isPolling: isPollingRef.current,
    startPolling,
    stopPolling,
    togglePolling,
    lastUpdate: lastUpdateRef.current,
  }
}

/**
 * Hook for multiple polling endpoints
 * @param {Array} pollingConfigs - Array of polling configurations
 * @returns {Object} - Combined polling controls
 */
export const useMultiplePolling = (pollingConfigs = []) => {
  const dispatch = useDispatch()
  const intervalRefs = useRef({})
  const isPollingRef = useRef(false)

  const startAllPolling = useCallback(() => {
    pollingConfigs.forEach(({ 
      key, 
      fetchAction, 
      interval = 30000, 
      dependencies = [] 
    }) => {
      if (intervalRefs.current[key]) return // Already polling
      
      // Initial fetch
      dispatch(fetchAction())
      
      // Set up interval
      intervalRefs.current[key] = setInterval(() => {
        dispatch(fetchAction())
      }, interval)
    })
    
    isPollingRef.current = true
  }, [dispatch, pollingConfigs])

  const stopAllPolling = useCallback(() => {
    Object.values(intervalRefs.current).forEach(interval => {
      if (interval) clearInterval(interval)
    })
    intervalRefs.current = {}
    isPollingRef.current = false
  }, [])

  const toggleAllPolling = useCallback(() => {
    if (isPollingRef.current) {
      stopAllPolling()
    } else {
      startAllPolling()
    }
  }, [startAllPolling, stopAllPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAllPolling()
  }, [stopAllPolling])

  return {
    isPolling: isPollingRef.current,
    startAllPolling,
    stopAllPolling,
    toggleAllPolling,
  }
}

/**
 * Hook for conditional polling based on user role
 * @param {string} userRole - Current user role
 * @param {Object} roleConfigs - Configuration for each role
 * @returns {Object} - Polling controls
 */
export const useRoleBasedPolling = (userRole, roleConfigs = {}) => {
  const config = roleConfigs[userRole] || roleConfigs.default || {}
  
  return useMultiplePolling(config.pollingConfigs || [])
}

export default useAutoPolling
