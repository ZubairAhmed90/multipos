'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchSalesReports } from '../../../store/slices/reportsSlice'
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
  TrendingUp,
  Receipt,
  Schedule,
  AttachMoney,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const DailyReportsPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  
  useEffect(() => {
    // For warehouse keepers, only show their own warehouse data
    const params = user?.role === 'WAREHOUSE_KEEPER' ? {
      warehouseId: user.warehouseId
    } : {}
    
    dispatch(fetchSalesReports(params))
  }, [dispatch, user])
  
  const [filters, setFilters] = useState({
    date: new Date(),
    shift: 'all',
    reportType: 'summary'
  })

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleRefresh = () => {
    // For warehouse keepers, only show their own warehouse data
    const params = user?.role === 'WAREHOUSE_KEEPER' ? {
      warehouseId: user.warehouseId
    } : {}
    
    dispatch(fetchSalesReports(params))
  }

  const handleExport = () => {
('Exporting daily report...')
  }

  // Use real data from sales reports API
  const { salesReports } = useSelector((state) => state.reports)
  
  // Transform sales data for daily reports
  const dailyData = Array.isArray(salesReports?.salesByDate) ? 
    salesReports.salesByDate.map(item => ({
      hour: new Date(item.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      sales: item.sales || 0,
      transactions: item.transactions || 0
    })) : []

  const transactionDetails = Array.isArray(salesReports?.recentSales) ? 
    salesReports.recentSales.map(sale => ({
      time: new Date(sale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      customer: sale.customer_name || 'Walk-in Customer',
      items: sale.items_count || 1,
      amount: sale.total_amount || 0,
      method: sale.payment_method || 'Cash'
    })) : []

  const shiftSummary = {
    shiftStart: '09:00',
    shiftEnd: '18:00',
    totalSales: salesReports?.totalRevenue || 0,
    totalTransactions: salesReports?.totalTransactions || 0,
    averageTicket: salesReports?.averageTicket || 0,
    cashSales: salesReports?.cashSales || 0,
    cardSales: salesReports?.cardSales || 0,
    refunds: salesReports?.refunds || 0,
    discounts: salesReports?.discounts || 0,
    taxCollected: salesReports?.taxCollected || 0
  }

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Daily Reports
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Your daily sales performance and transaction summary
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
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

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
              Filters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Date"
                  value={filters.date}
                  onChange={(date) => handleFilterChange('date', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Shift</InputLabel>
                  <Select
                    value={filters.shift}
                    onChange={(e) => handleFilterChange('shift', e.target.value)}
                    label="Shift"
                  >
                    <MenuItem value="all">All Shifts</MenuItem>
                    <MenuItem value="morning">Morning (9AM-1PM)</MenuItem>
                    <MenuItem value="afternoon">Afternoon (1PM-5PM)</MenuItem>
                    <MenuItem value="evening">Evening (5PM-9PM)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Report Type</InputLabel>
                  <Select
                    value={filters.reportType}
                    onChange={(e) => handleFilterChange('reportType', e.target.value)}
                    label="Report Type"
                  >
                    <MenuItem value="summary">Summary</MenuItem>
                    <MenuItem value="detailed">Detailed</MenuItem>
                    <MenuItem value="hourly">Hourly Breakdown</MenuItem>
                  </Select>
                </FormControl>
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
                        ${shiftSummary.totalSales.toLocaleString()}
                      </Typography>
                    </Box>
                    <AttachMoney sx={{ fontSize: 40, color: 'success.main' }} />
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
                        {shiftSummary.totalTransactions}
                      </Typography>
                    </Box>
                    <Receipt sx={{ fontSize: 40, color: 'primary.main' }} />
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
                        ${shiftSummary.averageTicket}
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
                        Shift Duration
                      </Typography>
                      <Typography variant="h4">
                        {shiftSummary.shiftStart} - {shiftSummary.shiftEnd}
                      </Typography>
                    </Box>
                    <Schedule sx={{ fontSize: 40, color: 'warning.main' }} />
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
                  Hourly Sales Performance
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sales" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Payment Methods
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Cash</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${shiftSummary.cashSales}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Card</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${shiftSummary.cardSales}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Refunds</Typography>
                    <Typography variant="body2" color="error.main" fontWeight="bold">
                      -${shiftSummary.refunds}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Discounts</Typography>
                    <Typography variant="body2" color="warning.main" fontWeight="bold">
                      -${shiftSummary.discounts}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Tax Collected</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${shiftSummary.taxCollected}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Transaction Details */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Transactions
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Payment Method</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactionDetails.map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell>{transaction.time}</TableCell>
                      <TableCell>{transaction.customer}</TableCell>
                      <TableCell align="right">{transaction.items}</TableCell>
                      <TableCell align="right">${transaction.amount}</TableCell>
                      <TableCell>{transaction.method}</TableCell>
                      <TableCell>
                        <Chip label="Completed" color="success" size="small" />
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

export default DailyReportsPage
