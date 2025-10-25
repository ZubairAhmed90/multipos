'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../../utils/axios'
import { fetchSales } from '../../../store/slices/salesSlice'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  InputAdornment,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material'
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  CreditCard as CreditIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  CreditCard as CreditCardIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'

function SalesLedger() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const { user: originalUser } = useSelector((state) => state.auth)
  
  // URL-based role switching (same as POS terminal)
  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)
  
  // Parse URL parameters for role simulation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const role = params.get('role')
      const scope = params.get('scope')
      const id = params.get('id')
      
      if (role && scope && id && originalUser?.role === 'ADMIN') {
        setUrlParams({ role, scope, id })
        setIsAdminMode(true)
      } else {
        setUrlParams({})
        setIsAdminMode(false)
      }
    }
  }, [originalUser])
  
  // Get effective user based on URL parameters
  const getEffectiveUser = useCallback((originalUser) => {
    if (!isAdminMode || !urlParams.role) {
      return originalUser
    }
    
    return {
      ...originalUser,
      role: urlParams.role.toUpperCase(),
      branchId: urlParams.scope === 'branch' ? parseInt(urlParams.id) : null,
      warehouseId: urlParams.scope === 'warehouse' ? parseInt(urlParams.id) : null,
      branchName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : null,
      warehouseName: urlParams.scope === 'warehouse' ? `Warehouse ${urlParams.id}` : null,
      isAdminMode: true,
      originalRole: originalUser.role,
      originalUser: originalUser
    }
  }, [isAdminMode, urlParams])
  
  // Get scope info
  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.role) {
      return null
    }
    
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`
    }
  }, [isAdminMode, urlParams])
  
  const user = getEffectiveUser(originalUser)
  const scopeInfo = getScopeInfo()
  const { data: sales, loading, error } = useSelector((state) => state.sales)
  
  // State for filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [creditStatusFilter, setCreditStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedSale, setSelectedSale] = useState(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingSale, setEditingSale] = useState(null)
  const [deletingSale, setDeletingSale] = useState(null)
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    customerPhone: '',
    paymentMethod: '',
    paymentStatus: '',
    notes: ''
  })
  const [paymentAmount, setPaymentAmount] = useState('')
  
  // Branch settings for permissions
  const [branchSettings, setBranchSettings] = useState({
    allowCashierSalesEdit: false,
    allowCashierSalesDelete: false
  })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Load sales data
  useEffect(() => {
    // For cashiers, only load sales from their branch
    const params = {}
    if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = user.branchId
    }
    // For admins, load all sales (no scope restrictions)
    
    dispatch(fetchSales(params))
  }, [dispatch, user])

  // Load branch settings for permissions
  useEffect(() => {
    const loadBranchSettings = async () => {
      if (user?.role === 'CASHIER' && user?.branchId) {
        try {
          const response = await api.get(`/branches/${user.branchId}/settings`)
          setBranchSettings(response.data.data.settings || {
            allowCashierSalesEdit: false,
            allowCashierSalesDelete: false
          })
        } catch (error) {
          // Set default permissions if API fails
          setBranchSettings({
            allowCashierSalesEdit: false,
            allowCashierSalesDelete: false
          })
        }
      } else if (user?.role === 'ADMIN') {
        // For admins, also load branch settings to respect toggle settings
        try {
          const response = await api.get(`/branches/${user.branchId}/settings`)
          setBranchSettings(response.data.data.settings || {
            allowCashierSalesEdit: false,
            allowCashierSalesDelete: false
          })
        } catch (error) {
          // Set default permissions if API fails
          setBranchSettings({
            allowCashierSalesEdit: false,
            allowCashierSalesDelete: false
          })
        }
      }
    }

    loadBranchSettings()
  }, [user])

  // Filter sales based on search and filters
  const filteredSales = sales?.filter(sale => {
    const matchesSearch = !searchTerm || 
      sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer_phone?.includes(searchTerm) ||
      sale.invoice_no?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesPaymentStatus = paymentStatusFilter === 'all' || sale.payment_status === paymentStatusFilter
    const matchesCreditStatus = creditStatusFilter === 'all' || sale.credit_status === creditStatusFilter
    
    const matchesDate = !dateFilter || 
      new Date(sale.created_at).toDateString() === new Date(dateFilter).toDateString()
    
    return matchesSearch && matchesPaymentStatus && matchesCreditStatus && matchesDate
  }) || []

  // Pagination calculations
  const totalPages = Math.ceil(filteredSales.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedSales = filteredSales.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, paymentStatusFilter, creditStatusFilter, dateFilter])

  // Calculate summary statistics
  const totalSales = filteredSales.length
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0)
  const totalPaid = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.payment_amount || 0), 0)
  const totalCredit = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.credit_amount || 0), 0)
  const pendingCredits = filteredSales.filter(sale => sale.credit_status === 'PENDING').length

  const handleViewDetails = (sale) => {
    setSelectedSale(sale)
    setShowDetailsDialog(true)
  }

  const handleMakePayment = (sale) => {
    setSelectedSale(sale)
    setPaymentAmount(sale.credit_amount || '0')
    setShowPaymentDialog(true)
  }

  const handleProcessPayment = async () => {
    // TODO: Implement payment processing
    setShowPaymentDialog(false)
    // Refresh sales data with scope parameters
    const params = {}
    if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = user.branchId
    }
    dispatch(fetchSales(params))
  }

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setCurrentPage(newPage + 1)
  }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setCurrentPage(1)
  }

  const handleFirstPage = () => {
    setCurrentPage(1)
  }

  const handleLastPage = () => {
    setCurrentPage(totalPages)
  }

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }

  const getPaymentStatusChip = (status) => {
    const statusConfig = {
      'COMPLETED': { color: 'success', icon: <CheckIcon />, label: 'Completed' },
      'PARTIAL': { color: 'warning', icon: <PendingIcon />, label: 'Partial Payment' },
      'PENDING': { color: 'error', icon: <PendingIcon />, label: 'Pending' },
      'FAILED': { color: 'error', icon: <CancelIcon />, label: 'Failed' },
      'REFUNDED': { color: 'info', icon: <CancelIcon />, label: 'Refunded' },
      'CANCELLED': { color: 'error', icon: <CancelIcon />, label: 'Cancelled' }
    }
    
    const config = statusConfig[status] || statusConfig['PENDING']
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    )
  }

  const getCreditStatusChip = (status) => {
    const statusConfig = {
      'NONE': { color: 'default', icon: <CheckIcon />, label: 'No Credit' },
      'PENDING': { color: 'warning', icon: <PendingIcon />, label: 'Pending' },
      'PAID': { color: 'success', icon: <CheckIcon />, label: 'Paid' },
      'OVERDUE': { color: 'error', icon: <CancelIcon />, label: 'Overdue' }
    }
    
    const config = statusConfig[status] || statusConfig['NONE']
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    )
  }

  const getPaymentMethodChip = (method) => {
    // Remove any dollar signs that might be present in the method
    const cleanMethod = method ? method.replace(/\$/g, '') : method;
    
    const methodConfig = {
      'CASH': { color: 'success', icon: <MoneyIcon />, label: 'Cash' },
      'CARD': { color: 'primary', icon: <CreditIcon />, label: 'Card' },
      'BANK_TRANSFER': { color: 'info', icon: <PaymentIcon />, label: 'Bank Transfer' },
      'MOBILE_PAYMENT': { color: 'secondary', icon: <PaymentIcon />, label: 'Mobile Payment' },
      'CHEQUE': { color: 'warning', icon: <ReceiptIcon />, label: 'Cheque' },
      'MOBILE_MONEY': { color: 'secondary', icon: <PaymentIcon />, label: 'Mobile Money' }
    }
    
    const config = methodConfig[cleanMethod] || { color: 'default', icon: <PaymentIcon />, label: cleanMethod || 'N/A' }
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    )
  }

  const getPaymentTypeChip = (type) => {
    const typeConfig = {
      'FULL_PAYMENT': { color: 'success', icon: <CheckCircleIcon />, label: 'Full Payment' },
      'PARTIAL_PAYMENT': { color: 'warning', icon: <ScheduleIcon />, label: 'Partial Payment' },
      'FULLY_CREDIT': { color: 'error', icon: <CreditCardIcon />, label: 'Fully Credit' },
      'CASH': { color: 'success', icon: <MoneyIcon />, label: 'Cash' },
      'CARD': { color: 'primary', icon: <CreditIcon />, label: 'Card' },
      'BANK_TRANSFER': { color: 'info', icon: <PaymentIcon />, label: 'Bank Transfer' },
      'CHEQUE': { color: 'warning', icon: <ReceiptIcon />, label: 'Cheque' }
    }
    
    const config = typeConfig[type] || { color: 'default', icon: <PaymentIcon />, label: type || 'N/A' }
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    )
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
    // error may be an object { message, status, serverMsg } from the thunk
    const errMsg = typeof error === 'string' ? error : (error.message || 'Failed to load sales data')
    const status = error?.status
    const serverMsg = error?.serverMsg

    return (
      <DashboardLayout>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" color="error">
            Error loading sales data: {status ? `${status} — ` : ''}{errMsg}
          </Typography>
          {serverMsg && (
            <Typography variant="body2" color="textSecondary">Server: {String(serverMsg)}</Typography>
          )}
        </Box>
      </DashboardLayout>
    )
  }

  // Handle edit sale
  const handleEditSale = (sale) => {
    setEditingSale(sale)
    setEditFormData({
      customerName: sale.customer_name || '',
      customerPhone: sale.customer_phone || '',
      paymentMethod: sale.payment_method || '',
      paymentStatus: sale.payment_status || '',
      notes: sale.notes || ''
    })
    setShowEditDialog(true)
  }

  // Handle delete sale
  const handleDeleteSale = (sale) => {
    setDeletingSale(sale)
    setShowDeleteDialog(true)
  }

  // Confirm edit sale
  const handleConfirmEdit = async () => {
    try {
      await dispatch(updateSale({ 
        id: editingSale.id, 
        data: editFormData 
      })).unwrap()
      
      setShowEditDialog(false)
      setEditingSale(null)
      
      // Refresh sales data
      const params = {}
      if (user?.role === 'CASHIER' && user?.branchId) {
        params.scopeType = 'BRANCH'
        params.scopeId = user.branchId
      }
      dispatch(fetchSales(params))
      
      alert('Sale updated successfully!')
    } catch (error) {
      alert(`Error updating sale: ${error}`)
    }
  }

  // Confirm delete sale
  const handleConfirmDelete = async () => {
    try {
      await dispatch(deleteSale(deletingSale.id)).unwrap()
      
      setShowDeleteDialog(false)
      setDeletingSale(null)
      
      // Refresh sales data
      const params = {}
      if (user?.role === 'CASHIER' && user?.branchId) {
        params.scopeType = 'BRANCH'
        params.scopeId = user.branchId
      }
      dispatch(fetchSales(params))
      
      
    } catch (error) {
      alert(`Error deleting sale: ${error}`)
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
      <DashboardLayout>
        {/* Admin Mode Indicator */}
        {isAdminMode && scopeInfo && (
          <Box sx={{ 
            bgcolor: 'warning.light', 
            color: 'warning.contrastText', 
            p: 1, 
            textAlign: 'center',
            borderBottom: 1,
            borderColor: 'warning.main',
            mb: 2
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              Sales Ledger Management
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {user?.role === 'CASHIER' 
                ? `Manage sales, payments, and credit accounts for Branch ${user?.branchId || 'N/A'}`
                : 'Manage sales, payments, and credit accounts across all branches'
              }
            </Typography>
          </Box>

          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ReceiptIcon sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {totalSales}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Sales
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <MoneyIcon sx={{ color: 'success.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {totalRevenue.toFixed(2)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Revenue
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PaymentIcon sx={{ color: 'success.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {totalPaid.toFixed(2)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Paid
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CreditIcon sx={{ color: 'warning.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {totalCredit.toFixed(2)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Credit ({pendingCredits} pending)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search by customer name, phone, or invoice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ fontWeight: 500 }}
                />
              </Grid>
              
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  select
                  label="Payment Status"
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  sx={{ fontWeight: 500 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="PARTIAL">Partial</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                </TextField>
              </Grid>
              
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  select
                  label="Credit Status"
                  value={creditStatusFilter}
                  onChange={(e) => setCreditStatusFilter(e.target.value)}
                  sx={{ fontWeight: 500 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="NONE">No Credit</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="PAID">Paid</MenuItem>
                </TextField>
              </Grid>
              
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ fontWeight: 500 }}
                />
              </Grid>
              
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    const params = {}
                    if (user?.role === 'CASHIER' && user?.branchId) {
                      params.scopeType = 'BRANCH'
                      params.scopeId = user.branchId
                    }
                    dispatch(fetchSales(params))
                  }}
                  sx={{ fontWeight: 500 }}
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Sales Table */}
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Invoice</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Paid</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Credit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Payment Method</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Payment Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Payment Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Credit Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedSales.map((sale) => (
                    <TableRow key={sale.id} hover>
                      <TableCell>
                        {sale.invoice_no}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PersonIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          {sale.customer_name || 'Walk-in Customer'}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PhoneIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          {sale.customer_phone || 'N/A'}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        {parseFloat(sale.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ color: 'success.main' }}>
                        {parseFloat(sale.payment_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ color: 'warning.main' }}>
                        {parseFloat(sale.credit_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getPaymentMethodChip(sale.payment_method)}
                      </TableCell>
                      <TableCell>
                        {getPaymentTypeChip(sale.payment_type)}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusChip(sale.payment_status)}
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            maxWidth: '150px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={sale.notes || 'No Notes'}
                        >
                          {sale.notes ? (sale.notes.length > 30 ? sale.notes.substring(0, 30) + '...' : sale.notes) : 'No Notes'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {getCreditStatusChip(sale.credit_status)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CalendarIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          {new Date(sale.created_at).toLocaleDateString()}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(sale)}
                              sx={{ color: 'primary.main' }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {sale.credit_status === 'PENDING' && (
                            <Tooltip title="Make Payment">
                              <IconButton
                                size="small"
                                onClick={() => handleMakePayment(sale)}
                                sx={{ color: 'success.main' }}
                              >
                                <PaymentIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {(branchSettings.allowCashierSalesEdit && (user?.role === 'ADMIN' || (user?.role === 'CASHIER' && sale.user_id === user?.id))) && (
                            <>
                              <Tooltip title="Edit Sale">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditSale(sale)}
                                  sx={{ color: 'warning.main' }}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              
                              {branchSettings.allowCashierSalesDelete && (
                                <Tooltip title="Delete Sale">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteSale(sale)}
                                    sx={{ color: 'error.main' }}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Pagination Controls */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              backgroundColor: 'background.paper'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Rows per page:
                </Typography>
                <TextField
                  select
                  size="small"
                  value={rowsPerPage}
                  onChange={handleChangeRowsPerPage}
                  sx={{ 
                    minWidth: 80
                  }}
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </TextField>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {startIndex + 1}-{Math.min(endIndex, filteredSales.length)} of {filteredSales.length}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title="First page">
                    <IconButton
                      onClick={handleFirstPage}
                      disabled={currentPage === 1}
                      size="small"
                    >
                      <FirstPageIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Previous page">
                    <IconButton
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      size="small"
                    >
                      <ChevronLeftIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Typography variant="body2" sx={{ 
                    mx: 2,
                    minWidth: 60,
                    textAlign: 'center'
                  }}>
                    Page {currentPage} of {totalPages}
                  </Typography>
                  
                  <Tooltip title="Next page">
                    <IconButton
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      size="small"
                    >
                      <ChevronRightIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Last page">
                    <IconButton
                      onClick={handleLastPage}
                      disabled={currentPage === totalPages}
                      size="small"
                    >
                      <LastPageIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Sale Details Dialog */}
          <Dialog open={showDetailsDialog} onClose={() => setShowDetailsDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              Sale Details - {selectedSale?.invoice_no}
            </DialogTitle>
            <DialogContent>
              {selectedSale && (
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Customer Information
                      </Typography>
                      <Typography>
                        Name: {selectedSale.customer_name || 'Walk-in Customer'}
                      </Typography>
                      <Typography>
                        Phone: {selectedSale.customer_phone || 'N/A'}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Payment Information
                      </Typography>
                      <Typography>
                        Subtotal: ${parseFloat(selectedSale.subtotal || 0).toFixed(2)}
                      </Typography>
                      <Typography>
                        Tax: ${parseFloat(selectedSale.tax || 0).toFixed(2)}
                      </Typography>
                      {parseFloat(selectedSale.discount || 0) > 0 && (
                        <Typography color="error.main" sx={{ fontWeight: 'bold' }}>
                          Total Discount: -${parseFloat(selectedSale.discount || 0).toFixed(2)}
                        </Typography>
                      )}
                      <Typography sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        Total: ${parseFloat(selectedSale.total || 0).toFixed(2)}
                      </Typography>
                      <Typography>
                        Paid: ${parseFloat(selectedSale.payment_amount || 0).toFixed(2)}
                      </Typography>
                      <Typography>
                        Credit: ${parseFloat(selectedSale.credit_amount || 0).toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  {/* Sale Items */}
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Sale Items
                  </Typography>
                  {selectedSale.items && selectedSale.items.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="right">Quantity</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="right">Unit Price</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="right">Discount</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="right">Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedSale.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.itemName || item.name || 'Unknown Item'}</TableCell>
                              <TableCell>{item.sku || 'N/A'}</TableCell>
                              <TableCell align="right">{item.quantity}</TableCell>
                              <TableCell align="right">${parseFloat(item.unitPrice || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">
                                {parseFloat(item.discount || 0) > 0 ? (
                                  <Typography variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>
                                    -${parseFloat(item.discount || 0).toFixed(2)}
                                  </Typography>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    $0.00
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">${parseFloat(item.total || 0).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No items found for this sale
                    </Typography>
                  )}
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Notes
                  </Typography>
                  <Typography>
                    {selectedSale.notes || 'No notes'}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>

          {/* Payment Dialog */}
          <Dialog open={showPaymentDialog} onClose={() => setShowPaymentDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 500 }}>
              Process Payment - {selectedSale?.invoice_no}
            </DialogTitle>
            <DialogContent>
              {selectedSale && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                    Outstanding Credit: {parseFloat(selectedSale.credit_amount || 0).toFixed(2)}
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Payment Amount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    inputProps={{ min: 0, max: selectedSale.credit_amount, step: 0.01 }}
                    sx={{ fontWeight: 500 }}
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowPaymentDialog(false)} sx={{ fontWeight: 500 }}>
                Cancel
              </Button>
              <Button 
                onClick={handleProcessPayment} 
                variant="contained"
                sx={{ fontWeight: 500 }}
              >
                Process Payment
              </Button>
            </DialogActions>
          </Dialog>

          {/* Edit Sale Dialog */}
          <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 500 }}>
              Edit Sale - {editingSale?.invoice_no}
            </DialogTitle>
            <DialogContent>
              {editingSale && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    label="Customer Name"
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Customer Phone"
                    value={editFormData.customerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    select
                    label="Payment Method"
                    value={editFormData.paymentMethod}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                    sx={{ mb: 2 }}
                  >
                    <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="CARD">Card</MenuItem>
                    <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                    <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
                  </TextField>
                  
                  <TextField
                    fullWidth
                    select
                    label="Payment Status"
                    value={editFormData.paymentStatus}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentStatus: e.target.value })}
                    sx={{ mb: 2 }}
                  >
                    <MenuItem value="COMPLETED">Completed</MenuItem>
                    <MenuItem value="PARTIAL">Partial</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                  </TextField>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Notes"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    sx={{ fontWeight: 500 }}
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowEditDialog(false)} sx={{ fontWeight: 500 }}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmEdit} 
                variant="contained"
                sx={{ fontWeight: 500 }}
              >
                Save Changes
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ color: 'error.main' }}>
              Confirm Delete Sale
            </DialogTitle>
            <DialogContent>
              {deletingSale && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" sx={{ mb: 2, color: 'warning.main', fontWeight: 'bold' }}>
                    Are you sure you want to delete this sale? This action cannot be undone.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Invoice: {deletingSale.invoice_no}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Customer: {deletingSale.customer_name || 'Walk-in Customer'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Total: {parseFloat(deletingSale.total || 0).toFixed(2)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Date: {new Date(deletingSale.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDeleteDialog(false)} sx={{ fontWeight: 500 }}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmDelete} 
                variant="contained"
                color="error"
                sx={{ fontWeight: 500 }}
              >
                Delete Sale
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
    </DashboardLayout>
    </RouteGuard>
  )
}

export default SalesLedger

