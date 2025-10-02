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
  LinearProgress,
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
  AttachMoney,
  PieChart,
  ShowChart,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { fetchFinancialReports } from '../../../store/slices/reportsSlice'

const FinancialReportsPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { financialReports, isLoading, error } = useSelector((state) => state.reports)
  
  const [filters, setFilters] = useState({
    period: 'monthly',
    year: new Date().getFullYear(),
    quarter: 'Q1',
    dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    dateTo: new Date(),
  })

  useEffect(() => {
    dispatch(fetchFinancialReports(filters))
  }, [dispatch, filters])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleRefresh = () => {
    dispatch(fetchFinancialReports(filters))
  }

  const handleExport = () => {
('Exporting financial report...')
  }

  // Mock financial data
  const mockRevenueData = [
    { month: 'Jan', revenue: 45000, expenses: 32000, profit: 13000 },
    { month: 'Feb', revenue: 52000, expenses: 35000, profit: 17000 },
    { month: 'Mar', revenue: 48000, expenses: 33000, profit: 15000 },
    { month: 'Apr', revenue: 55000, expenses: 38000, profit: 17000 },
    { month: 'May', revenue: 60000, expenses: 40000, profit: 20000 },
    { month: 'Jun', revenue: 58000, expenses: 39000, profit: 19000 },
  ]

  const mockCashFlowData = [
    { month: 'Jan', operating: 15000, investing: -5000, financing: 2000 },
    { month: 'Feb', operating: 18000, investing: -3000, financing: 1000 },
    { month: 'Mar', operating: 16000, investing: -8000, financing: 3000 },
    { month: 'Apr', operating: 20000, investing: -2000, financing: 1500 },
    { month: 'May', operating: 22000, investing: -6000, financing: 2500 },
    { month: 'Jun', operating: 19000, investing: -4000, financing: 2000 },
  ]

  const mockExpenseBreakdown = [
    { category: 'Cost of Goods Sold', amount: 180000, percentage: 45, color: '#0088FE' },
    { category: 'Operating Expenses', amount: 120000, percentage: 30, color: '#00C49F' },
    { category: 'Marketing', amount: 40000, percentage: 10, color: '#FFBB28' },
    { category: 'Administrative', amount: 30000, percentage: 7.5, color: '#FF8042' },
    { category: 'Other', amount: 30000, percentage: 7.5, color: '#8884d8' },
  ]

  const mockProfitabilityMetrics = [
    { metric: 'Gross Profit Margin', value: '65%', trend: '+2.1%', status: 'good' },
    { metric: 'Operating Profit Margin', value: '25%', trend: '+1.5%', status: 'good' },
    { metric: 'Net Profit Margin', value: '18%', trend: '+0.8%', status: 'good' },
    { metric: 'Return on Assets', value: '12%', trend: '+1.2%', status: 'good' },
    { metric: 'Return on Equity', value: '22%', trend: '+2.3%', status: 'excellent' },
  ]

  const mockFinancialRatios = [
    { ratio: 'Current Ratio', value: '2.4', benchmark: '2.0', status: 'good' },
    { ratio: 'Quick Ratio', value: '1.8', benchmark: '1.0', status: 'excellent' },
    { ratio: 'Debt-to-Equity', value: '0.3', benchmark: '0.5', status: 'excellent' },
    { ratio: 'Interest Coverage', value: '8.5', benchmark: '2.5', status: 'excellent' },
  ]

  const mockTopRevenueSources = [
    { source: 'Product Sales', revenue: 250000, growth: '+15%' },
    { source: 'Service Revenue', revenue: 120000, growth: '+8%' },
    { source: 'Subscription', revenue: 80000, growth: '+25%' },
    { source: 'Licensing', revenue: 50000, growth: '+12%' },
  ]

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Financial Reports
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Comprehensive financial analysis, profitability metrics, and cash flow insights
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
              <Grid item xs={12} sm={6} md={2}>
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
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={filters.year}
                    onChange={(e) => handleFilterChange('year', e.target.value)}
                    label="Year"
                  >
                    <MenuItem value={2024}>2024</MenuItem>
                    <MenuItem value={2023}>2023</MenuItem>
                    <MenuItem value={2022}>2022</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Quarter</InputLabel>
                  <Select
                    value={filters.quarter}
                    onChange={(e) => handleFilterChange('quarter', e.target.value)}
                    label="Quarter"
                  >
                    <MenuItem value="Q1">Q1</MenuItem>
                    <MenuItem value="Q2">Q2</MenuItem>
                    <MenuItem value="Q3">Q3</MenuItem>
                    <MenuItem value="Q4">Q4</MenuItem>
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

          {/* Key Financial Metrics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Total Revenue
                      </Typography>
                      <Typography variant="h4">
                        ${financialReports?.totalRevenue?.toLocaleString() || '500,000'}
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        +12.5% vs last period
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
                        Net Profit
                      </Typography>
                      <Typography variant="h4">
                        ${financialReports?.netProfit?.toLocaleString() || '90,000'}
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        +8.2% vs last period
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
                        Operating Cash Flow
                      </Typography>
                      <Typography variant="h4">
                        ${financialReports?.operatingCashFlow?.toLocaleString() || '110,000'}
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        +15.3% vs last period
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
                        Profit Margin
                      </Typography>
                      <Typography variant="h4">
                        {financialReports?.profitMargin || '18'}%
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        +1.2% vs last period
                      </Typography>
                    </Box>
                    <PieChart sx={{ fontSize: 40, color: 'info.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Revenue and Profit Trends */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Revenue vs Expenses Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={mockRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="expenses" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Expense Breakdown
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={mockExpenseBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${category} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {mockExpenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Cash Flow Analysis */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Cash Flow Analysis
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockCashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="operating" fill="#8884d8" />
                    <Bar dataKey="investing" fill="#82ca9d" />
                    <Bar dataKey="financing" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Profitability Metrics
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {mockProfitabilityMetrics.map((metric, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{metric.metric}</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {metric.value}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={parseFloat(metric.value)} 
                          sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                          color={metric.status === 'excellent' ? 'success' : 'primary'}
                        />
                        <Typography variant="caption" color="success.main">
                          {metric.trend}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Financial Ratios and Revenue Sources */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Financial Ratios
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Ratio</TableCell>
                        <TableCell align="right">Value</TableCell>
                        <TableCell align="right">Benchmark</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mockFinancialRatios.map((ratio, index) => (
                        <TableRow key={index}>
                          <TableCell>{ratio.ratio}</TableCell>
                          <TableCell align="right">{ratio.value}</TableCell>
                          <TableCell align="right">{ratio.benchmark}</TableCell>
                          <TableCell>
                            <Chip 
                              label={ratio.status.toUpperCase()} 
                              color={ratio.status === 'excellent' ? 'success' : 'primary'} 
                              size="small" 
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Top Revenue Sources
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Source</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                        <TableCell align="right">Growth</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mockTopRevenueSources.map((source, index) => (
                        <TableRow key={index}>
                          <TableCell>{source.source}</TableCell>
                          <TableCell align="right">${source.revenue.toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Typography color="success.main">
                              {source.growth}
                            </Typography>
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

export default FinancialReportsPage
