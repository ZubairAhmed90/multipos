'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Search,
  FilterList,
  Refresh,
  Inventory,
  Store,
  TrendingUp
} from '@mui/icons-material'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import { fetchAllInventories, fetchAllSales } from '../../../store/slices/adminSlice'

function AdminInventorySalesPage() {
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState(0)
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const { 
    inventories, 
    sales, 
    inventoriesLoading, 
    salesLoading, 
    inventoriesError, 
    salesError 
  } = useSelector((state) => state.admin)

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchAllInventories())
    dispatch(fetchAllSales())
  }, [dispatch])

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }


  // Filter inventories based on selected filters
  const filteredInventories = inventories?.filter(item => {
    const matchesLocation = selectedLocation === 'all' || 
      (selectedLocation === 'branch' && item.scope_type === 'BRANCH') ||
      (selectedLocation === 'warehouse' && item.scope_type === 'WAREHOUSE') ||
      (selectedLocation !== 'all' && selectedLocation !== 'branch' && selectedLocation !== 'warehouse' && 
       item.scope_id === parseInt(selectedLocation))
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch = searchTerm === '' || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesLocation && matchesCategory && matchesSearch
  }) || []

  // Filter sales based on selected filters
  const filteredSales = sales?.filter(sale => {
    const matchesLocation = selectedLocation === 'all' || 
      (selectedLocation === 'branch' && sale.scope_type === 'BRANCH') ||
      (selectedLocation === 'warehouse' && sale.scope_type === 'WAREHOUSE') ||
      (selectedLocation !== 'all' && selectedLocation !== 'branch' && selectedLocation !== 'warehouse' && 
       sale.scope_id === parseInt(selectedLocation))
    
    const matchesSearch = searchTerm === '' || 
      sale.id.toString().includes(searchTerm) ||
      sale.payment_method?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesLocation && matchesSearch
  }) || []

  // Get unique locations for filter dropdown
  const groupedInventories = filteredInventories.reduce((acc, item) => {
    const locationKey = `${item.scope_type}_${item.scope_id}`
    const locationName = item.scope_type === 'BRANCH' ? item.branch_name : item.warehouse_name
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        locationName,
        scopeType: item.scope_type,
        scopeId: item.scope_id
      }
    }
    return acc
  }, {})

  const groupedSales = filteredSales.reduce((acc, sale) => {
    const locationKey = `${sale.scope_type}_${sale.scope_id}`
    const locationName = sale.scope_type === 'BRANCH' ? `Branch ${sale.scope_id}` : `Warehouse ${sale.scope_id}`
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        locationName,
        scopeType: sale.scope_type,
        scopeId: sale.scope_id
      }
    }
    return acc
  }, {})

  // Calculate summary statistics
  const totalInventoryValue = filteredInventories.reduce((sum, item) => 
    sum + (Number(item.current_stock || 0) * Number(item.selling_price || 0)), 0)
  
  const totalSalesValue = filteredSales.reduce((sum, sale) => 
    sum + Number(sale.total || 0), 0)

  const categories = [...new Set(inventories?.map(item => item.category) || [])]

  const renderInventoryTab = () => (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Items
              </Typography>
              <Typography variant="h4">
                {filteredInventories.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Stock Value
              </Typography>
              <Typography variant="h4">
                {totalInventoryValue.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Locations
              </Typography>
              <Typography variant="h4">
                {Object.keys(groupedInventories).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Categories
              </Typography>
              <Typography variant="h4">
                {categories.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Simple Inventory Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Inventory Items ({filteredInventories.length})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell align="right">Sold</TableCell>
                  <TableCell align="right">Returned</TableCell>
                  <TableCell align="right">Purchased</TableCell>
                  <TableCell align="right">Selling Price</TableCell>
                  <TableCell align="right">Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInventories.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>
                      <Chip label={item.category} size="small" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.scope_type === 'BRANCH' ? (
                          <Store sx={{ fontSize: 16, color: 'primary.main' }} />
                        ) : (
                          <Inventory sx={{ fontSize: 16, color: 'secondary.main' }} />
                        )}
                        <Typography variant="body2">
                          {item.scope_type === 'BRANCH' ? item.branch_name : item.warehouse_name}
                        </Typography>
                        <Chip 
                          label={item.scope_type} 
                          size="small" 
                          color={item.scope_type === 'BRANCH' ? 'primary' : 'secondary'}
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={item.current_stock || 0} 
                        size="small" 
                        color={
                          item.current_stock === 0 ? 'error' : 
                          item.current_stock <= item.min_stock_level ? 'warning' : 'success'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={item.total_sold || 0} 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={item.total_returned || 0} 
                        size="small" 
                        color="warning"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={item.total_purchased || 0} 
                        size="small" 
                        color="success"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">${Number(item.selling_price || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      ${(Number(item.current_stock || 0) * Number(item.selling_price || 0)).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )

  const renderSalesTab = () => (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Sales
              </Typography>
              <Typography variant="h4">
                {filteredSales.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Value
              </Typography>
              <Typography variant="h4">
                ${totalSalesValue.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Locations
              </Typography>
              <Typography variant="h4">
                {Object.keys(groupedSales).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Sale Value
              </Typography>
              <Typography variant="h4">
                ${filteredSales.length > 0 ? (totalSalesValue / filteredSales.length).toFixed(0) : '0'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Simple Sales Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sales ({filteredSales.length})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Sale ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Payment Method</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.id}</TableCell>
                    <TableCell>
                      {new Date(sale.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {sale.scope_type === 'BRANCH' ? (
                          <Store sx={{ fontSize: 16, color: 'primary.main' }} />
                        ) : (
                          <Inventory sx={{ fontSize: 16, color: 'secondary.main' }} />
                        )}
                        <Typography variant="body2">
                          {sale.scope_type === 'BRANCH' ? `Branch ${sale.scope_id}` : `Warehouse ${sale.scope_id}`}
                        </Typography>
                        <Chip 
                          label={sale.scope_type} 
                          size="small" 
                          color={sale.scope_type === 'BRANCH' ? 'primary' : 'secondary'}
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{sale.payment_method}</TableCell>
                    <TableCell>
                      <Chip 
                        label={sale.status} 
                        size="small" 
                        color={sale.status === 'COMPLETED' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">${Number(sale.total || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )

  if (inventoriesLoading || salesLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Inventory & Sales Overview</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={() => {
                dispatch(fetchAllInventories())
                dispatch(fetchAllSales())
              }}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Error Handling */}
        {(inventoriesError || salesError) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {inventoriesError || salesError}
          </Alert>
        )}

        {/* Tabs with Integrated Filters */}
        <Paper sx={{ width: '100%' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="inventory-sales-tabs">
            <Tab 
              icon={<Inventory />} 
              label={`Inventory (${filteredInventories.length})`} 
              iconPosition="start"
            />
            <Tab 
              icon={<TrendingUp />} 
              label={`Sales (${filteredSales.length})`} 
              iconPosition="start"
            />
          </Tabs>
          
          <Box sx={{ p: 3 }}>
            {/* Filters Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Filters & Search
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Location</InputLabel>
                    <Select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      label="Location"
                    >
                      <MenuItem value="all">All Locations</MenuItem>
                      <MenuItem value="branch">All Branches</MenuItem>
                      <MenuItem value="warehouse">All Warehouses</MenuItem>
                      <Divider />
                      {Object.entries(groupedInventories).map(([key, data]) => (
                        <MenuItem key={key} value={data.scopeId.toString()}>
                          {data.locationName} ({data.scopeType})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="all">All Categories</MenuItem>
                      {categories.map((category) => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<FilterList />}
                    onClick={() => {
                      setSelectedLocation('all')
                      setSelectedCategory('all')
                      setSearchTerm('')
                    }}
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {/* Content */}
            {activeTab === 0 && renderInventoryTab()}
            {activeTab === 1 && renderSalesTab()}
          </Box>
        </Paper>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default AdminInventorySalesPage
