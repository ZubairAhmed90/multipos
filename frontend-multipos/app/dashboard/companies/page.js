'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Tooltip,
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
  CircularProgress,
  Alert,
  Avatar,
} from '@mui/material'
import { 
  Search, 
  Business, 
  BusinessCenter, 
  Add, 
  Refresh, 
  Edit, 
  Delete, 
  TrendingUp,
  Store,
  LocationOn,
  Phone,
  Email,
} from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import { fetchCompanies, createCompany, updateCompany, deleteCompany } from '../../store/slices/companiesSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'

// Validation schema - matches backend validation exactly
const companySchema = yup.object({
  name: yup.string()
    .trim()
    .min(1, 'Company name must be between 1 and 200 characters')
    .max(200, 'Company name must be between 1 and 200 characters')
    .required('Company name is required'),
  code: yup.string()
    .trim()
    .min(1, 'Company code must be between 1 and 20 characters')
    .max(20, 'Company code must be between 1 and 20 characters')
    .required('Company code is required'),
  contactPerson: yup.string()
    .trim()
    .min(1, 'Contact person must be between 1 and 200 characters')
    .max(200, 'Contact person must be between 1 and 200 characters')
    .required('Contact person is required'),
  phone: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('phone-length', 'Phone must not exceed 20 characters', function(value) {
      if (!value) return true // Allow empty/null values
      return value.length <= 20
    }),
  email: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('email-format', 'Email must be a valid email address', function(value) {
      if (!value) return true // Allow empty/null values
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    }),
  address: yup.string()
    .trim()
    .min(1, 'Address must be between 1 and 500 characters')
    .max(500, 'Address must be between 1 and 500 characters')
    .required('Address is required'),
  status: yup.string()
    .oneOf(['active', 'inactive', 'suspended'], 'Status must be active, inactive, or suspended')
    .nullable()
    .transform((value) => value === '' ? null : value),
  transactionType: yup.string()
    .oneOf(['CASH', 'CREDIT', 'CARD', 'DIGITAL'], 'Transaction type must be CASH, CREDIT, CARD, or DIGITAL')
    .nullable()
    .transform((value) => value === '' ? null : value),
  scopeType: yup.string()
    .oneOf(['BRANCH', 'WAREHOUSE', 'COMPANY'], 'Scope type must be BRANCH, WAREHOUSE, or COMPANY')
    .required('Scope type is required'),
  scopeId: yup.string()
    .min(1, 'Scope name must be between 1 and 100 characters')
    .max(100, 'Scope name must be between 1 and 100 characters')
    .required('Scope name is required'),
})

function CompaniesPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  
  // Check permissions for warehouse keepers (like inventory management)
  const canManageCompanies = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseCompanyCRUD)
  
  // Only admins can delete companies
  const canDeleteCompanies = user?.role === 'ADMIN'
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    scopeType: 'all',
    transactionType: 'all'
  })

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [companyToDelete, setCompanyToDelete] = useState(null)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get companies data from Redux store
  const { data: companies, loading, error } = useSelector((state) => state.companies || { data: [], loading: false, error: null })

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchCompanies())
    
    // Load warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }, [dispatch, user?.role, user?.warehouseId])

  // Filter companies based on current filters and user role
  const filteredCompanies = companies?.filter(company => {
    const matchesSearch = !filters.search || 
      company.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      company.code?.toLowerCase().includes(filters.search.toLowerCase()) ||
      company.contactPerson?.toLowerCase().includes(filters.search.toLowerCase())
    
    const matchesScopeType = filters.scopeType === 'all' || company.scopeType === filters.scopeType
    const matchesTransactionType = filters.transactionType === 'all' || company.transactionType === filters.transactionType
    
    // Role-based filtering: 
    // - Admins see all companies
    // - Warehouse keepers only see companies for their specific warehouse
    const matchesRoleScope = user?.role === 'ADMIN' || 
      (user?.role === 'WAREHOUSE_KEEPER' && 
       company.scopeType === 'WAREHOUSE' && 
       company.scopeId === user?.warehouseId)
    
    return matchesSearch && matchesScopeType && matchesTransactionType && matchesRoleScope
  }) || []

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Get company statistics
  const getCompanyStats = () => {
    if (!companies || !Array.isArray(companies)) {
      return { total: 0, active: 0, inactive: 0, warehouse: 0, branch: 0 }
    }
    
    const total = companies.length
    const active = companies.filter(c => c.status === 'active').length
    const inactive = companies.filter(c => c.status === 'inactive' || c.status === 'suspended').length
    const warehouse = companies.filter(c => c.scopeType === 'WAREHOUSE').length
    const branch = companies.filter(c => c.scopeType === 'BRANCH').length

    return { total, active, inactive, warehouse, branch }
  }

  const stats = getCompanyStats()

  // Handle CRUD operations
  const handleCreate = () => {
    setEditingCompany(null)
    setFormData({
      name: '',
      code: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      status: 'active',
      transactionType: 'CASH',
      scopeType: user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : 'BRANCH',
      scopeId: user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : '',
    })
    setFormErrors({})
    setFormDialogOpen(true)
  }

  const handleEdit = (company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name || '',
      code: company.code || '',
      contactPerson: company.contactPerson || '',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      status: company.status || 'active',
      transactionType: company.transactionType || 'CASH',
      scopeType: company.scopeType || 'BRANCH',
      scopeId: company.scopeId || '',
    })
    setFormErrors({})
    setFormDialogOpen(true)
  }

  const handleDelete = (company) => {
    setCompanyToDelete(company)
    setDeleteDialogOpen(true)
  }

  const handleFormSubmit = async () => {
    // Prevent multiple submissions
    if (isSubmitting) return
    
    try {
      setIsSubmitting(true)
      
      // Validate form data
      await companySchema.validate(formData, { abortEarly: false })
      setFormErrors({})

      // Prepare company data
      const companyData = {
        ...formData,
        // For warehouse keepers, set scope automatically
        scopeType: user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : formData.scopeType,
        scopeId: user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : formData.scopeId,
      }
      
      console.log('🔧 Company data being sent:', companyData)
      console.log('🔧 User role:', user?.role, 'Warehouse ID:', user?.warehouseId)

      if (editingCompany) {
        // Update existing company
        const result = await dispatch(updateCompany({ id: editingCompany.id, data: companyData }))
        if (updateCompany.fulfilled.match(result)) {
          setFormDialogOpen(false)
          dispatch(fetchCompanies())
        }
      } else {
        // Create new company
        const result = await dispatch(createCompany(companyData))
        if (createCompany.fulfilled.match(result)) {
          setFormDialogOpen(false)
          dispatch(fetchCompanies())
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
        console.error('Error saving company:', error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (companyToDelete?.id) {
      try {
        const result = await dispatch(deleteCompany(companyToDelete.id))
        if (deleteCompany.fulfilled.match(result)) {
          setDeleteDialogOpen(false)
          dispatch(fetchCompanies())
        }
      } catch (error) {
        console.error('Error deleting company:', error)
      }
    }
  }

  const handleFormClose = () => {
    setFormDialogOpen(false)
    setEditingCompany(null)
    setFormData({})
    setFormErrors({})
    setIsSubmitting(false)
  }

  const handleDeleteClose = () => {
    setDeleteDialogOpen(false)
    setCompanyToDelete(null)
  }

  const handleRefresh = () => {
    dispatch(fetchCompanies())
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessCenter />
            Companies Management
          </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Manage company accounts and relationships
              </Typography>
            </Box>
            {canManageCompanies && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleCreate}
                >
                  Add Company
                </Button>
              </Box>
            )}
        </Box>

        {/* Role-specific information */}
        {user?.role === 'WAREHOUSE_KEEPER' && (
            <Alert 
              severity={canManageCompanies ? 'info' : 'warning'} 
              sx={{ mb: 3 }}
            >
              <Typography variant="body2">
              <strong>Warehouse Keeper Access:</strong> {
                canManageCompanies 
                    ? `You can view and manage companies for your warehouse (ID: ${user?.warehouseId}).`
                  : 'Company management is currently disabled for your warehouse. Contact your administrator to enable this feature.'
              }
              </Typography>
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
                        Total Companies
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
                    <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
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
                      <Typography variant="h4" color="error.main">
                        {stats.inactive}
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 40, color: 'error.main' }} />
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
                    <BusinessCenter sx={{ fontSize: 40, color: 'info.main' }} />
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
                        Branch
                      </Typography>
                      <Typography variant="h4" color="secondary.main">
                        {stats.branch}
                      </Typography>
                    </Box>
                    <Business sx={{ fontSize: 40, color: 'secondary.main' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="Search Companies"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              size="small"
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
            
            {user?.role === 'ADMIN' && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Scope Type</InputLabel>
                <Select
                  value={filters.scopeType}
                  onChange={(e) => handleFilterChange('scopeType', e.target.value)}
                  label="Scope Type"
                >
                  <MenuItem value="all">All Scopes</MenuItem>
                  <MenuItem value="BRANCH">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business />
                      Branch Companies
                    </Box>
                  </MenuItem>
                  <MenuItem value="WAREHOUSE">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessCenter />
                      Warehouse Companies
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={filters.transactionType}
                onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                label="Transaction Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="CREDIT">Credit</MenuItem>
                  <MenuItem value="CARD">Card</MenuItem>
                  <MenuItem value="DIGITAL">Digital</MenuItem>
              </Select>
            </FormControl>

            {/* Active Filters Display */}
            {(filters.scopeType !== 'all' || filters.transactionType !== 'all') && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Active filters:
                </Typography>
                {user?.role === 'ADMIN' && filters.scopeType !== 'all' && (
                  <Chip
                    label={`Scope: ${filters.scopeType}`}
                    size="small"
                    onDelete={() => handleFilterChange('scopeType', 'all')}
                  />
                )}
                {filters.transactionType !== 'all' && (
                  <Chip
                    label={`Type: ${filters.transactionType}`}
                    size="small"
                    onDelete={() => handleFilterChange('transactionType', 'all')}
                  />
                )}
              </Box>
            )}
          </Box>
        </Paper>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Companies Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Companies List
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
                        <TableCell>Transaction Type</TableCell>
                        <TableCell>Scope</TableCell>
                        <TableCell>Created</TableCell>
                        {canManageCompanies && <TableCell align="center">Actions</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCompanies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canManageCompanies ? 8 : 7} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="textSecondary">
                              {companies?.length === 0 ? 'No companies found. Click "Add Company" to create your first company.' : 'No companies match your current filters.'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCompanies.map((company) => (
                          <TableRow key={company.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                  <BusinessCenter />
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {company.name || 'Unnamed Company'}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Code: {company.code}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {company.contactPerson}
                                </Typography>
                                {company.email && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                    <Email fontSize="small" color="action" />
                                    <Typography variant="caption">
                                      {company.email}
                                    </Typography>
                                  </Box>
                                )}
                                {company.phone && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Phone fontSize="small" color="action" />
                                    <Typography variant="caption">
                                      {company.phone}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationOn fontSize="small" color="action" />
                                <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {company.address || 'No address'}
                                </Typography>
      </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={company.status || 'unknown'} 
                                color={company.status === 'active' ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={company.transactionType || 'CASH'} 
                                color={company.transactionType === 'CASH' ? 'success' : 'warning'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={company.scopeType || 'Unknown'} 
                                color={company.scopeType === 'WAREHOUSE' ? 'info' : 'secondary'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {company.created_at ? new Date(company.created_at).toLocaleDateString() : 'Unknown'}
                              </Typography>
                            </TableCell>
                            {canManageCompanies && (
                              <TableCell align="center">
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleEdit(company)}
                                      color="primary"
                                    >
                                      <Edit />
                                    </IconButton>
                                  </Tooltip>
                                  {canDeleteCompanies && (
                                    <Tooltip title="Delete">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDelete(company)}
                                        color="error"
                                      >
                                        <Delete />
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
              {editingCompany ? 'Edit Company' : 'Add New Company'}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Company Name"
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
                    label="Company Code"
                    value={formData.code || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    error={!!formErrors.code}
                    helperText={formErrors.code}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Contact Person"
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    error={!!formErrors.contactPerson}
                    helperText={formErrors.contactPerson}
                    required
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
                    label="Email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    error={!!formErrors.email}
                    helperText={formErrors.email}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Transaction Type</InputLabel>
                    <Select
                      value={formData.transactionType || 'CASH'}
                      onChange={(e) => setFormData(prev => ({ ...prev, transactionType: e.target.value }))}
                      label="Transaction Type"
                    >
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="CREDIT">Credit</MenuItem>
                      <MenuItem value="CARD">Card</MenuItem>
                      <MenuItem value="DIGITAL">Digital</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    multiline
                    rows={2}
                    value={formData.address || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    error={!!formErrors.address}
                    helperText={formErrors.address}
                    required
                  />
                </Grid>
                {user?.role === 'ADMIN' ? (
                  <>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Scope Type</InputLabel>
                        <Select
                          value={formData.scopeType || 'BRANCH'}
                          onChange={(e) => setFormData(prev => ({ ...prev, scopeType: e.target.value }))}
                          label="Scope Type"
                        >
                          <MenuItem value="BRANCH">Branch</MenuItem>
                          <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Scope Name"
                        value={formData.scopeId || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, scopeId: e.target.value }))}
                        error={!!formErrors.scopeId}
                        helperText={formErrors.scopeId}
                        required
                      />
                    </Grid>
                  </>
                ) : user?.role === 'WAREHOUSE_KEEPER' ? (
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Scope Assignment
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        Warehouse: {user?.warehouseName || 'Your Warehouse'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Company will be automatically assigned to your warehouse scope
                      </Typography>
                    </Box>
                  </Grid>
                ) : null}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      label="Status"
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="suspended">Suspended</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleFormClose}>Cancel</Button>
            <Button onClick={handleFormSubmit} variant="contained" disabled={loading || isSubmitting}>
              {isSubmitting ? <CircularProgress size={20} /> : (editingCompany ? 'Update' : 'Create')}
            </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onClose={handleDeleteClose}>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete company &quot;{companyToDelete?.name}&quot;? This action cannot be undone.
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
    </RouteGuard>
  )
}

export default CompaniesPage