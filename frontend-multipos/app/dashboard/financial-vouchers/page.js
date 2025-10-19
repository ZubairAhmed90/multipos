'use client'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
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

const FinancialVouchersPage = () => {
  const dispatch = useDispatch()
  const theme = useTheme()
  const { user } = useSelector((state) => state.auth)
  const { vouchers, isLoading, error, success, pagination } = useSelector((state) => state.financialVouchers)
  
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
    notes: ''
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

  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    dispatch(fetchFinancialVouchers(filters))
  }, [dispatch, filters])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        dispatch(clearSuccess())
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [success, dispatch])

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
    dispatch(fetchFinancialVouchers(filters))
  }

  const handleCreateVoucher = () => {
    setFormData({
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

  const handleAction = (action, voucher) => {
    setActionDialog({ open: true, action, voucher, notes: '' })
  }

  const validateForm = () => {
    const errors = {}
    
    if (!formData.type) errors.type = 'Type is required'
    if (!formData.category) errors.category = 'Category is required'
    if (!formData.paymentMethod) errors.paymentMethod = 'Payment method is required'
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = 'Amount must be greater than 0'
    if (!formData.scopeType) errors.scopeType = 'Scope type is required'
    if (!formData.scopeId) errors.scopeId = 'Scope ID is required'
    
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
      const { action, voucher, notes } = actionDialog

      switch (action) {
        case 'approve':
          await dispatch(approveFinancialVoucher(voucher.id))
          break
        case 'reject':
          await dispatch(rejectFinancialVoucher({ id: voucher.id, notes }))
          break
        case 'delete':
          await dispatch(deleteFinancialVoucher(voucher.id))
          break
      }

      setActionDialog({ open: false, action: '', voucher: null, notes: '' })
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

  const getTypeColor = (type) => {
    switch (type) {
      case 'INCOME': return 'success'
      case 'EXPENSE': return 'error'
      case 'TRANSFER': return 'info'
      default: return 'default'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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
                >
                  Create Voucher
                </Button>
              </Box>
            </Box>
          </Box>

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
                              {voucher.voucherNo}
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
                          <TableCell>{voucher.paymentMethod}</TableCell>
                          <TableCell>
                            <Chip
                              label={voucher.status}
                              color={getStatusColor(voucher.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {voucher.scopeType} - {voucher.scopeId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {voucher.userName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {voucher.userRole}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {format(new Date(voucher.createdAt), 'MMM dd, yyyy')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(voucher.createdAt), 'HH:mm')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="View Details">
                                <IconButton size="small">
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {voucher.status === 'PENDING' && (
                                <>
                                  <Tooltip title="Edit">
                                    <IconButton 
                                      size="small"
                                      onClick={() => handleEditVoucher(voucher)}
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
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
                              <Tooltip title="Delete">
                                <IconButton 
                                  size="small"
                                  color="error"
                                  onClick={() => handleAction('delete', voucher)}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
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
            <DialogContent>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
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
                <Grid item xs={12} sm={6}>
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
                    </Select>
                    {formErrors.category && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                        {formErrors.category}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
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
                <Grid item xs={12} sm={6}>
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
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required error={!!formErrors.scopeType}>
                    <InputLabel>Scope Type</InputLabel>
                    <Select
                      value={formData.scopeType}
                      onChange={(e) => setFormData(prev => ({ ...prev, scopeType: e.target.value }))}
                      label="Scope Type"
                    >
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                    {formErrors.scopeType && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                        {formErrors.scopeType}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    label="Scope ID"
                    value={formData.scopeId}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeId: e.target.value }))}
                    placeholder="Enter branch or warehouse name"
                    error={!!formErrors.scopeId}
                    helperText={formErrors.scopeId}
                  />
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
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Reference"
                    value={formData.reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Invoice number, receipt reference, etc."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
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
            onClose={() => setActionDialog({ open: false, action: '', voucher: null, notes: '' })}
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
              {(actionDialog.action === 'reject' || actionDialog.action === 'delete') && (
                <TextField
                  fullWidth
                  label="Reason/Notes"
                  multiline
                  rows={3}
                  value={actionDialog.notes}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, notes: e.target.value }))}
                  sx={{ mt: 2 }}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setActionDialog({ open: false, action: '', voucher: null, notes: '' })}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmAction} 
                variant="contained"
                color={actionDialog.action === 'delete' ? 'error' : actionDialog.action === 'reject' ? 'warning' : 'success'}
              >
                {actionDialog.action === 'approve' && 'Approve'}
                {actionDialog.action === 'reject' && 'Reject'}
                {actionDialog.action === 'delete' && 'Delete'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </LocalizationProvider>
    </DashboardLayout>
  )
}

export default FinancialVouchersPage
