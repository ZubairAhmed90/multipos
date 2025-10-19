'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  TextField, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Pagination,
  Divider,
  Menu,
  ListItemIcon
} from '@mui/material'
import { 
  Search as SearchIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Receipt as ReceiptIcon,
  GetApp as ExportIcon
} from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import { 
  fetchAllCustomersWithSummaries, 
  fetchCustomerLedger, 
  exportCustomerLedger,
  clearError,
  clearCurrentLedger,
  setCustomersPagination,
  setLedgerPagination
} from '../../store/slices/customerLedgerSlice'
import api from '../../../utils/axios'

function CustomerLedgerPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { 
    customers, 
    currentCustomerLedger, 
    loading, 
    error, 
    pagination 
  } = useSelector((state) => state.customerLedger)

  // Debug logging
  console.log('Customer Ledger State:', { customers, loading, error, pagination })

  // State for customers list
  const [searchTerm, setSearchTerm] = useState('')
  const [hasBalanceFilter, setHasBalanceFilter] = useState('all')
  const [customersPage, setCustomersPage] = useState(1)

  // State for customer ledger details
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false)
  const [ledgerFilters, setLedgerFilters] = useState({
    startDate: '',
    endDate: '',
    transactionType: 'all',
    paymentMethod: 'all'
  })
  const [ledgerPage, setLedgerPage] = useState(1)
  const [sortField, setSortField] = useState('transaction_date')
  const [sortDirection, setSortDirection] = useState('asc')
  
  // State for sale items dialog
  const [saleItemsDialogOpen, setSaleItemsDialogOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [saleItems, setSaleItems] = useState([])
  const [loadingSaleItems, setLoadingSaleItems] = useState(false)
  
  // Export dropdown state
  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  
  // Auto-refresh state
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  const loadCustomers = useCallback(() => {
    const params = {
      search: searchTerm,
      hasBalance: hasBalanceFilter === 'true' ? 'true' : undefined,
      limit: 20,
      offset: (customersPage - 1) * 20
    }
    console.log('Loading customers with params:', params)
    console.log('Current user:', user)
    console.log('User role:', user?.role)
    console.log('User branchId:', user?.branchId)
    console.log('User warehouseId:', user?.warehouseId)
    dispatch(fetchAllCustomersWithSummaries(params))
  }, [dispatch, customersPage, searchTerm, hasBalanceFilter, user])

  // Load customers on component mount
  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const loadCustomerLedger = (customerId) => {
    const params = {
      ...ledgerFilters,
      limit: 50,
      offset: (ledgerPage - 1) * 50
    }
    dispatch(fetchCustomerLedger({ customerId, params }))
  }

  const handleSearch = () => {
    setCustomersPage(1)
    loadCustomers()
  }

  const handleViewLedger = (customer) => {
    setSelectedCustomer(customer)
    setLedgerDialogOpen(true)
    setLedgerPage(1)
    loadCustomerLedger(customer.customer_name || customer.customer_phone)
  }

  const handleExportLedger = (customerId, format = 'pdf', detailed = false) => {
    dispatch(exportCustomerLedger({ 
      customerId, 
      params: { ...ledgerFilters, format, detailed: detailed.toString() }
    }))
  }

  // Export dropdown handlers
  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget)
  }

  const handleExportClose = () => {
    setExportAnchorEl(null)
  }

  const handleExportAction = (format, detailed = false) => {
    const customerId = selectedCustomer?.customer_name || selectedCustomer?.customer_phone
    dispatch(exportCustomerLedger({ 
      customerId, 
      params: { ...ledgerFilters, format, detailed: detailed.toString() }
    }))
    handleExportClose()
  }

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    console.log('🚨🚨🚨 MANUAL REFRESH TRIGGERED 🚨🚨🚨')
    console.log('🚨🚨🚨 MANUAL REFRESH TRIGGERED 🚨🚨🚨')
    console.log('🚨🚨🚨 MANUAL REFRESH TRIGGERED 🚨🚨🚨')
    
    console.log('[Customer Ledger] Manual refresh triggered')
    setLastRefresh(Date.now())
    
    // Refresh customers list
    loadCustomers()
    
    // Refresh current customer ledger if dialog is open
    if (selectedCustomer && ledgerDialogOpen) {
      loadCustomerLedger(selectedCustomer.customer_name || selectedCustomer.customer_phone)
    }
  }, [loadCustomers, selectedCustomer, ledgerDialogOpen])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled) return

    const interval = setInterval(() => {
      console.log('[Customer Ledger] Auto-refresh triggered')
      handleManualRefresh()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefreshEnabled, handleManualRefresh])

  // Calculate summary totals
  const calculateSummaryTotals = () => {
    console.log('calculateSummaryTotals - currentCustomerLedger:', currentCustomerLedger)
    console.log('calculateSummaryTotals - transactions:', currentCustomerLedger?.transactions)
    
    if (!currentCustomerLedger || !currentCustomerLedger.transactions) {
      console.log('No transactions found, returning zeros')
      return {
        totalTransactions: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalCredit: 0,
        currentBalance: 0
      }
    }

    const transactions = currentCustomerLedger.transactions
    console.log('Processing transactions:', transactions.length, 'transactions')
    
    // Calculate running balance properly
    let runningBalance = 0
    const totals = transactions.reduce((acc, transaction) => {
      // Use the correct fields based on the table structure
      const subtotal = parseFloat(transaction.subtotal || transaction.total || 0) // Current bill amount
      const totalAmount = parseFloat(transaction.total_amount || transaction.total || 0) // Total bill including outstanding
      const paid = parseFloat(transaction.paid_amount || 0)
      const credit = parseFloat(transaction.credit_amount || 0)
      const outstanding = parseFloat(transaction.outstanding || 0) // Current outstanding for this transaction
      
      console.log('Transaction:', transaction.invoice_no, {
        subtotal,
        totalAmount,
        paid,
        credit,
        outstanding,
        runningBalance
      })
      
      // Update running balance: previous balance + new credit - new payment
      runningBalance = runningBalance + credit - paid
      
      return {
        totalTransactions: acc.totalTransactions + 1,
        totalAmount: acc.totalAmount + totalAmount, // Sum of all total amounts
        totalPaid: acc.totalPaid + paid,
        totalCredit: acc.totalCredit + credit,
        currentBalance: runningBalance // Use running balance
      }
    }, {
      totalTransactions: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalCredit: 0,
      currentBalance: 0
    })
    
    console.log('Final totals:', totals)
    return totals
  }

  const handleSort = (field) => {
    // For transaction_date, always sort in ascending order (earliest dates first)
    if (field === 'transaction_date') {
      setSortField(field)
      setSortDirection('asc')
    } else {
      // For other columns, toggle between asc and desc
      if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        setSortField(field)
        setSortDirection('asc')
      }
    }
  }

  const getSortIcon = (field) => {
    if (sortField !== field) return null
    
    // For transaction_date, always show ascending arrow
    if (field === 'transaction_date') {
      return <ArrowUpIcon fontSize="small" />
    }
    
    // For other columns, show icon based on current sort direction
    return sortDirection === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
  }

  const sortTransactions = (transactions) => {
    if (!transactions || transactions.length === 0) return transactions
    
    return [...transactions].sort((a, b) => {
      let aValue, bValue
      
      switch (sortField) {
        case 'transaction_date':
          aValue = new Date(a.transaction_date)
          bValue = new Date(b.transaction_date)
          break
        case 'invoice_no':
          aValue = a.invoice_no || ''
          bValue = b.invoice_no || ''
          break
        case 'amount':
          aValue = parseFloat(a.amount || 0)
          bValue = parseFloat(b.amount || 0)
          break
        case 'balance':
          aValue = parseFloat(a.balance || 0)
          bValue = parseFloat(b.balance || 0)
          break
        case 'payment_method':
          aValue = a.payment_method || ''
          bValue = b.payment_method || ''
          break
        case 'status':
          aValue = a.payment_status || ''
          bValue = b.payment_status || ''
          break
        default:
          return 0
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  const handleLedgerFilterChange = () => {
    setLedgerPage(1)
    loadCustomerLedger(selectedCustomer.customer_name || selectedCustomer.customer_phone)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getTransactionTypeColor = (scopeType) => {
    return scopeType === 'WAREHOUSE' ? 'primary' : 'secondary'
  }

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'success'
      case 'PARTIAL': return 'warning'
      case 'PENDING': return 'error'
      default: return 'default'
    }
  }

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'error'
    if (balance < 0) return 'success'
    return 'default'
  }

  // Function to fetch sale items for a specific invoice
  const fetchSaleItems = async (saleId) => {
    console.log('Fetching sale items for saleId:', saleId)
    setLoadingSaleItems(true)
    try {
      const response = await api.get(`/sales/${saleId}`)
      console.log('Sale details response:', response.data)
      if (response.data.success) {
        setSelectedSale(response.data.data)
        setSaleItems(response.data.data.items || [])
        console.log('Sale items set:', response.data.data.items)
        setSaleItemsDialogOpen(true)
      } else {
        alert('Failed to load sale details')
      }
    } catch (error) {
      console.error('Error loading sale details:', error)
      alert('Failed to load sale details')
    } finally {
      setLoadingSaleItems(false)
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1">
                Customer Ledger
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Auto-refresh every 30 seconds">
                  <Chip 
                    label={autoRefreshEnabled ? "Auto-refresh ON" : "Auto-refresh OFF"}
                    color={autoRefreshEnabled ? "success" : "default"}
                    size="small"
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
                <Tooltip title="Refresh customer data">
                  <IconButton onClick={handleManualRefresh} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Typography variant="body1" color="text.secondary">
              {user?.role === 'ADMIN' 
                ? 'View comprehensive customer transaction history across all branches and warehouses'
                : user?.role === 'CASHIER'
                ? 'View customer transaction history for your branch'
                : 'View retailer transaction history for your warehouse'
              }
            </Typography>
          </Box>

          {/* Search and Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search Customer"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Name or phone number"
                    InputProps={{
                      endAdornment: (
                        <IconButton onClick={handleSearch}>
                          <SearchIcon />
                        </IconButton>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Balance Filter</InputLabel>
                    <Select
                      value={hasBalanceFilter}
                      onChange={(e) => setHasBalanceFilter(e.target.value)}
                      label="Balance Filter"
                    >
                      <MenuItem value="all">All Customers</MenuItem>
                      <MenuItem value="true">With Outstanding Balance</MenuItem>
                      <MenuItem value="false">No Outstanding Balance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadCustomers}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          )}

          {/* Customers Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customers ({pagination.customers.total})
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <TableContainer component={Paper} sx={{ mt: 2 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Last Transaction</TableCell>
                          <TableCell>Customer Name</TableCell>
                          <TableCell>Phone</TableCell>
                          <TableCell>Total Transactions</TableCell>
                          <TableCell>Total Paid</TableCell>
                          <TableCell>Total Credit</TableCell>
                          <TableCell>Current Balance</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {customers && customers.length > 0 ? customers.map((customer, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {customer.last_transaction_date 
                                ? formatDate(customer.last_transaction_date)
                                : 'N/A'
                              }
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {customer.customer_name || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>{customer.customer_phone || 'N/A'}</TableCell>
                            <TableCell>{customer.total_transactions}</TableCell>
                            <TableCell>{formatCurrency(customer.total_paid)}</TableCell>
                            <TableCell>{formatCurrency(customer.total_credit)}</TableCell>
                            <TableCell>
                              <Chip
                                label={formatCurrency(customer.current_balance)}
                                color={getBalanceColor(customer.current_balance)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Tooltip title="View Ledger">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewLedger(customer)}
                                  color="primary"
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Export PDF">
                                <IconButton
                                  size="small"
                                  onClick={() => handleExportLedger(customer.customer_name || customer.customer_phone)}
                                  color="secondary"
                                >
                                  <DownloadIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              <Typography variant="body2" color="text.secondary">
                                {loading ? 'Loading customers...' : 'No customers found'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Pagination */}
                  {pagination.customers.total > 20 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                      <Pagination
                        count={Math.ceil(pagination.customers.total / 20)}
                        page={customersPage}
                        onChange={(event, page) => setCustomersPage(page)}
                        color="primary"
                      />
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Customer Ledger Dialog */}
          <Dialog
            open={ledgerDialogOpen}
            onClose={() => {
              setLedgerDialogOpen(false)
              dispatch(clearCurrentLedger())
            }}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Customer Ledger: {selectedCustomer?.customer_name || selectedCustomer?.customer_phone}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title="Auto-refresh every 30 seconds">
                    <Chip 
                      label={autoRefreshEnabled ? "Auto-refresh ON" : "Auto-refresh OFF"}
                      color={autoRefreshEnabled ? "success" : "default"}
                      size="small"
                      onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Tooltip>
                  <Tooltip title="Refresh data">
                    <IconButton onClick={handleManualRefresh} size="small">
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              {currentCustomerLedger && (
                <>
                  {/* Summary */}
                  <Box sx={{ mb: 3 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={3}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" color="primary">
                              {formatCurrency(currentCustomerLedger.summary.totalDebit)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Total Paid
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" color="error">
                              {formatCurrency(currentCustomerLedger.summary.totalCredit)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Total Credit
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography 
                              variant="h6" 
                              color={getBalanceColor(currentCustomerLedger.summary.currentBalance)}
                            >
                              {formatCurrency(currentCustomerLedger.summary.currentBalance)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Current Balance
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6">
                              {currentCustomerLedger.summary.totalTransactions}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Total Transactions
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Filters */}
                  <Box sx={{ mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label="Start Date"
                          type="date"
                          value={ledgerFilters.startDate}
                          onChange={(e) => setLedgerFilters({...ledgerFilters, startDate: e.target.value})}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label="End Date"
                          type="date"
                          value={ledgerFilters.endDate}
                          onChange={(e) => setLedgerFilters({...ledgerFilters, endDate: e.target.value})}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                          <InputLabel>Transaction Type</InputLabel>
                          <Select
                            value={ledgerFilters.transactionType}
                            onChange={(e) => setLedgerFilters({...ledgerFilters, transactionType: e.target.value})}
                            label="Transaction Type"
                          >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="COMPLETED">Paid</MenuItem>
                            <MenuItem value="PARTIAL">Partial Payment</MenuItem>
                            <MenuItem value="PENDING">Credit</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<FilterIcon />}
                          onClick={handleLedgerFilterChange}
                        >
                          Apply Filters
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Transactions Table */}
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('invoice_no')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Invoice
                              {getSortIcon('invoice_no')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('transaction_date')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Date
                              {getSortIcon('transaction_date')}
                            </Box>
                          </TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('amount')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Amount
                              {getSortIcon('amount')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('total_amount')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Total Amount
                              {getSortIcon('total_amount')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('old_balance')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Old Balance
                              {getSortIcon('old_balance')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('paid_amount')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Payment
                              {getSortIcon('paid_amount')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('payment_method')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Payment Method
                              {getSortIcon('payment_method')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('status')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Status
                              {getSortIcon('status')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                            onClick={() => handleSort('balance')}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Balance
                              {getSortIcon('balance')}
                            </Box>
                          </TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortTransactions(currentCustomerLedger.transactions).map((transaction) => (
                          <TableRow key={transaction.transaction_id}>
                            <TableCell>{transaction.invoice_no}</TableCell>
                            <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                            <TableCell>
                              <Chip
                                label={transaction.transaction_type_display}
                                color={getTransactionTypeColor(transaction.scope_type)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{formatCurrency(transaction.subtotal)}</TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2"
                                color="primary.main"
                                fontWeight="bold"
                              >
                                {formatCurrency(transaction.total)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2"
                                color="warning.main"
                                fontWeight="medium"
                              >
                                {formatCurrency(transaction.old_balance || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2"
                                color="success.main"
                                fontWeight="medium"
                              >
                                {formatCurrency(transaction.paid_amount || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell>{transaction.payment_method}</TableCell>
                            <TableCell>
                              <Chip
                                label={transaction.payment_status_display}
                                color={getPaymentStatusColor(transaction.payment_status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2"
                                color={getBalanceColor(transaction.running_balance)}
                                fontWeight="medium"
                              >
                                {formatCurrency(transaction.running_balance)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="View Sale Items">
                                <IconButton
                                  size="small"
                                  onClick={() => fetchSaleItems(transaction.transaction_id)}
                                  color="primary"
                                  disabled={loadingSaleItems}
                                >
                                  <ReceiptIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Summary Totals Row */}
                  {currentCustomerLedger.transactions && currentCustomerLedger.transactions.length > 0 && (
                    <Box sx={{ mt: 2, mb: 2 }}>
                      <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Total Transactions
                            </Typography>
                            <Typography variant="h6" color="primary">
                              {calculateSummaryTotals().totalTransactions}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Total Amount
                            </Typography>
                            <Typography variant="h6" color="text.primary">
                              {formatCurrency(calculateSummaryTotals().totalAmount)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Total Paid
                            </Typography>
                            <Typography variant="h6" color="success.main">
                              {formatCurrency(calculateSummaryTotals().totalPaid)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Outstanding Balance
                            </Typography>
                            <Typography variant="h6" color="error.main">
                              {formatCurrency(calculateSummaryTotals().currentBalance)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Box>
                  )}

                  {/* Pagination */}
                  {currentCustomerLedger.pagination.total > 50 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                      <Pagination
                        count={Math.ceil(currentCustomerLedger.pagination.total / 50)}
                        page={ledgerPage}
                        onChange={(event, page) => {
                          setLedgerPage(page)
                          loadCustomerLedger(selectedCustomer.customer_name || selectedCustomer.customer_phone)
                        }}
                        color="primary"
                      />
                    </Box>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button 
                variant="outlined" 
                startIcon={<ExportIcon />}
                onClick={handleExportClick}
                sx={{ minWidth: 120 }}
              >
                Export
              </Button>
              <Button onClick={() => setLedgerDialogOpen(false)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Sale Items Dialog */}
          <Dialog 
            open={saleItemsDialogOpen} 
            onClose={() => setSaleItemsDialogOpen(false)} 
            maxWidth="md" 
            fullWidth
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Sale Items - {selectedSale?.invoice_no || 'N/A'}
                </Typography>
                <Button onClick={() => setSaleItemsDialogOpen(false)}>Close</Button>
              </Box>
            </DialogTitle>
            <DialogContent>
              {loadingSaleItems ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : saleItems.length > 0 ? (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item Name</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Discount</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {saleItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.itemName || item.name || 'N/A'}</TableCell>
                          <TableCell>{item.sku || 'N/A'}</TableCell>
                          <TableCell align="right">{item.quantity || 0}</TableCell>
                          <TableCell align="right">{parseFloat(item.unitPrice || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(item.discount || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(item.total || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    No items found for this sale.
                  </Typography>
                </Box>
              )}
            </DialogContent>
          </Dialog>
          
          {/* Export Menu */}
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
            <MenuItem onClick={() => handleExportAction('pdf', false)}>
              <ListItemIcon>
                <DownloadIcon fontSize="small" />
              </ListItemIcon>
              Export as PDF
            </MenuItem>
            <MenuItem onClick={() => handleExportAction('pdf', true)}>
              <ListItemIcon>
                <DownloadIcon fontSize="small" />
              </ListItemIcon>
              Detailed PDF
            </MenuItem>
            <MenuItem onClick={() => handleExportAction('excel', false)}>
              <ListItemIcon>
                <DownloadIcon fontSize="small" />
              </ListItemIcon>
              Export as Excel
            </MenuItem>
            <MenuItem onClick={() => handleExportAction('excel', true)}>
              <ListItemIcon>
                <DownloadIcon fontSize="small" />
              </ListItemIcon>
              Detailed Excel
            </MenuItem>
          </Menu>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(CustomerLedgerPage)
