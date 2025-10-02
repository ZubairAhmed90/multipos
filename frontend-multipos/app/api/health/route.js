import { NextResponse } from 'next/server'
import { healthChecker, performanceMonitor, errorTracker, logger } from '../../../utils/monitoring'
import envConfig from '../../../config/environment'

// Health check endpoint
export async function GET() {
  try {
    const healthStatus = await healthChecker.getHealthStatus()
    const metrics = performanceMonitor.getMetrics()
    const errorStats = errorTracker.getErrorStats()

    const response = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: envConfig.getConfig().NODE_ENV,
      uptime: healthStatus.uptime,
      checks: healthStatus.checks,
      metrics: {
        pageLoads: metrics.pageLoads,
        apiCalls: metrics.apiCalls,
        errors: metrics.errors,
        warnings: metrics.warnings,
        averageResponseTime: metrics.averageResponseTime,
        memoryUsage: metrics.memoryUsage,
        cacheHitRate: metrics.cacheHitRate
      },
      errorStats: {
        total: errorStats.total,
        lastHour: errorStats.lastHour,
        lastDay: errorStats.lastDay,
        mostCommon: errorStats.mostCommon
      }
    }

    logger.info('Health check requested', { status: healthStatus.status })

    return NextResponse.json(response, {
      status: healthStatus.status === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    logger.error('Health check failed', { error: error.message })
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 })
  }
}

// Detailed status endpoint
export async function POST() {
  try {
    const healthStatus = await healthChecker.getHealthStatus()
    const metrics = performanceMonitor.getMetrics()
    const recentErrors = errorTracker.getErrors(50)
    const recentLogs = logger.getLogs('error', 20)

    const response = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: envConfig.getConfig().NODE_ENV,
      uptime: healthStatus.uptime,
      checks: healthStatus.checks,
      metrics,
      recentErrors,
      recentLogs,
      configuration: {
        apiUrl: envConfig.getApiUrl(),
        logLevel: envConfig.getLogLevel(),
        enableAnalytics: envConfig.shouldEnableAnalytics(),
        enableSentry: envConfig.shouldEnableSentry(),
        cacheTTL: envConfig.getCacheTTL(),
        pollingInterval: envConfig.getPollingInterval()
      }
    }

    logger.info('Detailed status requested')

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    logger.error('Detailed status failed', { error: error.message })
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 })
  }
}
