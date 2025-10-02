'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import pollingService from '../utils/pollingService'

export const usePolling = (dataType, options = {}) => {
  const { 
    enabled = true, 
    interval = null, 
    immediate = false,
    onDataUpdate = null 
  } = options

  const { isAuthenticated } = useSelector((state) => state.auth)
  const [isPolling, setIsPolling] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Start polling
  const startPolling = useCallback(() => {
    if (isAuthenticated && enabled) {
      const callback = () => {
        setLastUpdate(new Date())
        if (onDataUpdate) {
          onDataUpdate()
        }
      }
      pollingService.startPolling(dataType, callback, interval || 5000)
      setIsPolling(true)
      setLastUpdate(new Date())
    }
  }, [dataType, interval, enabled, isAuthenticated])

  // Stop polling
  const stopPolling = useCallback(() => {
    pollingService.stopPolling(dataType)
    setIsPolling(false)
  }, [dataType])

  // Refresh data immediately
  const refreshData = useCallback(async () => {
    await pollingService.refreshData(dataType)
    setLastUpdate(new Date())
  }, [dataType])

  // Memoize the callback to prevent infinite loops
  const memoizedCallback = useCallback(() => {
    setLastUpdate(new Date())
    if (onDataUpdate && typeof onDataUpdate === 'function') {
      onDataUpdate()
    }
  }, [onDataUpdate])

  // Effect to manage polling lifecycle
  useEffect(() => {
    if (enabled && isAuthenticated) {
      if (immediate) {
        pollingService.refreshData(dataType)
        setLastUpdate(new Date())
      }
      
      // Always start polling with a valid callback
      pollingService.startPolling(dataType, memoizedCallback, interval || 5000)
      setIsPolling(true)
      setLastUpdate(new Date())
    } else {
      pollingService.stopPolling(dataType)
      setIsPolling(false)
    }

    return () => {
      pollingService.stopPolling(dataType)
      setIsPolling(false)
    }
  }, [enabled, isAuthenticated, dataType, interval, immediate, memoizedCallback])

  return {
    isPolling,
    lastUpdate,
    startPolling,
    stopPolling,
    refreshData,
    pollingStatus: pollingService.getPollingStatus()[dataType]
  }
}

export const useInventoryPolling = (options = {}) => {
  return usePolling('inventory', { interval: 30000, ...options })
}

export const useSalesPolling = (options = {}) => {
  // Temporarily disable sales polling to prevent rate limiting and infinite loops
  return usePolling('sales', { enabled: false, interval: 60000, ...options })
}

export const useDashboardPolling = (options = {}) => {
  return usePolling('dashboard', { interval: 60000, ...options })
}

export const useWarehousesPolling = (options = {}) => {
  return usePolling('warehouses', { interval: 120000, ...options })
}

export const useBranchSettingsPolling = (options = {}) => {
  return usePolling('branchSettings', { interval: 300000, ...options })
}

export default usePolling
