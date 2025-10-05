'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RoleGuard from '../../../components/auth/RoleGuard'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material'
import {
  Inventory,
  Warehouse,
  TrendingDown,
  TrendingUp,
  Category,
} from '@mui/icons-material'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { fetchWarehouses } from '../../store/slices/warehousesSlice'

function OtherWarehousesInventoryPage() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: inventory, loading, error } = useSelector((state) => state.inventory)
  const { warehouses } = useSelector((state) => state.warehouses)
  
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [filteredInventory, setFilteredInventory] = useState([])
  
  // Ensure inventory is always an array
  const safeInventory = useMemo(() => Array.isArray(inventory) ? inventory : [], [inventory])
  
  // Load data on component mount
  useEffect(() => {
    dispatch(fetchInventory())
    dispatch(fetchWarehouses())
  }, [dispatch])
  
  // Filter other warehouses (exclude current user's warehouse)
  const otherWarehouses = warehouses?.filter(warehouse => 
    warehouse.id !== user?.warehouseId
  ) || []
  
  // Filter inventory based on selected warehouse
  useEffect(() => {
    if (selectedWarehouse) {
      const filtered = safeInventory.filter(item => 
        item.scopeType === 'WAREHOUSE' && 
        item.scopeId === parseInt(selectedWarehouse)
      )
      setFilteredInventory(filtered)
    } else {
      setFilteredInventory([])
    }
  }, [selectedWarehouse, safeInventory])
  
  // Calculate summary statistics
  const getSummaryStats = () => {
    if (!selectedWarehouse || filteredInventory.length === 0) {
      return {
        totalItems: 0,
        lowStockItems: 0,
        totalValue: 0,
        categories: 0
      }
    }
    
    const totalItems = filteredInventory.length
    const lowStockItems = filteredInventory.filter(item => 
      item.currentStock <= item.minStockLevel
    ).length
    const totalValue = filteredInventory.reduce((sum, item) => 
      sum + (item.currentStock * item.costPrice), 0
    )
    const categories = new Set(filteredInventory.map(item => item.category)).size
    
    return { totalItems, lowStockItems, totalValue, categories }
  }
  
  const summaryStats = getSummaryStats()
  
  const handleWarehouseChange = (event) => {
    setSelectedWarehouse(event.target.value)
  }
  
  const getSelectedWarehouseName = () => {
    const warehouse = otherWarehouses.find(w => w.id === parseInt(selectedWarehouse))
    return warehouse?.name || 'Unknown Warehouse'
  }
  
  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }
  
  if (error) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading inventory data: {error}
        </Alert>
      </DashboardLayout>
    )
  }
  
  return (
    <DashboardLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Other Warehouses Inventory
        </Typography>
        <Typography variant="body1" color="textSecondary">
          View inventory from other warehouses (excluding your assigned warehouse)
        </Typography>
      </Box>
      
      {/* Warehouse Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Select Warehouse</InputLabel>
          <Select
            value={selectedWarehouse}
            onChange={handleWarehouseChange}
            label="Select Warehouse"
          >
            {otherWarehouses.map((warehouse) => (
              <MenuItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>
      
      {selectedWarehouse && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Items
                      </Typography>
                      <Typography variant="h4">
                        {summaryStats.totalItems}
                      </Typography>
                    </Box>
                    <Inventory sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Low Stock Items
                      </Typography>
                      <Typography variant="h4" color="warning.main">
                        {summaryStats.lowStockItems}
                      </Typography>
                    </Box>
                    <TrendingDown sx={{ fontSize: 40, color: theme.palette.warning.main }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Value
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        ${summaryStats.totalValue.toLocaleString()}
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 40, color: theme.palette.success.main }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Categories
                      </Typography>
                      <Typography variant="h4" color="info.main">
                        {summaryStats.categories}
                      </Typography>
                    </Box>
                    <Category sx={{ fontSize: 40, color: theme.palette.info.main }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          {/* Inventory Table */}
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">
                {getSelectedWarehouseName()} - Inventory Items
              </Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Item Name</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Current Stock</TableCell>
                    <TableCell>Min Stock</TableCell>
                    <TableCell>Max Stock</TableCell>
                    <TableCell>Cost Price</TableCell>
                    <TableCell>Selling Price</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>
                        <Chip 
                          label={item.category} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{item.currentStock}</TableCell>
                      <TableCell>{item.minStockLevel}</TableCell>
                      <TableCell>{item.maxStockLevel}</TableCell>
                      <TableCell>${item.costPrice}</TableCell>
                      <TableCell>${item.sellingPrice}</TableCell>
                      <TableCell>
                        <Chip
                          label={item.currentStock <= item.minStockLevel ? 'Low Stock' : 'In Stock'}
                          color={item.currentStock <= item.minStockLevel ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {filteredInventory.length === 0 && (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="textSecondary">
                  No inventory items found for this warehouse.
                </Typography>
              </Box>
            )}
          </Paper>
        </>
      )}
      
      {!selectedWarehouse && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Warehouse sx={{ fontSize: 64, color: theme.palette.grey[400], mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Select a warehouse to view its inventory
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Choose from the dropdown above to see inventory items from other warehouses.
          </Typography>
        </Paper>
      )}
    </DashboardLayout>
  )
}

export default function ProtectedOtherWarehousesInventoryPage() {
  return (
    <RoleGuard allowedRoles={['WAREHOUSE_KEEPER']}>
      <OtherWarehousesInventoryPage />
    </RoleGuard>
  )
}
