'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../utils/axios'
import { Box, Typography, Chip, Button, Grid, Card, CardContent, FormControl, InputLabel, Select, MenuItem, Paper, Drawer, List, ListItem, ListItemText, Divider, IconButton, Badge, TextField, Menu, ListItemIcon, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, CircularProgress, Tooltip, InputAdornment, Pagination, Dialog, DialogTitle, DialogContent } from '@mui/material'
import { Close as CloseIcon, FilterList as FilterIcon, GetApp as ExportIcon, FileDownload as DownloadIcon, Delete as DeleteIcon, Search as SearchIcon, Clear as ClearIcon, Visibility as ViewIcon, Receipt as ReceiptIcon, Refresh as RefreshIcon } from '@mui/icons-material'
import { DataGrid } from '@mui/x-data-grid'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import PollingStatusIndicator from '../../../components/polling/PollingStatusIndicator'
import { useSalesPolling } from '../../../hooks/usePolling'
import { fetchSales, deleteSale, fetchSalesReturns, createSalesReturn, getSale } from '../../store/slices/salesSlice'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { fetchBranchSettings, fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses, fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchCompanies } from '../../store/slices/companiesSlice'
import { fetchRetailers } from '../../store/slices/retailersSlice'
import usePermissions from '../../../hooks/usePermissions'
import pollingService from '../../../utils/pollingService'
import EditableInvoiceForm from '../../../components/sales/EditableInvoiceForm'


// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'created_at', headerName: 'Date', width: 120, renderCell: (params) => {
    if (!params || !params.value) {
      return 'N/A';
    }
    try {
      const date = new Date(params.value);
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{date.toLocaleDateString()}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Date';
    }
  }},
  { field: 'created_time', headerName: 'Time', width: 100, renderCell: (params) => {
    if (!params || !params.row || !params.row.created_at) {
      return 'N/A';
    }
    try {
      const date = new Date(params.row.created_at);
      const timeString = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{timeString}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Time';
    }
  }},
  { field: 'invoice_no', headerName: 'Invoice #', width: 120 },
  { 
    field: 'scope_type', 
    headerName: 'Type', 
    width: 100,
    renderCell: (params) => {
      const scopeType = params.row.scope_type || params.row.scopeType
      return (
        <Chip 
          label={scopeType === 'WAREHOUSE' ? 'Wholesale' : 'Retail'} 
          color={scopeType === 'WAREHOUSE' ? 'secondary' : 'primary'}
          size="small"
        />
      )
    }
  },
  { 
    field: 'customerName', 
    headerName: 'Customer', 
    width: 150,
    renderCell: (params) => {
      if (!params || !params.row) {
        return 'No Data';
      }
      
      // Check for customerInfo (parsed from JSON)
      if (params.row.customerInfo && params.row.customerInfo.name) {
        return params.row.customerInfo.name;
      }
      
      // Check for customer_info (raw JSON string)
      if (params.row.customer_info) {
        try {
          const customerInfo = JSON.parse(params.row.customer_info);
          return customerInfo.name || 'No Customer';
        } catch (e) {
          return 'No Customer';
        }
      }
      
      return 'No Customer';
    }
  },
  { field: 'subtotal', headerName: 'Subtotal', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'tax', headerName: 'Tax', width: 100, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'discount', headerName: 'Discount', width: 100, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'total', headerName: 'Total', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'payment_amount', headerName: 'Payment', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return (
      <Typography 
        variant="body2"
        color="success.main"
        fontWeight="medium"
      >
        {parseFloat(params.value).toFixed(2)}
      </Typography>
    );
  }},
  { 
    field: 'paymentMethod', 
    headerName: 'Payment Method', 
    width: 150, 
    renderCell: (params) => {
      let paymentMethod = params.row.paymentMethod || params.row.payment_method;
      
      // Check customer_info for payment method if not found directly
      if (!paymentMethod && params.row.customer_info) {
        try {
          const customerInfo = typeof params.row.customer_info === 'string' 
            ? JSON.parse(params.row.customer_info) 
            : params.row.customer_info;
          paymentMethod = customerInfo.paymentMethod;
        } catch (e) {
          // Silent error handling
        }
      }
      
      if (!paymentMethod) {
        // Check if this is a credit sale based on creditAmount
        const creditAmount = params.row.creditAmount || 0;
        if (creditAmount > 0) {
          return <Chip label="FULLY CREDIT" color="error" size="small" />;
        }
        return <Chip label="N/A" color="default" size="small" />;
      }
      
      // ✅ CORRECTED LOGIC: Show actual payment method (CASH, BANK_TRANSFER, etc.)
      // Payment type (PARTIAL_PAYMENT, FULLY_CREDIT) should be shown in Status column
      
      const methodColors = {
        'CASH': 'success',
        'CARD': 'primary',
        'BANK_TRANSFER': 'info',
        'MOBILE_PAYMENT': 'secondary',
        'CHEQUE': 'warning',
        'MOBILE_MONEY': 'secondary'
      };
      
      return (
        <Chip 
          label={paymentMethod.replace('_', ' ').toUpperCase()} 
          color={methodColors[paymentMethod] || 'default'}
          size="small"
        />
      );
    }
  },
  { 
    field: 'paymentType', 
    headerName: 'Payment Type', 
    width: 150, 
    renderCell: (params) => {
      // Show payment type instead of status
      let paymentType = params.row.payment_type || params.row.paymentType;
      
      // If no payment type, determine from payment status
      if (!paymentType) {
        const paymentStatus = params.row.payment_status || params.row.paymentStatus;
        const creditAmount = params.row.creditAmount || params.row.credit_amount || 0;
        const paymentAmount = params.row.paymentAmount || params.row.payment_amount || 0;
        
        if (creditAmount > 0 && paymentAmount > 0) {
          paymentType = 'PARTIAL_PAYMENT';
        } else if (creditAmount > 0 && paymentAmount === 0) {
          paymentType = 'FULLY_CREDIT';
        } else {
          paymentType = 'FULL_PAYMENT';
        }
      }
      
      const typeColors = {
        'FULL_PAYMENT': 'success',
        'PARTIAL_PAYMENT': 'warning',
        'FULLY_CREDIT': 'error'
      }
      
      return (
        <Chip 
          label={paymentType.replace('_', ' ').toUpperCase()} 
          color={typeColors[paymentType] || 'default'}
          size="small"
        />
      );
    }
  },
  { 
    field: 'payment_terms', 
    headerName: 'Payment Terms', 
    width: 150,
    renderCell: (params) => {
      // First, get the payment method
      let paymentMethod = params.row.paymentMethod || params.row.payment_method;
      
      // Check customer_info for payment method if not found directly
      if (!paymentMethod && params.row.customer_info) {
        try {
          const customerInfo = typeof params.row.customer_info === 'string' 
            ? JSON.parse(params.row.customer_info) 
            : params.row.customer_info;
          paymentMethod = customerInfo.paymentMethod;
        } catch (e) {
          // Silent error handling
        }
      }
      
      // Show payment terms for credit sales
      if (paymentMethod === 'CREDIT') {
        let customerInfo = params.row.customerInfo;
        
        // If not found, try to parse customer_info
        if (!customerInfo && params.row.customer_info) {
          try {
            customerInfo = typeof params.row.customer_info === 'string' 
              ? JSON.parse(params.row.customer_info) 
              : params.row.customer_info;
          } catch (e) {
            // Silent error handling
          }
        }
        
        if (customerInfo && customerInfo.paymentTerms) {
          return customerInfo.paymentTerms;
        }
        
        return 'N/A';
      }
      
      return '-';
    }
  },
  { field: 'paymentStatus', headerName: 'Payment Status', width: 130, renderCell: (params) => {
    const paymentStatus = params.row.paymentStatus || params.row.payment_status;
    if (!paymentStatus) {
      return <Chip label="N/A" color="default" size="small" />;
    }
    
    const statusColors = {
      'COMPLETED': 'success',
      'PENDING': 'error',
      'FAILED': 'error',
      'REFUNDED': 'info',
      'PARTIAL': 'warning'
    };
    
    return (
      <Chip 
        label={paymentStatus.replace('_', ' ').toUpperCase()} 
        color={statusColors[paymentStatus] || 'default'}
        size="small"
      />
    );
  }},
  { field: 'paymentStatus', headerName: 'Payment Status', width: 120, renderCell: (params) => {
    const paymentStatus = params.row.paymentStatus || params.row.payment_status;
    if (!paymentStatus) {
      return <Chip label="N/A" color="default" size="small" />;
    }
    return (
      <Chip 
        label={paymentStatus.replace('-', ' ').toUpperCase()} 
        color={paymentStatus === 'COMPLETED' ? 'success' : paymentStatus === 'PENDING' ? 'error' : 'default'}
        size="small"
      />
    );
  }},
  { field: 'branch_name', headerName: 'Branch', width: 120 },
  { 
    field: 'return_quantity', 
    headerName: 'Returns', 
    width: 100,
    renderCell: (params) => {
      // Check if this sale has any returns
      const saleId = params.row.id;
      const returns = salesReturns?.filter(returnItem => returnItem.sale_id === saleId) || [];
      
      if (returns.length === 0) {
        return <Chip label="0" color="default" size="small" />;
      }
      
      // Calculate total returned quantity
      const totalReturnedQty = returns.reduce((sum, returnItem) => {
        return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
      }, 0);
      
      return (
        <Chip 
          label={totalReturnedQty} 
          color="warning" 
          size="small"
          title={`${returns.length} return(s) - ${totalReturnedQty} items`}
        />
      );
    }
  },
  { 
    field: 'notes', 
    headerName: 'Notes', 
    width: 200,
    renderCell: (params) => {
      const notes = params.row.notes || '';
      if (!notes) {
        return <Chip label="No Notes" color="default" size="small" />;
      }
      
      // Truncate long notes for display
      const truncatedNotes = notes.length > 50 ? notes.substring(0, 50) + '...' : notes;
      
      return (
        <Tooltip title={notes} arrow>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {truncatedNotes}
          </Typography>
        </Tooltip>
      );
    }
  },
]

// Sales returns columns
const returnsColumns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'originalSaleId', headerName: 'Original Sale', width: 120 },
  { field: 'reason', headerName: 'Reason', width: 200 },
  { field: 'refundAmount', headerName: 'Refund', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'status', headerName: 'Payment Type', width: 120, renderCell: (params) => {
    // Show payment type instead of status
    let paymentType = params.row.payment_type || params.row.paymentType;
    
    // If no payment type, determine from payment status
    if (!paymentType) {
      const paymentStatus = params.row.payment_status || params.row.paymentStatus;
      const creditAmount = params.row.creditAmount || params.row.credit_amount || 0;
      const paymentAmount = params.row.paymentAmount || params.row.payment_amount || 0;
      
      if (creditAmount > 0 && paymentAmount > 0) {
        paymentType = 'PARTIAL_PAYMENT';
      } else if (creditAmount > 0 && paymentAmount === 0) {
        paymentType = 'FULLY_CREDIT';
      } else {
        paymentType = 'FULL_PAYMENT';
      }
    }
    
    const typeColors = {
      'FULL_PAYMENT': 'success',
      'PARTIAL_PAYMENT': 'warning',
      'FULLY_CREDIT': 'error'
    }
    
    return (
      <Chip 
        label={paymentType.replace('_', ' ').toUpperCase()} 
        color={typeColors[paymentType] || 'default'}
        size="small"
      />
    );
  }},
  { field: 'created_at', headerName: 'Date', width: 120, renderCell: (params) => {
    if (!params || !params.value) {
      return 'N/A';
    }
    try {
      const date = new Date(params.value);
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{date.toLocaleDateString()}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Date';
    }
  }},
  { field: 'created_time', headerName: 'Time', width: 100, renderCell: (params) => {
    if (!params || !params.row || !params.row.created_at) {
      return 'N/A';
    }
    try {
      const date = new Date(params.row.created_at);
      const timeString = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{timeString}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Time';
    }
  }}
]


  const SalesManagement = () => {
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
  
  const { data: inventoryItems } = useSelector((state) => state.inventory)
  const { branchSettings, data: branches } = useSelector((state) => state.branches)
  const { data: warehouses, warehouseSettings } = useSelector((state) => state.warehouses)
  const { data: companies } = useSelector((state) => state.companies)
  const { data: retailers } = useSelector((state) => state.retailers)
    const { data: sales = [], loading: salesLoading, error: salesError } = useSelector((state) => state.sales || {})
  
  // Filter state for admin and warehouse keepers
  const [filters, setFilters] = useState({
    scopeType: 'all',
    scopeId: 'all',
    companyId: 'all',
    retailerId: 'all',
    startDate: '',
    endDate: ''
  })

  // New filter states for the integrated filters
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [scopeTypeFilter, setScopeTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Pagination states
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  
  // Drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [filteredSales, setFilteredSales] = useState([])
  
  // Export state
  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  
  // Refresh state
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Individual sale state for viewing
  const [selectedSale, setSelectedSale] = useState(null)
  const [saleItems, setSaleItems] = useState([])
  const [showItemsDialog, setShowItemsDialog] = useState(false)
  const [viewingSale, setViewingSale] = useState(null)
  
  // Editable invoice form state
  const [editingSale, setEditingSale] = useState(null)
  const [showEditableInvoice, setShowEditableInvoice] = useState(false)

  // Debug saleItems changes
  useEffect(() => {
    console.log('[Sales] saleItems state changed:', saleItems);
  }, [saleItems]);
  
  
  // Check if user can manage sales
  const canManageSales = () => {
    if (user?.role === 'ADMIN') return true
    if (user?.role === 'CASHIER') {
      return branchSettings?.allowCashierSalesEdit || false
    }
    if (user?.role === 'WAREHOUSE_KEEPER') {
      return warehouseSettings?.allowWarehouseSales || false
    }
    return false
  }
  
  const canEdit = canManageSales()
  
  // Dialog state management
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [entityToDelete, setEntityToDelete] = useState(null)


  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    console.log('[Sales] Manual refresh triggered')
    setRefreshKey(prev => prev + 1)
    const timestamp = Date.now()
    dispatch(fetchSales({ _t: timestamp }))
    dispatch(fetchSalesReturns({ _t: timestamp }))
  }, [dispatch])

  // Memoize the data update callback to prevent infinite loops
  const handleDataUpdate = useCallback(() => {
    console.log('[Sales] Data update callback triggered')
    const timestamp = Date.now()
    dispatch(fetchSales({ _t: timestamp }))
    dispatch(fetchSalesReturns({ _t: timestamp }))
  }, [dispatch])

  // Polling for real-time updates
  const { isPolling, lastUpdate, refreshData } = useSalesPolling({
    enabled: true,
    onDataUpdate: handleDataUpdate
  })

  useEffect(() => {
    // Load sales data with filters
    const salesParams = {}
    if (user?.role === 'ADMIN' && filters.scopeType !== 'all') {
      salesParams.scopeType = filters.scopeType
      if (filters.scopeId !== 'all') {
        salesParams.scopeId = filters.scopeId
      }
    }
    if (user?.role === 'WAREHOUSE_KEEPER' && filters.retailerId !== 'all') {
      salesParams.retailerId = filters.retailerId
    }
    if (user?.role === 'ADMIN' && filters.companyId !== 'all') {
      salesParams.companyId = filters.companyId
    }
    if (filters.startDate) {
      salesParams.startDate = filters.startDate
    }
    if (filters.endDate) {
      salesParams.endDate = filters.endDate
    }
    dispatch(fetchSales(salesParams))
    dispatch(fetchSalesReturns())
    
    // Load branches and warehouses for admin filter
    if (user?.role === 'ADMIN') {
      dispatch(fetchBranches())
      dispatch(fetchWarehouses())
    }
    
    // Load branch settings for cashier permissions
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }

    // Load warehouse settings for warehouse keeper permissions
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
      // Load retailers for warehouse keepers
      dispatch(fetchRetailers({ warehouseId: user.warehouseId }))
    }
    
    // Load inventory items for user's scope
    if (user) {
      const params = {}
      if (user.role === 'CASHIER') {
        // Cashiers can see all branch inventory (not just their own branch)
        params.scopeType = 'BRANCH'
        // No scopeId specified = all branches
      } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
        params.scopeType = 'WAREHOUSE'
        params.scopeId = user.warehouseId
      }
      // Admin can see all inventory (no scope restrictions)
      
      dispatch(fetchInventory(params))
    }
  }, [dispatch, user, filters])

  // Debug: Log sales data when it changes
  useEffect(() => {
    if (sales && sales.length > 0) {
    }
  }, [sales, salesLoading, salesError])


  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value }
      // Reset scopeId when scopeType changes
      if (field === 'scopeType') {
        newFilters.scopeId = 'all'
      }
      return newFilters
    })
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('')
    setPaymentMethodFilter('all')
    setStatusFilter('all')
    setScopeTypeFilter('all')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1) // Reset to first page when clearing filters
  }

  // Get filter summary
  const getFilterSummary = () => {
    const filters = []
    if (searchTerm) filters.push(`Search: "${searchTerm}"`)
    if (paymentMethodFilter !== 'all') filters.push(`Payment: ${paymentMethodFilter}`)
    if (statusFilter !== 'all') filters.push(`Status: ${statusFilter}`)
    if (scopeTypeFilter !== 'all') filters.push(`Scope: ${scopeTypeFilter}`)
    return filters
  }

  // Filter and sort sales
  const getFilteredAndSortedSales = () => {
    let filtered = (sales || []).filter(sale => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const invoiceMatch = sale.invoice_no?.toLowerCase().includes(searchLower)
        const customerMatch = sale.customerName?.toLowerCase().includes(searchLower)
        if (!invoiceMatch && !customerMatch) return false
      }

      // Payment method filter
      if (paymentMethodFilter !== 'all') {
        const paymentMethod = sale.paymentMethod || sale.payment_method
        const paymentStatus = sale.paymentStatus || sale.payment_status
        const creditAmount = sale.creditAmount || 0
        
        if (paymentMethodFilter === 'partial_payment') {
          // Check if this is a partial payment
          if (paymentStatus !== 'PARTIAL' && creditAmount <= 0) return false
        } else {
          // For other payment methods, check the actual payment method
          if (paymentMethod?.toLowerCase() !== paymentMethodFilter.toLowerCase()) return false
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const status = sale.status?.toLowerCase()
        if (status !== statusFilter.toLowerCase()) return false
      }

      // Scope type filter
      if (scopeTypeFilter !== 'all') {
        const scopeType = sale.scope_type || sale.scopeType
        if (scopeType !== scopeTypeFilter) return false
      }

      return true
    })

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'total':
          aValue = parseFloat(a.total || 0)
          bValue = parseFloat(b.total || 0)
          break
        case 'invoice_no':
          aValue = a.invoice_no || ''
          bValue = b.invoice_no || ''
          break
        case 'customerName':
          aValue = a.customerName || ''
          bValue = b.customerName || ''
          break
        case 'created_at':
        default:
          aValue = new Date(a.created_at || a.createdAt || 0)
          bValue = new Date(b.created_at || b.createdAt || 0)
          break
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }

  // Pagination logic
  const totalItems = getFilteredAndSortedSales().length
  const totalPages = Math.ceil(totalItems / rowsPerPage)
  const startIndex = (page - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedSales = getFilteredAndSortedSales().slice(startIndex, endIndex)

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(1) // Reset to first page when changing page size
  }

  // Apply filters and show in drawer
  const applyFilters = () => {
    if (filters.scopeType === 'all' && filters.scopeId === 'all' && !filters.startDate && !filters.endDate) {
      setFilteredSales(sales || [])
    } else {
      const filtered = (sales || []).filter(sale => {
        const saleScopeType = sale.scope_type || sale.scopeType
        const saleScopeId = sale.scope_id || sale.scopeId
        const saleDate = new Date(sale.createdAt || sale.date)
        
        let matchesScopeType = true
        let matchesScopeId = true
        let matchesDateRange = true
        
        if (filters.scopeType !== 'all') {
          matchesScopeType = saleScopeType === filters.scopeType
        }
        
        if (filters.scopeId !== 'all') {
          matchesScopeId = parseInt(saleScopeId) === parseInt(filters.scopeId)
        }
        
        // Date range filtering
        if (filters.startDate) {
          const startDate = new Date(filters.startDate)
          startDate.setHours(0, 0, 0, 0)
          matchesDateRange = matchesDateRange && saleDate >= startDate
        }
        
        if (filters.endDate) {
          const endDate = new Date(filters.endDate)
          endDate.setHours(23, 59, 59, 999)
          matchesDateRange = matchesDateRange && saleDate <= endDate
        }
        
        return matchesScopeType && matchesScopeId && matchesDateRange
      })
      
      setFilteredSales(filtered)
    }
    setFilterDrawerOpen(true)
  }

  // Clear old filters (for drawer)
  const clearOldFilters = () => {
    setFilters({
      scopeType: 'all',
      scopeId: 'all',
      companyId: 'all',
      retailerId: 'all',
      startDate: '',
      endDate: ''
    })
    setFilteredSales([])
    setFilterDrawerOpen(false)
  }

  // Check if filters are active
  const hasActiveFilters = filters.scopeType !== 'all' || filters.scopeId !== 'all' || filters.companyId !== 'all' || filters.retailerId !== 'all' || filters.startDate || filters.endDate

  // Function to fetch sale details with items for editing
  const fetchSaleForEdit = async (saleId) => {
    try {
      const result = await dispatch(getSale(saleId));
      if (getSale.fulfilled.match(result)) {
        const saleData = result.payload.data || result.payload;
        console.log('[Sales] fetchSaleForEdit saleData:', saleData);
        console.log('[Sales] fetchSaleForEdit items:', saleData.items);
        if (saleData.items && saleData.items.length > 0) {
          console.log('[Sales] First item structure:', saleData.items[0]);
          console.log('[Sales] First item unitPrice type:', typeof saleData.items[0].unitPrice);
          console.log('[Sales] First item unitPrice value:', saleData.items[0].unitPrice);
        }
        setSelectedSale(saleData);
        setSaleItems(saleData.items || []);
        return saleData;
      } else {
        console.error('Failed to fetch sale details:', result.payload);
        return null;
      }
    } catch (error) {
      console.error('Error fetching sale details:', error);
      return null;
    }
  };


  const handleDeleteSale = async () => {
    try {
      const result = await dispatch(deleteSale(entityToDelete.id))
      
      if (deleteSale.fulfilled.match(result)) {
        // Success - close dialog and refresh data
        setOpenDeleteDialog(false)
        setEntityToDelete(null)
        // Refresh the data to show updated list
        dispatch(fetchSales())
      } else if (deleteSale.rejected.match(result)) {
        // Error - show error message
        // You could show a toast notification here
        alert(`Failed to delete sale: ${result.payload || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to delete sale: ${error.message || 'Unknown error'}`)
    }
  }

  const handleCreateReturn = (returnData) => {
    dispatch(createSalesReturn(returnData))
    setOpenDialog(false)
  }

  // Editable invoice handlers
  const handleEditInvoice = async (sale) => {
    try {
      // Fetch full sale details with items
      const response = await api.get(`/sales/${sale.id}`)
      if (response.data.success) {
        setEditingSale(response.data.data)
        setShowEditableInvoice(true)
      } else {
        alert('Failed to load sale details')
      }
    } catch (error) {
      console.error('Error loading sale details:', error)
      alert('Failed to load sale details')
    }
  }

  const handleCloseEditableInvoice = () => {
    setShowEditableInvoice(false)
    setEditingSale(null)
  }

  const handleSaveEditableInvoice = (updatedSale) => {
    // Refresh sales data
    dispatch(fetchSales())
    dispatch(fetchInventory())
    
    // Close the dialog
    setShowEditableInvoice(false)
    setEditingSale(null)
  }

  // Export functions
  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget)
  }

  const handleExportClose = () => {
    setExportAnchorEl(null)
  }

  const exportToCSV = () => {
    const salesToExport = filteredSales.length > 0 ? filteredSales : sales || []
    const csvContent = generateCSV(salesToExport)
    downloadFile(csvContent, 'sales-data.csv', 'text/csv')
    handleExportClose()
  }

  const exportToExcel = async () => {
    const salesToExport = filteredSales.length > 0 ? filteredSales : sales || []
    const excelData = await generateExcel(salesToExport)
    
    // Determine if we got a buffer (proper Excel) or string (CSV fallback)
    const isBuffer = excelData instanceof ArrayBuffer || excelData instanceof Uint8Array
    const mimeType = isBuffer 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv'
    const fileExtension = isBuffer ? 'xlsx' : 'csv'
    
    // Create blob from Excel buffer or CSV string
    const blob = new Blob([excelData], { type: mimeType })
    
    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sales-data-${new Date().toISOString().split('T')[0]}.${fileExtension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    handleExportClose()
  }

  const exportToPDF = () => {
    const salesToExport = filteredSales.length > 0 ? filteredSales : sales || []
    const pdfContent = generatePDF(salesToExport)
    downloadFile(pdfContent, 'sales-data.pdf', 'application/pdf')
    handleExportClose()
  }

  const generateCSV = (salesData) => {
    const headers = ['ID', 'Date', 'Time', 'Invoice #', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment', 'Payment Method', 'Payment Type', 'Payment Status', 'Returns', 'Notes', 'Created By']
    const rows = salesData.map(sale => {
      // Calculate returns for this sale
      const returns = salesReturns?.filter(returnItem => returnItem.sale_id === sale.id) || [];
      const totalReturnedQty = returns.reduce((sum, returnItem) => {
        return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
      }, 0);
      
      const saleDate = new Date(sale.created_at);
      
      return [
        sale.id,
        saleDate.toLocaleDateString(),
        saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        sale.invoice_no || 'N/A',
        sale.customerInfo?.name || sale.customer_info?.name || 'N/A',
        parseFloat(sale.subtotal || 0).toFixed(2),
        parseFloat(sale.tax || 0).toFixed(2),
        parseFloat(sale.discount || 0).toFixed(2),
        parseFloat(sale.total || 0).toFixed(2),
        parseFloat(sale.payment_amount || 0).toFixed(2),
        sale.paymentMethod || sale.payment_method || 'N/A',
        sale.paymentType || sale.payment_type || 'N/A',
        sale.paymentStatus || sale.payment_status || 'N/A',
        totalReturnedQty,
        sale.notes || 'No Notes',
        sale.created_by || sale.username || sale.user_name || 'Unknown'
      ]
    })
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const generateExcel = async (salesData) => {
    try {
      // Try to use XLSX library for proper Excel format
      const XLSX = await import('xlsx')
      
      // Prepare data for Excel
      const excelData = salesData.map(sale => {
        // Calculate returns for this sale
        const returns = salesReturns?.filter(returnItem => returnItem.sale_id === sale.id) || [];
        const totalReturnedQty = returns.reduce((sum, returnItem) => {
          return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
        }, 0);
        
        const saleDate = new Date(sale.created_at);
        
        return {
          'ID': sale.id,
          'Date': saleDate.toLocaleDateString(),
          'Time': saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          'Invoice #': sale.invoice_no || 'N/A',
          'Customer': sale.customerInfo?.name || sale.customer_info?.name || 'N/A',
          'Subtotal': parseFloat(sale.subtotal || 0).toFixed(2),
          'Tax': parseFloat(sale.tax || 0).toFixed(2),
          'Discount': parseFloat(sale.discount || 0).toFixed(2),
          'Total': parseFloat(sale.total || 0).toFixed(2),
          'Payment': parseFloat(sale.payment_amount || 0).toFixed(2),
          'Payment Method': sale.paymentMethod || sale.payment_method || 'N/A',
          'Payment Type': sale.paymentType || sale.payment_type || 'N/A',
          'Payment Status': sale.paymentStatus || sale.payment_status || 'N/A',
          'Returns': totalReturnedQty,
          'Notes': sale.notes || 'No Notes',
          'Created By': sale.created_by || sale.username || sale.user_name || 'Unknown'
        };
      })
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Data')
      
      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { 
        type: 'array', 
        bookType: 'xlsx' 
      })
      
      return excelBuffer
    } catch (error) {
      console.warn('XLSX library not available, falling back to CSV format:', error)
      // Fallback to CSV format with Excel MIME type
      return generateCSV(salesData)
    }
  }

  const generatePDF = (salesData) => {
    // Generate HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .total-row { font-weight: bold; background-color: #e6f3ff; }
            .status-completed { color: #28a745; }
            .status-pending { color: #ffc107; }
            .status-cancelled { color: #dc3545; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sales Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>Total Records: ${salesData.length}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p>Total Sales: ${salesData.length}</p>
            <p>Total Amount: $${salesData.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0).toFixed(2)}</p>
            <p>Completed Payments: ${salesData.filter(sale => (sale.paymentStatus || sale.payment_status) === 'COMPLETED').length}</p>
            <p>Pending Payments: ${salesData.filter(sale => (sale.paymentStatus || sale.payment_status) === 'PENDING').length}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Subtotal</th>
                <th>Tax</th>
                <th>Discount</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Payment Method</th>
                <th>Payment Type</th>
                <th>Payment Status</th>
                <th>Returns</th>
                <th>Notes</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(sale => {
                // Calculate returns for this sale
                const returns = salesReturns?.filter(returnItem => returnItem.sale_id === sale.id) || [];
                const totalReturnedQty = returns.reduce((sum, returnItem) => {
                  return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
                }, 0);
                
                const saleDate = new Date(sale.created_at);
                
                return `
                <tr>
                  <td>${saleDate.toLocaleDateString()}</td>
                  <td>${saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                  <td>${sale.invoice_no || 'N/A'}</td>
                  <td>${sale.customerInfo?.name || sale.customer_info?.name || 'Walk-in Customer'}</td>
                  <td>$${parseFloat(sale.subtotal || 0).toFixed(2)}</td>
                  <td>$${parseFloat(sale.tax || 0).toFixed(2)}</td>
                  <td>$${parseFloat(sale.discount || 0).toFixed(2)}</td>
                  <td>$${parseFloat(sale.total || 0).toFixed(2)}</td>
                  <td>$${parseFloat(sale.payment_amount || 0).toFixed(2)}</td>
                  <td>${sale.paymentMethod || sale.payment_method || 'N/A'}</td>
                  <td>${sale.paymentType || sale.payment_type || 'N/A'}</td>
                  <td class="status-${(sale.paymentStatus || sale.payment_status)?.toLowerCase() || 'unknown'}">${sale.paymentStatus || sale.payment_status || 'N/A'}</td>
                  <td>${totalReturnedQty}</td>
                  <td>${sale.notes || 'No Notes'}</td>
                  <td>${sale.created_by || sale.username || sale.user_name || 'Unknown'}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    
    return htmlContent
  }

  const downloadFile = (content, filename, mimeType) => {
    if (mimeType === 'application/pdf') {
      // For PDF, open in new window and trigger print
      const printWindow = window.open('', '_blank')
      printWindow.document.write(content)
      printWindow.document.close()
      
      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        printWindow.print()
        printWindow.close()
      }
    } else {
      // For other formats (CSV, Excel), use blob download
      const blob = new Blob([content], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  }

  // Calculate sales statistics
  const salesStats = useMemo(() => {
    if (!sales || sales.length === 0) {
      return {
        totalSales: 0,
        totalTransactions: 0,
        averageOrderValue: 0,
        completedSales: 0
      }
    }

    const completedSales = sales.filter(sale => (sale.paymentStatus || sale.payment_status) === 'COMPLETED')
    const totalSales = completedSales.reduce((sum, sale) => sum + parseFloat(sale.total || sale.totalAmount || 0), 0)
    const totalTransactions = completedSales.length
    const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0

    return {
      totalSales,
      totalTransactions,
      averageOrderValue,
      completedSales: completedSales.length
    }
  }, [sales])

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
        <PermissionCheck roles={['ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_KEEPER']}>
          <Box sx={{ p: 3 }}>
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
            
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                Sales Management
              </Typography>
            </Box>

            {/* Sales Statistics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Sales
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salesStats.totalSales.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Transactions
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salesStats.totalTransactions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Average Order Value
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salesStats.averageOrderValue.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Completed Sales
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salesStats.completedSales}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Sales Transactions Table */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Sales Transactions
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleManualRefresh}
                    disabled={salesLoading}
                    sx={{ minWidth: 120 }}
                  >
                    Refresh
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<ExportIcon />}
                    onClick={handleExportClick}
                    sx={{ minWidth: 120 }}
                  >
                    Export
                  </Button>
                </Box>
              </Box>
              
              {/* Simple Sales Table */}
              <Card>
                <CardContent>
                  {/* Search and Filter Section */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <FilterIcon sx={{ mr: 1, fontSize: 20 }} />
                      <Typography variant="subtitle2">Search & Filters</Typography>
                    </Box>
                    
                    <Grid container spacing={2} sx={{ mb: 1 }} alignItems="center">
                      {/* Search Input */}
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                        size="small"
                          label="Search Sales"
                          placeholder="Search by invoice, customer..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon />
                              </InputAdornment>
                            ),
                            endAdornment: searchTerm && (
                              <InputAdornment position="end">
                                <IconButton
                        size="small"
                                  onClick={() => setSearchTerm('')}
                                  edge="end"
                                >
                                  <ClearIcon />
                                </IconButton>
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>

                      {/* Payment Method Filter */}
                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Payment Method</InputLabel>
                        <Select
                            value={paymentMethodFilter}
                            label="Payment Method"
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Methods</MenuItem>
                            <MenuItem value="cash">Cash</MenuItem>
                            <MenuItem value="card">Card</MenuItem>
                            <MenuItem value="upi">UPI</MenuItem>
                            <MenuItem value="netbanking">Net Banking</MenuItem>
                            <MenuItem value="partial_payment">Partial Payment</MenuItem>
                        </Select>
                      </FormControl>
                      </Grid>

                      {/* Status Filter */}
                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Status</InputLabel>
                        <Select
                            value={statusFilter}
                            label="Status"
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Status</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="cancelled">Cancelled</MenuItem>
                        </Select>
                      </FormControl>
                      </Grid>

                      {/* Scope Type Filter */}
                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Scope</InputLabel>
                        <Select
                            value={scopeTypeFilter}
                            label="Scope"
                            onChange={(e) => setScopeTypeFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Scopes</MenuItem>
                            <MenuItem value="BRANCH">Branch</MenuItem>
                            <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                        </Select>
                      </FormControl>
                      </Grid>

                      {/* Sort By */}
                      <Grid item xs={12} md={1}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Sort By</InputLabel>
                          <Select
                            value={sortBy}
                            label="Sort By"
                            onChange={(e) => setSortBy(e.target.value)}
                          >
                            <MenuItem value="created_at">Date</MenuItem>
                            <MenuItem value="total">Total</MenuItem>
                            <MenuItem value="invoice_no">Invoice</MenuItem>
                            <MenuItem value="customerName">Customer</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {/* Action Icons */}
                      <Grid item xs={12} md={1}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Clear all filters">
                            <IconButton
                      size="small"
                              onClick={clearFilters}
                              disabled={getFilterSummary().length === 0}
                            >
                              <ClearIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title={sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}>
                            <IconButton
                      size="small"
                              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            >
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </IconButton>
                          </Tooltip>
                  </Box>
                      </Grid>
                    </Grid>

                    {/* Filter Summary */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {getFilterSummary().length > 0 && (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            Active filters:
                          </Typography>
                          {getFilterSummary().map((filter, index) => (
                        <Chip
                              key={index}
                              label={filter}
                          size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                        </>
                      )}
                      {getFilterSummary().length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          No filters applied - showing all items
                        </Typography>
                      )}
                    </Box>

                    {/* Results Summary */}
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} sales
                      </Typography>
                    </Box>
                  </Box>
                  {salesLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress />
                    </Box>
                  ) : salesError ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {typeof salesError === 'string' ? salesError : salesError.message || 'Failed to load sales data'}
                    </Alert>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Time</TableCell>
                            <TableCell>Invoice #</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell align="right">Subtotal</TableCell>
                            <TableCell align="right">Tax</TableCell>
                            <TableCell align="right">Discount</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell>Payment Method</TableCell>
                              <TableCell>Payment Type</TableCell>
                            <TableCell>Payment Terms</TableCell>
                            <TableCell>Payment Status</TableCell>
                            <TableCell>Created By</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedSales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell>{sale.id}</TableCell>
                              <TableCell>
                                {(() => {
                                  try {
                                    const date = new Date(sale.created_at);
                                    if (isNaN(date.getTime())) return 'N/A';
                                    return date.toLocaleDateString();
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  try {
                                    const date = new Date(sale.created_at);
                                    return date.toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
                              </TableCell>
                              <TableCell>{sale.invoice_no || 'N/A'}</TableCell>
                              <TableCell>
                        <Chip
                                  label={sale.scope_type === 'WAREHOUSE' ? 'Wholesale' : 'Retail'} 
                                  color={sale.scope_type === 'WAREHOUSE' ? 'secondary' : 'primary'}
                          size="small"
                        />
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  if (sale.customerInfo && sale.customerInfo.name) {
                                    return sale.customerInfo.name;
                                  }
                                  if (sale.customer_info) {
                                    try {
                                      const customerInfo = JSON.parse(sale.customer_info);
                                      return customerInfo.name || 'No Customer';
                                    } catch (e) {
                                      return 'No Customer';
                                    }
                                  }
                                  return 'No Customer';
                                })()}
                              </TableCell>
                              <TableCell align="right">{parseFloat(sale.subtotal || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">{parseFloat(sale.tax || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">{parseFloat(sale.discount || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">{parseFloat(sale.total || 0).toFixed(2)}</TableCell>
                              <TableCell>
                                {(() => {
                                  // Get payment details
                                  const paymentStatus = sale.paymentStatus || sale.payment_status;
                                  const creditAmount = parseFloat(sale.creditAmount || 0);
                                  const paymentAmount = parseFloat(sale.paymentAmount || 0);
                                  const total = parseFloat(sale.total || 0);
                                  
                                  // Get payment method first
                                  let paymentMethod = sale.paymentMethod || sale.payment_method;
                                  if (!paymentMethod && sale.customer_info) {
                                    try {
                                      const customerInfo = typeof sale.customer_info === 'string' 
                                        ? JSON.parse(sale.customer_info) 
                                        : sale.customer_info;
                                      paymentMethod = customerInfo.paymentMethod;
                                    } catch (e) {
                                      // Silent error handling
                                    }
                                  }

                                  // ✅ CORRECTED LOGIC: Show payment method based on actual payment_method field
                                  if (paymentMethod === 'FULLY_CREDIT') {
                                    return <Chip label="FULLY CREDIT" color="error" size="small" />;
                                  }
                                  
                                  if (paymentMethod === 'PARTIAL_PAYMENT') {
                                    return <Chip label="PARTIAL PAYMENT" color="warning" size="small" />;
                                  }
                                  
                                  // For other payment methods, show the method
                                  const methodColors = {
                                    'CASH': 'success',
                                    'CARD': 'primary',
                                    'BANK_TRANSFER': 'info',
                                    'MOBILE_PAYMENT': 'secondary',
                                    'CHEQUE': 'warning'
                                  };
                                  
                                  return (
                                    <Chip 
                                      label={paymentMethod?.replace('_', ' ').toUpperCase() || 'N/A'} 
                                      color={methodColors[paymentMethod] || 'default'}
                                      size="small"
                                    />
                                  );
                                })()}
                              </TableCell>
                                <TableCell>
                                  {(() => {
                                    // Get payment type
                                    let paymentType = sale.paymentType || sale.payment_type;
                                    if (!paymentType && sale.customer_info) {
                                      try {
                                        const customerInfo = typeof sale.customer_info === 'string' 
                                          ? JSON.parse(sale.customer_info) 
                                          : sale.customer_info;
                                        paymentType = customerInfo.paymentType;
                                      } catch (e) {
                                        // Silent error handling
                                      }
                                    }
                                    
                                    // Format payment type
                                    const typeColors = {
                                      'FULL_PAYMENT': 'success',
                                      'PARTIAL_PAYMENT': 'warning',
                                      'FULLY_CREDIT': 'error',
                                      'CASH': 'success',
                                      'CARD': 'primary',
                                      'BANK_TRANSFER': 'info',
                                      'CHEQUE': 'warning'
                                    };
                                    
                                    const typeLabels = {
                                      'FULL_PAYMENT': 'Full Payment',
                                      'PARTIAL_PAYMENT': 'Partial Payment',
                                      'FULLY_CREDIT': 'Fully Credit',
                                      'CASH': 'Cash',
                                      'CARD': 'Card',
                                      'BANK_TRANSFER': 'Bank Transfer',
                                      'CHEQUE': 'Cheque'
                                    };
                                    
                                    return (
                                      <Chip 
                                        label={typeLabels[paymentType] || paymentType || 'N/A'} 
                                        color={typeColors[paymentType] || 'default'}
                                        size="small"
                                      />
                                    );
                                  })()}
                                </TableCell>
                              <TableCell>
                                {(() => {
                                  let paymentMethod = sale.paymentMethod || sale.payment_method;
                                  if (!paymentMethod && sale.customer_info) {
                                    try {
                                      const customerInfo = typeof sale.customer_info === 'string' 
                                        ? JSON.parse(sale.customer_info) 
                                        : sale.customer_info;
                                      paymentMethod = customerInfo.paymentMethod;
                                    } catch (e) {
                                      // Silent error handling
                                    }
                                  }
                                  
                                  if (paymentMethod === 'CREDIT') {
                                    let customerInfo = sale.customerInfo;
                                    if (!customerInfo && sale.customer_info) {
                                      try {
                                        customerInfo = typeof sale.customer_info === 'string' 
                                          ? JSON.parse(sale.customer_info) 
                                          : sale.customer_info;
                                      } catch (e) {
                                        // Silent error handling
                                      }
                                    }
                                    
                                    if (customerInfo && customerInfo.paymentTerms) {
                                      return customerInfo.paymentTerms;
                                    }
                                    return 'N/A';
                                  }
                                  return '-';
                                })()}
                              </TableCell>
                              <TableCell>
                        <Chip
                                  label={sale.paymentStatus || sale.payment_status || 'N/A'} 
                                  color={(sale.paymentStatus || sale.payment_status) === 'COMPLETED' ? 'success' : (sale.paymentStatus || sale.payment_status) === 'PENDING' ? 'error' : 'default'}
                          size="small"
                        />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" fontWeight="medium">
                                    {sale.created_by || sale.username || sale.user_name || 'Unknown'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  {canEdit && (
                                    <>
                                      <Tooltip title="View Items">
                                        <IconButton
                                          size="small"
                                          onClick={async () => {
                                            setViewingSale(sale)
                                            await fetchSaleForEdit(sale.id)
                                            setShowItemsDialog(true)
                                          }}
                                          color="info"
                                        >
                                          <ViewIcon />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Edit Invoice">
                                        <IconButton
                                          size="small"
                                          onClick={() => handleEditInvoice(sale)}
                                          color="secondary"
                                        >
                                          <ReceiptIcon />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete">
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            setEntityToDelete(sale)
                  setOpenDeleteDialog(true)
                                          }}
                                          color="error"
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                      )}
                    </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Rows per page:
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                          <Select
                            value={rowsPerPage}
                            onChange={handleRowsPerPageChange}
                            displayEmpty
                          >
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={25}>25</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                          </Select>
                        </FormControl>
            </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Page {page} of {totalPages}
                </Typography>
                        <Pagination
                          count={totalPages}
                          page={page}
                          onChange={handlePageChange}
                          color="primary"
                          size="small"
                          showFirstButton
                          showLastButton
                        />
                      </Box>
              </Box>
            )}
                </CardContent>
              </Card>
            </Box>

          </Box>
        </PermissionCheck>
      </RouteGuard>
      
      
      
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={openDeleteDialog}
        onClose={() => {
          setOpenDeleteDialog(false)
          setEntityToDelete(null)
        }}
        onConfirm={handleDeleteSale}
        title="Delete Sale"
        message={`Are you sure you want to delete this sale? This action cannot be undone.`}
      />
      
      {/* Sale Items Dialog */}
      <Dialog open={showItemsDialog} onClose={() => setShowItemsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Sale Items - {viewingSale?.invoice_no}</Typography>
            <Button onClick={() => setShowItemsDialog(false)}>Close</Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {saleItems.length > 0 ? (
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
                      <TableCell>{item.itemName || item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
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
      
      {/* Filter Results Drawer */}
      <Drawer
        anchor="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            height: '70vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Filtered Sales Results
              <Badge badgeContent={filteredSales.length} color="primary" sx={{ ml: 2 }} />
            </Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          {filteredSales.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No sales found matching the selected filters.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ height: 'calc(70vh - 120px)', overflow: 'auto' }}>
              <List>
                {filteredSales.map((sale, index) => (
                  <React.Fragment key={sale.id || index}>
                    <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Sale #{sale.receiptNumber || sale.id}
                        </Typography>
                        <Chip
                          label={sale.scope_type || sale.scopeType || 'Unknown'}
                          color={sale.scope_type === 'BRANCH' || sale.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                          size="small"
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', width: '100%' }}>
                        <ListItemText
                          primary="Date"
                          secondary={new Date(sale.createdAt || sale.date).toLocaleDateString()}
                          sx={{ minWidth: 100 }}
                        />
                        <ListItemText
                          primary="Time"
                          secondary={new Date(sale.createdAt || sale.date).toLocaleTimeString()}
                          sx={{ minWidth: 100 }}
                        />
                        <ListItemText
                          primary="Customer"
                          secondary={sale.customerName || 'Walk-in'}
                          sx={{ minWidth: 120 }}
                        />
                        <ListItemText
                          primary="Total"
                          secondary={`${parseFloat(sale.total || 0).toFixed(2)}`}
                          sx={{ minWidth: 100 }}
                        />
                        <ListItemText
                          primary="Payment"
                          secondary={sale.paymentMethod || 'Cash'}
                          sx={{ minWidth: 100 }}
                        />
                        <ListItemText
                          primary="Location"
                          secondary={
                            sale.scope_type === 'BRANCH' || sale.scopeType === 'BRANCH'
                              ? (branches || []).find(b => b.id === (sale.scope_id || sale.scopeId))?.name || `Branch ${sale.scope_id || sale.scopeId}`
                              : (warehouses || []).find(w => w.id === (sale.scope_id || sale.scopeId))?.name || `Warehouse ${sale.scope_id || sale.scopeId}`
                          }
                          sx={{ minWidth: 150 }}
                        />
                      </Box>
                      
                      {sale.items && sale.items.length > 0 && (
                        <Box sx={{ mt: 1, width: '100%' }}>
                          <Typography variant="caption" color="text.secondary">
                            Items: {sale.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                          </Typography>
                        </Box>
                      )}
                    </ListItem>
                    {index < filteredSales.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </Drawer>
      
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
        <MenuItem onClick={exportToCSV}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={exportToExcel}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as Excel
        </MenuItem>
        <MenuItem onClick={exportToPDF}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as PDF
        </MenuItem>
      </Menu>
      
      {/* Editable Invoice Form */}
      <EditableInvoiceForm
        open={showEditableInvoice}
        onClose={handleCloseEditableInvoice}
        sale={editingSale}
        onSave={handleSaveEditableInvoice}
      />
    </DashboardLayout>
  )
}

  export default withAuth(SalesManagement)