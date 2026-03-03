'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Chip
} from '@mui/material'
import { Refresh as RefreshIcon } from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth.js'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import WarehouseLedgerAccountsTab from './components/WarehouseLedgerAccountsTab'
import WarehouseLedgerEntriesTab from './components/WarehouseLedgerEntriesTab'
import WarehouseLedgerSummaryTab from './components/WarehouseLedgerSummaryTab'
import {
  fetchWarehouseLedgerAccounts,
  fetchWarehouseLedgerEntries,
  fetchWarehouseBalanceSummary,
  clearErrors
} from '../../store/slices/warehouseLedgerSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'

function WarehouseLedgerPage() {
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState(0)
  const { user } = useSelector((state) => state.auth)
  const { warehouseSettings } = useSelector((state) => state.warehouses)
  
  const {
    accounts,
    entries,
    balanceSummary,
    accountsLoading,
    entriesLoading,
    balanceLoading,
    accountsError,
    entriesError,
    balanceError
  } = useSelector((state) => state.warehouseLedger)

  // Get warehouse ID from user (memoized to prevent infinite loops)
  const warehouseId = useMemo(() => {
    return user?.warehouseId || user?.warehouse_id
  }, [user?.warehouseId, user?.warehouse_id])

  // Load initial data
  useEffect(() => {
    if (warehouseId) {
      dispatch(fetchWarehouseLedgerAccounts({ warehouseId }))
      dispatch(fetchWarehouseLedgerEntries({ warehouseId }))
      dispatch(fetchWarehouseBalanceSummary({ warehouseId }))
      
      // Load warehouse settings for permission checking
      if (user?.role === 'WAREHOUSE_KEEPER') {
        dispatch(fetchWarehouseSettings(warehouseId))
      }
    }
  }, [dispatch, warehouseId, user?.role])

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearErrors())
    }
  }, [dispatch])

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }

  const handleRefresh = () => {
    if (warehouseId) {
      dispatch(fetchWarehouseLedgerAccounts({ warehouseId }))
      dispatch(fetchWarehouseLedgerEntries({ warehouseId }))
      dispatch(fetchWarehouseBalanceSummary({ warehouseId }))
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return <WarehouseLedgerAccountsTab warehouseId={warehouseId} />
      case 1:
        return <WarehouseLedgerEntriesTab warehouseId={warehouseId} />
      case 2:
        return <WarehouseLedgerSummaryTab warehouseId={warehouseId} />
      default:
        return <WarehouseLedgerAccountsTab warehouseId={warehouseId} />
    }
  }

  if (!warehouseId && user?.role !== 'ADMIN') {
    return (
      <RouteGuard allowedRoles={['WAREHOUSE_KEEPER', 'ADMIN']}>
        <DashboardLayout>
          <Box sx={{ p: 3 }}>
            <Alert severity="warning">
              No warehouse assigned. Please contact administrator to assign a warehouse.
            </Alert>
          </Box>
        </DashboardLayout>
      </RouteGuard>
    )
  }

  return (
    <RouteGuard allowedRoles={['WAREHOUSE_KEEPER', 'ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Warehouse Ledger Management
              </Typography>
              {warehouseId && (
                <Chip 
                  label={`Warehouse ID: ${warehouseId}`} 
                  color="primary" 
                  size="small"
                />
              )}
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              sx={{ textTransform: 'none' }}
            >
              Refresh
            </Button>
          </Box>

          {/* Error Alerts */}
          {accountsError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearErrors())}>
              Accounts Error: {accountsError}
            </Alert>
          )}
          {entriesError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearErrors())}>
              Entries Error: {entriesError}
            </Alert>
          )}
          {balanceError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearErrors())}>
              Balance Error: {balanceError}
            </Alert>
          )}

          {/* Loading Indicator */}
          {(accountsLoading || entriesLoading || balanceLoading) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab 
                label="Chart of Accounts" 
                sx={{ textTransform: 'none', fontSize: '1rem' }}
              />
              <Tab 
                label="Transaction Entries" 
                sx={{ textTransform: 'none', fontSize: '1rem' }}
              />
              <Tab 
                label="Balance Summary" 
                sx={{ textTransform: 'none', fontSize: '1rem' }}
              />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          <Paper sx={{ p: 3 }}>
            {renderTabContent()}
          </Paper>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(WarehouseLedgerPage)
