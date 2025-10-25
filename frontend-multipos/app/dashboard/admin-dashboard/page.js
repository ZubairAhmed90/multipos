'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Paper,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  useTheme
} from '@mui/material'
import {
  Store as StoreIcon,
  Warehouse as WarehouseIcon,
  PointOfSale as POSIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Security as SecurityIcon
} from '@mui/icons-material'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import { fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses } from '../../store/slices/warehousesSlice'

const AdminDashboardPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()
  const theme = useTheme()
  
  const { data: branches, loading: branchesLoading } = useSelector(state => state.branches)
  const { data: warehouses, loading: warehousesLoading } = useSelector(state => state.warehouses)
  const { user } = useSelector(state => state.auth)

  const [selectedScope, setSelectedScope] = useState('')
  const [selectedScopeType, setSelectedScopeType] = useState('') // 'BRANCH' or 'WAREHOUSE'
  const [selectedScopeData, setSelectedScopeData] = useState(null)

  useEffect(() => {
    dispatch(fetchBranches())
    dispatch(fetchWarehouses())
  }, [dispatch])

  const handleScopeChange = (scopeType, scopeId) => {
    setSelectedScopeType(scopeType)
    setSelectedScope(scopeId)
    
    if (scopeType === 'BRANCH') {
      const branch = branches.find(b => b.id.toString() === scopeId)
      setSelectedScopeData(branch)
    } else if (scopeType === 'WAREHOUSE') {
      const warehouse = warehouses.find(w => w.id.toString() === scopeId)
      setSelectedScopeData(warehouse)
    }
  }

  const handlePOSAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      alert('Please select a branch first')
      return
    }
    
    // Navigate to POS with URL parameters for role simulation
    const role = selectedScopeType === 'BRANCH' ? 'cashier' : 'warehouse-keeper'
    const scope = selectedScopeType === 'BRANCH' ? 'branch' : 'warehouse'
    router.push(`/dashboard/pos/terminal?role=${role}&scope=${scope}&id=${selectedScope}`)
  }

  const handleWarehouseBillingAccess = () => {
    if (!selectedScope || selectedScopeType !== 'WAREHOUSE') {
      alert('Please select a warehouse first')
      return
    }
    
    // Navigate to warehouse billing with URL parameters
    router.push(`/dashboard/warehouse-billing?role=warehouse-keeper&scope=warehouse&id=${selectedScope}`)
  }

  const handleInventoryAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      alert('Please select a branch or warehouse first')
      return
    }
    
    // Navigate to inventory with URL parameters
    const role = selectedScopeType === 'BRANCH' ? 'cashier' : 'warehouse-keeper'
    const scope = selectedScopeType === 'BRANCH' ? 'branch' : 'warehouse'
    router.push(`/dashboard/inventory?role=${role}&scope=${scope}&id=${selectedScope}`)
  }

  const handleReportsAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      alert('Please select a branch or warehouse first')
      return
    }
    
    // Navigate to reports with URL parameters
    const role = selectedScopeType === 'BRANCH' ? 'cashier' : 'warehouse-keeper'
    const scope = selectedScopeType === 'BRANCH' ? 'branch' : 'warehouse'
    router.push(`/dashboard/reports?role=${role}&scope=${scope}&id=${selectedScope}`)
  }

  const getScopeIcon = (scopeType) => {
    return scopeType === 'BRANCH' ? <StoreIcon /> : <WarehouseIcon />
  }

  const getScopeColor = (scopeType) => {
    return scopeType === 'BRANCH' ? 'primary' : 'secondary'
  }

  const getScopeLabel = (scopeType) => {
    return scopeType === 'BRANCH' ? 'Branch' : 'Warehouse'
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN']} />
      <PermissionCheck permission="admin_dashboard" />
      
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AdminIcon color="primary" />
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a branch or warehouse to access location-specific functionality
          </Typography>
        </Box>

        {/* Scope Selection */}
        <Grid container spacing={3}>
          {/* Branch Selection */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StoreIcon color="primary" />
                  Branch Access
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Access POS terminal and branch-specific functionality as a cashier
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Branch</InputLabel>
                  <Select
                    value={selectedScopeType === 'BRANCH' ? selectedScope : ''}
                    onChange={(e) => handleScopeChange('BRANCH', e.target.value)}
                    disabled={branchesLoading}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id.toString()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StoreIcon fontSize="small" />
                          {branch.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedScopeType === 'BRANCH' && selectedScopeData && (
                  <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Selected Branch: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
                    {selectedScopeData.phone && (
                      <Typography variant="body2" color="text.secondary">
                        Phone: {selectedScopeData.phone}
                      </Typography>
                    )}
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Warehouse Selection */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarehouseIcon color="secondary" />
                  Warehouse Access
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Access warehouse billing and warehouse-specific functionality as a warehouse keeper
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Warehouse</InputLabel>
                  <Select
                    value={selectedScopeType === 'WAREHOUSE' ? selectedScope : ''}
                    onChange={(e) => handleScopeChange('WAREHOUSE', e.target.value)}
                    disabled={warehousesLoading}
                  >
                    {warehouses.map((warehouse) => (
                      <MenuItem key={warehouse.id} value={warehouse.id.toString()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WarehouseIcon fontSize="small" />
                          {warehouse.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedScopeType === 'WAREHOUSE' && selectedScopeData && (
                  <Paper sx={{ p: 2, bgcolor: 'secondary.50' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Selected Warehouse: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
                    {selectedScopeData.manager && (
                      <Typography variant="body2" color="text.secondary">
                        Manager: {selectedScopeData.manager}
                      </Typography>
                    )}
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Current Selection Status */}
        {selectedScope && selectedScopeType && (
          <Card sx={{ mt: 3, bgcolor: 'success.50' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ bgcolor: getScopeColor(selectedScopeType) + '.main' }}>
                  {getScopeIcon(selectedScopeType)}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    Working as {getScopeLabel(selectedScopeType)} User
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedScopeData?.name} - {selectedScopeData?.location}
                  </Typography>
                </Box>
                <Chip 
                  label={`Admin Mode: ${getScopeLabel(selectedScopeType)}`} 
                  color={getScopeColor(selectedScopeType)}
                  variant="outlined"
                />
              </Box>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                You are now operating as a {getScopeLabel(selectedScopeType).toLowerCase()} user. 
                All functionality will be scoped to {selectedScopeData?.name}.
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Functionality Access */}
        {selectedScope && selectedScopeType && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Functions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Access location-specific functionality based on your selection
              </Typography>

              <Grid container spacing={2}>
                {/* POS Terminal - Only for Branches */}
                {selectedScopeType === 'BRANCH' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer', 
                        '&:hover': { bgcolor: 'action.hover' },
                        border: 1,
                        borderColor: 'primary.main'
                      }}
                      onClick={handlePOSAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <POSIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          POS Terminal
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Process sales as {selectedScopeData?.name} cashier
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Warehouse Billing - Only for Warehouses */}
                {selectedScopeType === 'WAREHOUSE' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer', 
                        '&:hover': { bgcolor: 'action.hover' },
                        border: 1,
                        borderColor: 'secondary.main'
                      }}
                      onClick={handleWarehouseBillingAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <ReceiptIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          Warehouse Billing
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Process sales as {selectedScopeData?.name} warehouse keeper
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Inventory Management - For Both */}
                <Grid item xs={12} sm={6} md={4}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer', 
                      '&:hover': { bgcolor: 'action.hover' },
                      border: 1,
                      borderColor: 'info.main'
                    }}
                    onClick={handleInventoryAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <InventoryIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6" gutterBottom>
                        Inventory Management
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Manage {getScopeLabel(selectedScopeType).toLowerCase()} inventory
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Reports - For Both */}
                <Grid item xs={12} sm={6} md={4}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer', 
                      '&:hover': { bgcolor: 'action.hover' },
                      border: 1,
                      borderColor: 'warning.main'
                    }}
                    onClick={handleReportsAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <ReportsIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6" gutterBottom>
                        Reports & Analytics
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        View {getScopeLabel(selectedScopeType).toLowerCase()} reports
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              How to Use Admin Dashboard
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <SecurityIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Select Scope"
                  secondary="Choose either a branch or warehouse to work with"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <PersonIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Role Simulation"
                  secondary="You will operate as a cashier (for branches) or warehouse keeper (for warehouses)"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <BusinessIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Scoped Data"
                  secondary="All data and functionality will be filtered to your selected location"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <LocationIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Full Access"
                  secondary="You can access all features available to the simulated role"
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  )
}

export default AdminDashboardPage
