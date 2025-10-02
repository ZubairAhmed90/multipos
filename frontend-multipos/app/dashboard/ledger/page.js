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
  CircularProgress
} from '@mui/material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import LedgerAccountsTab from './components/LedgerAccountsTab'
import LedgerEntriesTab from './components/LedgerEntriesTab'
import LedgerSummaryTab from './components/LedgerSummaryTab'
import {
  fetchLedgerAccounts,
  fetchLedgerEntries,
  fetchBalanceSummary,
  clearErrors
} from '../../store/slices/ledgerSlice'

function LedgerPage() {
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState(0)
  const { user } = useSelector((state) => state.auth)
  
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
  } = useSelector((state) => state.ledger)

  // Determine user's scope (memoized to prevent infinite loops)
  const userScope = useMemo(() => {
    if (!user) return { scopeType: 'BRANCH', scopeId: 1 }
    
    if (user.role === 'CASHIER' && user.branchId) {
      return { scopeType: 'BRANCH', scopeId: user.branchId }
    } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
      return { scopeType: 'WAREHOUSE', scopeId: user.warehouseId }
    }
    
    // Default for admin or users without specific assignment
    return { scopeType: 'BRANCH', scopeId: 1 }
  }, [user])

  // Load initial data
  useEffect(() => {
    dispatch(fetchLedgerAccounts())
    dispatch(fetchLedgerEntries())
    dispatch(fetchBalanceSummary({ scopeType: userScope.scopeType, scopeId: userScope.scopeId }))
  }, [dispatch, userScope])

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearErrors())
    }
  }, [dispatch])

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return <LedgerAccountsTab />
      case 1:
        return <LedgerEntriesTab />
      case 2:
        return <LedgerSummaryTab />
      default:
        return <LedgerAccountsTab />
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
            Ledger Management
          </Typography>

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

export default withAuth(LedgerPage)
