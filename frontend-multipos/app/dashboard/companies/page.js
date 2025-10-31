'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
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
  Menu,
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
  Download as DownloadIcon,
  Inventory as InventoryIcon,
  ShoppingCart,
  Paid,
  Today,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import { fetchCompanies, createCompany, updateCompany, deleteCompany, exportCompaniesReport } from '../../store/slices/companiesSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchBranchSettings } from '../../store/slices/branchesSlice'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const { user } = useSelector((state) => state.auth)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  const { branchSettings } = useSelector((state) => state.branches || { branchSettings: null })
  
  // Check permissions for warehouse keepers (like inventory management)
  const canManageCompanies = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseCompanyCRUD) ||
    (user?.role === 'CASHIER' && branchSettings?.allowCashierCustomers)
  
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
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null)

  const handleOpenExportMenu = (event) => {
    setExportMenuAnchor(event.currentTarget)
  }

  const handleCloseExportMenu = () => {
    setExportMenuAnchor(null)
  }

  const handleExport = async (format) => {
    try {
      handleCloseExportMenu()
      const params = {}

      if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        params.scopeType = 'WAREHOUSE'
        params.scopeId = user.warehouseId
      } else if (user?.role === 'CASHIER' && user?.branchId) {
        params.scopeType = 'BRANCH'
        params.scopeId = user.branchId
      }

      const result = await dispatch(exportCompaniesReport({ format, params })).unwrap()

      if (format === 'pdf') {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(result.data)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
        }, 250)
        return
      }

      const dataset = result?.data || result
      const rows = dataset?.rows || []
      const summaryData = dataset?.summary || {}

      const normalizedRows = rows.map(row => ({
        'Company Name': row.name || '',
        'Code': row.code || '',
        'Contact Person': row.contactPerson || '',
        'Phone': row.phone || '',
        'Email': row.email || '',
        'Status': row.status || '',
        'Transaction Type': row.transactionType || '',
        'Scope': row.scopeType ? `${row.scopeType} - ${row.scopeId}` : '',
        'Purchase Orders': Number(row.metrics?.purchaseOrderCount || 0),
        'Total Purchase Amount': Number(row.metrics?.totalPurchaseAmount || 0),
        'Products Purchased': Number(row.metrics?.totalQuantityOrdered || 0),
        'Inventory Items': Number(row.metrics?.inventoryItemCount || 0),
        'Last Purchase Date': row.metrics?.lastPurchaseDate ? new Date(row.metrics.lastPurchaseDate).toLocaleDateString() : ''
      }))

      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(normalizedRows)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Companies')

      const summarySheet = XLSX.utils.json_to_sheet([
        { Metric: 'Total Companies', Value: summaryData.totalCompanies ?? normalizedRows.length },
        { Metric: 'Total Purchase Orders', Value: summaryData.totalPurchaseOrders ?? 0 },
        { Metric: 'Total Purchase Amount', Value: summaryData.totalPurchaseAmount ?? 0 },
        { Metric: 'Total Products Purchased', Value: summaryData.totalProductsPurchased ?? 0 },
        { Metric: 'Total Inventory Items', Value: summaryData.totalInventoryItems ?? 0 },
        { Metric: 'Last Purchase Date', Value: summaryData.lastPurchaseDate ? new Date(summaryData.lastPurchaseDate).toLocaleDateString() : '—' }
      ])
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      if (format === 'excel') {
        XLSX.writeFile(workbook, `company-summary-${Date.now()}.xlsx`)
      } else if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(worksheet)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `company-summary-${Date.now()}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(downloadUrl)
      }
    } catch (error) {
      console.error('Error exporting companies:', error)
      alert(error?.message || 'Failed to export companies')
    }
  }

  // Get companies data from Redux store
  const {
    data: companies,
    loading,
    error,
    summary: companySummary,
    exportLoading
  } = useSelector((state) => state.companies || { data: [], loading: false, error: null, summary: null, exportLoading: false })

  // Load data on component mount
  useEffect(() => {
    const params = {}

    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId = user.warehouseId
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = user.branchId
    }

    dispatch(fetchCompanies(params))
    
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }

    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }, [dispatch, user?.role, user?.warehouseId, user?.branchId])

  // Filter companies based on current filters and user role
  const filteredCompanies = useMemo(() => {
    if (!Array.isArray(companies)) {
      return []
    }

    return companies.filter(company => {
      const matchesSearch = !filters.search || 
        company.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        company.code?.toLowerCase().includes(filters.search.toLowerCase()) ||
        company.contactPerson?.toLowerCase().includes(filters.search.toLowerCase())
      
      const matchesScopeType = filters.scopeType === 'all' || company.scopeType === filters.scopeType
      const matchesTransactionType = filters.transactionType === 'all' || company.transactionType === filters.transactionType
      
      const matchesRoleScope = user?.role === 'ADMIN' || 
        (user?.role === 'WAREHOUSE_KEEPER' && 
         company.scopeType === 'WAREHOUSE' && 
         String(company.scopeId) === String(user?.warehouseId)) ||
        (user?.role === 'CASHIER' && 
         company.scopeType === 'BRANCH' && 
         String(company.scopeId) === String(user?.branchId))
      
      return matchesSearch && matchesScopeType && matchesTransactionType && matchesRoleScope
    })
  }, [companies, filters, user?.role, user?.warehouseId, user?.branchId])

  const aggregateMetrics = useMemo(() => {
    if (filteredCompanies.length === 0 && companySummary) {
      return {
        totalPurchaseOrders: companySummary.totalPurchaseOrders || 0,
        totalPurchaseAmount: companySummary.totalPurchaseAmount || 0,
        totalProductsPurchased: companySummary.totalProductsPurchased || 0,
        totalInventoryItems: companySummary.totalInventoryItems || 0,
        lastPurchaseDate: companySummary.lastPurchaseDate || null
      }
    }

    return filteredCompanies.reduce((acc, company) => {
      const metrics = company.metrics || {}
      acc.totalPurchaseOrders += Number(metrics.purchaseOrderCount || 0)
      acc.totalPurchaseAmount += Number(metrics.totalPurchaseAmount || 0)
      acc.totalProductsPurchased += Number(metrics.totalQuantityOrdered || 0)
      acc.totalInventoryItems += Number(metrics.inventoryItemCount || 0)

      if (!acc.lastPurchaseDate || (metrics.lastPurchaseDate && metrics.lastPurchaseDate > acc.lastPurchaseDate)) {
        acc.lastPurchaseDate = metrics.lastPurchaseDate
      }

      return acc
    }, {
      totalPurchaseOrders: 0,
      totalPurchaseAmount: 0,
      totalProductsPurchased: 0,
      totalInventoryItems: 0,
      lastPurchaseDate: null
    })
  }, [filteredCompanies, companySummary])

  const formatNumber = (value) => Number(value || 0).toLocaleString()
  const formatCurrency = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Get company statistics
  const getCompanyStats = (sourceCompanies) => {
    if (!sourceCompanies || !Array.isArray(sourceCompanies)) {
      return { total: 0, active: 0, inactive: 0, warehouse: 0, branch: 0 }
    }
    
    const total = sourceCompanies.length
    const active = sourceCompanies.filter(c => c.status === 'active').length
    const inactive = sourceCompanies.filter(c => c.status === 'inactive' || c.status === 'suspended').length
    const warehouse = sourceCompanies.filter(c => c.scopeType === 'WAREHOUSE').length
    const branch = sourceCompanies.filter(c => c.scopeType === 'BRANCH').length

    return { total, active, inactive, warehouse, branch }
  }

  const stats = getCompanyStats(filteredCompanies)

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
    const params = {}
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId = user.warehouseId
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = user.branchId
    }
    dispatch(fetchCompanies(params))
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
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
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleOpenExportMenu}
                disabled={exportLoading}
              >
                {exportLoading ? 'Exporting…' : 'Export'}
              </Button>
              {canManageCompanies && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleCreate}
                >
                  Add Company
                </Button>
              )}
            </Box>
        </Box>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={handleCloseExportMenu}
          >
            <MenuItem onClick={() => handleExport('pdf')}>
              PDF
            </MenuItem>
            <MenuItem onClick={() => handleExport('excel')}>
              Excel
            </MenuItem>
            <MenuItem onClick={() => handleExport('csv')}>
              CSV
            </MenuItem>
          </Menu>

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

        {user?.role === 'CASHIER' && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Cashier Access:</strong> You can view companies assigned to your branch (ID: {user?.branchId}). Contact your administrator if you need changes.
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
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="h6">
                        Total Purchase Amount
                      </Typography>
                      <Typography variant="h4">
                        {`$${formatCurrency(aggregateMetrics.totalPurchaseAmount)}`}
                      </Typography>
                    </Box>
                    <Paid sx={{ fontSize: 40, color: 'primary.main' }} />
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
                        Products Purchased
                      </Typography>
                      <Typography variant="h4" color="secondary.main">
                        {formatNumber(aggregateMetrics.totalProductsPurchased)}
                      </Typography>
                    </Box>
                    <ShoppingCart sx={{ fontSize: 40, color: 'secondary.main' }} />
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
                        Inventory Items Linked
                      </Typography>
                      <Typography variant="h4" color="info.main">
                        {formatNumber(aggregateMetrics.totalInventoryItems)}
                      </Typography>
                    </Box>
                    <InventoryIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                        Last Purchase Date
                      </Typography>
                      <Typography variant="h5">
                        {aggregateMetrics.lastPurchaseDate ? new Date(aggregateMetrics.lastPurchaseDate).toLocaleDateString() : '—'}
                      </Typography>
                    </Box>
                    <Today sx={{ fontSize: 40, color: 'warning.main' }} />
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
                        <TableCell>Purchase Orders</TableCell>
                        <TableCell>Total Purchases</TableCell>
                        <TableCell>Products Purchased</TableCell>
                        <TableCell>Inventory Items</TableCell>
                        <TableCell>Last Purchase</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCompanies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
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
                                <Typography variant="body2" sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                              <Typography variant="body2" fontWeight="bold">
                                {company.createdByUsername || company.created_by_username || '—'}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {company.createdAt || company.created_at ? new Date(company.createdAt || company.created_at).toLocaleDateString() : ''}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {formatNumber(company.metrics?.purchaseOrderCount || 0)}
                            </TableCell>
                            <TableCell>
                              {`$${formatCurrency(company.metrics?.totalPurchaseAmount || 0)}`}
                            </TableCell>
                            <TableCell>
                              {formatNumber(company.metrics?.totalQuantityOrdered || 0)}
                            </TableCell>
                            <TableCell>
                              {formatNumber(company.metrics?.inventoryItemCount || 0)}
                            </TableCell>
                            <TableCell>
                              {company.metrics?.lastPurchaseDate ? new Date(company.metrics.lastPurchaseDate).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    onClick={() => router.push(`/dashboard/companies/${company.id}`)}
                                    color="primary"
                                  >
                                    <ViewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {canManageCompanies && (
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleEdit(company)}
                                      color="primary"
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {canManageCompanies && canDeleteCompanies && (
                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDelete(company)}
                                      color="error"
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
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