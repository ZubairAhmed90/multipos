'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  const [selectedScope, setSelectedScope] = useState('all')
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const { user } = useSelector((state) => state.auth)
  const [urlParams, setUrlParams] = useState({})
  const [isAdminScopeMode, setIsAdminScopeMode] = useState(false)

  const { 
    inventories, 
    sales, 
    inventoriesLoading, 
    salesLoading, 
    inventoriesError, 
    salesError 
  } = useSelector((state) => state.admin)

  // Parse scope from URL when admin impersonates a branch/warehouse
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const role = params.get('role')
    const scope = params.get('scope')
    const id = params.get('id')

    if (role && scope && id && user?.role === 'ADMIN') {
      setUrlParams({ role, scope, id })
      setIsAdminScopeMode(true)
    } else {
      setUrlParams({})
      setIsAdminScopeMode(false)
    }
  }, [user?.role])

  const scopeInfo = useMemo(() => {
    if (!isAdminScopeMode || !urlParams.scope || !urlParams.id) {
      return null
    }

    const scopeType = urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE'
    return {
      scopeType,
      scopeId: parseInt(urlParams.id, 10),
      scopeName: scopeType === 'BRANCH' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`,
    }
  }, [isAdminScopeMode, urlParams])

  useEffect(() => {
    if (scopeInfo?.scopeId && scopeInfo.scopeType) {
      const scopeTypeLower = scopeInfo.scopeType.toLowerCase()
      setSelectedScope(scopeTypeLower)
      setSelectedLocation(`${scopeTypeLower}:${scopeInfo.scopeId}`)
    } else if (!isAdminScopeMode) {
      setSelectedScope('all')
      setSelectedLocation('all')
    }
  }, [scopeInfo, isAdminScopeMode])

  // Load data whenever the scoped context changes
  useEffect(() => {
    const inventoryParams = {}
    const salesParams = {}

    if (scopeInfo?.scopeType === 'BRANCH' && scopeInfo.scopeId) {
      inventoryParams.scopeType = 'BRANCH'
      inventoryParams.scopeId = scopeInfo.scopeId
      salesParams.scopeType = 'BRANCH'
      salesParams.scopeId = scopeInfo.scopeId
    } else if (scopeInfo?.scopeType === 'WAREHOUSE' && scopeInfo.scopeId) {
      inventoryParams.scopeType = 'WAREHOUSE'
      inventoryParams.scopeId = scopeInfo.scopeId
      salesParams.scopeType = 'WAREHOUSE'
      salesParams.scopeId = scopeInfo.scopeId
    }

    dispatch(fetchAllInventories(inventoryParams))
    dispatch(fetchAllSales(salesParams))
  }, [dispatch, scopeInfo])

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }


  // Filter inventories based on selected filters
  const specificLocation = useMemo(() => {
    if (['all', 'branch', 'warehouse'].includes(selectedLocation)) {
      return null
    }
    const [selectedType, selectedId] = selectedLocation.split(':')
    if (!selectedType || !selectedId) {
      return null
    }
    return {
      scopeType: selectedType.toUpperCase(),
      scopeId: selectedId
    }
  }, [selectedLocation])

  const filteredInventories = inventories?.filter(item => {
    const scopeType = item.scope_type
    const matchesScopeSelection = selectedScope === 'all' ||
      (selectedScope === 'branch' && scopeType === 'BRANCH') ||
      (selectedScope === 'warehouse' && scopeType === 'WAREHOUSE')

    if (!matchesScopeSelection) {
      return false
    }

    const matchesLocation = selectedLocation === 'all' || 
      (selectedLocation === 'branch' && scopeType === 'BRANCH') ||
      (selectedLocation === 'warehouse' && scopeType === 'WAREHOUSE') ||
      (!!specificLocation &&
        scopeType === specificLocation.scopeType &&
        String(item.scope_id) === specificLocation.scopeId)
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch = searchTerm === '' || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesLocation && matchesCategory && matchesSearch
  }) || []

  // Filter sales based on selected filters
  const filteredSales = sales?.filter(sale => {
    const scopeType = sale.scope_type
    const matchesScopeSelection = selectedScope === 'all' ||
      (selectedScope === 'branch' && scopeType === 'BRANCH') ||
      (selectedScope === 'warehouse' && scopeType === 'WAREHOUSE')

    if (!matchesScopeSelection) {
      return false
    }

    const matchesLocation = selectedLocation === 'all' || 
      (selectedLocation === 'branch' && scopeType === 'BRANCH') ||
      (selectedLocation === 'warehouse' && scopeType === 'WAREHOUSE') ||
      (!!specificLocation &&
        scopeType === specificLocation.scopeType &&
        String(sale.scope_id) === specificLocation.scopeId)
    
    const matchesSearch = searchTerm === '' || 
      sale.id.toString().includes(searchTerm) ||
      sale.payment_method?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesLocation && matchesSearch
  }) || []

  // Get unique locations for filter dropdown
  const branchLocationOptions = useMemo(() => {
    const map = new Map()

    const addBranch = (id, name) => {
      if (id === undefined || id === null) {
        return
      }
      const key = String(id)
      if (!map.has(key)) {
        map.set(key, {
          value: `branch:${key}`,
          scopeType: 'BRANCH',
          scopeId: key,
          label: name || `Branch ${key}`
        })
      }
    }

    ;(inventories || []).forEach(item => {
      if (item.scope_type === 'BRANCH') {
        addBranch(item.scope_id, item.branch_name || item.location || `Branch ${item.scope_id}`)
      }
    })

    ;(sales || []).forEach(sale => {
      if (sale.scope_type === 'BRANCH') {
        addBranch(sale.scope_id, sale.branch_name || sale.location_name || `Branch ${sale.scope_id}`)
      }
    })

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [inventories, sales])

  const warehouseLocationOptions = useMemo(() => {
    const map = new Map()

    const addWarehouse = (id, name) => {
      if (id === undefined || id === null) {
        return
      }
      const key = String(id)
      if (!map.has(key)) {
        map.set(key, {
          value: `warehouse:${key}`,
          scopeType: 'WAREHOUSE',
          scopeId: key,
          label: name || `Warehouse ${key}`
        })
      }
    }

    ;(inventories || []).forEach(item => {
      if (item.scope_type === 'WAREHOUSE') {
        addWarehouse(item.scope_id, item.warehouse_name || item.location || `Warehouse ${item.scope_id}`)
      }
    })

    ;(sales || []).forEach(sale => {
      if (sale.scope_type === 'WAREHOUSE') {
        addWarehouse(sale.scope_id, sale.warehouse_name || sale.location_name || `Warehouse ${sale.scope_id}`)
      }
    })

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [inventories, sales])

  const totalLocationsCount = branchLocationOptions.length + warehouseLocationOptions.length

  // Calculate summary statistics
  const totalInventoryValue = filteredInventories.reduce((sum, item) => 
    sum + (Number(item.current_stock || 0) * Number(item.selling_price || 0)), 0)
  
  const totalSalesValue = filteredSales.reduce((sum, sale) => 
    sum + Number(sale.total || 0), 0)

  const categories = [...new Set(inventories?.map(item => item.category) || [])]

  const handleScopeChange = (event) => {
    const newScope = event.target.value
    setSelectedScope(newScope)

    if (newScope === 'branch') {
      setSelectedLocation('branch')
    } else if (newScope === 'warehouse') {
      setSelectedLocation('warehouse')
    } else {
      setSelectedLocation('all')
    }
  }

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
                {totalLocationsCount}
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
                    <TableCell align="right">{Number(item.selling_price || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {(Number(item.current_stock || 0) * Number(item.selling_price || 0)).toFixed(2)}
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
                {totalSalesValue.toLocaleString()}
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
                {totalLocationsCount}
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
                {filteredSales.length > 0 ? (totalSalesValue / filteredSales.length).toFixed(0) : '0'}
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
                    <TableCell align="right">{Number(sale.total || 0).toFixed(2)}</TableCell>
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
                dispatch(fetchAllInventories({}))
                dispatch(fetchAllSales({}))
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
                    <InputLabel>Scope</InputLabel>
                    <Select
                      value={selectedScope}
                      onChange={handleScopeChange}
                      label="Scope"
                    >
                      <MenuItem value="all">All Scopes</MenuItem>
                      <MenuItem value="branch">Branches</MenuItem>
                      <MenuItem value="warehouse">Warehouses</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Location</InputLabel>
                    <Select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      label="Location"
                    >
                      {selectedScope === 'all' && (
                        <>
                          <MenuItem value="all">All Locations</MenuItem>
                          {branchLocationOptions.length > 0 && (
                            <MenuItem value="branch">All Branches</MenuItem>
                          )}
                          {warehouseLocationOptions.length > 0 && (
                            <MenuItem value="warehouse">All Warehouses</MenuItem>
                          )}
                          {(branchLocationOptions.length > 0 || warehouseLocationOptions.length > 0) && (
                            <Divider sx={{ my: 0.5 }} />
                          )}
                          {branchLocationOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {`${option.label} (Branch)`}
                            </MenuItem>
                          ))}
                          {warehouseLocationOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {`${option.label} (Warehouse)`}
                            </MenuItem>
                          ))}
                        </>
                      )}

                      {selectedScope === 'branch' && (
                        <>
                          <MenuItem value="branch">All Branches</MenuItem>
                          {branchLocationOptions.length > 0 && <Divider sx={{ my: 0.5 }} />}
                          {branchLocationOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </>
                      )}

                      {selectedScope === 'warehouse' && (
                        <>
                          <MenuItem value="warehouse">All Warehouses</MenuItem>
                          {warehouseLocationOptions.length > 0 && <Divider sx={{ my: 0.5 }} />}
                          {warehouseLocationOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </>
                      )}
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
                      setSelectedScope('all')
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
