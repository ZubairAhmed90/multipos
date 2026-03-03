'use client'

import React from 'react'
import AppErrorPage from '../components/error/AppErrorPage'

export default function GlobalError({ error, reset }) {
  // You can send the error to your monitoring service here
  // Example: monitoring.captureException(error)
  React.useEffect(() => {
    if (error) {
      try {
        // Basic console log for debugging (serverless environments will pick this up)
        console.error('[GlobalError] ', error)
      } catch (e) {}
    }
  }, [error])

  return <AppErrorPage error={error} reset={reset} />
}
