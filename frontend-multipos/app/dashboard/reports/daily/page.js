'use client'

import { useEffect, useState, useCallback } from 'react'
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
  Menu,
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
  const { salesReports, isLoading, error } = useSelector((state) => state.reports)
  
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null)
  const [filters, setFilters] = useState({
    date: new Date(),
    shift: 'all',
    reportType: 'summary'
  })
  
  const loadDailyReports = useCallback(() => {
    const selectedDate = filters.date
    const params = {
      branch: filters.branch || undefined,
      cashier: filters.cashier || undefined,
      dateRange: {
        start: selectedDate.toISOString().split('T')[0],
        end: selectedDate.toISOString().split('T')[0]
      }
    }
    
    console.log('🔍 Loading daily reports for date:', selectedDate.toISOString().split('T')[0])
    dispatch(fetchSalesReports(params))
  }, [dispatch, filters])

  useEffect(() => {
    loadDailyReports()
  }, [loadDailyReports])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleRefresh = () => {
    loadDailyReports()
  }

  // Transform sales data for daily reports
  // Group sales by hour from recentSales if available
  let hourlyData = {};
  if (Array.isArray(salesReports?.recentSales) && salesReports.recentSales.length > 0) {
    salesReports.recentSales.forEach(sale => {
      if (sale.created_at) {
        const hour = new Date(sale.created_at).getHours();
        const hourKey = `${hour}:00`;
        if (!hourlyData[hourKey]) {
          hourlyData[hourKey] = { hour: hourKey, sales: 0, transactions: 0 };
        }
        hourlyData[hourKey].sales += sale.total_amount || sale.sales || 0;
        hourlyData[hourKey].transactions += 1;
      }
    });
  }
  
  // Convert to array and sort by hour
  const dailyData = Object.values(hourlyData).length > 0 
    ? Object.values(hourlyData).sort((a, b) => a.hour.localeCompare(b.hour))
    : [
        // Default data when no sales data
        { hour: '09:00', sales: 0, transactions: 0 },
        { hour: '12:00', sales: 0, transactions: 0 },
        { hour: '15:00', sales: 0, transactions: 0 },
        { hour: '18:00', sales: 0, transactions: 0 }
      ]

  const transactionDetails = Array.isArray(salesReports?.recentSales) && salesReports.recentSales.length > 0 ? 
    salesReports.recentSales.map(sale => ({
      time: new Date(sale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      customer: sale.customer_name || 'Walk-in Customer',
      items: sale.items_count || 1,
      amount: sale.total_amount || 0,
      method: sale.payment_method || 'Cash'
    })) : [
      // Default empty transaction
      { time: '--:--', customer: 'No transactions', items: 0, amount: 0, method: '--' }
    ]

  // FIXED: Use actual data from salesReports with proper fallbacks
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

  // Debug logging to see what data we have
  console.log('🔍 Daily Reports Data:', {
    salesReports,
    dailyData,
    transactionDetails,
    shiftSummary,
    isLoading,
    error
  })

  const handleExport = async () => {
    try {
      // Prepare data for CSV/Excel
      const exportData = [
        // Summary data
        { Category: 'Daily Report Summary', Value: '' },
        { Category: 'Total Sales', Value: shiftSummary.totalSales || 0 },
        { Category: 'Total Transactions', Value: shiftSummary.totalTransactions || 0 },
        { Category: 'Average Ticket', Value: shiftSummary.averageTicket || 0 },
        { Category: '', Value: '' },
        { Category: 'Cash Sales', Value: shiftSummary.cashSales || 0 },
        { Category: 'Card Sales', Value: shiftSummary.cardSales || 0 },
        { Category: 'Refunds', Value: -shiftSummary.refunds || 0 },
        { Category: 'Discounts', Value: -shiftSummary.discounts || 0 },
        { Category: 'Tax Collected', Value: shiftSummary.taxCollected || 0 },
        { Category: '', Value: '' },
        // Transaction details
        { Category: 'Recent Transactions', Value: '' },
        ...transactionDetails.map((item, index) => ({
          Category: item.time,
          Value: `${item.customer} - ${item.items} items - Amount: ${item.amount} - ${item.method}`
        }))
      ]
      
      // Convert to CSV
      const headers = ['Category', 'Value']
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => `${row.Category || ''},${row.Value || ''}`)
      ].join('\n')
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `daily-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export daily report. Please try again.')
    }
  }

  const handleExportPDF = () => {
    // Generate PDF content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; }
            .header { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { margin: 20px 0; }
            .summary-row { display: flex; justify-content: space-between; padding: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Daily Sales Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>Report Date: ${filters.date.toISOString().split('T')[0]}</p>
          </div>
          
          <div class="summary">
            <h2>Summary</h2>
            <div class="summary-row">
              <strong>Total Sales:</strong> <span>${shiftSummary.totalSales.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <strong>Total Transactions:</strong> <span>${shiftSummary.totalTransactions}</span>
            </div>
            <div class="summary-row">
              <strong>Average Ticket:</strong> <span>${shiftSummary.averageTicket.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <strong>Cash Sales:</strong> <span>${shiftSummary.cashSales.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <strong>Card Sales:</strong> <span>${shiftSummary.cardSales.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <strong>Refunds:</strong> <span>-${shiftSummary.refunds.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <strong>Discounts:</strong> <span>-${shiftSummary.discounts.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <strong>Tax Collected:</strong> <span>${shiftSummary.taxCollected.toLocaleString()}</span>
            </div>
          </div>

          <h2>Recent Transactions</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Payment Method</th>
              </tr>
            </thead>
            <tbody>
              ${transactionDetails.map(tr => `
                <tr>
                  <td>${tr.time}</td>
                  <td>${tr.customer}</td>
                  <td>${tr.items}</td>
                  <td>${tr.amount.toLocaleString()}</td>
                  <td>${tr.method}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="header" style="margin-top: 40px;">
            <p>MultiPOS Dashboard - Daily Report</p>
          </div>
        </body>
      </html>
    `
    
    // Open in new window for printing
    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
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
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                disabled={isLoading}
              >
                Export
              </Button>
              <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
              >
                <MenuItem onClick={() => { setExportMenuAnchor(null); handleExport(); }}>
                  <Download sx={{ mr: 1 }} />
                  Export to Excel
                </MenuItem>
                <MenuItem onClick={() => { setExportMenuAnchor(null); handleExportPDF(); }}>
                  <Download sx={{ mr: 1 }} />
                  Export to PDF
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleRefresh}
                sx={{ ml: 2 }}
              >
                Retry
              </Button>
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

          {/* Loading State */}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Summary Cards */}
          {!isLoading && (
            <>
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
                            {shiftSummary.totalSales.toLocaleString()}
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
                            {shiftSummary.averageTicket.toFixed(2)}
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
                          {shiftSummary.cashSales.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Card</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {shiftSummary.cardSales.toLocaleString()}
                        </Typography>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Refunds</Typography>
                        <Typography variant="body2" color="error.main" fontWeight="bold">
                          -{shiftSummary.refunds.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Discounts</Typography>
                        <Typography variant="body2" color="warning.main" fontWeight="bold">
                          -{shiftSummary.discounts.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Tax Collected</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {shiftSummary.taxCollected.toLocaleString()}
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
                          <TableCell align="right">{transaction.amount.toLocaleString()}</TableCell>
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
            </>
          )}
        </Box>
      </LocalizationProvider>
    </DashboardLayout>
  )
}

export default DailyReportsPage