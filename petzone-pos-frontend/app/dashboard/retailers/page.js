'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { fetchRetailers, createRetailer, updateRetailer, deleteRetailer } from '../../store/slices/retailersSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import api from '../../../utils/axios'
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
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  Divider
} from '@mui/material'
import {
  Add,
  Refresh,
  Store,
  TrendingUp,
  LocationOn,
  Phone,
  Edit,
  Delete,
  Visibility,
  Warning,
  CheckCircle,
  Block
} from '@mui/icons-material'
import * as yup from 'yup'

const RetailersPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { warehouseSettings, loading: settingsLoading } = useSelector((state) => state.warehouses || { warehouseSettings: null, loading: false })
  
  // ✅ Granular permissions for retailers
  const canCreateRetailer = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowRetailerCreate === true)
  
  const canEditRetailer = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowRetailerEdit === true)
  
  const canDeleteRetailer = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowRetailerDelete === true)
  
  // For backward compatibility (if old setting still exists)
  const canManageRetailersOld = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseRetailerCRUD === true)
  
  // Combined permissions - use new if available, fall back to old
  const canCreate = canCreateRetailer || canManageRetailersOld
  const canEdit = canEditRetailer || canManageRetailersOld
  const canDelete = canDeleteRetailer || canManageRetailersOld
  
  // For showing action column (if any action is allowed)
  const canManageRetailers = canCreate || canEdit || canDelete
  
  // Permission warning for warehouse keepers without sufficient permissions
  const showPermissionWarning = user?.role === 'WAREHOUSE_KEEPER' && 
    !canCreate && !canEdit && !canDelete && 
    warehouseSettings && !settingsLoading
  
  const [filters, setFilters] = useState({
    status: 'all',
    location: 'all',
    search: ''
  })

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editingRetailer, setEditingRetailer] = useState(null)
  const [viewingRetailer, setViewingRetailer] = useState(null)
  const [retailerToDelete, setRetailerToDelete] = useState(null)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get retailers data from Redux store
  const { data: retailers, loading, error } = useSelector((state) => state.retailers || { data: [], loading: false, error: null })

  // Load warehouse settings for permission checking
  useEffect(() => {
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }, [dispatch, user])

  // Load retailers data on component mount
  useEffect(() => {
    dispatch(fetchRetailers())
  }, [dispatch])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Handle refresh - fetch retailers data again
  const handleRefresh = () => {
    dispatch(fetchRetailers())
    
    // Reload warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }

  const getRetailerStats = () => {
    if (!retailers || !Array.isArray(retailers)) {
      return { total: 0, active: 0, inactive: 0, suspended: 0, warehouse: 0, branch: 0 }
    }
    
    const total = retailers.length
    const active = retailers.filter(r => r.status === 'ACTIVE' || r.status === 'active').length
    const inactive = retailers.filter(r => r.status === 'INACTIVE' || r.status === 'inactive').length
    const suspended = retailers.filter(r => r.status === 'SUSPENDED' || r.status === 'suspended').length
    const warehouse = retailers.filter(r => r.warehouse_id !== null && r.warehouse_id !== undefined).length
    const branch = retailers.filter(r => r.warehouse_id === null || r.warehouse_id === undefined).length

    return { total, active, inactive, suspended, warehouse, branch }
  }

  const stats = getRetailerStats()

  // Filter retailers based on current filters
  const filteredRetailers = retailers?.filter(retailer => {
    const matchesSearch = !filters.search || 
      retailer.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      retailer.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      retailer.phone?.toLowerCase().includes(filters.search.toLowerCase())
    
    const matchesStatus = filters.status === 'all' || 
      retailer.status?.toLowerCase() === filters.status.toLowerCase()
    
    const matchesLocation = filters.location === 'all' ||
      (filters.location === 'WAREHOUSE' && retailer.warehouse_id) ||
      (filters.location === 'BRANCH' && !retailer.warehouse_id)
    
    return matchesSearch && matchesStatus && matchesLocation
  }) || []

  // Form validation schema
  const validationSchema = yup.object({
    name: yup.string().required('Retailer name is required'),
    phone: yup.string().optional(),
    address: yup.string().optional(),
    city: yup.string().optional(),
    creditLimit: yup.number().min(0).optional(),
    paymentTerms: yup.string().optional(),
    status: yup.string().required('Status is required'),
    notes: yup.string().optional(),
  })

  // Handle form operations
  const handleCreate = () => {
    setEditingRetailer(null)
    setFormData({
      name: '',
      phone: '',
      address: '',
      city: '',
      warehouseId: null,
      creditLimit: 0,
      paymentTerms: 'CASH',
      status: 'ACTIVE',
      notes: ''
    })
    setFormErrors({})
    setFormDialogOpen(true)
  }

  const handleEdit = (retailer) => {
    setEditingRetailer(retailer)
    setFormData({
      name: retailer.name || '',
      phone: retailer.phone || '',
      address: retailer.address || '',
      city: retailer.city || '',
      warehouseId: retailer.warehouse_id ?? null,
      creditLimit: Number(retailer.creditLimit ?? retailer.credit_limit ?? 0),
      paymentTerms: retailer.paymentTerms || retailer.payment_terms || 'CASH',
      status: retailer.status || 'ACTIVE',
      notes: retailer.notes || ''
    })
    setFormErrors({})
    setFormDialogOpen(true)
  }

  const handleView = (retailer) => {
    setViewingRetailer(retailer)
    setViewDialogOpen(true)
  }

  const handleDelete = (retailer) => {
    setRetailerToDelete(retailer)
    setDeleteDialogOpen(true)
  }

  const handleFormSubmit = async () => {
    // Prevent multiple submissions
    if (isSubmitting) return
    
    try {
      setIsSubmitting(true)
      
      // Validate form data
      await validationSchema.validate(formData, { abortEarly: false })
      setFormErrors({})

      // Normalize/clean payload to avoid undefined
      const normalize = (v) => (v === undefined || v === '' ? null : v)
      const retailerData = {
        name: formData.name || '',
        phone: normalize(formData.phone),
        address: normalize(formData.address),
        city: normalize(formData.city),
        creditLimit: formData.creditLimit === '' || formData.creditLimit === undefined || formData.creditLimit === null
          ? 0
          : Number(formData.creditLimit),
        paymentTerms: formData.paymentTerms || 'CASH',
        status: formData.status || 'ACTIVE',
        notes: normalize(formData.notes),
        // Scope/warehouse assignment
        warehouseId:
          user?.role === 'WAREHOUSE_KEEPER'
            ? (user?.warehouseId ?? null)
            : normalize(formData.warehouseId)
      }

      if (editingRetailer) {
        // Update existing retailer
        const result = await dispatch(updateRetailer({ id: editingRetailer.id, data: retailerData }))
        if (updateRetailer.fulfilled.match(result)) {
          setFormDialogOpen(false)
          dispatch(fetchRetailers())
        }
      } else {
        // Create new retailer
        const result = await dispatch(createRetailer(retailerData))
        if (createRetailer.fulfilled.match(result)) {
          setFormDialogOpen(false)
          dispatch(fetchRetailers())
        }
      }
    } catch (error) {
      if (error.inner) {
        // Validation errors
        const errors = {}
        error.inner.forEach(err => {
          errors[err.path] = err.message
        })
        setFormErrors(errors)
      } else {
        console.error('Error saving retailer:', error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (retailerToDelete?.id) {
      try {
        const result = await dispatch(deleteRetailer(retailerToDelete.id))
        if (deleteRetailer.fulfilled.match(result)) {
          setDeleteDialogOpen(false)
          dispatch(fetchRetailers())
        }
    } catch (error) {
        console.error('Error deleting retailer:', error)
      }
    }
  }

  const handleFormClose = () => {
    setFormDialogOpen(false)
    setEditingRetailer(null)
    setFormData({})
    setFormErrors({})
    setIsSubmitting(false)
  }

  const handleViewClose = () => {
    setViewDialogOpen(false)
    setViewingRetailer(null)
  }

  const handleDeleteClose = () => {
    setDeleteDialogOpen(false)
    setRetailerToDelete(null)
  }

  // Get status chip color
  const getStatusColor = (status) => {
    switch(status?.toUpperCase()) {
      case 'ACTIVE': return 'success'
      case 'INACTIVE': return 'default'
      case 'SUSPENDED': return 'error'
      default: return 'default'
    }
  }

  return (
    <DashboardLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
          <Typography variant="h4" gutterBottom>
            Retailers Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Manage retailer accounts and relationships
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
            {/* ✅ Add button only shows if user can create */}
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreate}
              >
                Add Retailer
              </Button>
            )}
          </Box>
        </Box>

        {/* Permission Warning for Warehouse Keepers */}
        {showPermissionWarning && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>Limited Access</AlertTitle>
            You have view-only access to retailers. Contact an administrator if you need to create, edit, or delete retailers.
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Total Retailers
                    </Typography>
                    <Typography variant="h4">
                      {stats.total}
                    </Typography>
                  </Box>
                  <Store sx={{ fontSize: 40, color: 'primary.main' }} />
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
                      Active
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {stats.active}
                    </Typography>
                  </Box>
                  <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
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
                      Inactive
                    </Typography>
                    <Typography variant="h4" color="textSecondary">
                      {stats.inactive}
                    </Typography>
                  </Box>
                  <Block sx={{ fontSize: 40, color: 'text.secondary' }} />
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
                      Suspended
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {stats.suspended}
                    </Typography>
                  </Box>
                  <Warning sx={{ fontSize: 40, color: 'error.main' }} />
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
                      Warehouse
                    </Typography>
                    <Typography variant="h4" color="info.main">
                      {stats.warehouse}
                    </Typography>
                  </Box>
                  <Store sx={{ fontSize: 40, color: 'info.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Search Retailers"
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
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Scope Type</InputLabel>
            <Select
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              label="Scope Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
              <MenuItem value="BRANCH">Branch</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {/* Retailers Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Retailers List
              </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                      <TableCell>Company</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Payment Terms</TableCell>
                      <TableCell>Credit Limit</TableCell>
                      <TableCell>Created</TableCell>
                      {canManageRetailers && <TableCell align="center">Actions</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                    {filteredRetailers.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={canManageRetailers ? 9 : 8} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="textSecondary">
                            {retailers?.length === 0 ? 'No retailers found. Click "Add Retailer" to create your first retailer.' : 'No retailers match your current filters.'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                      filteredRetailers.map((retailer) => (
                        <TableRow key={retailer.id} hover>
                            <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                <Store />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                {retailer.name || 'Unnamed Retailer'}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {retailer.email || 'No email'}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              {retailer.phone && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Phone fontSize="small" color="action" />
                                  <Typography variant="caption">
                                    {retailer.phone}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocationOn fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {retailer.address || 'No address'}
                              </Typography>
                            </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                              label={retailer.status || 'unknown'} 
                              color={getStatusColor(retailer.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={retailer.paymentTerms || 'CASH'} 
                              color={retailer.paymentTerms === 'CASH' ? 'success' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              ${parseFloat(retailer.creditLimit || 0).toFixed(2)}
                                      </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {(() => {
                                const createdAt = retailer.createdAt || retailer.created_at;
                                if (!createdAt) {
                                  return 'Unknown';
                                }
                                const dateValue = typeof createdAt === 'string' || createdAt instanceof Date
                                  ? new Date(createdAt)
                                  : null;
                                if (!dateValue || Number.isNaN(dateValue.getTime())) {
                                  return 'Unknown';
                                }
                                return dateValue.toLocaleDateString();
                              })()}
                            </Typography>
                          </TableCell>
                          {canManageRetailers && (
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleView(retailer)}
                                    color="info"
                                  >
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {/* ✅ Edit button only shows if user can edit */}
                                {canEdit && (
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleEdit(retailer)}
                                      color="primary"
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* ✅ Delete button only shows if user can delete */}
                                {canDelete && (
                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDelete(retailer)}
                                      color="error"
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <Dialog open={formDialogOpen} onClose={handleFormClose} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingRetailer ? 'Edit Retailer' : 'Add New Retailer'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Retailer Name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  error={!!formErrors.phone}
                  helperText={formErrors.phone}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={formData.city || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  error={!!formErrors.city}
                  helperText={formErrors.city}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={formData.address || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  error={!!formErrors.address}
                  helperText={formErrors.address}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Credit Limit ($)"
                  type="number"
                  value={formData.creditLimit || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: parseFloat(e.target.value) || 0 }))}
                  error={!!formErrors.creditLimit}
                  helperText={formErrors.creditLimit}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Terms</InputLabel>
                            <Select
                    value={formData.paymentTerms || 'CASH'}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    label="Payment Terms"
                            >
                              <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="NET_15">Net 15</MenuItem>
                    <MenuItem value="NET_30">Net 30</MenuItem>
                    <MenuItem value="NET_45">Net 45</MenuItem>
                    <MenuItem value="NET_60">Net 60</MenuItem>
                            </Select>
                          </FormControl>
                      </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                            <Select
                    value={formData.status || 'ACTIVE'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    label="Status"
                  >
                    <MenuItem value="ACTIVE">Active</MenuItem>
                    <MenuItem value="INACTIVE">Inactive</MenuItem>
                    <MenuItem value="SUSPENDED">Suspended</MenuItem>
                            </Select>
                          </FormControl>
                      </Grid>
              <Grid item xs={12}>
                        <TextField
                          fullWidth
                  label="Notes"
                          multiline
                          rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  error={!!formErrors.notes}
                  helperText={formErrors.notes}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleFormClose}>Cancel</Button>
            <Button onClick={handleFormSubmit} variant="contained" disabled={loading || isSubmitting}>
              {isSubmitting ? <CircularProgress size={20} /> : (editingRetailer ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={viewDialogOpen} onClose={handleViewClose} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Store />
              <Typography variant="h6">Retailer Details</Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {viewingRetailer && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Name</Typography>
                  <Typography variant="body1">{viewingRetailer.name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Divider />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Email</Typography>
                  <Typography variant="body1">{viewingRetailer.email || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Phone</Typography>
                  <Typography variant="body1">{viewingRetailer.phone || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Address</Typography>
                  <Typography variant="body1">{viewingRetailer.address || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">City</Typography>
                  <Typography variant="body1">{viewingRetailer.city || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                  <Chip 
                    label={viewingRetailer.status || 'unknown'} 
                    color={getStatusColor(viewingRetailer.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Payment Terms</Typography>
                  <Typography variant="body1">{viewingRetailer.paymentTerms || 'CASH'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Credit Limit</Typography>
                  <Typography variant="body1">${parseFloat(viewingRetailer.creditLimit || 0).toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Notes</Typography>
                  <Typography variant="body1">{viewingRetailer.notes || 'No notes'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Created</Typography>
                  <Typography variant="body2">
                    {viewingRetailer.createdAt ? new Date(viewingRetailer.createdAt).toLocaleString() : 'Unknown'}
                  </Typography>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleViewClose}>Close</Button>
            {canEdit && viewingRetailer && (
              <Button 
                onClick={() => {
                  handleViewClose()
                  handleEdit(viewingRetailer)
                }} 
                color="primary"
              >
                Edit
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={handleDeleteClose}>
          <DialogTitle>Delete Retailer</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete retailer &quot;{retailerToDelete?.name}&quot;? This action cannot be undone.
                </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteClose}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={loading}>
              Delete
                </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}

export default RetailersPage