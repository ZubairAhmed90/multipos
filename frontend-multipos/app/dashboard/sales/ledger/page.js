'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../../utils/axios'
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
import { fetchSales, updateSale, deleteSale } from '../../../../app/store/slices/salesSlice'

function SalesLedger() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
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
      'PARTIAL': { color: 'warning', icon: <PendingIcon />, label: 'Partial' },
      'PENDING': { color: 'error', icon: <PendingIcon />, label: 'Pending' },
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
    return (
      <DashboardLayout>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" color="error">
            Error loading sales data: {error}
          </Typography>
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
                      ${totalRevenue.toFixed(2)}
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
                      ${totalPaid.toFixed(2)}
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
                      ${totalCredit.toFixed(2)}
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
                    <TableCell sx={{ fontWeight: 'bold' }}>Payment Status</TableCell>
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
                        ${parseFloat(sale.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ color: 'success.main' }}>
                        ${parseFloat(sale.payment_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ color: 'warning.main' }}>
                        ${parseFloat(sale.credit_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusChip(sale.payment_status)}
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
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 2 }}>
                    Outstanding Credit: ${parseFloat(selectedSale.credit_amount || 0).toFixed(2)}
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
                    sx={{ mb: 2, fontFamily: 'monospace' }}
                  />
                  
                  <TextField
                    fullWidth
                    label="Customer Phone"
                    value={editFormData.customerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    sx={{ mb: 2, fontFamily: 'monospace' }}
                  />
                  
                  <TextField
                    fullWidth
                    select
                    label="Payment Method"
                    value={editFormData.paymentMethod}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                    sx={{ mb: 2, fontFamily: 'monospace' }}
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
                    sx={{ mb: 2, fontFamily: 'monospace' }}
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
            <DialogTitle sx={{ fontFamily: 'monospace', color: 'error.main' }}>
              Confirm Delete Sale
            </DialogTitle>
            <DialogContent>
              {deletingSale && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" sx={{ mb: 2, color: 'warning.main', fontWeight: 'bold' }}>
                    Are you sure you want to delete this sale? This action cannot be undone.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    Invoice: {deletingSale.invoice_no}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    Customer: {deletingSale.customer_name || 'Walk-in Customer'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    Total: ${parseFloat(deletingSale.total || 0).toFixed(2)}
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
