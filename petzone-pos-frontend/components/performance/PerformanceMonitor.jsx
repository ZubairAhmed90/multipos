'use client'

import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material'
import {
  Speed,
  Memory,
  Storage,
  NetworkCheck,
  Refresh,
  ExpandMore,
  ExpandLess,
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Error,
  Info,
} from '@mui/icons-material'
import {
  usePerformanceMetrics,
  useMemoryMonitor,
  useCacheManagement
} from '../../hooks/usePerformance'
import performanceOptimizer from '../../utils/performanceOptimizer'
import apiCacheService from '../../utils/apiCacheService'

// Performance metrics card
const PerformanceCard = ({ title, value, unit, icon, color = 'primary', trend = null }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp color="success" />
    if (trend === 'down') return <TrendingDown color="error" />
    return null
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'success'
    if (trend === 'down') return 'error'
    return 'default'
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" component="div">
              {value}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {title}
            </Typography>
            {unit && (
              <Typography variant="caption" color="textSecondary">
                {unit}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            {trend && (
              <Chip
                icon={getTrendIcon()}
                label={trend}
                color={getTrendColor()}
                size="small"
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// Memory usage component
const MemoryUsage = ({ memoryUsage }) => {
  if (!memoryUsage) {
    return (
      <Alert severity="info">
        Memory usage information not available
      </Alert>
    )
  }

  const usedMB = Math.round(memoryUsage.used / 1024 / 1024)
  const totalMB = Math.round(memoryUsage.total / 1024 / 1024)
  const limitMB = Math.round(memoryUsage.limit / 1024 / 1024)
  const usagePercentage = (memoryUsage.used / memoryUsage.limit) * 100

  const getSeverity = () => {
    if (usagePercentage > 90) return 'error'
    if (usagePercentage > 70) return 'warning'
    return 'success'
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Memory Usage
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              {usedMB} MB / {limitMB} MB
            </Typography>
            <Typography variant="body2">
              {usagePercentage.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={usagePercentage}
            color={getSeverity()}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {usedMB}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Used (MB)
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="info">
                {totalMB}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Total (MB)
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="success">
                {limitMB}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Limit (MB)
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

// Cache statistics component
const CacheStatistics = ({ cacheStats }) => {
  const [expanded, setExpanded] = useState(false)

  if (!cacheStats) {
    return (
      <Alert severity="info">
        Cache statistics not available
      </Alert>
    )
  }

  const getSeverity = (hitRate) => {
    if (hitRate > 0.8) return 'success'
    if (hitRate > 0.5) return 'warning'
    return 'error'
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Cache Statistics
          </Typography>
          <IconButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {cacheStats.hits}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Cache Hits
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="error">
                {cacheStats.misses}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Cache Misses
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              Hit Rate
            </Typography>
            <Typography variant="body2">
              {(cacheStats.hitRate * 100).toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={cacheStats.hitRate * 100}
            color={getSeverity(cacheStats.hitRate)}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Detailed Statistics
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Cache Size"
                  secondary={`${cacheStats.cacheSize} items`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Memory Usage"
                  secondary={`${Math.round(cacheStats.memoryUsage / 1024)} KB`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Compressions"
                  secondary={cacheStats.compressions}
                />
              </ListItem>
            </List>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}

// Performance alerts component
const PerformanceAlerts = ({ metrics, memoryUsage }) => {
  const alerts = []

  // Memory usage alerts
  if (memoryUsage) {
    const usagePercentage = (memoryUsage.used / memoryUsage.limit) * 100
    if (usagePercentage > 90) {
      alerts.push({
        severity: 'error',
        title: 'High Memory Usage',
        message: `Memory usage is at ${usagePercentage.toFixed(1)}%. Consider clearing cache.`
      })
    } else if (usagePercentage > 70) {
      alerts.push({
        severity: 'warning',
        title: 'Moderate Memory Usage',
        message: `Memory usage is at ${usagePercentage.toFixed(1)}%. Monitor closely.`
      })
    }
  }

  // Cache hit rate alerts
  if (metrics && metrics.cacheHitRate < 0.5) {
    alerts.push({
      severity: 'warning',
      title: 'Low Cache Hit Rate',
      message: `Cache hit rate is ${(metrics.cacheHitRate * 100).toFixed(1)}%. Consider optimizing cache strategy.`
    })
  }

  // Render time alerts
  if (metrics && metrics.renderTime > 1000) {
    alerts.push({
      severity: 'warning',
      title: 'Slow Render Time',
      message: `Average render time is ${metrics.renderTime.toFixed(0)}ms. Consider performance optimizations.`
    })
  }

  if (alerts.length === 0) {
    return (
      <Alert severity="success">
        <AlertTitle>Performance Status</AlertTitle>
        All performance metrics are within normal ranges.
      </Alert>
    )
  }

  return (
    <Box>
      {alerts.map((alert, index) => (
        <Alert key={index} severity={alert.severity} sx={{ mb: 1 }}>
          <AlertTitle>{alert.title}</AlertTitle>
          {alert.message}
        </Alert>
      ))}
    </Box>
  )
}

// Main performance monitoring component
export default function PerformanceMonitor() {
  const [expanded, setExpanded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  
  const metrics = usePerformanceMetrics()
  const memoryUsage = useMemoryMonitor()
  const { getCacheStats } = useCacheManagement()
  
  const [cacheStats, setCacheStats] = useState(null)

  useEffect(() => {
    const updateCacheStats = () => {
      setCacheStats(getCacheStats())
    }

    updateCacheStats()
    const interval = setInterval(updateCacheStats, 5000)

    return () => clearInterval(interval)
  }, [getCacheStats, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleClearCache = () => {
    performanceOptimizer.clearCache()
    apiCacheService.clear()
    setCacheStats(getCacheStats())
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">
          Performance Monitor
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={handleClearCache}
          >
            Clear Cache
          </Button>
        </Box>
      </Box>

      {/* Performance Alerts */}
      <Box sx={{ mb: 3 }}>
        <PerformanceAlerts metrics={metrics} memoryUsage={memoryUsage} />
      </Box>

      {/* Main Performance Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            title="API Calls"
            value={metrics?.apiCalls || 0}
            icon={<NetworkCheck color="primary" />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            title="Cache Hit Rate"
            value={metrics ? `${(metrics.cacheHitRate * 100).toFixed(1)}%` : '0%'}
            icon={<Storage color="success" />}
            color="success"
            trend={metrics?.cacheHitRate > 0.7 ? 'up' : 'down'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            title="Render Time"
            value={metrics ? `${metrics.renderTime.toFixed(0)}ms` : '0ms'}
            icon={<Speed color="warning" />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <PerformanceCard
            title="Cache Size"
            value={metrics?.cacheSize || 0}
            unit="items"
            icon={<Memory color="info" />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Detailed Metrics */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <MemoryUsage memoryUsage={memoryUsage} />
        </Grid>
        <Grid item xs={12} md={6}>
          <CacheStatistics cacheStats={cacheStats} />
        </Grid>
      </Grid>

      {/* Expandable Detailed View */}
      <Box sx={{ mt: 3 }}>
        <Button
          startIcon={expanded ? <ExpandLess /> : <ExpandMore />}
          onClick={() => setExpanded(!expanded)}
          variant="outlined"
        >
          {expanded ? 'Hide' : 'Show'} Detailed Metrics
        </Button>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Detailed Performance Metrics
                </Typography>
                
                {metrics && (
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Metric</TableCell>
                          <TableCell align="right">Value</TableCell>
                          <TableCell align="right">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>API Calls</TableCell>
                          <TableCell align="right">{metrics.apiCalls}</TableCell>
                          <TableCell align="right">
                            <Chip label="Normal" color="success" size="small" />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Cache Hits</TableCell>
                          <TableCell align="right">{metrics.cacheHits}</TableCell>
                          <TableCell align="right">
                            <Chip label="Good" color="success" size="small" />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Cache Misses</TableCell>
                          <TableCell align="right">{metrics.cacheMisses}</TableCell>
                          <TableCell align="right">
                            <Chip label="Normal" color="info" size="small" />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Render Time</TableCell>
                          <TableCell align="right">{metrics.renderTime.toFixed(2)}ms</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={metrics.renderTime > 1000 ? "Slow" : "Fast"} 
                              color={metrics.renderTime > 1000 ? "warning" : "success"} 
                              size="small" 
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Load Time</TableCell>
                          <TableCell align="right">{metrics.loadTime.toFixed(2)}ms</TableCell>
                          <TableCell align="right">
                            <Chip label="Normal" color="success" size="small" />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        </Collapse>
      </Box>
    </Box>
  )
}
