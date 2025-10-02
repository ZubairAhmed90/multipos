'use client'

import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Switch,
  FormControlLabel,
} from '@mui/material'
import {
  Sync,
  SyncDisabled,
  CheckCircle,
  Cancel,
  Schedule,
  Refresh,
  Settings,
} from '@mui/icons-material'
import pollingService from '../../utils/pollingService'

export default function PollingStatusIndicator({ dataType, showControls = false }) {
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [isPolling, setIsPolling] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [anchorEl, setAnchorEl] = useState(null)
  const [pollingStatus, setPollingStatus] = useState({})

  useEffect(() => {
    if (!isAuthenticated) return

    const updateStatus = () => {
      const status = pollingService.getPollingStatus()
      setPollingStatus(status)
      
      if (dataType) {
        setIsPolling(pollingService.isPolling(dataType))
      } else {
        // Check if any polling is active
        const hasActivePolling = Object.values(status).some(s => s.isPolling)
        setIsPolling(hasActivePolling)
      }
    }

    updateStatus()
    const interval = setInterval(updateStatus, 1000)
    return () => clearInterval(interval)
  }, [isAuthenticated, dataType])

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleTogglePolling = (targetDataType) => {
    if (pollingService.isPolling(targetDataType)) {
      pollingService.stopPolling(targetDataType)
    } else {
      pollingService.startPolling(targetDataType)
    }
    setLastUpdate(new Date())
  }

  const handleRefreshData = async (targetDataType) => {
    await pollingService.refreshData(targetDataType)
    setLastUpdate(new Date())
  }

  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'Never'
    const now = new Date()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  const formatInterval = (ms) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000)}h`
  }

  if (!isAuthenticated) return null

  const dataTypes = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'sales', label: 'Sales' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'warehouses', label: 'Warehouses' },
    { key: 'branchSettings', label: 'Branch Settings' }
  ]

  return (
    <>
      <Tooltip title={isPolling ? 'Real-time updates active' : 'Real-time updates inactive'}>
        <Chip
          icon={isPolling ? <Sync /> : <SyncDisabled />}
          label={isPolling ? 'Live' : 'Offline'}
          color={isPolling ? 'success' : 'default'}
          size="small"
          onClick={showControls ? handleMenuOpen : undefined}
          clickable={showControls}
        />
      </Tooltip>

      {showControls && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <MenuItem disabled>
            <ListItemIcon>
              <Settings />
            </ListItemIcon>
            <ListItemText primary="Polling Controls" />
          </MenuItem>
          
          <Divider />
          
          {dataTypes.map(dataType => {
            const isDataTypePolling = pollingService.isPolling(dataType.key)
            const status = pollingStatus[dataType.key]
            
            return (
              <MenuItem key={dataType.key} dense>
                <ListItemIcon>
                  {isDataTypePolling ? <CheckCircle color="success" /> : <Cancel color="error" />}
                </ListItemIcon>
                <ListItemText 
                  primary={dataType.label}
                  secondary={status ? `Interval: ${formatInterval(status.interval)}` : 'Not configured'}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isDataTypePolling}
                        onChange={() => handleTogglePolling(dataType.key)}
                        size="small"
                      />
                    }
                    label=""
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRefreshData(dataType.key)}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </Box>
              </MenuItem>
            )
          })}
          
          <Divider />
          
          <MenuItem onClick={() => {
            pollingService.startAllPolling()
            setLastUpdate(new Date())
          }}>
            <ListItemIcon>
              <Sync />
            </ListItemIcon>
            <ListItemText primary="Start All Polling" />
          </MenuItem>
          
          <MenuItem onClick={() => {
            pollingService.stopAllPolling()
            setLastUpdate(new Date())
          }}>
            <ListItemIcon>
              <SyncDisabled />
            </ListItemIcon>
            <ListItemText primary="Stop All Polling" />
          </MenuItem>
        </Menu>
      )}
    </>
  )
}
