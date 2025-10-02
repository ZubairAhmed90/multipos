'use client'

import React, { useState, useEffect } from 'react'
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
  Button
} from '@mui/material'
import {
  AccountBalance as BalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import {
  fetchWarehouseBalanceSummary,
  fetchWarehouseLedgerAccounts
} from '../../../store/slices/warehouseLedgerSlice'

function WarehouseLedgerSummaryTab({ warehouseId }) {
  const dispatch = useDispatch()
  const { 
    balanceSummary, 
    balanceLoading, 
    balanceError,
    accounts,
    accountsLoading
  } = useSelector((state) => state.warehouseLedger)

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
    if (warehouseId) {
      dispatch(fetchWarehouseBalanceSummary({ warehouseId }))
      dispatch(fetchWarehouseLedgerAccounts({ warehouseId }))
    }
  }, [dispatch, warehouseId])

  // Calculate summary data from accounts
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const summary = accounts.reduce((acc, account) => {
        const balance = parseFloat(account.balance) || 0
        
        switch (account.accountType) {
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
    if (warehouseId) {
      dispatch(fetchWarehouseBalanceSummary({ warehouseId }))
      dispatch(fetchWarehouseLedgerAccounts({ warehouseId }))
    }
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
              ${value.toFixed(2)}
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
    const filteredAccounts = accounts.filter(account => account.accountType === type)
    const total = filteredAccounts.reduce((sum, account) => sum + (parseFloat(account.balance) || 0), 0)

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
            {type} Accounts
            <Chip 
              label={`Total: $${total.toFixed(2)}`} 
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
                    <TableCell>{account.accountName}</TableCell>
                    <TableCell align="right">
                      ${(parseFloat(account.balance) || 0).toFixed(2)}
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

  if (balanceLoading || accountsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Warehouse Balance Summary
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          sx={{ textTransform: 'none' }}
        >
          Refresh
        </Button>
      </Box>

      {balanceError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {balanceError}
        </Alert>
      )}

      {/* Summary Cards */}
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

      {/* Accounting Equation */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Accounting Equation
          </Typography>
          <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.2rem' }}>
            Assets = Liabilities + Equity
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            ${summaryData.totalAssets.toFixed(2)} = ${summaryData.totalLiabilities.toFixed(2)} + ${summaryData.totalEquity.toFixed(2)}
          </Typography>
          <Typography 
            variant="body2" 
            color={Math.abs(summaryData.totalAssets - (summaryData.totalLiabilities + summaryData.totalEquity)) < 0.01 ? 'success.main' : 'error.main'}
            sx={{ mt: 1, fontWeight: 'bold' }}
          >
            {Math.abs(summaryData.totalAssets - (summaryData.totalLiabilities + summaryData.totalEquity)) < 0.01 
              ? '✓ Equation is balanced' 
              : '⚠ Equation is not balanced'
            }
          </Typography>
        </CardContent>
      </Card>

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

export default WarehouseLedgerSummaryTab











