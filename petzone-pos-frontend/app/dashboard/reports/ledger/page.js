'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material'
import {
  Refresh,
  Assessment,
  FilterList,
  Download,
  AccountBalance,
  TrendingUp,
  TrendingDown,
  Receipt,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { fetchLedgerReports } from '../../../store/slices/reportsSlice'

const LedgerReportsPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { ledgerReports, isLoading, error } = useSelector((state) => state.reports)
  
  const [filters, setFilters] = useState({
    account: 'all',
    transactionType: 'all',
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    dateTo: new Date(),
  })

  useEffect(() => {
    dispatch(fetchLedgerReports(filters))
  }, [dispatch, filters])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleRefresh = () => {
    dispatch(fetchLedgerReports(filters))
  }

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx')
      
      // Prepare data for Excel
      const excelData = [
        // Summary data
        { 'Report Type': 'Ledger Summary', 'Value': '' },
        { 'Report Type': 'Total Debits', 'Value': ledgerReports?.summary?.totalDebits || 0 },
        { 'Report Type': 'Total Credits', 'Value': ledgerReports?.summary?.totalCredits || 0 },
        { 'Report Type': 'Net Balance', 'Value': ledgerReports?.summary?.netBalance || 0 },
        { 'Report Type': '', 'Value': '' },
        
        // Ledger entries
        { 'Report Type': 'Ledger Entries', 'Value': '' },
        ...mockLedgerData.map(item => ({
          'Report Type': item.date || 'N/A',
          'Value': item.balance || 0
        }))
      ]
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger Report')
      
      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { 
        type: 'array', 
        bookType: 'xlsx' 
      })
      
      // Create download link
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ledger-report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export ledger report. Please try again.')
    }
  }

  const mockLedgerData = [
    { date: '2024-01-01', debit: 5000, credit: 3000, balance: 2000 },
    { date: '2024-01-02', debit: 4500, credit: 3500, balance: 1000 },
    { date: '2024-01-03', debit: 6000, credit: 4000, balance: 3000 },
    { date: '2024-01-04', debit: 5500, credit: 4500, balance: 1000 },
    { date: '2024-01-05', debit: 7000, credit: 5000, balance: 3000 },
  ]

  const mockAccountData = [
    { account: 'Cash Account', balance: 25000, transactions: 150 },
    { account: 'Bank Account', balance: 150000, transactions: 75 },
    { account: 'Credit Card', balance: -5000, transactions: 45 },
    { account: 'Petty Cash', balance: 2000, transactions: 30 },
  ]

  const mockRecentTransactions = [
    { date: '2024-01-05', description: 'Sales Revenue', amount: 5000, type: 'credit', account: 'Cash Account' },
    { date: '2024-01-05', description: 'Inventory Purchase', amount: 2500, type: 'debit', account: 'Bank Account' },
    { date: '2024-01-04', description: 'Office Supplies', amount: 150, type: 'debit', account: 'Petty Cash' },
    { date: '2024-01-04', description: 'Customer Refund', amount: 200, type: 'debit', account: 'Cash Account' },
    { date: '2024-01-03', description: 'Bank Transfer', amount: 10000, type: 'credit', account: 'Bank Account' },
  ]

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Ledger Reports
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Financial transactions and account balances
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleExport}
              >
                Export
              </Button>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
              Filters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Account</InputLabel>
                  <Select
                    value={filters.account}
                    onChange={(e) => handleFilterChange('account', e.target.value)}
                    label="Account"
                  >
                    <MenuItem value="all">All Accounts</MenuItem>
                    <MenuItem value="cash">Cash Account</MenuItem>
                    <MenuItem value="bank">Bank Account</MenuItem>
                    <MenuItem value="credit">Credit Card</MenuItem>
                    <MenuItem value="petty">Petty Cash</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Transaction Type</InputLabel>
                  <Select
                    value={filters.transactionType}
                    onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                    label="Transaction Type"
                  >
                    <MenuItem value="all">All Transactions</MenuItem>
                    <MenuItem value="debit">Debit</MenuItem>
                    <MenuItem value="credit">Credit</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={(date) => handleFilterChange('dateFrom', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="To Date"
                  value={filters.dateTo}
                  onChange={(date) => handleFilterChange('dateTo', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Total Assets
                      </Typography>
                      <Typography variant="h4">
                        {ledgerReports?.totalAssets?.toLocaleString() || '177,000'}
                      </Typography>
                    </Box>
                    <AccountBalance sx={{ fontSize: 40, color: 'success.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Total Liabilities
                      </Typography>
                      <Typography variant="h4">
                        {ledgerReports?.totalLiabilities?.toLocaleString() || '5,000'}
                      </Typography>
                    </Box>
                    <TrendingDown sx={{ fontSize: 40, color: 'error.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Net Worth
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {ledgerReports?.netWorth?.toLocaleString() || '172,000'}
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Transactions
                      </Typography>
                      <Typography variant="h4">
                        {ledgerReports?.totalTransactions?.toLocaleString() || '300'}
                      </Typography>
                    </Box>
                    <Receipt sx={{ fontSize: 40, color: 'primary.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Account Balance Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockLedgerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="balance" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Debit vs Credit
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockLedgerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="debit" fill="#ff7300" />
                    <Bar dataKey="credit" fill="#00c49f" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Account Summary */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Account Summary
            </Typography>
            <Grid container spacing={2}>
              {mockAccountData.map((account, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {account.account}
                      </Typography>
                      <Typography 
                        variant="h4" 
                        color={account.balance < 0 ? 'error.main' : 'success.main'}
                      >
                        {Math.abs(account.balance).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {account.transactions} transactions
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Recent Transactions */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Transactions
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockRecentTransactions.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.account}</TableCell>
                      <TableCell align="right">{row.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip 
                          label={row.type.toUpperCase()} 
                          color={row.type === 'credit' ? 'success' : 'error'} 
                          size="small" 
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </LocalizationProvider>
    </DashboardLayout>
  )
}

export default LedgerReportsPage
