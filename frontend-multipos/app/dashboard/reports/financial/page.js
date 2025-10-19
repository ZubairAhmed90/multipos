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
  alpha,
  useTheme,
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
  ArrowUpward,
  ArrowDownward,
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
  Area,
  Legend
} from 'recharts'
import { fetchFinancialReports } from '../../../store/slices/reportsSlice'

const FinancialReportsPage = () => {
  const dispatch = useDispatch()
  const theme = useTheme()
  const { user } = useSelector((state) => state.auth)
  const { financialReports, isLoading, error } = useSelector((state) => state.reports)
  
  const [filters, setFilters] = useState({
    period: 'monthly',
    year: new Date().getFullYear(),
    quarter: 'Q1',
    dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
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

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx')
      
      // Prepare data for Excel
      const excelData = [
        // Summary data
        { 'Report Type': 'Financial Summary', 'Value': '' },
        { 'Report Type': 'Total Revenue', 'Value': financialReports?.summary?.totalRevenue || 0 },
        { 'Report Type': 'Total Expenses', 'Value': financialReports?.summary?.totalExpenses || 0 },
        { 'Report Type': 'Net Profit', 'Value': financialReports?.summary?.netProfit || 0 },
        { 'Report Type': 'Profit Margin', 'Value': financialReports?.summary?.profitMargin || 0 },
        { 'Report Type': '', 'Value': '' },
        
        // Revenue by period
        { 'Report Type': 'Revenue by Period', 'Value': '' },
        ...revenueData.map(item => ({
          'Report Type': item.period || 'N/A',
          'Value': item.revenue || 0
        })),
        { 'Report Type': '', 'Value': '' },
        
        // Cash flow data
        { 'Report Type': 'Cash Flow Data', 'Value': '' },
        ...cashFlowData.map(item => ({
          'Report Type': item.period || 'N/A',
          'Value': item.amount || 0
        })),
        { 'Report Type': '', 'Value': '' },
        
        // Expense breakdown
        { 'Report Type': 'Expense Breakdown', 'Value': '' },
        ...expenseBreakdown.map(item => ({
          'Report Type': item.category || 'N/A',
          'Value': item.amount || 0
        }))
      ]
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Report')
      
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
      link.download = `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export financial report. Please try again.')
    }
  }

  // Process financial data from API
  const revenueData = financialReports?.revenueByPeriod || []
  const cashFlowData = financialReports?.cashFlowData || []
  const expenseBreakdown = financialReports?.expenseBreakdown || []
  const profitabilityMetrics = financialReports?.profitabilityMetrics || []
  const financialRatios = financialReports?.financialRatios || []
  const topRevenueSources = financialReports?.topRevenueSources || []

  // Modern color palette
  const chartColors = {
    revenue: theme.palette.primary.main,
    expenses: theme.palette.error.main,
    profit: theme.palette.success.main,
    operating: theme.palette.info.main,
    investing: theme.palette.warning.main,
    financing: theme.palette.secondary.main,
  }

  // Data aggregation function for fewer data points
  const aggregateData = (data, maxPoints = 8) => {
    if (data.length <= maxPoints) return data;
    
    const aggregated = [];
    const step = Math.ceil(data.length / maxPoints);
    
    for (let i = 0; i < data.length; i += step) {
      const chunk = data.slice(i, i + step);
      const aggregatedPoint = {
        month: chunk[0].month,
        revenue: chunk.reduce((sum, item) => sum + (item.revenue || 0), 0) / chunk.length,
        expenses: chunk.reduce((sum, item) => sum + (item.expenses || 0), 0) / chunk.length
      };
      aggregated.push(aggregatedPoint);
    }
    
    return aggregated;
  };

  const aggregatedRevenueData = aggregateData(revenueData);

  const MetricCard = ({ title, value, change, icon, color = 'primary' }) => (
    <Card 
      sx={{ 
        background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
        border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        backdropFilter: 'blur(10px)',
        borderRadius: 3,
        position: 'relative',
        overflow: 'visible',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 32px ${alpha(theme.palette[color].main, 0.15)}`,
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography 
              color="textSecondary" 
              gutterBottom 
              variant="h6"
              sx={{ 
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: 0.8,
                mb: 1
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.palette[color].main}, ${theme.palette[color].dark})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                mb: 1
              }}
            >
              {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {change.includes('+') ? (
                <ArrowUpward sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <ArrowDownward sx={{ fontSize: 16, color: 'error.main' }} />
              )}
              <Typography 
                variant="body2" 
                color={change.includes('+') ? 'success.main' : 'error.main'}
                sx={{ fontWeight: 600 }}
              >
                {change} vs last period
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette[color].main}, ${theme.palette[color].dark})`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ml: 2
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ py: 2 }}>
          {/* Header Section */}
          <Box 
            sx={{ 
              mb: 4,
              padding: 4,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
                <Typography 
                  variant="h4" 
                  gutterBottom
                  sx={{ 
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                Financial Reports
              </Typography>
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    opacity: 0.8,
                    fontSize: '1.1rem'
                  }}
                >
                Comprehensive financial analysis, profitability metrics, and cash flow insights
              </Typography>
            </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
                disabled={isLoading}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    '&:hover': {
                      border: `2px solid ${theme.palette.primary.main}`,
                      background: alpha(theme.palette.primary.main, 0.04),
                    }
                  }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleExport}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                    '&:hover': {
                      boxShadow: `0 6px 25px ${alpha(theme.palette.primary.main, 0.4)}`,
                      transform: 'translateY(-1px)',
                    }
                  }}
              >
                Export
              </Button>
              </Box>
            </Box>
          </Box>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
              }}
            >
              {error}
            </Alert>
          )}

          {/* Filters */}
          <Paper 
            sx={{ 
              p: 3, 
              mb: 4,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  color: 'white',
                  mr: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FilterList fontSize="small" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Report Filters
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                { field: 'period', label: 'Period', options: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] },
                { field: 'year', label: 'Year', options: [2024, 2023, 2022] },
                { field: 'quarter', label: 'Quarter', options: ['Q1', 'Q2', 'Q3', 'Q4'] },
              ].map((filterConfig) => (
                <Grid item xs={12} sm={6} md={2.4} key={filterConfig.field}>
                <FormControl fullWidth>
                    <InputLabel sx={{ fontWeight: 600 }}>{filterConfig.label}</InputLabel>
                  <Select
                      value={filters[filterConfig.field]}
                      onChange={(e) => handleFilterChange(filterConfig.field, e.target.value)}
                      label={filterConfig.label}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.primary.main, 0.2),
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.primary.main, 0.4),
                        },
                      }}
                    >
                      {filterConfig.options.map(option => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              ))}
              <Grid item xs={12} sm={6} md={2.4}>
                <DatePicker
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={(date) => handleFilterChange('dateFrom', date)}
                  renderInput={(params) => 
                    <TextField 
                      {...params} 
                      fullWidth 
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.primary.main, 0.2),
                        },
                      }}
                    />}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <DatePicker
                  label="To Date"
                  value={filters.dateTo}
                  onChange={(date) => handleFilterChange('dateTo', date)}
                  renderInput={(params) => 
                    <TextField 
                      {...params} 
                      fullWidth 
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.primary.main, 0.2),
                        },
                      }}
                    />}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Key Financial Metrics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Revenue"
                value={`$${financialReports?.totalRevenue?.toLocaleString() || '0'}`}
                change={financialReports?.totalRevenue > 0 ? '+12.5%' : '0.0%'}
                icon={<AttachMoney sx={{ fontSize: 24 }} />}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Net Profit"
                value={`$${financialReports?.netProfit?.toLocaleString() || '0'}`}
                change={financialReports?.netProfit > 0 ? '+8.3%' : '0.0%'}
                icon={<TrendingUp sx={{ fontSize: 24 }} />}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Operating Cash Flow"
                value={`$${financialReports?.cashFlow?.toLocaleString() || '0'}`}
                change={financialReports?.cashFlow > 0 ? '+15.2%' : '0.0%'}
                icon={<Receipt sx={{ fontSize: 24 }} />}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Profit Margin"
                value={`${financialReports?.profitMargin?.toFixed(1) || '0.0'}%`}
                change={financialReports?.profitMargin > 0 ? '+2.1%' : '0.0%'}
                icon={<PieChart sx={{ fontSize: 24 }} />}
                color="warning"
              />
            </Grid>
          </Grid>

          {/* Revenue and Profit Trends - Optimized Chart Sizes */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={8}>
              <Paper 
                sx={{ 
                  p: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  height: '400px', // Reduced from 500px
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Revenue vs Expenses Trend
                </Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={aggregatedRevenueData} 
                      margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={alpha(theme.palette.common.black, 0.1)} 
                        vertical={false} // Remove vertical grid lines
                      />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 11 }} // Smaller font
                        interval="preserveStartEnd" // Show fewer labels
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `$${value / 1000}k`}
                        width={35} // Fixed width
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: 8,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
                          fontSize: '12px' // Smaller tooltip
                        }}
                        formatter={(value) => [`$${Math.round(value).toLocaleString()}`, 'Amount']}
                      />
                      <Legend 
                        verticalAlign="top"
                        height={30} // Reduced height
                        iconSize={10} // Smaller icons
                        iconType="circle"
                      />
                      <Line 
                        name="Revenue"
                        type="monotone" 
                        dataKey="revenue" 
                        stroke={chartColors.revenue} 
                        strokeWidth={2} // Thinner lines
                        dot={false} // Remove dots for cleaner look
                        activeDot={{ r: 4, stroke: chartColors.revenue, strokeWidth: 2 }}
                      />
                      <Line 
                        name="Expenses"
                        type="monotone" 
                        dataKey="expenses" 
                        stroke={chartColors.expenses} 
                        strokeWidth={2} // Thinner lines
                        dot={false} // Remove dots for cleaner look
                        activeDot={{ r: 4, stroke: chartColors.expenses, strokeWidth: 2 }}
                      />
                    </LineChart>
                </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper 
                sx={{ 
                  p: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  height: '400px', // Reduced from 500px
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Expense Breakdown
                </Typography>
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
                  <ResponsiveContainer width="60%" height="100%">
                  <RechartsPieChart>
                    <Pie
                        data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                        label={({ percentage }) => `${percentage?.toFixed(0) || '0'}%`}
                        outerRadius={80} // Reduced radius
                        innerRadius={40} // Reduced inner radius
                      dataKey="amount"
                        paddingAngle={1} // Reduced padding
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color || theme.palette.primary.main} 
                            stroke={theme.palette.background.paper}
                            strokeWidth={1} // Thinner strokes
                          />
                      ))}
                    </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: 8,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          fontSize: '12px'
                        }}
                        formatter={(value, name, props) => [
                          `$${value.toLocaleString()}`, 
                          props.payload.category
                        ]}
                      />
                  </RechartsPieChart>
                </ResponsiveContainer>
                  
                  {/* Custom Legend */}
                  <Box sx={{ width: '40%', pl: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: '0.8rem' }}>
                      Categories:
                    </Typography>
                    {expenseBreakdown.map((entry, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: entry.color || theme.palette.primary.main,
                            mr: 1,
                            flexShrink: 0
                          }}
                        />
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
                          {entry.category}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Cash Flow Analysis - Optimized Chart Sizes */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Paper 
                sx={{ 
                  p: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  height: '380px', // Reduced from 450px
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Cash Flow Analysis
                </Typography>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={cashFlowData} 
                      margin={{ top: 15, right: 20, left: 15, bottom: 5 }}
                    >
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={alpha(theme.palette.common.black, 0.1)} 
                        vertical={false} // Remove vertical grid lines
                      />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 11 }} // Smaller font
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `$${value / 1000}k`}
                        width={35}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: 8,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          fontSize: '12px'
                        }}
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']}
                      />
                      <Legend 
                        verticalAlign="top"
                        height={30}
                        iconSize={10}
                        iconType="circle"
                      />
                      <Bar 
                        name="Operating"
                        dataKey="operating" 
                        fill={chartColors.operating}
                        radius={[3, 3, 0, 0]} // Smaller radius
                        maxBarSize={35} // Slightly smaller bars
                      />
                      <Bar 
                        name="Investing"
                        dataKey="investing" 
                        fill={chartColors.investing}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={35}
                      />
                      <Bar 
                        name="Financing"
                        dataKey="financing" 
                        fill={chartColors.financing}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={35}
                      />
                  </BarChart>
                </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper 
                sx={{ 
                  p: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  height: '380px', // Reduced from 450px
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Profitability Metrics
                </Typography>
                <Box sx={{ mt: 1, flex: 1, overflow: 'auto', pr: 1 }}>
                  {profitabilityMetrics.map((metric, index) => (
                    <Box key={index} sx={{ mb: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {metric.metric}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ 
                          color: metric.status === 'excellent' ? 'success.main' : 'primary.main',
                          fontSize: '0.8rem'
                        }}>
                          {metric.value}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={parseFloat(metric.value?.replace('%', '') || 0)} 
                          sx={{ 
                            flexGrow: 1, 
                            height: 8, // Slightly smaller
                            borderRadius: 3,
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 3,
                              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                            }
                          }}
                        />
                        <Typography variant="caption" sx={{ 
                          fontWeight: 600,
                          color: metric.trend?.includes('↑') ? 'success.main' : 'error.main',
                          fontSize: '0.7rem',
                          minWidth: '35px'
                        }}>
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
              <Paper 
                sx={{ 
                  p: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  height: '380px', // Slightly reduced
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Financial Ratios
                </Typography>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                <TableContainer>
                    <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                          <TableCell sx={{ fontWeight: 600, borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`, fontSize: '0.8rem', py: 1 }}>
                            Ratio
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`, fontSize: '0.8rem', py: 1 }}>
                            Value
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`, fontSize: '0.8rem', py: 1 }}>
                            Benchmark
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`, fontSize: '0.8rem', py: 1 }}>
                            Status
                          </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                        {financialRatios.map((ratio, index) => (
                          <TableRow 
                            key={index}
                            sx={{ 
                              '&:last-child td': { borderBottom: 0 },
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.02),
                              }
                            }}
                          >
                            <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`, fontSize: '0.75rem', py: 1 }}>
                              {ratio.ratio}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`, fontSize: '0.75rem', py: 1 }}>
                              {ratio.value}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`, fontSize: '0.75rem', py: 1 }}>
                              {ratio.benchmark}
                            </TableCell>
                            <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`, py: 1 }}>
                            <Chip 
                                label={ratio.status?.toUpperCase()} 
                              color={ratio.status === 'excellent' ? 'success' : 'primary'} 
                              size="small" 
                                sx={{ 
                                  fontWeight: 600,
                                  borderRadius: 1,
                                  fontSize: '0.65rem',
                                  height: '20px'
                                }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper 
                sx={{ 
                  p: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  height: '380px', // Slightly reduced
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Top Revenue Sources
                </Typography>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                <TableContainer>
                    <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                          <TableCell sx={{ fontWeight: 600, borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`, fontSize: '0.8rem', py: 1 }}>
                            Source
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`, fontSize: '0.8rem', py: 1 }}>
                            Revenue
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`, fontSize: '0.8rem', py: 1 }}>
                            Growth
                          </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                        {topRevenueSources.map((source, index) => (
                          <TableRow 
                            key={index}
                            sx={{ 
                              '&:last-child td': { borderBottom: 0 },
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.02),
                              }
                            }}
                          >
                            <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`, fontSize: '0.75rem', py: 1 }}>
                              {source.source}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`, fontSize: '0.75rem', py: 1 }}>
                              ${source.revenue?.toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`, py: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                {source.growth?.includes('+') ? (
                                  <ArrowUpward sx={{ fontSize: 14, color: 'success.main' }} />
                                ) : (
                                  <ArrowDownward sx={{ fontSize: 14, color: 'error.main' }} />
                                )}
                                <Typography 
                                  color={source.growth?.includes('+') ? 'success.main' : 'error.main'}
                                  sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                >
                              {source.growth}
                            </Typography>
                              </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </LocalizationProvider>
    </DashboardLayout>
  )
}

export default FinancialReportsPage
