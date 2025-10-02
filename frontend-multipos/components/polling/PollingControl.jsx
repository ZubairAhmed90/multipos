'use client'

import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Chip,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  Refresh,
  Settings,
  TrendingUp,
  Inventory,
  ShoppingCart,
  Dashboard,
  Warehouse,
  Business,
  CheckCircle,
  Cancel,
  Schedule,
} from '@mui/icons-material'
import pollingService from '../../utils/pollingService'

export default function PollingControl() {
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const [pollingStatus, setPollingStatus] = useState({})
  const [isPollingEnabled, setIsPollingEnabled] = useState(true)
  const [customIntervals, setCustomIntervals] = useState({
    inventory: 30000,
    sales: 15000,
    dashboard: 60000,
    warehouses: 120000,
    branchSettings: 300000
  })

  const dataTypes = [
    { key: 'inventory', label: 'Inventory', icon: <Inventory />, color: 'primary' },
    { key: 'sales', label: 'Sales', icon: <ShoppingCart />, color: 'secondary' },
    { key: 'dashboard', label: 'Dashboard', icon: <Dashboard />, color: 'success' },
    { key: 'warehouses', label: 'Warehouses', icon: <Warehouse />, color: 'info' },
    { key: 'branchSettings', label: 'Branch Settings', icon: <Business />, color: 'warning' }
  ]

  useEffect(() => {
    updatePollingStatus()
    const interval = setInterval(updatePollingStatus, 1000)
    return () => clearInterval(interval)
  }, [])

  const updatePollingStatus = () => {
    setPollingStatus(pollingService.getPollingStatus())
  }

  const handleTogglePolling = (dataType) => {
    if (pollingService.isPolling(dataType)) {
      pollingService.stopPolling(dataType)
    } else {
      pollingService.startPolling(dataType, customIntervals[dataType])
    }
    updatePollingStatus()
  }

  const handleStartAllPolling = () => {
    pollingService.startAllPolling()
    setIsPollingEnabled(true)
    updatePollingStatus()
  }

  const handleStopAllPolling = () => {
    pollingService.stopAllPolling()
    setIsPollingEnabled(false)
    updatePollingStatus()
  }

  const handleRefreshData = async (dataType) => {
    await pollingService.refreshData(dataType)
    updatePollingStatus()
  }

  const handleIntervalChange = (dataType, newInterval) => {
    setCustomIntervals(prev => ({
      ...prev,
      [dataType]: newInterval
    }))
    pollingService.setInterval(dataType, newInterval)
    
    // Restart polling with new interval if currently polling
    if (pollingService.isPolling(dataType)) {
      pollingService.stopPolling(dataType)
      pollingService.startPolling(dataType, newInterval)
    }
    updatePollingStatus()
  }

  const formatInterval = (ms) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000)}h`
  }

  const getStatusColor = (isPolling) => {
    return isPolling ? 'success' : 'default'
  }

  const getStatusIcon = (isPolling) => {
    return isPolling ? <CheckCircle /> : <Cancel />
  }

  if (!isAuthenticated) {
    return (
      <Alert severity="warning">
        Please log in to manage real-time updates
      </Alert>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Real-time Updates Control
      </Typography>
      
      {/* User Context */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current User Context
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                <strong>User:</strong> {user?.username || user?.name}
              </Typography>
              <Typography variant="body2">
                <strong>Role:</strong> {user?.role}
              </Typography>
              <Typography variant="body2">
                <strong>Branch:</strong> {user?.branchId || 'Not assigned'}
              </Typography>
              <Typography variant="body2">
                <strong>Warehouse:</strong> {user?.warehouseId || 'Not assigned'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Chip 
                label={isPollingEnabled ? 'Polling Enabled' : 'Polling Disabled'}
                color={isPollingEnabled ? 'success' : 'error'}
                icon={isPollingEnabled ? <CheckCircle /> : <Cancel />}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Global Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Global Controls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={handleStartAllPolling}
              disabled={isPollingEnabled}
            >
              Start All Polling
            </Button>
            <Button
              variant="outlined"
              startIcon={<Pause />}
              onClick={handleStopAllPolling}
              disabled={!isPollingEnabled}
            >
              Stop All Polling
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => {
                dataTypes.forEach(dataType => {
                  pollingService.refreshData(dataType.key)
                })
              }}
            >
              Refresh All Data
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Individual Data Type Controls */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Data Type Controls
          </Typography>
          
          <List>
            {dataTypes.map((dataType, index) => {
              const isPolling = pollingService.isPolling(dataType.key)
              const currentInterval = customIntervals[dataType.key]
              
              return (
                <div key={dataType.key}>
                  <ListItem>
                    <ListItemIcon>
                      {dataType.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={dataType.label}
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Chip
                            label={isPolling ? 'Active' : 'Inactive'}
                            color={getStatusColor(isPolling)}
                            icon={getStatusIcon(isPolling)}
                            size="small"
                          />
                          <Chip
                            label={`Interval: ${formatInterval(currentInterval)}`}
                            color="default"
                            size="small"
                            icon={<Schedule />}
                          />
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Toggle Polling">
                          <Switch
                            checked={isPolling}
                            onChange={() => handleTogglePolling(dataType.key)}
                            color={dataType.color}
                          />
                        </Tooltip>
                        <Tooltip title="Refresh Data">
                          <IconButton
                            onClick={() => handleRefreshData(dataType.key)}
                            size="small"
                          >
                            <Refresh />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  {/* Interval Control */}
                  <Box sx={{ px: 2, pb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Polling Interval
                    </Typography>
                    <Slider
                      value={currentInterval}
                      onChange={(e, value) => handleIntervalChange(dataType.key, value)}
                      min={5000}
                      max={600000}
                      step={5000}
                      marks={[
                        { value: 5000, label: '5s' },
                        { value: 30000, label: '30s' },
                        { value: 60000, label: '1m' },
                        { value: 300000, label: '5m' },
                        { value: 600000, label: '10m' }
                      ]}
                      valueLabelDisplay="auto"
                      valueLabelFormat={formatInterval}
                    />
                  </Box>
                  
                  {index < dataTypes.length - 1 && <Divider />}
                </div>
              )
            })}
          </List>
        </CardContent>
      </Card>

      {/* Polling Status Summary */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Polling Status Summary
          </Typography>
          <Grid container spacing={2}>
            {dataTypes.map(dataType => {
              const isPolling = pollingService.isPolling(dataType.key)
              const status = pollingStatus[dataType.key]
              
              return (
                <Grid item xs={12} sm={6} md={4} key={dataType.key}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    {dataType.icon}
                    <Typography variant="subtitle2" gutterBottom>
                      {dataType.label}
                    </Typography>
                    <Chip
                      label={isPolling ? 'Active' : 'Inactive'}
                      color={getStatusColor(isPolling)}
                      icon={getStatusIcon(isPolling)}
                      size="small"
                    />
                    {status && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Interval: {formatInterval(status.interval)}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}
