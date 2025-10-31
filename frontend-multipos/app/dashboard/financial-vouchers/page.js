'use client'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'next/navigation'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Pagination,
  Stack,
  Autocomplete,
  Menu,
} from '@mui/material'
import {
  Add,
  Edit,
  Delete,
  CheckCircle,
  Cancel,
  Refresh,
  FilterList,
  Search,
  Receipt,
  AccountBalance,
  TrendingUp,
  TrendingDown,
  Visibility,
  GetApp,
  PictureAsPdf,
  Assessment,
  CalendarToday,
  CalendarMonth,
  Business,
  Store,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { format } from 'date-fns'
import { 
  fetchFinancialVouchers, 
  createFinancialVoucher, 
  updateFinancialVoucher, 
  approveFinancialVoucher, 
  rejectFinancialVoucher, 
  deleteFinancialVoucher,
  clearError,
  clearSuccess
} from '../../store/slices/financialVoucherSlice'
import api from '../../../utils/axios'

const FinancialVouchersPage = () => {
  const dispatch = useDispatch()
  const theme = useTheme()

  // Helper function to safely format dates
  const formatDate = (dateString, formatStr = 'dd/MM/yyyy') => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'N/A'
      return format(date, formatStr)
    } catch (error) {
      console.warn('Invalid date:', dateString, error)
      return 'N/A'
    }
  }

  // Fetch branches
  const fetchBranches = async () => {
    try {
      setLoadingBranches(true)
      const response = await api.get('/branches')
      setBranches(response.data.data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
      setBranches([])
    } finally {
      setLoadingBranches(false)
    }
  }

  // Fetch warehouses
  const fetchWarehouses = async () => {
    try {
      setLoadingWarehouses(true)
      const response = await api.get('/warehouses')
      setWarehouses(response.data.data || [])
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      setWarehouses([])
    } finally {
      setLoadingWarehouses(false)
    }
  }
  const searchParams = useSearchParams()
  const { user: originalUser } = useSelector((state) => state.auth)
  const { vouchers, isLoading, error, success, pagination } = useSelector((state) => state.financialVouchers)
  
  // URL-based role switching
  const urlParams = useMemo(() => {
    const role = searchParams.get('role')
    const scope = searchParams.get('scope')
    const id = searchParams.get('id')
    return { role, scope, id }
  }, [searchParams])

  // Get effective user based on URL parameters
  const getEffectiveUser = useCallback(() => {
    if (urlParams.role && urlParams.scope && urlParams.id) {
      return {
        ...originalUser,
        role: urlParams.role.toUpperCase(),
        scopeType: urlParams.scope.toUpperCase(),
        scopeId: urlParams.id,
        isSimulated: true
      }
    }
    return originalUser
  }, [originalUser, urlParams])

  const user = useMemo(() => getEffectiveUser(), [getEffectiveUser])
  
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    paymentMethod: '',
    scopeType: '',
    scopeId: '',
    status: '',
    search: '',
    dateFrom: null,
    dateTo: null,
    page: 1,
    limit: 25
  })

  const [formDialog, setFormDialog] = useState({
    open: false,
    mode: 'create', // 'create' or 'edit'
    voucher: null
  })

  const [actionDialog, setActionDialog] = useState({
    open: false,
    action: '', // 'approve', 'reject', 'delete'
    voucher: null,
    notes: '',
    rejectionReason: ''
  })

  const [formData, setFormData] = useState({
    type: '',
    category: '',
    paymentMethod: '',
    amount: '',
    description: '',
    reference: '',
    scopeType: '',
    scopeId: '',
    notes: ''
  })
  
  // State for branches and warehouses
  const [branches, setBranches] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)

  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Report filters and export states
  const [reportFilters, setReportFilters] = useState({
    type: 'all',
    date: null,
    month: null,
    year: null,
    scopeType: 'all',
    scopeId: 'all'
  })
  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    // Use role-based API call
    if (user.isSimulated && user.scopeType && user.scopeId) {
      // Admin simulating a role - use scope-based endpoint
      const scopeFilters = {
        ...filters,
        scopeType: user.scopeType,
        scopeId: user.scopeId
      }
      dispatch(fetchFinancialVouchers(scopeFilters))
    } else {
      // Regular user - use standard endpoint
      dispatch(fetchFinancialVouchers(filters))
    }
  }, [dispatch, filters, user])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        dispatch(clearSuccess())
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [success, dispatch])

  // Fetch branches and warehouses when form opens
  useEffect(() => {
    if (formDialog.open && user.role === 'ADMIN' && !user.isSimulated) {
      fetchBranches()
      fetchWarehouses()
    }
  }, [formDialog.open, user.role, user.isSimulated])

  // Fetch branches and warehouses for admin users on component load
  useEffect(() => {
    if (user.role === 'ADMIN' && !user.isSimulated) {
      fetchBranches()
      fetchWarehouses()
    }
  }, [user.role, user.isSimulated])

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError())
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, dispatch])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ 
      ...prev, 
      [field]: value,
      page: field !== 'page' ? 1 : value // Reset to page 1 when other filters change
    }))
  }

  const handleRefresh = () => {
    // Use role-based API call
    if (user.isSimulated && user.scopeType && user.scopeId) {
      // Admin simulating a role - use scope-based endpoint
      const scopeFilters = {
        ...filters,
        scopeType: user.scopeType,
        scopeId: user.scopeId
      }
      dispatch(fetchFinancialVouchers(scopeFilters))
    } else {
      // Regular user - use standard endpoint
      dispatch(fetchFinancialVouchers(filters))
    }
  }

  const handleCreateVoucher = () => {
    // Auto-fill scope fields based on user role
    let defaultScopeType = ''
    let defaultScopeId = ''
    
    if (user.isSimulated && user.scopeType && user.scopeId) {
      // Admin simulating a role
      defaultScopeType = user.scopeType
      defaultScopeId = user.scopeId
    } else if (user.role === 'CASHIER' && user.branchId) {
      // Cashier - use their branch
      defaultScopeType = 'BRANCH'
      defaultScopeId = String(user.branchId)
    } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
      // Warehouse keeper - use their warehouse
      defaultScopeType = 'WAREHOUSE'
      defaultScopeId = String(user.warehouseId)
    }
    
    setFormData({
      type: '',
      category: '',
      paymentMethod: '',
      amount: '',
      description: '',
      reference: '',
      scopeType: defaultScopeType,
      scopeId: defaultScopeId,
      notes: ''
    })
    setFormDialog({ open: true, mode: 'create', voucher: null })
  }

  const handleEditVoucher = (voucher) => {
    setFormData({
      type: voucher.type,
      category: voucher.category,
      paymentMethod: voucher.paymentMethod,
      amount: voucher.amount.toString(),
      description: voucher.description || '',
      reference: voucher.reference || '',
      scopeType: voucher.scopeType,
      scopeId: voucher.scopeId,
      notes: voucher.notes || ''
    })
    setFormDialog({ open: true, mode: 'edit', voucher })
  }

  const handleViewVoucher = (voucher) => {
    setFormData({
      type: voucher.type,
      category: voucher.category,
      paymentMethod: voucher.paymentMethod,
      amount: voucher.amount.toString(),
      description: voucher.description || '',
      reference: voucher.reference || '',
      scopeType: voucher.scopeType,
      scopeId: voucher.scopeId,
      notes: voucher.notes || ''
    })
    setFormDialog({ open: true, mode: 'view', voucher })
  }

  const handleAction = (action, voucher) => {
    setActionDialog({ open: true, action, voucher, notes: '', rejectionReason: '' })
  }

  const validateForm = () => {
    const errors = {}
    
    if (!formData.type) errors.type = 'Type is required'
    if (!formData.category) errors.category = 'Category is required'
    if (!formData.paymentMethod) errors.paymentMethod = 'Payment method is required'
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = 'Amount must be greater than 0'
    
    // Only validate scope fields for admins (cashiers and warehouse keepers have auto-filled scope)
    if (user.role === 'ADMIN' && !user.isSimulated) {
      if (!formData.scopeType) errors.scopeType = 'Scope type is required'
      if (!formData.scopeId) errors.scopeId = 'Scope ID is required'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmitForm = async () => {
    if (!validateForm()) return
    
    setIsSubmitting(true)
    try {
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount)
      }

      // Add role-based scope data
      if (user.isSimulated && user.scopeType && user.scopeId) {
        // Admin simulating a role - use simulated scope
        submitData.scopeType = user.scopeType
        submitData.scopeId = user.scopeId
      } else if (user.role === 'CASHIER' && user.branchId) {
        // Cashier - use their branch
        submitData.scopeType = 'BRANCH'
        submitData.scopeId = String(user.branchId)
      } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
        // Warehouse keeper - use their warehouse
        submitData.scopeType = 'WAREHOUSE'
        submitData.scopeId = String(user.warehouseId)
      }

      if (formDialog.mode === 'create') {
        await dispatch(createFinancialVoucher(submitData))
      } else {
        await dispatch(updateFinancialVoucher({ id: formDialog.voucher.id, ...submitData }))
      }

      setFormDialog({ open: false, mode: 'create', voucher: null })
      setFormErrors({})
      // Don't call handleRefresh() here as the slice will update the state automatically
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmAction = async () => {
    try {
      const { action, voucher, notes, rejectionReason } = actionDialog

      switch (action) {
        case 'approve':
          await dispatch(approveFinancialVoucher({ id: voucher.id, notes }))
          break
        case 'reject':
          await dispatch(rejectFinancialVoucher({ id: voucher.id, notes, rejectionReason }))
          break
        case 'delete':
          await dispatch(deleteFinancialVoucher(voucher.id))
          break
      }

      setActionDialog({ open: false, action: '', voucher: null, notes: '', rejectionReason: '' })
      // Don't call handleRefresh() here as the slice will update the state automatically
    } catch (error) {
      console.error('Error performing action:', error)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'success'
      case 'REJECTED': return 'error'
      case 'PENDING': return 'warning'
      default: return 'default'
    }
  }

  // Export functions
  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget)
  }

  const handleExportClose = () => {
    setExportAnchorEl(null)
  }

  const handleExport = async (exportFormat) => {
    setIsExporting(true)
    try {
      console.log('Starting export with format:', exportFormat)
      console.log('Report filters:', reportFilters)
      console.log('Available vouchers:', vouchers?.length || 0)
      
      // Filter vouchers based on report filters
      let filteredVouchers = vouchers || []

      // Apply report filters
      if (reportFilters.type === 'daily' && reportFilters.date) {
        const reportDate = format(reportFilters.date, 'yyyy-MM-dd')
        filteredVouchers = filteredVouchers.filter(voucher => 
          voucher.createdAt && voucher.createdAt.startsWith(reportDate)
        )
      } else if (reportFilters.type === 'monthly' && reportFilters.month && reportFilters.year) {
        filteredVouchers = filteredVouchers.filter(voucher => {
          if (!voucher.createdAt) return false
          const voucherDate = new Date(voucher.createdAt)
          return voucherDate.getMonth() + 1 === reportFilters.month && 
                 voucherDate.getFullYear() === reportFilters.year
        })
      } else if (reportFilters.type === 'branch' && reportFilters.scopeType === 'BRANCH' && reportFilters.scopeId !== 'all') {
        filteredVouchers = filteredVouchers.filter(voucher => 
          voucher.scopeType === 'BRANCH' && voucher.scopeId === reportFilters.scopeId
        )
      } else if (reportFilters.type === 'warehouse' && reportFilters.scopeType === 'WAREHOUSE' && reportFilters.scopeId !== 'all') {
        filteredVouchers = filteredVouchers.filter(voucher => 
          voucher.scopeType === 'WAREHOUSE' && voucher.scopeId === reportFilters.scopeId
        )
      }

      // Generate filename based on filters
      let filename = 'financial-vouchers'
      if (reportFilters.type === 'daily' && reportFilters.date) {
        filename += `-daily-${format(reportFilters.date, 'yyyy-MM-dd')}`
      } else if (reportFilters.type === 'monthly' && reportFilters.month && reportFilters.year) {
        filename += `-monthly-${reportFilters.year}-${reportFilters.month}`
      } else if (reportFilters.type === 'branch' && reportFilters.scopeId !== 'all') {
        filename += `-branch-${reportFilters.scopeId}`
      } else if (reportFilters.type === 'warehouse' && reportFilters.scopeId !== 'all') {
        filename += `-warehouse-${reportFilters.scopeId}`
      }
      filename += `-${format(new Date(), 'yyyy-MM-dd')}`

      console.log('Filtered vouchers count:', filteredVouchers.length)
      console.log('Generated filename:', filename)

      if (exportFormat === 'csv') {
        handleExportCSV(filteredVouchers, filename)
      } else if (exportFormat === 'excel') {
        handleExportExcel(filteredVouchers, filename)
      } else if (exportFormat === 'pdf') {
        handleExportPDF(filteredVouchers, filename)
      }
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
      handleExportClose()
    }
  }

  const handleExportCSV = (data, filename) => {
    try {
      console.log('Exporting CSV with', data.length, 'records')
      const csvContent = [
        ['Date', 'Voucher #', 'Type', 'Amount', 'Scope', 'Status', 'Created By', 'Description'].join(','),
        ...data.map(voucher => [
          formatDate(voucher.createdAt),
          voucher.voucherNo || 'N/A',
          voucher.type,
          voucher.amount,
          `${voucher.scopeType} - ${voucher.scopeId}`,
          voucher.status,
          voucher.userName || 'N/A',
          voucher.description || 'N/A'
        ].map(field => `"${field}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      console.log('CSV export completed')
    } catch (error) {
      console.error('CSV export error:', error)
    }
  }

  const handleExportExcel = (data, filename) => {
    try {
      console.log('Exporting Excel with', data.length, 'records')
      // For Excel export, we'll create a CSV with Excel-compatible format
      const csvContent = [
        ['Date', 'Voucher #', 'Type', 'Amount', 'Scope', 'Status', 'Created By', 'Description'].join('\t'),
        ...data.map(voucher => [
          formatDate(voucher.createdAt),
          voucher.voucherNo || 'N/A',
          voucher.type,
          voucher.amount,
          `${voucher.scopeType} - ${voucher.scopeId}`,
          voucher.status,
          voucher.userName || 'N/A',
          voucher.description || 'N/A'
        ].join('\t'))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.xls`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      console.log('Excel export completed')
    } catch (error) {
      console.error('Excel export error:', error)
    }
  }

  const handleExportPDF = (data, filename) => {
    try {
      console.log('Exporting PDF with', data.length, 'records')
      // Create a simple HTML table for PDF generation
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Financial Vouchers Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .header { text-align: center; margin-bottom: 20px; }
              .summary { margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Financial Vouchers Report</h1>
              <p>Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              <p>Total Records: ${data.length}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher #</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(voucher => `
                  <tr>
                    <td>${formatDate(voucher.createdAt)}</td>
                    <td>${voucher.voucherNo || 'N/A'}</td>
                    <td>${voucher.type}</td>
                    <td>${formatCurrency(voucher.amount)}</td>
                    <td>${voucher.scopeType} - ${voucher.scopeId}</td>
                    <td>${voucher.status}</td>
                    <td>${voucher.userName || 'N/A'}</td>
                    <td>${voucher.description || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `

      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      console.log('PDF export completed')
    } catch (error) {
      console.error('PDF export error:', error)
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'INCOME': return 'success'
      case 'EXPENSE': return 'error'
      case 'TRANSFER': return 'info'
      default: return 'default'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ py: 2 }}>
          {/* Header Section */}
          <Box 
            sx={{ 
              mb: 4,
              padding: 4,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography 
                  variant="h4" 
                  gutterBottom
                  sx={{ 
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  Financial Vouchers
                </Typography>
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    opacity: 0.8,
                    fontSize: '1.1rem'
                  }}
                >
                  Manage financial transactions, approvals, and accounting entries
                </Typography>
                {user.isSimulated && (
                  <Chip 
                    label={`Acting as ${user.role} - ${user.scopeType} ${user.scopeId}`}
                    color="info"
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                  sx={{ borderRadius: 2 }}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleCreateVoucher}
                  sx={{ borderRadius: 2 }}
                  disabled={user.role === 'CASHIER' && !user.branchId || user.role === 'WAREHOUSE_KEEPER' && !user.warehouseId}
                >
                  Create Voucher
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Reporting Section */}
          <Box sx={{ mb: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Reports & Downloads
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Report Filters */}
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Report Type</InputLabel>
                    <Select
                      value={reportFilters.type}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, type: e.target.value }))}
                      label="Report Type"
                    >
                      <MenuItem value="all">All Vouchers</MenuItem>
                      <MenuItem value="daily">Daily Report</MenuItem>
                      <MenuItem value="monthly">Monthly Report</MenuItem>
                      <MenuItem value="branch">Branch Wise</MenuItem>
                      <MenuItem value="warehouse">Warehouse Wise</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Date Filter for Daily/Monthly */}
                  {(reportFilters.type === 'daily' || reportFilters.type === 'monthly') && (
                    <>
                      {reportFilters.type === 'daily' && (
                        <DatePicker
                          label="Select Date"
                          value={reportFilters.date}
                          onChange={(newValue) => setReportFilters(prev => ({ ...prev, date: newValue }))}
                          renderInput={(params) => <TextField {...params} size="small" sx={{ width: 150 }} />}
                        />
                      )}
                      {reportFilters.type === 'monthly' && (
                        <>
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Month</InputLabel>
                            <Select
                              value={reportFilters.month || ''}
                              onChange={(e) => setReportFilters(prev => ({ ...prev, month: e.target.value }))}
                              label="Month"
                            >
                              {Array.from({ length: 12 }, (_, i) => (
                                <MenuItem key={i + 1} value={i + 1}>
                                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Year</InputLabel>
                            <Select
                              value={reportFilters.year || ''}
                              onChange={(e) => setReportFilters(prev => ({ ...prev, year: e.target.value }))}
                              label="Year"
                            >
                              {Array.from({ length: 5 }, (_, i) => {
                                const year = new Date().getFullYear() - i;
                                return <MenuItem key={year} value={year}>{year}</MenuItem>;
                              })}
                            </Select>
                          </FormControl>
                        </>
                      )}
                    </>
                  )}

                  {/* Scope Filter for Branch/Warehouse */}
                  {(reportFilters.type === 'branch' || reportFilters.type === 'warehouse') && (
                    <>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Scope Type</InputLabel>
                        <Select
                          value={reportFilters.scopeType}
                          onChange={(e) => setReportFilters(prev => ({ 
                            ...prev, 
                            scopeType: e.target.value,
                            scopeId: 'all'
                          }))}
                          label="Scope Type"
                        >
                          <MenuItem value="all">All Scopes</MenuItem>
                          <MenuItem value="BRANCH">Branch</MenuItem>
                          <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                        </Select>
                      </FormControl>
                      {reportFilters.scopeType !== 'all' && (
                        <Autocomplete
                          size="small"
                          sx={{ minWidth: 200 }}
                          options={reportFilters.scopeType === 'BRANCH' ? branches : warehouses}
                          getOptionLabel={(option) => option.name || option.id?.toString() || 'Unknown'}
                          value={reportFilters.scopeType === 'BRANCH' 
                            ? branches.find(branch => branch.id.toString() === reportFilters.scopeId) || null
                            : warehouses.find(warehouse => warehouse.id.toString() === reportFilters.scopeId) || null
                          }
                          onChange={(event, newValue) => {
                            setReportFilters(prev => ({ 
                              ...prev, 
                              scopeId: newValue ? newValue.id.toString() : 'all'
                            }))
                          }}
                          loading={reportFilters.scopeType === 'BRANCH' ? loadingBranches : loadingWarehouses}
                          filterOptions={(options, { inputValue }) => {
                            return options.filter(option => 
                              option.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
                              option.id?.toString().includes(inputValue)
                            )
                          }}
                          noOptionsText="No branches found"
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={`${reportFilters.scopeType} ID`}
                              placeholder={`Search ${reportFilters.scopeType.toLowerCase()}`}
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {reportFilters.scopeType === 'BRANCH' ? loadingBranches : loadingWarehouses ? (
                                      <CircularProgress color="inherit" size={20} />
                                    ) : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      )}
                    </>
                  )}

                  {/* Export Dropdown */}
                      <Button
                        variant="outlined"
                    startIcon={<GetApp />}
                    onClick={handleExportClick}
                    disabled={isExporting}
                        sx={{ borderRadius: 2 }}
                      >
                    {isExporting ? 'Exporting...' : 'Export'}
                      </Button>

                  {/* Refresh Button */}
                      <Button
                        variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => window.location.reload()}
                        sx={{ borderRadius: 2 }}
                      >
                    Refresh
                      </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Export Dropdown Menu */}
          <Menu
            anchorEl={exportAnchorEl}
            open={Boolean(exportAnchorEl)}
            onClose={handleExportClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <MenuItem onClick={() => handleExport('csv')}>
              <GetApp sx={{ mr: 1 }} />
              Export as CSV
            </MenuItem>
            <MenuItem onClick={() => handleExport('excel')}>
              <GetApp sx={{ mr: 1 }} />
              Export as Excel
            </MenuItem>
            <MenuItem onClick={() => handleExport('pdf')}>
              <GetApp sx={{ mr: 1 }} />
              Export as PDF
            </MenuItem>
          </Menu>

          {/* Filters Section */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FilterList sx={{ mr: 1, color: theme.palette.primary.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Filters
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setFilters({
                    type: '', category: '', paymentMethod: '', scopeType: '', scopeId: '',
                    status: '', search: '', dateFrom: null, dateTo: null, page: 1, limit: 25
                  })}
                  sx={{ 
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main,
                    '&:hover': {
                      borderColor: theme.palette.primary.dark,
                      backgroundColor: alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
                >
                  Clear All
                </Button>
              </Box>
              
              {/* Filter Chips Row */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {/* Type Filter */}
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  <Typography variant="body2" sx={{ mr: 1, fontWeight: 500, color: 'text.secondary' }}>
                    Type:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {['INCOME', 'EXPENSE', 'TRANSFER'].map((type) => (
                      <Chip
                        key={type}
                        label={type}
                        size="small"
                        variant={filters.type === type ? 'filled' : 'outlined'}
                        color={filters.type === type ? 'primary' : 'default'}
                        onClick={() => handleFilterChange('type', filters.type === type ? '' : type)}
                        sx={{ 
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          height: '28px',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.1)
                          }
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Status Filter */}
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  <Typography variant="body2" sx={{ mr: 1, fontWeight: 500, color: 'text.secondary' }}>
                    Status:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[
                      { value: 'PENDING', label: 'Pending', color: 'warning' },
                      { value: 'APPROVED', label: 'Approved', color: 'success' },
                      { value: 'REJECTED', label: 'Rejected', color: 'error' }
                    ].map((status) => (
                      <Chip
                        key={status.value}
                        label={status.label}
                        size="small"
                        variant={filters.status === status.value ? 'filled' : 'outlined'}
                        color={filters.status === status.value ? status.color : 'default'}
                        onClick={() => handleFilterChange('status', filters.status === status.value ? '' : status.value)}
                        sx={{ 
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          height: '28px',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette[status.color].main, 0.1)
                          }
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Payment Method Filter */}
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  <Typography variant="body2" sx={{ mr: 1, fontWeight: 500, color: 'text.secondary' }}>
                    Payment:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {['CASH', 'BANK', 'CARD', 'MOBILE'].map((method) => (
                      <Chip
                        key={method}
                        label={method}
                        size="small"
                        variant={filters.paymentMethod === method ? 'filled' : 'outlined'}
                        color={filters.paymentMethod === method ? 'secondary' : 'default'}
                        onClick={() => handleFilterChange('paymentMethod', filters.paymentMethod === method ? '' : method)}
                        sx={{ 
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          height: '28px',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.secondary.main, 0.1)
                          }
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* Search and Advanced Filters */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    placeholder="Search vouchers, descriptions, references..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'background.paper',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.02)
                        }
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={filters.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      label="Category"
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      <MenuItem value="SALES">Sales</MenuItem>
                      <MenuItem value="EXPENSE">Expense</MenuItem>
                      <MenuItem value="TRANSFER">Transfer</MenuItem>
                      <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
                      <MenuItem value="REFUND">Refund</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Scope Type</InputLabel>
                    <Select
                      value={filters.scopeType}
                      onChange={(e) => handleFilterChange('scopeType', e.target.value)}
                      label="Scope Type"
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="">All Scopes</MenuItem>
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Active Filters Display */}
              {(filters.type || filters.category || filters.paymentMethod || filters.status || filters.scopeType || filters.search) && (
                <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: 'text.secondary' }}>
                    Active Filters:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {filters.type && (
                      <Chip
                        label={`Type: ${filters.type}`}
                        size="small"
                        onDelete={() => handleFilterChange('type', '')}
                        color="primary"
                        variant="filled"
                      />
                    )}
                    {filters.category && (
                      <Chip
                        label={`Category: ${filters.category}`}
                        size="small"
                        onDelete={() => handleFilterChange('category', '')}
                        color="secondary"
                        variant="filled"
                      />
                    )}
                    {filters.paymentMethod && (
                      <Chip
                        label={`Payment: ${filters.paymentMethod}`}
                        size="small"
                        onDelete={() => handleFilterChange('paymentMethod', '')}
                        color="info"
                        variant="filled"
                      />
                    )}
                    {filters.status && (
                      <Chip
                        label={`Status: ${filters.status}`}
                        size="small"
                        onDelete={() => handleFilterChange('status', '')}
                        color={filters.status === 'APPROVED' ? 'success' : filters.status === 'REJECTED' ? 'error' : 'warning'}
                        variant="filled"
                      />
                    )}
                    {filters.scopeType && (
                      <Chip
                        label={`Scope: ${filters.scopeType}`}
                        size="small"
                        onDelete={() => handleFilterChange('scopeType', '')}
                        color="default"
                        variant="filled"
                      />
                    )}
                    {filters.search && (
                      <Chip
                        label={`Search: "${filters.search}"`}
                        size="small"
                        onDelete={() => handleFilterChange('search', '')}
                        color="default"
                        variant="filled"
                      />
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Success Alert */}
          {success && (
            <Alert 
              severity="success" 
              sx={{ mb: 3 }}
              onClose={() => dispatch(clearSuccess())}
            >
              {success}
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              onClose={() => dispatch(clearError())}
            >
              {error}
            </Alert>
          )}

          {/* Vouchers Table */}
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Voucher No</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Payment Method</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Scope</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created By</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : vouchers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography variant="body1" color="text.secondary">
                            No vouchers found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      vouchers.map((voucher) => (
                        <TableRow key={voucher.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {voucher.voucherNo || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={voucher.type}
                              color={getTypeColor(voucher.type)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{voucher.category}</TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: voucher.type === 'INCOME' ? 'success.main' : 'error.main'
                              }}
                            >
                              {formatCurrency(voucher.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>{voucher.paymentMethod || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip
                              label={voucher.status}
                              color={getStatusColor(voucher.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {voucher.scopeType && voucher.scopeId ? `${voucher.scopeType} - ${voucher.scopeId}` : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {voucher.userName || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {voucher.userRole || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(voucher.createdAt, 'MMM dd, yyyy')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(voucher.createdAt, 'HH:mm')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="View Details">
                                <IconButton 
                                  size="small"
                                  onClick={() => handleViewVoucher(voucher)}
                                >
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {voucher.status === 'PENDING' && (
                                <>
                                  {/* Edit button - only creator or admin */}
                                  {(user.role === 'ADMIN' || voucher.userId === user.id) && (
                                    <Tooltip title="Edit">
                                      <IconButton 
                                        size="small"
                                        onClick={() => handleEditVoucher(voucher)}
                                      >
                                        <Edit fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {/* Approve/Reject buttons - admin only */}
                                  {user.role === 'ADMIN' && (
                                    <>
                                      <Tooltip title="Approve">
                                        <IconButton 
                                          size="small"
                                          color="success"
                                          onClick={() => handleAction('approve', voucher)}
                                        >
                                          <CheckCircle fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Reject">
                                        <IconButton 
                                          size="small"
                                          color="error"
                                          onClick={() => handleAction('reject', voucher)}
                                        >
                                          <Cancel fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                </>
                              )}
                              {/* Delete button - admin only */}
                              {user.role === 'ADMIN' && (
                                <Tooltip title="Delete">
                                  <IconButton 
                                    size="small"
                                    color="error"
                                    onClick={() => handleAction('delete', voucher)}
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

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={pagination.pages}
                    page={filters.page}
                    onChange={(event, page) => handleFilterChange('page', page)}
                    color="primary"
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Create/Edit Voucher Dialog */}
          <Dialog 
            open={formDialog.open} 
            onClose={() => setFormDialog({ open: false, mode: 'create', voucher: null })}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {formDialog.mode === 'create' ? 'Create Financial Voucher' : 'Edit Financial Voucher'}
            </DialogTitle>
            <DialogContent sx={{ minWidth: 800 }}>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth required error={!!formErrors.type}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      label="Type"
                    >
                      <MenuItem value="INCOME">Income</MenuItem>
                      <MenuItem value="EXPENSE">Expense</MenuItem>
                      <MenuItem value="TRANSFER">Transfer</MenuItem>
                    </Select>
                    {formErrors.type && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                        {formErrors.type}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth required error={!!formErrors.category}>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      label="Category"
                    >
                      <MenuItem value="SALES">Sales</MenuItem>
                      <MenuItem value="EXPENSE">Expense</MenuItem>
                      <MenuItem value="TRANSFER">Transfer</MenuItem>
                      <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
                      <MenuItem value="REFUND">Refund</MenuItem>
                      <MenuItem value="RENT">Rent</MenuItem>
                      <MenuItem value="FARE">Fare</MenuItem>
                      <MenuItem value="UTILITY">Utility</MenuItem>
                    </Select>
                    {formErrors.category && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                        {formErrors.category}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth required>
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      label="Payment Method"
                    >
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="BANK">Bank</MenuItem>
                      <MenuItem value="MOBILE">Mobile</MenuItem>
                      <MenuItem value="CARD">Card</MenuItem>
                      <MenuItem value="CHEQUE">Cheque</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    required
                    label="Amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    inputProps={{ min: 0.01, step: 0.01 }}
                    error={!!formErrors.amount}
                    helperText={formErrors.amount}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth required error={!!formErrors.scopeType}>
                    <InputLabel>Scope Type</InputLabel>
                    <Select
                      value={formData.scopeType}
                      onChange={(e) => {
                        setFormData(prev => ({ 
                          ...prev, 
                          scopeType: e.target.value,
                          scopeId: '' // Clear scope ID when scope type changes
                        }))
                      }}
                      label="Scope Type"
                      disabled={user.role === 'CASHIER' || user.role === 'WAREHOUSE_KEEPER' || user.isSimulated}
                    >
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                    {formErrors.scopeType && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                        {formErrors.scopeType}
                      </Typography>
                    )}
                    {(user.role === 'CASHIER' || user.role === 'WAREHOUSE_KEEPER' || user.isSimulated) && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 2 }}>
                        Auto-filled based on your role
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  {user.role === 'ADMIN' && !user.isSimulated ? (
                    <Autocomplete
                      fullWidth
                      options={formData.scopeType === 'BRANCH' ? branches : warehouses}
                      getOptionLabel={(option) => option.name || option.id?.toString() || 'Unknown'}
                      value={formData.scopeType === 'BRANCH' 
                        ? branches.find(branch => branch.id.toString() === formData.scopeId) || null
                        : warehouses.find(warehouse => warehouse.id.toString() === formData.scopeId) || null
                      }
                      onChange={(event, newValue) => {
                        setFormData(prev => ({ 
                          ...prev, 
                          scopeId: newValue ? newValue.id.toString() : '' 
                        }))
                      }}
                      loading={formData.scopeType === 'BRANCH' ? loadingBranches : loadingWarehouses}
                      disabled={!formData.scopeType}
                      filterOptions={(options, { inputValue }) => {
                        return options.filter(option => 
                          option.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
                          option.id?.toString().includes(inputValue)
                        )
                      }}
                      noOptionsText={`No ${formData.scopeType?.toLowerCase() || 'items'} found`}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Scope ID"
                          required
                          error={!!formErrors.scopeId}
                          helperText={
                            formErrors.scopeId || 
                            (!formData.scopeType ? 'Please select scope type first' : 
                             `Search and select ${formData.scopeType.toLowerCase()}`)
                          }
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {formData.scopeType === 'BRANCH' ? loadingBranches : loadingWarehouses ? (
                                  <CircularProgress color="inherit" size={20} />
                                ) : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  ) : (
                  <TextField
                    fullWidth
                    required
                    label="Scope ID"
                    value={formData.scopeId}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeId: e.target.value }))}
                    placeholder="Enter branch or warehouse name"
                    error={!!formErrors.scopeId}
                    helperText={
                      formErrors.scopeId || 
                      ((user.role === 'CASHIER' || user.role === 'WAREHOUSE_KEEPER' || user.isSimulated) ? 
                        'Auto-filled based on your role' : 
                        'Enter branch or warehouse name')
                    }
                    disabled={user.role === 'CASHIER' || user.role === 'WAREHOUSE_KEEPER' || user.isSimulated}
                  />
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    label="Reference"
                    value={formData.reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Invoice number, receipt reference, etc."
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={() => {
                  setFormDialog({ open: false, mode: 'create', voucher: null })
                  setFormErrors({})
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitForm} 
                variant="contained"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
              >
                {isSubmitting ? 'Processing...' : (formDialog.mode === 'create' ? 'Create' : 'Update')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Action Confirmation Dialog */}
          <Dialog 
            open={actionDialog.open} 
            onClose={() => setActionDialog({ open: false, action: '', voucher: null, notes: '', rejectionReason: '' })}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {actionDialog.action === 'approve' && 'Approve Voucher'}
              {actionDialog.action === 'reject' && 'Reject Voucher'}
              {actionDialog.action === 'delete' && 'Delete Voucher'}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {actionDialog.action === 'approve' && 'Are you sure you want to approve this voucher?'}
                {actionDialog.action === 'reject' && 'Are you sure you want to reject this voucher?'}
                {actionDialog.action === 'delete' && 'Are you sure you want to delete this voucher? This action cannot be undone.'}
              </Typography>
              {actionDialog.voucher && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Voucher:</strong> {actionDialog.voucher.voucherNo}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Amount:</strong> {formatCurrency(actionDialog.voucher.amount)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Type:</strong> {actionDialog.voucher.type}
                  </Typography>
                </Box>
              )}
              {actionDialog.action === 'reject' && (
                <TextField
                  fullWidth
                  label="Rejection Reason *"
                  multiline
                  rows={2}
                  value={actionDialog.rejectionReason}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, rejectionReason: e.target.value }))}
                  sx={{ mt: 2 }}
                  required
                  error={!actionDialog.rejectionReason}
                  helperText={!actionDialog.rejectionReason ? 'Rejection reason is required' : ''}
                />
              )}
              {(actionDialog.action === 'reject' || actionDialog.action === 'delete') && (
                <TextField
                  fullWidth
                  label="Additional Notes"
                  multiline
                  rows={3}
                  value={actionDialog.notes}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, notes: e.target.value }))}
                  sx={{ mt: 2 }}
                />
              )}
              {actionDialog.action === 'approve' && (
                <TextField
                  fullWidth
                  label="Approval Notes"
                  multiline
                  rows={3}
                  value={actionDialog.notes}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, notes: e.target.value }))}
                  sx={{ mt: 2 }}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setActionDialog({ open: false, action: '', voucher: null, notes: '', rejectionReason: '' })}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmAction} 
                variant="contained"
                color={actionDialog.action === 'delete' ? 'error' : actionDialog.action === 'reject' ? 'warning' : 'success'}
                disabled={actionDialog.action === 'reject' && !actionDialog.rejectionReason}
              >
                {actionDialog.action === 'approve' && 'Approve'}
                {actionDialog.action === 'reject' && 'Reject'}
                {actionDialog.action === 'delete' && 'Delete'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Reports now handled by dedicated reports page */}
        </Box>
      </LocalizationProvider>
    </DashboardLayout>
  )
}

export default FinancialVouchersPage
