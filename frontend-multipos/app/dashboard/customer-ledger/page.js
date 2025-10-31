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
import api from '../../../utils/axios'
import { 
  fetchAllCustomersWithSummaries, 
  fetchCustomerLedger, 
  exportCustomerLedger,
  clearError,
  clearCurrentLedger,
  setCustomersPagination,
  setLedgerPagination
} from '../../store/slices/customerLedgerSlice'

function CustomerLedgerPage() {
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
  
  const getCustomerIdentifier = (customer) => {
    if (!customer) return ''
    if (customer.id) return customer.id
    if (customer.customer_name) return customer.customer_name
    if (customer.customer_phone) return customer.customer_phone
    return ''
  }

  const getCustomerDisplayName = (customer) => {
    if (!customer) return ''
    if (customer.isAllCustomers) return 'All Customers'
    return customer.customer_name || customer.customer_phone || 'Unknown Customer'
  }

  const loadCustomers = useCallback(() => {
    const params = {
      search: searchTerm,
      hasBalance: hasBalanceFilter === 'all' ? undefined : hasBalanceFilter,
      limit: 20,
      offset: (customersPage - 1) * 20,
      _t: Date.now() // Force fresh data by adding timestamp
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

  const loadCustomerLedger = useCallback((customerId) => {
    const params = {
      ...ledgerFilters,
      limit: 50,
      offset: (ledgerPage - 1) * 50
    }
    dispatch(fetchCustomerLedger({ customerId, params }))
  }, [dispatch, ledgerFilters, ledgerPage])

  const handleSearch = () => {
    setCustomersPage(1)
    loadCustomers()
  }

  const handleViewLedger = (customer) => {
    const identifier = getCustomerIdentifier(customer)
    const enrichedCustomer = {
      ...customer,
      id: identifier
    }
    setSelectedCustomer(enrichedCustomer)
    setLedgerDialogOpen(true)
    setLedgerPage(1)
    loadCustomerLedger(identifier)
  }

  const handleViewAllLedger = () => {
    const allPlaceholder = {
      id: '__all__',
      customer_name: 'All Customers',
      customer_phone: '',
      total_transactions: pagination.customers.total,
      isAllCustomers: true
    }
    setSelectedCustomer(allPlaceholder)
    setLedgerDialogOpen(true)
    setLedgerPage(1)
    loadCustomerLedger(allPlaceholder.id)
  }

  const handleViewDetailedLedger = (customer) => {
    const customerId = getCustomerIdentifier(customer)
    if (!customerId || customerId === '__all__') {
      alert('Detailed view is only available for individual customers.')
      return
    }
    // Open detailed ledger view in new tab
    window.open(`/dashboard/customer-ledger/detailed/${encodeURIComponent(customerId)}`, '_blank')
  }

  const handleExportLedger = (customerId, format = 'pdf', detailed = false) => {
    if (!customerId) return
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
    const customerId = getCustomerIdentifier(selectedCustomer)
    if (!customerId) {
      handleExportClose()
      return
    }
    dispatch(exportCustomerLedger({ 
      customerId, 
      params: { ...ledgerFilters, format, detailed: detailed.toString() }
    }))
    handleExportClose()
  }

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    console.log('[Customer Ledger] Manual refresh triggered')
    
    // Refresh customers list
    loadCustomers()
    
    // Refresh current customer ledger if dialog is open
    if (selectedCustomer && ledgerDialogOpen) {
      const identifier = getCustomerIdentifier(selectedCustomer)
      if (identifier) {
        loadCustomerLedger(identifier)
      }
    }
  }, [loadCustomers, selectedCustomer, ledgerDialogOpen, loadCustomerLedger])


  // Calculate summary totals
 // Calculate summary totals - CORRECTED VERSION
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
      currentBalance: 0,
      outstandingBalance: 0
    }
  }

  const transactions = currentCustomerLedger.transactions
  console.log('Processing transactions:', transactions.length, 'transactions')
  
  // CORRECTED: Use the backend-calculated summary instead of recalculating
  // The backend already provides the correct summary in currentCustomerLedger.summary
  if (currentCustomerLedger.summary) {
    console.log('Using backend summary:', currentCustomerLedger.summary)
    return {
      totalTransactions: currentCustomerLedger.summary.totalTransactions,
      totalAmount: currentCustomerLedger.summary.totalAmount,
      totalPaid: currentCustomerLedger.summary.totalPaid,
      totalCredit: currentCustomerLedger.summary.totalCredit,
      outstandingBalance: currentCustomerLedger.summary.outstandingBalance
    }
  }
  
  // Fallback calculation if summary is not available
  console.log('Backend summary not available, using fallback calculation')
  
  // Calculate totals from transaction data
  const totals = transactions.reduce((acc, transaction) => {
    const currentAmount = parseFloat(transaction.amount || 0)
    const correctedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || 0)
    
    return {
      totalTransactions: acc.totalTransactions + 1,
      totalAmount: acc.totalAmount + currentAmount,
      totalPaid: acc.totalPaid + correctedPaid,
      totalCredit: acc.totalCredit
    }
  }, {
    totalTransactions: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalCredit: 0
  })
  
  // Use the running balance from the most recent transaction as outstanding balance
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.transaction_date) - new Date(a.transaction_date)
  )
  const outstandingBalance = sortedTransactions.length > 0 
    ? parseFloat(sortedTransactions[0].running_balance || 0)
    : totals.totalAmount - totals.totalPaid
  
  console.log('Fallback totals:', { ...totals, outstandingBalance })
  return {
    ...totals,
    outstandingBalance: outstandingBalance
  }
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
    const identifier = getCustomerIdentifier(selectedCustomer)
    if (identifier) {
      loadCustomerLedger(identifier)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  const viewingAllCustomers = Boolean(selectedCustomer?.isAllCustomers)
  const summaryTotals = calculateSummaryTotals()

  const renderSingleCustomerLedger = () => {
    const transactions = currentCustomerLedger?.transactions || []
    const totalRecords = currentCustomerLedger?.pagination?.total || 0

    return (
      <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell 
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                onClick={() => handleSort('transaction_date')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Date
                  {getSortIcon('transaction_date')}
                </Box>
              </TableCell>
              <TableCell 
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                onClick={() => handleSort('invoice_no')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Invoice
                  {getSortIcon('invoice_no')}
                </Box>
              </TableCell>
              {viewingAllCustomers && (
                <TableCell>Customer</TableCell>
              )}
              <TableCell 
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                onClick={() => handleSort('amount')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Amount
                  {getSortIcon('amount')}
                </Box>
              </TableCell>
              <TableCell>
                Old Balance
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
            {sortTransactions(transactions)?.map((transaction, index) => {
              const currentAmount = parseFloat(transaction.subtotal || transaction.amount || transaction.total || 0)
              const oldBalance = parseFloat(transaction.old_balance || transaction.previous_balance || 0)
              const totalAmount = parseFloat(transaction.total_amount || transaction.total || 0)
              const correctedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || 0)
              const balance = parseFloat(transaction.running_balance || transaction.balance || (totalAmount - correctedPaid))

              return (
                <TableRow key={transaction.transaction_id || index}>
                  <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                  <TableCell>{transaction.invoice_no}</TableCell>
                  {viewingAllCustomers && (
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {transaction.customer_name || 'N/A'}
                      </Typography>
                      {transaction.customer_phone && (
                        <Typography variant="caption" color="text.secondary">
                          {transaction.customer_phone}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell>{formatCurrency(currentAmount)}</TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2"
                      color="warning.main"
                      fontWeight="medium"
                    >
                      {formatCurrency(oldBalance)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2"
                      color="primary.main"
                      fontWeight="bold"
                    >
                      {formatCurrency(totalAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2"
                      color="success.main"
                      fontWeight="medium"
                    >
                      {formatCurrency(correctedPaid)}
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
                      color={balance < 0 ? 'success.main' : 'error.main'}
                      fontWeight="medium"
                    >
                      {formatCurrency(balance)}
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
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {transactions.length > 0 && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Transactions
                </Typography>
                <Typography variant="h6" color="primary">
                  {summaryTotals.totalTransactions}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Amount
                </Typography>
                <Typography variant="h6" color="text.primary">
                  {formatCurrency(summaryTotals.totalAmount)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Paid
                </Typography>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(summaryTotals.totalPaid)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Outstanding Balance
                </Typography>
                <Typography variant="h6" color="error.main">
                  {formatCurrency(summaryTotals.outstandingBalance)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}

      {totalRecords > 50 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={Math.ceil(totalRecords / 50)}
            page={ledgerPage}
            onChange={(event, page) => {
              setLedgerPage(page)
              const identifier = getCustomerIdentifier(selectedCustomer)
              if (identifier) {
                loadCustomerLedger(identifier)
              }
            }}
            color="primary"
          />
        </Box>
      )}
      </>
    )
  }

  const renderAllCustomerLedgers = () => {
    const groups = currentCustomerLedger?.groupedLedgers || []
    const uniqueCount = currentCustomerLedger?.customer?.unique_customers ?? groups.length
    const overallSummary = summaryTotals

    if (groups.length === 0) {
      return (
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No customer ledger data found for the selected filters.
          </Typography>
        </Box>
      )
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {groups.length > 0 && (
          <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">Total Customers</Typography>
                <Typography variant="h6" color="primary">{uniqueCount}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">Total Amount</Typography>
                <Typography variant="h6">{formatCurrency(overallSummary.totalAmount)}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">Total Paid</Typography>
                <Typography variant="h6" color="success.main">{formatCurrency(overallSummary.totalPaid)}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="subtitle2" color="text.secondary">Outstanding</Typography>
                <Typography variant="h6" color="error.main">{formatCurrency(overallSummary.outstandingBalance)}</Typography>
              </Grid>
            </Grid>
          </Paper>
        )}
        {groups.map((group, index) => {
          const groupKey = group.customer?.key || `${group.customer?.name || 'customer'}-${index}`
          const groupSummary = group.summary || {}
          const transactions = group.transactions || []

          return (
            <Paper key={groupKey} sx={{ p: 2 }} elevation={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6">
                    {group.customer?.name || 'Unknown Customer'}
                  </Typography>
                  {group.customer?.phone && (
                    <Typography variant="body2" color="text.secondary">
                      {group.customer.phone}
                    </Typography>
                  )}
                </Box>
                <Chip label={`Transactions: ${groupSummary.totalTransactions || 0}`} color="primary" size="small" />
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}>
                  <Typography variant="subtitle2" color="text.secondary">Total Amount</Typography>
                  <Typography variant="h6">{formatCurrency(groupSummary.totalAmount)}</Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="subtitle2" color="text.secondary">Total Paid</Typography>
                  <Typography variant="h6" color="success.main">{formatCurrency(groupSummary.totalPaid)}</Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="subtitle2" color="text.secondary">Outstanding</Typography>
                  <Typography variant="h6" color="error.main">{formatCurrency(groupSummary.outstandingBalance)}</Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="subtitle2" color="text.secondary">Total Credit</Typography>
                  <Typography variant="h6">{formatCurrency(groupSummary.totalCredit)}</Typography>
                </Grid>
              </Grid>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Old Balance</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell align="right">Payment</TableCell>
                      <TableCell>Payment Method</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((transaction, txIndex) => {
                      const currentAmount = parseFloat(transaction.subtotal || transaction.amount || transaction.total || 0)
                      const oldBalance = parseFloat(transaction.old_balance || transaction.previous_balance || 0)
                      const totalAmount = parseFloat(transaction.total_amount || transaction.total || 0)
                      const correctedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || 0)
                      const balance = parseFloat(transaction.running_balance || transaction.balance || (totalAmount - correctedPaid))

                      return (
                        <TableRow key={transaction.transaction_id || txIndex}>
                          <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                          <TableCell>{transaction.invoice_no}</TableCell>
                          <TableCell align="right">{formatCurrency(currentAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(oldBalance)}</TableCell>
                          <TableCell align="right">{formatCurrency(totalAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(correctedPaid)}</TableCell>
                          <TableCell>{transaction.payment_method}</TableCell>
                          <TableCell>
                            <Chip
                              label={transaction.payment_status_display}
                              color={getPaymentStatusColor(transaction.payment_status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{formatCurrency(balance)}</TableCell>
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
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )
        })}
      </Box>
    )
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1">
                Customer Ledger
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<ViewIcon />}
                  size="small"
                  onClick={handleViewAllLedger}
                >
                  See All Ledger
                </Button>
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
                      onChange={(e) => {
                        setHasBalanceFilter(e.target.value)
                        setCustomersPage(1) // Reset to first page when filter changes
                      }}
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
                          <TableCell>Total Amount</TableCell>
                          <TableCell>Total Paid</TableCell>
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
                            <TableCell>
                              {(() => {
                                console.log('Customer data for', customer.customer_name, ':', customer)
                                return formatCurrency(customer.total_amount || 0)
                              })()}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                console.log('Total paid for', customer.customer_name, ':', customer.total_paid)
                                return formatCurrency(customer.total_paid || 0)
                              })()}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={(() => {
                                  const balance = customer.current_balance || 0
                                  console.log('Balance for', customer.customer_name, ':', balance)
                                  return formatCurrency(balance)
                                })()}
                                color={getBalanceColor(customer.current_balance || 0)}
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
                              <Tooltip title="View Detailed Ledger">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewDetailedLedger(customer)}
                                  color="info"
                                >
                                  <ReceiptIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Export PDF">
                                <IconButton
                                  size="small"
                                  onClick={() => handleExportLedger(getCustomerIdentifier(customer))}
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
                  Customer Ledger: {getCustomerDisplayName(selectedCustomer)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                  {viewingAllCustomers && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Displaying combined ledger across all customers. Use filters to narrow the date range before exporting.
                    </Alert>
                  )}

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

                  {viewingAllCustomers ? renderAllCustomerLedgers() : renderSingleCustomerLedger()}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button 
                variant="outlined" 
                startIcon={<ExportIcon />}
                onClick={handleExportClick}
                sx={{ minWidth: 120 }}
                disabled={!selectedCustomer}
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
