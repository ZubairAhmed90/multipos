'use client'

import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { initializeAuth } from '../../app/store/slices/authSlice'

const AuthInitializer = () => {
  const dispatch = useDispatch()
  const initialized = useRef(false)

  useEffect(() => {
    // Prevent multiple initializations
    if (initialized.current) {
      return
    }

    // Add small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      dispatch(initializeAuth())
      initialized.current = true
    }, 100)

    return () => clearTimeout(timer)
  }, [dispatch])

  return null // This component doesn't render anything
}

export default AuthInitializer
