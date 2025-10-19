'use client'

import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RoleGuard from '../../../components/auth/RoleGuard'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
  TextField,
  InputAdornment,
  Skeleton,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import {
  Store,
  Inventory,
  Warning,
  TrendingUp,
  Category,
  Search,
  LocationOn,
  Business,
  Clear,
} from '@mui/icons-material'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { fetchBranches } from '../../store/slices/branchesSlice'

function OtherBranchesInventoryPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: inventory, loading: inventoryLoading, error: inventoryError } = useSelector((state) => state.inventory)
  const { data: branches, loading: branchesLoading } = useSelector((state) => state.branches)
  
  const [selectedBranchId, setSelectedBranchId] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [filteredInventory, setFilteredInventory] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Fetch branches and inventory
    dispatch(fetchBranches())
    dispatch(fetchInventory())
  }, [dispatch])

  // Filter inventory based on selected branch
  useEffect(() => {
    if (selectedBranchId && inventory) {
      const filtered = inventory.filter(item => 
        item.scopeType === 'BRANCH' && item.scopeId === selectedBranchId
      )
      setFilteredInventory(filtered)
    } else {
      setFilteredInventory([])
    }
  }, [selectedBranchId, inventory])

  // Get other branches (excluding current user's branch) and filter by search term
  const otherBranches = branches?.filter(branch => branch.id !== user?.branchId) || []
  const filteredBranches = otherBranches.filter(branch => 
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (branch.address && branch.address.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Calculate summary statistics
  const totalItems = filteredInventory.length
  const lowStockItems = filteredInventory.filter(item => 
    item.quantity <= (item.minStockLevel || 10)
  ).length
  const totalValue = filteredInventory.reduce((sum, item) => 
    sum + (item.quantity * (item.costPrice || 0)), 0
  )
  const categories = [...new Set(filteredInventory.map(item => item.category))].length

  // Define columns for the inventory table
  const columns = [
    { field: 'name', headerName: 'Item Name', width: 200 },
    { field: 'category', headerName: 'Category', width: 150 },
    { field: 'quantity', headerName: 'Quantity', width: 100, type: 'number' },
    { field: 'minStockLevel', headerName: 'Min Stock', width: 100, type: 'number' },
    { field: 'costPrice', headerName: 'Cost Price', width: 120, type: 'number' },
    { field: 'sellingPrice', headerName: 'Selling Price', width: 120, type: 'number' },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => {
        const isLowStock = params.row.quantity <= (params.row.minStockLevel || 10)
        const isOutOfStock = params.row.quantity <= 0
        
        if (isOutOfStock) {
          return <Chip label="Out of Stock" color="error" size="small" />
        } else if (isLowStock) {
          return <Chip label="Low Stock" color="warning" size="small" />
        } else {
          return <Chip label="In Stock" color="success" size="small" />
        }
      }
    },
  ]

  const handleBranchChange = (event, newValue) => {
    if (newValue) {
      setSelectedBranch(newValue)
      setSelectedBranchId(newValue.id)
    } else {
      setSelectedBranch(null)
      setSelectedBranchId(null)
    }
  }

  const handleClearSelection = () => {
    setSelectedBranch(null)
    setSelectedBranchId(null)
    setSearchTerm('')
  }

  const getSelectedBranchName = () => {
    return selectedBranch ? selectedBranch.name : 'Select Branch'
  }

  return (
    <RoleGuard allowedRoles={['CASHIER']}>
      <DashboardLayout>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Other Branches Inventory
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                View inventory from other branches (Read Only)
              </Typography>
            </Box>
            <Chip 
              label="CASHIER" 
              color="primary" 
              variant="outlined" 
            />
          </Box>

          {/* Enhanced Branch Selection */}
          <Card sx={{ mb: 3, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Business sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="primary">
                  Branch Selection
                </Typography>
              </Box>
              
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={8}>
                  {branchesLoading ? (
                    <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
                  ) : (
                    <Autocomplete
                      value={selectedBranch}
                      onChange={handleBranchChange}
                      inputValue={searchTerm}
                      onInputChange={(event, newInputValue) => {
                        setSearchTerm(newInputValue)
                      }}
                      options={filteredBranches}
                      getOptionLabel={(option) => `${option.name} (${option.code})`}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Search and Select Branch"
                          placeholder="Type to search branches..."
                          fullWidth
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search color="action" />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <>
                                {selectedBranch && (
                                  <InputAdornment position="end">
                                    <Clear 
                                      onClick={handleClearSelection}
                                      sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                                    />
                                  </InputAdornment>
                                )}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '1rem',
                              padding: '12px 14px',
                            },
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', py: 1.5, px: 2 }}>
                          <LocationOn sx={{ mr: 2, color: 'text.secondary', fontSize: 24 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body1" fontWeight="medium" sx={{ mb: 0.5 }}>
                              {option.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.code} {option.address && `• ${option.address}`}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      noOptionsText={
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                          <Store sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            {searchTerm ? 'No branches found matching your search' : 'No other branches available'}
                          </Typography>
                        </Box>
                      }
                      sx={{
                        '& .MuiAutocomplete-paper': {
                          boxShadow: 3,
                          borderRadius: 2,
                          minWidth: 400,
                        },
                        '& .MuiAutocomplete-listbox': {
                          minWidth: 400,
                        },
                      }}
                    />
                  )}
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Fade in={!!selectedBranch}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        bgcolor: selectedBranch ? 'primary.50' : 'grey.50',
                        border: selectedBranch ? '1px solid' : '1px dashed',
                        borderColor: selectedBranch ? 'primary.main' : 'grey.300',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Store sx={{ mr: 1, color: selectedBranch ? 'primary.main' : 'text.secondary' }} />
                        <Typography variant="subtitle2" color={selectedBranch ? 'primary.main' : 'text.secondary'}>
                          {selectedBranch ? 'Selected Branch' : 'No Branch Selected'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {selectedBranch 
                          ? `Viewing inventory for: ${getSelectedBranchName()}`
                          : 'Please select a branch to view its inventory'
                        }
                      </Typography>
                      {selectedBranch && (
                        <Box sx={{ mt: 1 }}>
                          <Chip 
                            label={`${filteredInventory.length} items`} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </Card>
                  </Fade>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {selectedBranchId && (
            <Fade in={!!selectedBranchId}>
              <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="h6">
                          Total Items
                        </Typography>
                        <Typography variant="h4">
                          {totalItems.toLocaleString()}
                        </Typography>
                      </Box>
                      <Inventory sx={{ fontSize: 40, color: 'primary.main' }} />
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
                          Low Stock Items
                        </Typography>
                        <Typography variant="h4" color="warning.main">
                          {lowStockItems.toLocaleString()}
                        </Typography>
                      </Box>
                      <Warning sx={{ fontSize: 40, color: 'warning.main' }} />
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
                          Total Value
                        </Typography>
                        <Typography variant="h4" color="success.main">
                          {totalValue.toLocaleString()}
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
                          Categories
                        </Typography>
                        <Typography variant="h4" color="info.main">
                          {categories.toLocaleString()}
                        </Typography>
                      </Box>
                      <Category sx={{ fontSize: 40, color: 'info.main' }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            </Fade>
          )}

          {/* Error Display */}
          {inventoryError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {inventoryError}
            </Alert>
          )}

          {/* Simple Inventory Table */}
          {selectedBranchId ? (
            <Fade in={!!selectedBranchId}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {getSelectedBranchName()} Inventory (View Only) ({filteredInventory.length})
                  </Typography>
                  
                  {inventoryLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress />
                    </Box>
                  ) : inventoryError ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {inventoryError}
                    </Alert>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Item Name</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                            <TableCell align="right">Sold</TableCell>
                            <TableCell align="right">Returned</TableCell>
                            <TableCell align="right">Purchased</TableCell>
                            <TableCell align="right">Min Stock</TableCell>
                            <TableCell align="right">Cost Price</TableCell>
                            <TableCell align="right">Selling Price</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredInventory.map((item) => {
                            const isLowStock = item.quantity <= (item.minStockLevel || 10)
                            const isOutOfStock = item.quantity <= 0
                            
                            let statusColor = 'success'
                            let statusLabel = 'In Stock'
                            
                            if (isOutOfStock) {
                              statusColor = 'error'
                              statusLabel = 'Out of Stock'
                            } else if (isLowStock) {
                              statusColor = 'warning'
                              statusLabel = 'Low Stock'
                            }
                            
                            return (
                              <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>
                                  <Chip label={item.category} size="small" />
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={item.quantity || 0} 
                                    size="small" 
                                    color={
                                      item.quantity === 0 ? 'error' : 
                                      item.quantity <= item.minStockLevel ? 'warning' : 'success'
                                    }
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={item.totalSold || 0} 
                                    size="small" 
                                    color="primary"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={item.totalReturned || 0} 
                                    size="small" 
                                    color="warning"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={item.totalPurchased || 0} 
                                    size="small" 
                                    color="success"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">{item.minStockLevel || 0}</TableCell>
                                <TableCell align="right">${item.costPrice?.toFixed(2) || '0.00'}</TableCell>
                                <TableCell align="right">${item.sellingPrice?.toFixed(2) || '0.00'}</TableCell>
                                <TableCell>
                                  <Chip 
                                    label={statusLabel} 
                                    color={statusColor} 
                                    size="small" 
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Fade>
          ) : (
            <Card sx={{ boxShadow: 1 }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Store sx={{ fontSize: 80, color: 'text.secondary', mb: 3, opacity: 0.6 }} />
                  <Typography variant="h5" color="textSecondary" gutterBottom fontWeight="medium">
                    Select a Branch
                  </Typography>
                  <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
                    Choose a branch from the searchable dropdown above to view its inventory details
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Chip 
                      icon={<Search />} 
                      label="Search by name or code" 
                      variant="outlined" 
                      color="primary"
                    />
                    <Chip 
                      icon={<LocationOn />} 
                      label="View branch details" 
                      variant="outlined" 
                      color="secondary"
                    />
                    <Chip 
                      icon={<Inventory />} 
                      label="Read-only access" 
                      variant="outlined" 
                      color="info"
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </DashboardLayout>
    </RoleGuard>
  )
}

export default OtherBranchesInventoryPage
