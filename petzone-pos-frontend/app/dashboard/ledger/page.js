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
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  AccountBalance as LedgerIcon,
  AccountBalance,
  AccountTree as ChartIcon,
  Receipt as TransactionIcon,
  Assessment as SummaryIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  FilterList as FilterIcon,
  CheckCircle,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material'
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

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return {
        totalAccounts: 0,
        activeAccounts: 0,
        totalBalance: 0,
        assetBalance: 0,
        liabilityBalance: 0
      }
    }

    return accounts.reduce((acc, account) => {
      if (!account) return acc
      
      const balance = parseFloat(account.balance) || 0
      const accountType = account.accountType || account.account_type
      const status = account.status
      
      acc.totalAccounts += 1
      if (status === 'ACTIVE') acc.activeAccounts += 1
      acc.totalBalance += balance
      
      if (accountType === 'asset') {
        acc.assetBalance += balance
      } else if (accountType === 'liability') {
        acc.liabilityBalance += balance
      }
      
      return acc
    }, {
      totalAccounts: 0,
      activeAccounts: 0,
      totalBalance: 0,
      assetBalance: 0,
      liabilityBalance: 0
    })
  }, [accounts])

  const handleRefresh = () => {
    dispatch(fetchLedgerAccounts())
    dispatch(fetchLedgerEntries())
    dispatch(fetchBalanceSummary({ scopeType: userScope.scopeType, scopeId: userScope.scopeId }))
  }

  // Render content inside RouteGuard to avoid conditional hook calls
  const renderContent = () => (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LedgerIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" gutterBottom>
                Ledger Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete financial tracking and accounting system
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              sx={{ textTransform: 'none' }}
            >
              Export
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Total Accounts
                    </Typography>
                    <Typography variant="h5" component="div">
                      {summaryStats.totalAccounts}
                    </Typography>
                  </Box>
                  <ChartIcon sx={{ color: 'primary.main', fontSize: 30 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Active Accounts
                    </Typography>
                    <Typography variant="h5" component="div" color="success.main">
                      {summaryStats.activeAccounts}
                    </Typography>
                  </Box>
                  <CheckCircle sx={{ color: 'success.main', fontSize: 30 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Total Balance
                    </Typography>
                    <Typography variant="h5" component="div">
                      ${summaryStats.totalBalance.toFixed(2)}
                    </Typography>
                  </Box>
                  <AccountBalance sx={{ color: 'info.main', fontSize: 30 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Assets
                    </Typography>
                    <Typography variant="h5" component="div" color="success.main">
                      ${summaryStats.assetBalance.toFixed(2)}
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ color: 'success.main', fontSize: 30 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Liabilities
                    </Typography>
                    <Typography variant="h5" component="div" color="error.main">
                      ${summaryStats.liabilityBalance.toFixed(2)}
                    </Typography>
                  </Box>
                  <TrendingDown sx={{ color: 'error.main', fontSize: 30 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

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
        <Paper sx={{ mb: 3, boxShadow: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                minHeight: 64
              }
            }}
          >
            <Tab 
              label="Chart of Accounts" 
              icon={<ChartIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Transaction Entries" 
              icon={<TransactionIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Balance Summary" 
              icon={<SummaryIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        <Paper sx={{ p: 3, boxShadow: 2 }}>
          {renderTabContent()}
        </Paper>
      </Box>
    </DashboardLayout>
  )

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      {renderContent()}
    </RouteGuard>
  )
}

export default withAuth(LedgerPage)
