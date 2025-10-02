'use client'

import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import { usePermissions } from '../../../hooks/usePermissions'
import { fetchReturns, createReturn, updateReturn, deleteReturn } from '../../store/slices/returnsSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
} from '@mui/material'
import {
  Add,
  Refresh,
  Receipt,
  TrendingDown,
  Delete,
} from '@mui/icons-material'
import * as yup from 'yup'

const ReturnsPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: returns, loading, error } = useSelector((state) => state.returns)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  const { hasPermission } = usePermissions()
  
  // Check if warehouse keeper can manage returns
  const canManageReturns = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseReturns) ||
    (user?.role === 'CASHIER' && hasPermission('CASHIER_RETURNS'))
  
  
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: '7days',
    search: ''
  })

  const columns = [
    { field: 'return_no', headerName: 'Return #', width: 120 },
    { field: 'invoice_no', headerName: 'Original Invoice', width: 150 },
    { field: 'reason', headerName: 'Reason', width: 150 },
    { field: 'total_refund', headerName: 'Refund Amount', width: 120, renderCell: (params) => `$${params.value || 0}` },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'pending'} 
          color={
            params.value === 'completed' ? 'success' :
            params.value === 'approved' ? 'primary' :
            params.value === 'pending' ? 'warning' : 'error'
          }
          size="small"
        />
      )
    },
    { field: 'created_at', headerName: 'Return Date', width: 120, renderCell: (params) => new Date(params.value).toLocaleDateString() },
    { field: 'username', headerName: 'Processed By', width: 150 },
    { 
      field: 'scope_type', 
      headerName: 'Location', 
      width: 120,
      renderCell: (params) => {
        const row = params.row;
        if (row.scope_type === 'BRANCH') {
          return row.branch_name || `Branch ${row.scope_id}`;
        } else if (row.scope_type === 'WAREHOUSE') {
          return row.warehouse_name || `Warehouse ${row.scope_id}`;
        }
        return row.branch_name || row.warehouse_name || 'Unknown';
      }
    },
  ]

  const validationSchema = yup.object({
    saleId: yup.number().required('Sale ID is required').min(1, 'Sale ID must be valid'),
    reason: yup.string().required('Reason is required').max(500, 'Reason cannot exceed 500 characters'),
    notes: yup.string().max(500, 'Notes cannot exceed 500 characters'),
    items: yup.array().min(1, 'At least one item is required').of(
      yup.object({
        inventoryItemId: yup.number().required('Inventory item ID is required').min(1, 'Invalid inventory item'),
        quantity: yup.number().required('Quantity is required').min(0.01, 'Quantity must be greater than 0'),
        refundAmount: yup.number().required('Refund amount is required').min(0, 'Refund amount must be positive'),
      })
    ),
  })

  const formFields = [
    { name: 'saleId', label: 'Sale ID', type: 'number', required: true },
    { 
      name: 'reason', 
      label: 'Reason', 
      type: 'select', 
      required: true,
      options: [
        { value: 'defective', label: 'Defective' },
        { value: 'changed_mind', label: 'Changed Mind' },
        { value: 'wrong_model', label: 'Wrong Model' },
        { value: 'damaged_shipping', label: 'Damaged in Shipping' },
        { value: 'other', label: 'Other' }
      ]
    },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ]

  // Dialog state management
  const [openDialog, setOpenDialog] = useState(false)
  const [editingEntity, setEditingEntity] = useState(null)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [entityToDelete, setEntityToDelete] = useState(null)
  
  // Return form state
  const [returnForm, setReturnForm] = useState({
    saleId: '',
    reason: '',
    notes: '',
    items: [{ inventoryItemId: '', quantity: '', refundAmount: '' }]
  })

  // Load returns data on component mount
  useEffect(() => {
    // Pass user scope for filtering
    const params = {};
    if (user?.role === 'WAREHOUSE_KEEPER') {
      params.scopeType = 'WAREHOUSE';
      params.scopeId = user.warehouseId;
    } else if (user?.role === 'CASHIER') {
      params.scopeType = 'BRANCH';
      params.scopeId = user.branchId;
    }
    // Admin doesn't need scope filtering - can see all returns
    
    dispatch(fetchReturns(params))
    
    // Load warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }, [dispatch, user])

  const handleCreate = (data) => {
    dispatch(createReturn(data))
    setOpenDialog(false)
  }

  const handleReturnFormChange = (field, value) => {
    setReturnForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index, field, value) => {
    setReturnForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const addItem = () => {
    setReturnForm(prev => ({
      ...prev,
      items: [...prev.items, { inventoryItemId: '', quantity: '', refundAmount: '' }]
    }))
  }

  const removeItem = (index) => {
    if (returnForm.items.length > 1) {
      setReturnForm(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }))
    }
  }

  const handleCreateReturn = () => {
    const returnData = {
      ...returnForm,
      saleId: parseInt(returnForm.saleId),
      items: returnForm.items.map(item => ({
        inventoryItemId: parseInt(item.inventoryItemId),
        quantity: parseFloat(item.quantity),
        refundAmount: parseFloat(item.refundAmount)
      }))
    }
    dispatch(createReturn(returnData))
    setOpenDialog(false)
    setReturnForm({
      saleId: '',
      reason: '',
      notes: '',
      items: [{ inventoryItemId: '', quantity: '', refundAmount: '' }]
    })
  }

  const handleUpdate = (data) => {
    dispatch(updateReturn({ id: editingEntity.id, data }))
    setOpenDialog(false)
    setEditingEntity(null)
  }

  const handleDelete = () => {
    dispatch(deleteReturn(entityToDelete.id))
    setOpenDeleteDialog(false)
    setEntityToDelete(null)
  }

  const handleRefresh = () => {
    // Pass user scope for filtering
    const params = {};
    if (user?.role === 'WAREHOUSE_KEEPER') {
      params.scopeType = 'WAREHOUSE';
      params.scopeId = user.warehouseId;
    } else if (user?.role === 'CASHIER') {
      params.scopeType = 'BRANCH';
      params.scopeId = user.branchId;
    }
    // Admin doesn't need scope filtering - can see all returns
    
    dispatch(fetchReturns(params))
    
    // Reload warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success'
      case 'approved': return 'primary'
      case 'pending': return 'warning'
      case 'rejected': return 'error'
      default: return 'default'
    }
  }

  const getReturnStats = () => {
    try {
      if (!returns || !Array.isArray(returns) || returns.length === undefined) {
        return { total: 0, pending: 0, approved: 0, completed: 0, totalAmount: 0 }
      }
      
      const total = returns.length
      const pending = returns.filter(r => r && r.status === 'pending').length
      const approved = returns.filter(r => r && r.status === 'approved').length
      const completed = returns.filter(r => r && r.status === 'completed').length
      const totalAmount = returns.reduce((sum, r) => sum + (r && r.total_refund ? r.total_refund : 0), 0)

      return { total, pending, approved, completed, totalAmount }
    } catch (error) {
      return { total: 0, pending: 0, approved: 0, completed: 0, totalAmount: 0 }
    }
  }

  const stats = getReturnStats()

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>
        <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Returns Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Process and manage product returns
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Total Returns
                    </Typography>
                    <Typography variant="h4">
                      {stats.total}
                    </Typography>
                  </Box>
                  <Receipt sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Pending
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {stats.pending}
                    </Typography>
                  </Box>
                  <TrendingDown sx={{ fontSize: 40, color: 'warning.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Approved
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {stats.approved}
                    </Typography>
                  </Box>
                  <Receipt sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Completed
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {stats.completed}
                    </Typography>
                  </Box>
                  <Receipt sx={{ fontSize: 40, color: 'success.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Total Amount
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      ${stats.totalAmount.toFixed(2)}
                    </Typography>
                  </Box>
                  <TrendingDown sx={{ fontSize: 40, color: 'error.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Search"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              label="Date Range"
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="7days">Last 7 Days</MenuItem>
              <MenuItem value="30days">Last 30 Days</MenuItem>
              <MenuItem value="90days">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Returns Table */}
        <EntityTable
          entities={returns || []}
          columns={columns}
          loading={loading}
          error={error}
          title="Returns Management"
          entityName="Return"
          onAdd={canManageReturns ? () => setOpenDialog(true) : undefined}
          onEdit={canManageReturns ? (entity) => {
            setEditingEntity(entity)
            setOpenDialog(true)
          } : undefined}
          onDelete={canManageReturns ? (entity) => {
            setEntityToDelete(entity)
            setOpenDeleteDialog(true)
          } : undefined}
          showAddButton={canManageReturns}
          showActions={canManageReturns}
          showToolbar={canManageReturns}
        />

        {/* Return Form Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Return</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Sale ID"
                    type="number"
                    value={returnForm.saleId}
                    onChange={(e) => handleReturnFormChange('saleId', e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Reason</InputLabel>
                    <Select
                      value={returnForm.reason}
                      onChange={(e) => handleReturnFormChange('reason', e.target.value)}
                      label="Reason"
                    >
                      <MenuItem value="defective">Defective</MenuItem>
                      <MenuItem value="changed_mind">Changed Mind</MenuItem>
                      <MenuItem value="wrong_model">Wrong Model</MenuItem>
                      <MenuItem value="damaged_shipping">Damaged in Shipping</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={3}
                    value={returnForm.notes}
                    onChange={(e) => handleReturnFormChange('notes', e.target.value)}
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Return Items</Typography>
                <Button startIcon={<Add />} onClick={addItem} variant="outlined">
                  Add Item
                </Button>
              </Box>
              
              {returnForm.items.map((item, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="Inventory Item ID"
                          type="number"
                          value={item.inventoryItemId}
                          onChange={(e) => handleItemChange(index, 'inventoryItemId', e.target.value)}
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          label="Quantity"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          label="Refund Amount"
                          type="number"
                          value={item.refundAmount}
                          onChange={(e) => handleItemChange(index, 'refundAmount', e.target.value)}
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <IconButton 
                          onClick={() => removeItem(index)}
                          disabled={returnForm.items.length === 1}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateReturn} 
              variant="contained" 
              disabled={loading}
            >
              Create Return
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={openDeleteDialog}
          onClose={() => {
            setOpenDeleteDialog(false)
            setEntityToDelete(null)
          }}
          onConfirm={handleDelete}
          title="Delete Return"
          message={`Are you sure you want to delete return ${entityToDelete?.return_no}?`}
          loading={loading}
        />
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default ReturnsPage
