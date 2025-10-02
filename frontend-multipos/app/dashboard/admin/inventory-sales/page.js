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
  CardActions,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  ExpandMore,
  Search,
  FilterList,
  Refresh,
  Inventory,
  Store,
  TrendingUp,
  Assessment,
  Visibility,
  Download
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
  const [expandedAccordion, setExpandedAccordion] = useState('')

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

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedAccordion(isExpanded ? panel : false)
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

  // Group inventories by location
  const groupedInventories = filteredInventories.reduce((acc, item) => {
    const locationKey = `${item.scope_type}_${item.scope_id}`
    const locationName = item.scope_type === 'BRANCH' ? item.branch_name : item.warehouse_name
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        locationName,
        scopeType: item.scope_type,
        scopeId: item.scope_id,
        items: []
      }
    }
    acc[locationKey].items.push(item)
    return acc
  }, {})

  // Group sales by location
  const groupedSales = filteredSales.reduce((acc, sale) => {
    const locationKey = `${sale.scope_type}_${sale.scope_id}`
    const locationName = sale.scope_type === 'BRANCH' ? `Branch ${sale.scope_id}` : `Warehouse ${sale.scope_id}`
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        locationName,
        scopeType: sale.scope_type,
        scopeId: sale.scope_id,
        sales: []
      }
    }
    acc[locationKey].sales.push(sale)
    return acc
  }, {})

  // Calculate summary statistics
  const totalInventoryValue = filteredInventories.reduce((sum, item) => 
    sum + (item.current_stock * item.selling_price), 0)
  
  const totalSalesValue = filteredSales.reduce((sum, sale) => 
    sum + parseFloat(sale.total || 0), 0)

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
                ${totalInventoryValue.toLocaleString()}
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

      {/* Inventory by Location */}
      {Object.entries(groupedInventories).map(([locationKey, locationData]) => (
        <Accordion 
          key={locationKey}
          expanded={expandedAccordion === locationKey}
          onChange={handleAccordionChange(locationKey)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {locationData.scopeType === 'BRANCH' ? (
                  <Store sx={{ mr: 1, color: 'primary.main' }} />
                ) : (
                  <Inventory sx={{ mr: 1, color: 'secondary.main' }} />
                )}
                <Typography variant="h6">
                  {locationData.locationName}
                </Typography>
                <Chip 
                  label={locationData.scopeType} 
                  size="small" 
                  sx={{ ml: 2 }}
                  color={locationData.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                {locationData.items.length} items
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Stock</TableCell>
                    <TableCell align="right">Selling Price</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {locationData.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>
                        <Chip label={item.category} size="small" />
                      </TableCell>
                      <TableCell align="right">{item.current_stock}</TableCell>
                      <TableCell align="right">${item.selling_price}</TableCell>
                      <TableCell align="right">
                        ${(item.current_stock * item.selling_price).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}
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
                ${filteredSales.length > 0 ? (totalSalesValue / filteredSales.length).toFixed(0) : 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sales by Location */}
      {Object.entries(groupedSales).map(([locationKey, locationData]) => (
        <Accordion 
          key={locationKey}
          expanded={expandedAccordion === locationKey}
          onChange={handleAccordionChange(locationKey)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {locationData.scopeType === 'BRANCH' ? (
                  <Store sx={{ mr: 1, color: 'primary.main' }} />
                ) : (
                  <Inventory sx={{ mr: 1, color: 'secondary.main' }} />
                )}
                <Typography variant="h6">
                  {locationData.locationName}
                </Typography>
                <Chip 
                  label={locationData.scopeType} 
                  size="small" 
                  sx={{ ml: 2 }}
                  color={locationData.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                {locationData.sales.length} sales
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sale ID</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Payment Method</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {locationData.sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{sale.id}</TableCell>
                      <TableCell>
                        {new Date(sale.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{sale.payment_method}</TableCell>
                      <TableCell>
                        <Chip 
                          label={sale.status} 
                          size="small" 
                          color={sale.status === 'COMPLETED' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">${sale.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}
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

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
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
        </Paper>

        {/* Error Handling */}
        {(inventoriesError || salesError) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {inventoriesError || salesError}
          </Alert>
        )}

        {/* Tabs */}
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
            {activeTab === 0 && renderInventoryTab()}
            {activeTab === 1 && renderSalesTab()}
          </Box>
        </Paper>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default AdminInventorySalesPage
