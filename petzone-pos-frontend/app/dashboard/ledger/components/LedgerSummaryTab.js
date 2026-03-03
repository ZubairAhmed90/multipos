'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material'
import {
  AccountBalance as BalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Assessment as SummaryIcon,
  GetApp as ExportIcon,
  Print as PrintIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material'
import {
  fetchBalanceSummary,
  fetchLedgerAccounts
} from '../../../store/slices/ledgerSlice'

function LedgerSummaryTab() {
  const dispatch = useDispatch()
  const { 
    balanceSummary, 
    balanceLoading, 
    balanceError,
    accounts,
    accountsLoading
  } = useSelector((state) => state.ledger)

  const [summaryData, setSummaryData] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0
  })

  // Load data
  useEffect(() => {
    dispatch(fetchBalanceSummary({ scopeType: 'BRANCH', scopeId: 1 }))
    dispatch(fetchLedgerAccounts())
  }, [dispatch])

  // Calculate summary data from accounts
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const summary = accounts.reduce((acc, account) => {
        const balance = parseFloat(account.balance) || 0
        const accountType = account.accountType || account.account_type
        
        switch (accountType) {
          case 'asset':
            acc.totalAssets += balance
            break
          case 'liability':
            acc.totalLiabilities += balance
            break
          case 'equity':
            acc.totalEquity += balance
            break
          case 'revenue':
            acc.totalRevenue += balance
            break
          case 'expense':
            acc.totalExpenses += balance
            break
        }
        return acc
      }, {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0
      })

      summary.netIncome = summary.totalRevenue - summary.totalExpenses
      setSummaryData(summary)
    }
  }, [accounts])

  const handleRefresh = () => {
    dispatch(fetchBalanceSummary({ scopeType: 'BRANCH', scopeId: 1 }))
    dispatch(fetchLedgerAccounts())
  }

  const SummaryCard = ({ title, value, icon, color = 'primary' }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={color}>
              {value.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ color: `${color}.main` }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )

  const AccountTypeTable = ({ type, accounts, color }) => {
    const filteredAccounts = accounts.filter(account => (account.accountType || account.account_type) === type)
    const total = filteredAccounts.reduce((sum, account) => sum + (parseFloat(account.balance) || 0), 0)

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
            {type} Accounts
            <Chip 
              label={`Total: ${total.toFixed(2)}`} 
              color={color} 
              size="small" 
              sx={{ ml: 2 }}
            />
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Account Name</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.accountName || account.account_name}</TableCell>
                    <TableCell align="right">
                      {(parseFloat(account.balance) || 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={account.status} 
                        color={account.status === 'ACTIVE' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    )
  }

  // Calculate additional metrics
  const additionalMetrics = useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return {
        workingCapital: 0,
        currentRatio: 0,
        debtToEquity: 0,
        grossProfitMargin: 0
      }
    }

    const currentAssets = accounts
      .filter(acc => (acc.accountType || acc.account_type) === 'asset' && (acc.accountName || acc.account_name)?.toLowerCase().includes('cash'))
      .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0)
    
    const currentLiabilities = accounts
      .filter(acc => (acc.accountType || acc.account_type) === 'liability')
      .reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0)
    
    const totalEquity = summaryData.totalEquity
    const totalRevenue = summaryData.totalRevenue
    const totalExpenses = summaryData.totalExpenses

    return {
      workingCapital: currentAssets - currentLiabilities,
      currentRatio: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
      debtToEquity: totalEquity > 0 ? summaryData.totalLiabilities / totalEquity : 0,
      grossProfitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0
    }
  }, [accounts, summaryData])

  if (balanceLoading || accountsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SummaryIcon sx={{ fontSize: 30, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5">
              Balance Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Complete financial overview and analysis
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Print Report">
            <IconButton color="primary">
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Data">
            <IconButton color="primary">
              <ExportIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {balanceError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {balanceError}
        </Alert>
      )}

      {/* Primary Financial Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2}>
          <SummaryCard
            title="Total Assets"
            value={summaryData.totalAssets}
            icon={<BalanceIcon sx={{ fontSize: 40 }} />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <SummaryCard
            title="Total Liabilities"
            value={summaryData.totalLiabilities}
            icon={<TrendingDownIcon sx={{ fontSize: 40 }} />}
            color="error"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <SummaryCard
            title="Total Equity"
            value={summaryData.totalEquity}
            icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <SummaryCard
            title="Total Revenue"
            value={summaryData.totalRevenue}
            icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <SummaryCard
            title="Total Expenses"
            value={summaryData.totalExpenses}
            icon={<TrendingDownIcon sx={{ fontSize: 40 }} />}
            color="error"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <SummaryCard
            title="Net Income"
            value={summaryData.netIncome}
            icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
            color={summaryData.netIncome >= 0 ? 'success' : 'error'}
          />
        </Grid>
      </Grid>

      {/* Financial Ratios */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Working Capital
                  </Typography>
                  <Typography variant="h5" color={additionalMetrics.workingCapital >= 0 ? 'success.main' : 'error.main'}>
                    ${additionalMetrics.workingCapital.toFixed(2)}
                  </Typography>
                </Box>
                <PieChartIcon sx={{ color: 'primary.main', fontSize: 30 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Current Ratio
                  </Typography>
                  <Typography variant="h5" color={additionalMetrics.currentRatio >= 1 ? 'success.main' : 'warning.main'}>
                    {additionalMetrics.currentRatio.toFixed(2)}:1
                  </Typography>
                </Box>
                <BarChartIcon sx={{ color: 'info.main', fontSize: 30 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Debt to Equity
                  </Typography>
                  <Typography variant="h5" color={additionalMetrics.debtToEquity <= 1 ? 'success.main' : 'error.main'}>
                    {additionalMetrics.debtToEquity.toFixed(2)}:1
                  </Typography>
                </Box>
                <TrendingDownIcon sx={{ color: 'warning.main', fontSize: 30 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Profit Margin
                  </Typography>
                  <Typography variant="h5" color={additionalMetrics.grossProfitMargin >= 0 ? 'success.main' : 'error.main'}>
                    {additionalMetrics.grossProfitMargin.toFixed(1)}%
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ color: 'success.main', fontSize: 30 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Accounting Equation & Financial Health */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Accounting Equation
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1.2rem', fontWeight: 500, mb: 2 }}>
                Assets = Liabilities + Equity
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                ${summaryData.totalAssets.toFixed(2)} = ${summaryData.totalLiabilities.toFixed(2)} + ${summaryData.totalEquity.toFixed(2)}
              </Typography>
              <Chip 
                label={Math.abs(summaryData.totalAssets - (summaryData.totalLiabilities + summaryData.totalEquity)) < 0.01 
                  ? '✓ Equation is balanced' 
                  : '⚠ Equation is not balanced'
                }
                color={Math.abs(summaryData.totalAssets - (summaryData.totalLiabilities + summaryData.totalEquity)) < 0.01 ? 'success' : 'error'}
                variant="outlined"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Financial Health
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Liquidity</Typography>
                  <Chip 
                    label={additionalMetrics.currentRatio >= 1 ? 'Good' : 'Poor'} 
                    color={additionalMetrics.currentRatio >= 1 ? 'success' : 'error'} 
                    size="small" 
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Solvency</Typography>
                  <Chip 
                    label={additionalMetrics.debtToEquity <= 1 ? 'Good' : 'Poor'} 
                    color={additionalMetrics.debtToEquity <= 1 ? 'success' : 'error'} 
                    size="small" 
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Profitability</Typography>
                  <Chip 
                    label={summaryData.netIncome >= 0 ? 'Profitable' : 'Loss'} 
                    color={summaryData.netIncome >= 0 ? 'success' : 'error'} 
                    size="small" 
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Working Capital</Typography>
                  <Chip 
                    label={additionalMetrics.workingCapital >= 0 ? 'Positive' : 'Negative'} 
                    color={additionalMetrics.workingCapital >= 0 ? 'success' : 'error'} 
                    size="small" 
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Account Details by Type */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <AccountTypeTable 
            type="asset" 
            accounts={accounts} 
            color="success"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <AccountTypeTable 
            type="liability" 
            accounts={accounts} 
            color="error"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <AccountTypeTable 
            type="equity" 
            accounts={accounts} 
            color="info"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <AccountTypeTable 
            type="revenue" 
            accounts={accounts} 
            color="success"
          />
        </Grid>
        <Grid item xs={12}>
          <AccountTypeTable 
            type="expense" 
            accounts={accounts} 
            color="error"
          />
        </Grid>
      </Grid>
    </Box>
  )
}

export default LedgerSummaryTab



