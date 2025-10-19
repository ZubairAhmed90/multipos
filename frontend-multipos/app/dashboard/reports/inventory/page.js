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
  LinearProgress,
} from '@mui/material'
import {
  Refresh,
  Assessment,
  FilterList,
  Download,
  Inventory,
  Warning,
  TrendingUp,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { fetchInventoryReports } from '../../../store/slices/reportsSlice'

const InventoryReportsPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { inventoryReports, isLoading, error } = useSelector((state) => state.reports)
  
  const [filters, setFilters] = useState({
    warehouse: 'all',
    category: 'all',
    status: 'all',
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    dateTo: new Date(),
  })

  useEffect(() => {
    dispatch(fetchInventoryReports(filters))
  }, [dispatch, filters])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleRefresh = () => {
    dispatch(fetchInventoryReports(filters))
  }

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx')
      
      // Prepare data for Excel
      const excelData = [
        // Summary data
        { 'Report Type': 'Inventory Summary', 'Value': '' },
        { 'Report Type': 'Total Items', 'Value': inventoryReports?.summary?.totalItems || 0 },
        { 'Report Type': 'Low Stock Items', 'Value': inventoryReports?.summary?.lowStockItems || 0 },
        { 'Report Type': 'Out of Stock Items', 'Value': inventoryReports?.summary?.outOfStockItems || 0 },
        { 'Report Type': 'Total Value', 'Value': inventoryReports?.summary?.totalValue || 0 },
        { 'Report Type': '', 'Value': '' },
        
        // Category data
        { 'Report Type': 'Items by Category', 'Value': '' },
        ...categoryData.map(item => ({
          'Report Type': item.name || 'N/A',
          'Value': item.value || 0
        })),
        { 'Report Type': '', 'Value': '' },
        
        // Low stock items
        { 'Report Type': 'Low Stock Items', 'Value': '' },
        ...lowStockItems.map(item => ({
          'Report Type': item.name || 'N/A',
          'Value': item.current_stock || 0
        })),
        { 'Report Type': '', 'Value': '' },
        
        // Top selling items
        { 'Report Type': 'Top Selling Items', 'Value': '' },
        ...topSellingItems.map(item => ({
          'Report Type': item.name || 'N/A',
          'Value': item.quantity_sold || 0
        }))
      ]
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Report')
      
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
      link.download = `inventory-report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export inventory report. Please try again.')
    }
  }

  // Use real data from API - ensure arrays are properly handled
  const inventoryMovementData = Array.isArray(inventoryReports?.movementData) ? inventoryReports.movementData : []
  const categoryData = inventoryReports?.summary?.categoryCounts && typeof inventoryReports.summary.categoryCounts === 'object' ? 
    Object.entries(inventoryReports.summary.categoryCounts).map(([name, value], index) => ({
      name,
      value,
      color: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'][index % 6]
    })) : []
  const lowStockItems = Array.isArray(inventoryReports?.lowStockItems) ? inventoryReports.lowStockItems : []
  const topSellingItems = Array.isArray(inventoryReports?.topSellingItems) ? inventoryReports.topSellingItems : []

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Inventory Reports
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Stock levels, movement, and performance analytics
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
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Warehouse</InputLabel>
                  <Select
                    value={filters.warehouse}
                    onChange={(e) => handleFilterChange('warehouse', e.target.value)}
                    label="Warehouse"
                  >
                    <MenuItem value="all">All Warehouses</MenuItem>
                    <MenuItem value="main">Main Warehouse</MenuItem>
                    <MenuItem value="branch1">Branch 1</MenuItem>
                    <MenuItem value="branch2">Branch 2</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                     <MenuItem value="Food">Food</MenuItem>
                     <MenuItem value="Accessories">Accessories</MenuItem>
                     <MenuItem value="Medicine">Medicine</MenuItem>
                     <MenuItem value="Litters">Litters</MenuItem>
                     <MenuItem value="Toys">Toys</MenuItem>
                     <MenuItem value="Grooming">Grooming</MenuItem>
                     <MenuItem value="Bedding">Bedding</MenuItem>
                     <MenuItem value="Collars & Leashes">Collars & Leashes</MenuItem>
                     <MenuItem value="Bowls & Feeders">Bowls & Feeders</MenuItem>
                     <MenuItem value="Health & Wellness">Health & Wellness</MenuItem>
                     <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All Items</MenuItem>
                    <MenuItem value="in-stock">In Stock</MenuItem>
                    <MenuItem value="low-stock">Low Stock</MenuItem>
                    <MenuItem value="out-of-stock">Out of Stock</MenuItem>
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
            </Grid>
          </Paper>

          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Total Items
                      </Typography>
                      <Typography variant="h4">
                        {inventoryReports?.summary?.totalItems?.toLocaleString() || '0'}
                      </Typography>
                    </Box>
                    <Inventory sx={{ fontSize: 40, color: 'primary.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Total Value
                      </Typography>
                      <Typography variant="h4">
                        ${inventoryReports?.summary?.totalValue?.toLocaleString() || '0'}
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Low Stock Items
                      </Typography>
                      <Typography variant="h4" color="warning.main">
                        {inventoryReports?.summary?.stockStatusCounts?.['Low Stock'] || '0'}
                      </Typography>
                    </Box>
                    <Warning sx={{ fontSize: 40, color: 'warning.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Turnover Rate
                      </Typography>
                      <Typography variant="h4">
                        {inventoryReports?.summary?.turnoverRate || '0'}x
                      </Typography>
                    </Box>
                    <Assessment sx={{ fontSize: 40, color: 'info.main' }} />
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
                  Inventory Movement
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={inventoryMovementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="received" stroke="#8884d8" strokeWidth={2} />
                    <Line type="monotone" dataKey="sold" stroke="#82ca9d" strokeWidth={2} />
                    <Line type="monotone" dataKey="returned" stroke="#ffc658" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Inventory by Category
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Detailed Tables */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="warning.main">
                  Low Stock Alert
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Current</TableCell>
                        <TableCell>Minimum</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lowStockItems.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.currentStock}</TableCell>
                          <TableCell>{row.minStockLevel}</TableCell>
                          <TableCell>
                            <Chip 
                              label={row.stockStatus === 'Out of Stock' ? "Critical" : "Low"} 
                              color={row.stockStatus === 'Out of Stock' ? "error" : "warning"} 
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
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Top Selling Items
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Sold</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topSellingItems.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell align="right">{row.totalSold || 0}</TableCell>
                          <TableCell align="right">${row.totalRevenue?.toLocaleString() || '0'}</TableCell>
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

export default InventoryReportsPage
