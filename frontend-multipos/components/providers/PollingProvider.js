'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useRoleBasedPolling } from '../../hooks/useAutoPolling'
import { POLLING_CONFIGS } from '../../utils/pollingConfig'

const PollingContext = createContext()

export const usePolling = () => {
  const context = useContext(PollingContext)
  if (!context) {
    throw new Error('usePolling must be used within a PollingProvider')
  }
  return context
}

export const PollingProvider = ({ children }) => {
  const { user } = useSelector((state) => state.auth)
  const [isEnabled, setIsEnabled] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  
  const {
    isPolling,
    startAllPolling,
    stopAllPolling,
    toggleAllPolling
  } = useRoleBasedPolling(user?.role, POLLING_CONFIGS)

  // Update last update time when polling occurs
  useEffect(() => {
    if (isPolling) {
      setLastUpdate(new Date())
    }
  }, [isPolling])

  // Auto-start polling when user logs in
  useEffect(() => {
    if (user && isEnabled) {
      startAllPolling()
    } else {
      stopAllPolling()
    }
  }, [user, isEnabled, startAllPolling, stopAllPolling])

  const togglePolling = () => {
    setIsEnabled(!isEnabled)
    toggleAllPolling()
  }

  const manualRefresh = () => {
    // This would trigger all relevant fetch actions
    // Implementation depends on specific needs
    setLastUpdate(new Date())
  }

  const value = {
    isPolling,
    isEnabled,
    lastUpdate,
    togglePolling,
    manualRefresh,
    startPolling: startAllPolling,
    stopPolling: stopAllPolling,
  }

  return (
    <PollingContext.Provider value={value}>
      {children}
    </PollingContext.Provider>
  )
}

export default PollingProvider
