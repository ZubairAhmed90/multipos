import { NextResponse } from 'next/server'
import { performanceMonitor, logger } from '../../../utils/monitoring'
import envConfig from '../../../config/environment'

// Status endpoint for basic application status
export async function GET() {
  try {
    const metrics = performanceMonitor.getMetrics()
    
    const response = {
      status: 'running',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: envConfig.getConfig().NODE_ENV,
      uptime: Date.now() - metrics.startTime,
      basicMetrics: {
        pageLoads: metrics.pageLoads,
        apiCalls: metrics.apiCalls,
        errors: metrics.errors,
        warnings: metrics.warnings
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    logger.error('Status check failed', { error: error.message })
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 })
  }
}
