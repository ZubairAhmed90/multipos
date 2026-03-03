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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
} from '@mui/material'
import {
  Store as StoreIcon,
  Warehouse as WarehouseIcon,
  PointOfSale as POSIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Assessment as ReportsIcon,
  AdminPanelSettings as AdminIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Clear as ClearIcon,
  PlayArrow as SimulateIcon,
} from '@mui/icons-material'

import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import { fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses } from '../../store/slices/warehousesSlice'

const AdminDashboardPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()

  const { data: branches, loading: branchesLoading } = useSelector(state => state.branches)
  const { data: warehouses, loading: warehousesLoading } = useSelector(state => state.warehouses)

  const [selectedScope, setSelectedScope] = useState('')
  const [selectedScopeType, setSelectedScopeType] = useState('')
  const [selectedScopeData, setSelectedScopeData] = useState(null)
  const [isSimulationActive, setIsSimulationActive] = useState(false)

  // Load branches/warehouses on page load
  useEffect(() => {
    dispatch(fetchBranches())
    dispatch(fetchWarehouses())

    // Restore simulation state from sessionStorage on page load
    try {
      const existing = sessionStorage.getItem('adminSimulation')
      if (existing) {
        const { scopeType, scopeId } = JSON.parse(existing)
        setSelectedScopeType(scopeType)
        setSelectedScope(String(scopeId))
        setIsSimulationActive(true)
      }
    } catch (e) {
      sessionStorage.removeItem('adminSimulation')
    }
  }, [dispatch])

  // Restore selectedScopeData after branches/warehouses load
  useEffect(() => {
    if (!selectedScope || !selectedScopeType) return

    const numericId = Number(selectedScope)
    if (selectedScopeType === 'BRANCH' && branches.length > 0) {
      const branch = branches.find(b => b.id === numericId)
      if (branch) setSelectedScopeData(branch)
    }
    if (selectedScopeType === 'WAREHOUSE' && warehouses.length > 0) {
      const warehouse = warehouses.find(w => w.id === numericId)
      if (warehouse) setSelectedScopeData(warehouse)
    }
  }, [branches, warehouses, selectedScope, selectedScopeType])

  // Handle scope selection - saves to sessionStorage so axios sends headers
  const handleScopeChange = (newScopeType, newScopeId) => {
    setSelectedScopeType(newScopeType)
    setSelectedScope(newScopeId)
    setIsSimulationActive(false) // Reset until user clicks Activate

    const numericId = Number(newScopeId)

    if (newScopeType === 'BRANCH') {
      const branch = branches.find(b => b.id === numericId)
      setSelectedScopeData(branch)
    }

    if (newScopeType === 'WAREHOUSE') {
      const warehouse = warehouses.find(w => w.id === numericId)
      setSelectedScopeData(warehouse)
    }
  }

  // Activate simulation - saves to sessionStorage so all API calls use this scope
  const handleActivateSimulation = () => {
    if (!selectedScope || !selectedScopeType) return

    try {
      sessionStorage.setItem('adminSimulation', JSON.stringify({
        scopeType: selectedScopeType,
        scopeId: selectedScope
      }))
      setIsSimulationActive(true)
    } catch (e) {
      console.error('Failed to save simulation to sessionStorage', e)
    }
  }

  // Clear simulation - removes from sessionStorage so API calls go back to normal
  const handleClearSimulation = () => {
    sessionStorage.removeItem('adminSimulation')
    setSelectedScope('')
    setSelectedScopeType('')
    setSelectedScopeData(null)
    setIsSimulationActive(false)
  }

  const handlePOSAccess = () => {
    if (!selectedScope || selectedScopeType !== 'BRANCH') {
      alert('Please select a branch first')
      return
    }
    router.push(`/dashboard/pos/terminal?role=cashier&scope=branch&id=${selectedScope}`)
  }

  const handleWarehouseBillingAccess = () => {
    if (!selectedScope || selectedScopeType !== 'WAREHOUSE') {
      alert('Please select a warehouse first')
      return
    }
    router.push(`/dashboard/warehouse-billing?role=warehouse_keeper&scope=warehouse&id=${selectedScope}`)
  }

  const handleInventoryAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      alert('Please select a branch or warehouse first')
      return
    }
    const role = selectedScopeType === 'BRANCH' ? 'cashier' : 'warehouse_keeper'
    const scope = selectedScopeType.toLowerCase()
    router.push(`/dashboard/inventory?role=${role}&scope=${scope}&id=${selectedScope}`)
  }

  const handleReportsAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      alert('Please select a branch or warehouse first')
      return
    }
    const role = selectedScopeType === 'BRANCH' ? 'cashier' : 'warehouse_keeper'
    const scope = selectedScopeType.toLowerCase()
    router.push(`/dashboard/reports?role=${role}&scope=${scope}&id=${selectedScope}`)
  }

  const getScopeIcon = (type) => {
    return type === 'BRANCH' ? <StoreIcon /> : <WarehouseIcon />
  }

  const getScopeColor = (type) => {
    return type === 'BRANCH' ? 'primary' : 'secondary'
  }

  const getScopeLabel = (type) => {
    return type === 'BRANCH' ? 'Branch' : 'Warehouse'
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN']} />
      <PermissionCheck permission="admin_dashboard" />

      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AdminIcon color="primary" />
              Admin Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Select a branch or warehouse to simulate working as that role.
            </Typography>
          </Box>

          {/* Active simulation badge */}
          {isSimulationActive && (
            <Chip
              icon={<SimulateIcon />}
              label={`Simulating: ${selectedScopeData?.name || selectedScopeType}`}
              color={selectedScopeType === 'BRANCH' ? 'primary' : 'secondary'}
              variant="filled"
              onDelete={handleClearSimulation}
              deleteIcon={<ClearIcon />}
              sx={{ fontWeight: 'bold', fontSize: '0.9rem', p: 1 }}
            />
          )}
        </Box>

        {/* Active simulation warning banner */}
        {isSimulationActive && (
          <Alert severity="warning" sx={{ mb: 3 }} action={
            <Button color="inherit" size="small" onClick={handleClearSimulation} startIcon={<ClearIcon />}>
              Clear
            </Button>
          }>
            <strong>Simulation Active:</strong> All API calls are now scoped to <strong>{selectedScopeData?.name}</strong>. 
                You are acting as admin but within this {getScopeLabel(selectedScopeType).toLowerCase()}&apos;s scope.          </Alert>
        )}

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
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2">
                      Selected Branch: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
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
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2">
                      Selected Warehouse: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Current Selection Status */}
        {selectedScope && selectedScopeType && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ bgcolor: getScopeColor(selectedScopeType) + '.main' }}>
                  {getScopeIcon(selectedScopeType)}
                </Avatar>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6">
                    {isSimulationActive ? '🟢 Simulation Active' : '⚪ Simulation Ready'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedScopeData?.name} — {selectedScopeData?.location}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {!isSimulationActive && (
                    <Button
                      variant="contained"
                      color={selectedScopeType === 'BRANCH' ? 'primary' : 'secondary'}
                      startIcon={<SimulateIcon />}
                      onClick={handleActivateSimulation}
                    >
                      Activate Simulation
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<ClearIcon />}
                    onClick={handleClearSimulation}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>

              {!isSimulationActive ? (
                <Alert severity="info">
                  Click <strong>Activate Simulation</strong> to scope all API calls to <strong>{selectedScopeData?.name}</strong>. 
                  Once active, any action you take (create retailer, make sale, etc.) will be saved under your admin account but scoped to this {getScopeLabel(selectedScopeType).toLowerCase()}&apos;s scope.
                </Alert>
              ) : (
                <Alert severity="success">
                  ✅ Simulation is active for <strong>{selectedScopeData?.name}</strong>. 
                  All API calls are now scoped to this {getScopeLabel(selectedScopeType).toLowerCase()}. Records will be saved with your admin identity.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Functions */}
        {selectedScope && selectedScopeType && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Functions
              </Typography>

              <Grid container spacing={2}>
                {selectedScopeType === 'BRANCH' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'primary.main' }}
                      onClick={handlePOSAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <POSIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6">POS Terminal</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {selectedScopeType === 'WAREHOUSE' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'secondary.main' }}
                      onClick={handleWarehouseBillingAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <ReceiptIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6">Warehouse Billing</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'info.main' }}
                    onClick={handleInventoryAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <InventoryIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6">Inventory</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'warning.main' }}
                    onClick={handleReportsAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <ReportsIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6">Reports</Typography>
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
                  primary="1. Select Scope"
                  secondary="Choose a branch or warehouse from the dropdowns above"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <SimulateIcon color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="2. Activate Simulation"
                  secondary="Click Activate Simulation to start scoping all API calls to the selected branch/warehouse"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <PersonIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="3. Work Normally"
                  secondary="Create retailers, make sales, manage inventory — all saved under your admin account"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <ClearIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="4. Clear When Done"
                  secondary="Click Clear to stop simulation and return to normal admin mode"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <LocationIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Switch Anytime"
                  secondary="Return here to switch to a different branch or warehouse"
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