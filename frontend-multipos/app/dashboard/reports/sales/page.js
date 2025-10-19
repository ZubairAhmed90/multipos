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
} from '@mui/material'
import {
  Refresh,
  Assessment,
  FilterList,
  Download,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { fetchSalesReports } from '../../../store/slices/reportsSlice'

const SalesReportsPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { salesReports, isLoading, error } = useSelector((state) => state.reports)
  
  const [filters, setFilters] = useState({
    branch: 'all',
    cashier: 'all',
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    dateTo: new Date(),
    reportType: 'daily',
    period: 'daily' // daily, weekly, monthly, quarterly, yearly
  })

  useEffect(() => {
    // For warehouse keepers, only show their own warehouse data
    const params = user?.role === 'WAREHOUSE_KEEPER' ? {
      ...filters,
      warehouseId: user.warehouseId
    } : filters
    
    dispatch(fetchSalesReports(params))
  }, [dispatch, filters, user])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    
    // Auto-adjust date range based on period selection
    if (field === 'period') {
      const now = new Date()
      let dateFrom, dateTo = now
      
      switch (value) {
        case 'daily':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days
          break
        case 'weekly':
          dateFrom = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000) // 4 weeks
          break
        case 'monthly':
          dateFrom = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000) // 12 months
          break
        case 'quarterly':
          dateFrom = new Date(now.getTime() - 4 * 90 * 24 * 60 * 60 * 1000) // 4 quarters
          break
        case 'yearly':
          dateFrom = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000) // 5 years
          break
        default:
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days
      }
      
      setFilters(prev => ({ ...prev, dateFrom, dateTo }))
    }
  }

  const handleRefresh = () => {
    // For warehouse keepers, only show their own warehouse data
    const params = user?.role === 'WAREHOUSE_KEEPER' ? {
      ...filters,
      warehouseId: user.warehouseId
    } : filters
    
    dispatch(fetchSalesReports(params))
  }

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx')
      
      // Prepare data for Excel
      const excelData = [
        // Summary data
        { 'Report Type': 'Sales Summary', 'Value': '' },
        { 'Report Type': 'Total Sales', 'Value': salesReports?.summary?.totalSales || 0 },
        { 'Report Type': 'Total Transactions', 'Value': salesReports?.summary?.totalTransactions || 0 },
        { 'Report Type': 'Average Transaction', 'Value': salesReports?.summary?.averageTransaction || 0 },
        { 'Report Type': '', 'Value': '' },
        
        // Sales by date
        { 'Report Type': 'Sales by Date', 'Value': '' },
        ...salesData.map(item => ({
          'Report Type': item.date || 'N/A',
          'Value': item.sales || 0
        })),
        { 'Report Type': '', 'Value': '' },
        
        // Sales by branch
        { 'Report Type': 'Sales by Branch', 'Value': '' },
        ...branchData.map(item => ({
          'Report Type': item.branch || 'N/A',
          'Value': item.sales || 0
        })),
        { 'Report Type': '', 'Value': '' },
        
        // Sales by cashier
        { 'Report Type': 'Sales by Cashier', 'Value': '' },
        ...cashierData.map(item => ({
          'Report Type': item.cashier || 'N/A',
          'Value': item.sales || 0
        }))
      ]
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report')
      
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
      link.download = `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export sales report. Please try again.')
    }
  }

  // Use real data from API - ensure it's always an array
  const salesData = Array.isArray(salesReports?.salesByDate) ? salesReports.salesByDate : []
  const branchData = salesReports?.salesByBranch && typeof salesReports.salesByBranch === 'object' ? 
    Object.entries(salesReports.salesByBranch).map(([branch, data]) => ({
      branch,
      sales: data.sales || 0,
      transactions: data.transactions || 0
    })) : []
  const cashierData = salesReports?.salesByCashier && typeof salesReports.salesByCashier === 'object' ? 
    Object.entries(salesReports.salesByCashier).map(([cashier, data]) => ({
      cashier,
      sales: data.sales || 0,
      transactions: data.transactions || 0
    })) : []
  const recentSales = Array.isArray(salesReports?.recentSales) ? salesReports.recentSales : []
  
  // For warehouse keepers, show only their warehouse data
  const filteredBranchData = user?.role === 'WAREHOUSE_KEEPER' ? 
    branchData.filter(item => item.branch === user.warehouseName) : branchData

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Sales Reports
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Detailed sales analytics and performance metrics
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
              {user?.role === 'ADMIN' && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Branch</InputLabel>
                  <Select
                    value={filters.branch}
                    onChange={(e) => handleFilterChange('branch', e.target.value)}
                    label="Branch"
                  >
                    <MenuItem value="all">All Branches</MenuItem>
                    <MenuItem value="main">Main Branch</MenuItem>
                    <MenuItem value="downtown">Downtown</MenuItem>
                    <MenuItem value="mall">Mall</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              )}
              {user?.role === 'ADMIN' && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Cashier</InputLabel>
                  <Select
                    value={filters.cashier}
                    onChange={(e) => handleFilterChange('cashier', e.target.value)}
                    label="Cashier"
                  >
                    <MenuItem value="all">All Cashiers</MenuItem>
                    <MenuItem value="john">John Doe</MenuItem>
                    <MenuItem value="jane">Jane Smith</MenuItem>
                    <MenuItem value="mike">Mike Johnson</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Period</InputLabel>
                  <Select
                    value={filters.period}
                    onChange={(e) => handleFilterChange('period', e.target.value)}
                    label="Period"
                  >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                    <MenuItem value="quarterly">Quarterly</MenuItem>
                    <MenuItem value="yearly">Yearly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <DatePicker
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={(date) => handleFilterChange('dateFrom', date)}
                   enableAccessibleFieldDOMStructure={false}
                   slots={{
                     textField: TextField
                   }}
                   slotProps={{
                     textField: { fullWidth: true }
                   }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <DatePicker
                  label="To Date"
                  value={filters.dateTo}
                  onChange={(date) => handleFilterChange('dateTo', date)}
                  enableAccessibleFieldDOMStructure={false}
                  slots={{
                    textField: TextField
                  }}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
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
                        Total Sales
                      </Typography>
                      <Typography variant="h4">
                        {salesReports?.totalSales?.toLocaleString() || '0'}
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
                        {salesReports?.totalTransactions?.toLocaleString() || '0'}
                      </Typography>
                    </Box>
                    <Assessment sx={{ fontSize: 40, color: 'primary.main' }} />
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
                        Avg. Ticket
                      </Typography>
                      <Typography variant="h4">
                        {salesReports?.averageTicket?.toFixed(2) || '0.00'}
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 40, color: 'info.main' }} />
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
                        Growth
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        +12.5%
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {filters.period === 'daily' ? 'Daily' : 
                   filters.period === 'weekly' ? 'Weekly' :
                   filters.period === 'monthly' ? 'Monthly' :
                   filters.period === 'quarterly' ? 'Quarterly' :
                   filters.period === 'yearly' ? 'Yearly' : 'Daily'} Sales Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {user?.role === 'ADMIN' ? 'Sales by Branch' : 'My Warehouse Sales'}
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredBranchData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="branch" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sales" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Detailed Tables */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {user?.role === 'ADMIN' ? 'Sales by Cashier' : 'My Warehouse Cashiers'}
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Cashier</TableCell>
                        <TableCell align="right">Sales</TableCell>
                        <TableCell align="right">Transactions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cashierData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.cashier}</TableCell>
                          <TableCell align="right">{row.sales.toLocaleString()}</TableCell>
                          <TableCell align="right">{row.transactions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {user?.role === 'ADMIN' ? 'Recent Transactions' : 'My Recent Transactions'}
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Cashier</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSales.slice(0, 5).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.date || row.created_at}</TableCell>
                          <TableCell>{row.sales || row.total_amount || 0}</TableCell>
                          <TableCell>{row.cashier || row.cashier_name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Chip label="Completed" color="success" size="small" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </LocalizationProvider>
    </DashboardLayout>
  )
}

export default SalesReportsPage
