'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import { Box, Typography, Chip, Button, Grid, Card, CardContent, FormControl, InputLabel, Select, MenuItem, Paper, Drawer, List, ListItem, ListItemText, Divider, IconButton, Badge, TextField, Menu, ListItemIcon } from '@mui/material'
import { Close as CloseIcon, FilterList as FilterIcon, GetApp as ExportIcon, FileDownload as DownloadIcon } from '@mui/icons-material'
import { DataGrid } from '@mui/x-data-grid'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import PollingStatusIndicator from '../../../components/polling/PollingStatusIndicator'
import useEntityCRUD from '../../../hooks/useEntityCRUD'
import { useSalesPolling } from '../../../hooks/usePolling'
import { fetchSales, createSale, updateSale, deleteSale, fetchSalesReturns, createSalesReturn } from '../../store/slices/salesSlice'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { fetchBranchSettings, fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses, fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchCompanies } from '../../store/slices/companiesSlice'
import { fetchRetailers } from '../../store/slices/retailersSlice'
import usePermissions from '../../../hooks/usePermissions'
import pollingService from '../../../utils/pollingService'

// Validation schema for sales
const salesSchema = yup.object({
  customerName: yup.string().required('Customer name is required').max(100, 'Customer name cannot exceed 100 characters'),
  customerEmail: yup.string().email('Invalid email format').optional(),
  customerPhone: yup.string().optional().max(20, 'Customer phone cannot exceed 20 characters'),
  customerAddress: yup.string().optional().max(200, 'Customer address cannot exceed 200 characters'),
  subtotal: yup.number().required('Subtotal is required').min(0.01, 'Subtotal must be greater than 0'),
  tax: yup.number().nullable().transform((value, originalValue) => {
    return originalValue === '' ? 0 : value;
  }).min(0, 'Tax must be non-negative'),
  discount: yup.number().nullable().transform((value, originalValue) => {
    return originalValue === '' ? 0 : value;
  }).min(0, 'Discount must be non-negative'),
  paymentMethod: yup.string().required('Payment method is required').oneOf(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT']),
  paymentStatus: yup.string().required('Payment status is required').oneOf(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
  status: yup.string().required('Status is required').oneOf(['PENDING', 'COMPLETED', 'CANCELLED']),
  notes: yup.string().optional().max(500, 'Notes cannot exceed 500 characters'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
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
  { field: 'total', headerName: 'Total', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
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
  { 
    field: 'payment_method', 
    headerName: 'Payment Method', 
    width: 150,
    renderCell: (params) => {
      let paymentMethod = params.row.payment_method || params.row.paymentMethod;
      
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
        return <Chip label="N/A" color="default" size="small" />;
      }
      
      const methodColors = {
        'CASH': 'success',
        'CARD': 'primary',
        'BANK_TRANSFER': 'info',
        'MOBILE_PAYMENT': 'secondary',
        'CHEQUE': 'warning',
        'CREDIT': 'error'
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
    field: 'payment_terms', 
    headerName: 'Payment Terms', 
    width: 150,
    renderCell: (params) => {
      // First, get the payment method
      let paymentMethod = params.row.payment_method || params.row.paymentMethod;
      
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
  { field: 'payment_status', headerName: 'Payment Status', width: 130, renderCell: (params) => {
    const paymentStatus = params.row.payment_status || params.row.paymentStatus;
    if (!paymentStatus) {
      return <Chip label="N/A" color="default" size="small" />;
    }
    return (
      <Chip 
        label={paymentStatus.replace('-', ' ').toUpperCase()} 
        color={paymentStatus === 'COMPLETED' ? 'success' : paymentStatus === 'PENDING' ? 'warning' : paymentStatus === 'FAILED' ? 'error' : 'default'}
        size="small"
      />
    );
  }},
  { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => {
    const status = params.row.status;
    if (!status) {
      return <Chip label="N/A" color="default" size="small" />;
    }
    return (
      <Chip 
        label={status.replace('-', ' ').toUpperCase()} 
        color={status === 'COMPLETED' ? 'success' : status === 'PENDING' ? 'warning' : status === 'CANCELLED' ? 'error' : 'default'}
        size="small"
      />
    );
  }},
  { field: 'branch_name', headerName: 'Branch', width: 120 },
  { field: 'created_at', headerName: 'Date', width: 150, renderCell: (params) => {
    if (!params || !params.value) {
      return 'N/A';
    }
    try {
      return new Date(params.value).toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  }},
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
  { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => {
    if (!params || !params.value) {
      return <Chip label="N/A" color="default" size="small" />;
    }
    return (
      <Chip 
        label={params.value.replace('-', ' ').toUpperCase()} 
        color={params.value === 'approved' ? 'success' : params.value === 'pending' ? 'warning' : 'default'}
        size="small"
      />
    );
  }},
  { field: 'created_at', headerName: 'Date', width: 150, renderCell: (params) => {
    if (!params || !params.value) {
      return 'N/A';
    }
    try {
      return new Date(params.value).toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  }}
]

// Helper function to calculate total amount
const calculateTotal = (subtotal, tax = 0, discount = 0) => {
  const subtotalNum = parseFloat(subtotal) || 0
  const taxNum = parseFloat(tax) || 0
  const discountNum = parseFloat(discount) || 0
  return subtotalNum + taxNum - discountNum
}

// Transform sale data to form data format
const transformSaleToFormData = (sale) => {
  if (!sale) return null;
  
  
  const transformed = {
    scopeType: sale.scope_type || sale.scopeType || 'BRANCH',
    scopeId: sale.scope_id || sale.scopeId || 1,
    subtotal: parseFloat(sale.subtotal) || 0,
    tax: parseFloat(sale.tax) || 0,
    discount: parseFloat(sale.discount) || 0,
    total: parseFloat(sale.total) || 0,
    paymentMethod: sale.payment_method || sale.paymentMethod || 'CASH',
    paymentStatus: sale.payment_status || sale.paymentStatus || '',
    status: sale.status || 'PENDING',
    customerName: sale.customerInfo?.name || sale.customer_info?.name || '',
    customerEmail: sale.customerInfo?.email || sale.customer_info?.email || '',
    customerPhone: sale.customerInfo?.phone || sale.customer_info?.phone || '',
    customerAddress: sale.customerInfo?.address || sale.customer_info?.address || '',
    notes: sale.notes || ''
  };
  
  return transformed;
}

const SalesPage = () => {
  const dispatch = useDispatch()
  const { data: sales, loading: salesLoading, error: salesError, returns: salesReturns } = useSelector((state) => state.sales)
  const { user } = useSelector((state) => state.auth)
  
  const { data: inventoryItems } = useSelector((state) => state.inventory)
  const { branchSettings, data: branches } = useSelector((state) => state.branches)
  const { data: warehouses, warehouseSettings } = useSelector((state) => state.warehouses)
  const { data: companies } = useSelector((state) => state.companies)
  const { data: retailers } = useSelector((state) => state.retailers)
  
  // Filter state for admin and warehouse keepers
  const [filters, setFilters] = useState({
    scopeType: 'all',
    scopeId: 'all',
    companyId: 'all',
    retailerId: 'all',
    startDate: '',
    endDate: ''
  })
  
  // Drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [filteredSales, setFilteredSales] = useState([])
  
  // Export state
  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  
  // Determine user's scope automatically
  const getUserScope = () => {
    if (!user) return { scopeType: 'BRANCH', scopeId: 1 }
    
    if (user.role === 'CASHIER' && user.branchId) {
      return { scopeType: 'BRANCH', scopeId: user.branchId }
    } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
      return { scopeType: 'WAREHOUSE', scopeId: user.warehouseId }
    }
    
    // Default for admin or users without specific assignment
    return { scopeType: 'BRANCH', scopeId: 1 }
  }
  
  const userScope = getUserScope()
  
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
  const [openDialog, setOpenDialog] = useState(false)
  const [editingEntity, setEditingEntity] = useState(null)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [entityToDelete, setEntityToDelete] = useState(null)
  const [calculatedTotal, setCalculatedTotal] = useState(0)

  // Handle form field changes for real-time calculation
  const handleFormFieldChange = (fieldName, value) => {
    if (fieldName === 'subtotal' || fieldName === 'tax' || fieldName === 'discount') {
      const subtotal = fieldName === 'subtotal' ? parseFloat(value) || 0 : (editingEntity?.subtotal || 0)
      const tax = fieldName === 'tax' ? parseFloat(value) || 0 : (editingEntity?.tax || 0)
      const discount = fieldName === 'discount' ? parseFloat(value) || 0 : (editingEntity?.discount || 0)
      
      const newTotal = calculateTotal(subtotal, tax, discount)
      setCalculatedTotal(newTotal)
    }
  }

  // Update calculated total when editing entity changes
  useEffect(() => {
    if (editingEntity) {
      const formData = transformSaleToFormData(editingEntity)
      if (formData) {
        const total = calculateTotal(formData.subtotal, formData.tax, formData.discount)
        setCalculatedTotal(total)
      }
    } else {
      setCalculatedTotal(0)
    }
  }, [editingEntity])

  // Update calculated total when dialog opens for new sale
  useEffect(() => {
    if (openDialog && !editingEntity) {
      setCalculatedTotal(0)
    }
  }, [openDialog, editingEntity])

  // Memoize the data update callback to prevent infinite loops
  const handleDataUpdate = useCallback(() => {
    dispatch(fetchSales())
    dispatch(fetchSalesReturns())
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

  // Handle refresh function
  const handleRefresh = () => {
    // Clear Redux state first
    dispatch({ type: 'sales/clearError' })
    // Then fetch fresh data with current filters
    const salesParams = {}
    if (user?.role === 'ADMIN' && filters.scopeType !== 'all') {
      salesParams.scopeType = filters.scopeType
      if (filters.scopeId !== 'all') {
        salesParams.scopeId = filters.scopeId
      }
    }
    dispatch(fetchSales(salesParams))
    dispatch(fetchSalesReturns())
  }

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

  // Clear filters
  const clearFilters = () => {
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

  // CRUD handler functions
  const handleCreateSale = async (formData) => {
    try {
      // Calculate total automatically (tax and discount are optional)
      const calculatedTotal = calculateTotal(formData.subtotal, formData.tax, formData.discount)
      
      // Use user's scope instead of form data
      const saleData = {
        scopeType: userScope.scopeType,
        scopeId: userScope.scopeId,
        subtotal: parseFloat(formData.subtotal) || 0,
        tax: parseFloat(formData.tax) || 0,
        discount: parseFloat(formData.discount) || 0,
        total: calculatedTotal,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus || 'PENDING',
        status: formData.status || 'PENDING',
        customerInfo: {
          name: formData.customerName || 'Walk-in Customer',
          email: formData.customerEmail || '',
          phone: formData.customerPhone || '',
          address: formData.customerAddress || ''
        },
        notes: formData.notes || '',
        items: [
          // Find first available inventory item from user's scope
          ...(inventoryItems?.filter(item => 
            item.scopeType === userScope.scopeType && 
            item.scopeId === userScope.scopeId &&
            item.currentStock > 0
          ).slice(0, 1).map(item => ({
            inventoryItemId: item.id,
            sku: item.sku,
            name: item.name,
            quantity: 1,
            unitPrice: parseFloat(formData.subtotal) || item.sellingPrice,
            discount: parseFloat(formData.discount) || 0
          })) || [{
            // Fallback if no inventory items found
            inventoryItemId: 1,
            sku: 'DEFAULT',
            name: 'Default Item',
            quantity: 1,
            unitPrice: parseFloat(formData.subtotal) || 100,
            discount: parseFloat(formData.discount) || 0
          }])
        ]
      }
      
      const result = await dispatch(createSale(saleData));
      
      if (createSale.fulfilled.match(result)) {
        setOpenDialog(false);
        // Refresh the sales list
        dispatch(fetchSales());
      } else if (createSale.rejected.match(result)) {
        alert(`Failed to create sale: ${result.payload}`);
      }
    } catch (error) {
      alert(`Error creating sale: ${error.message}`);
    }
  }

  const handleUpdateSale = async (formData) => {
    try {
      // Calculate total automatically (tax and discount are optional)
      const calculatedTotal = calculateTotal(formData.subtotal, formData.tax, formData.discount)
      
      // Transform form data to match backend API
      const saleData = {
        scopeType: formData.scopeType,
        scopeId: parseInt(formData.scopeId), // Ensure scopeId is an integer
        subtotal: parseFloat(formData.subtotal) || 0,
        tax: parseFloat(formData.tax) || 0, // Convert empty string to 0
        discount: parseFloat(formData.discount) || 0, // Convert empty string to 0
        total: calculatedTotal,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus, // Don't default to PENDING
        status: formData.status, // Don't default to PENDING
        customerName: formData.customerName || '',
        customerEmail: formData.customerEmail || '',
        customerPhone: formData.customerPhone || '',
        customerAddress: formData.customerAddress || '',
        notes: formData.notes || '',
        items: [
          // Use a valid inventory item for BRANCH scope
          {
            inventoryItemId: 6, // Laptop Computer with BRANCH scope
            sku: 'LAPTOP001',
            name: 'Laptop Computer',
            quantity: 1,
            unitPrice: parseFloat(formData.subtotal) || 999.99,
            discount: parseFloat(formData.discount) || 0
          }
        ]
      }
      
      
      const result = await dispatch(updateSale({ id: editingEntity.id, data: saleData }));
      
      if (updateSale.fulfilled.match(result)) {
        setOpenDialog(false);
        setEditingEntity(null);
        // Refresh the sales list
        dispatch(fetchSales());
      } else if (updateSale.rejected.match(result)) {
        alert(`Failed to update sale: ${result.payload}`);
      }
    } catch (error) {
      alert(`Error updating sale: ${error.message}`);
    }
  }

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

  const exportToExcel = () => {
    const salesToExport = filteredSales.length > 0 ? filteredSales : sales || []
    const excelContent = generateExcel(salesToExport)
    downloadFile(excelContent, 'sales-data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    handleExportClose()
  }

  const exportToPDF = () => {
    const salesToExport = filteredSales.length > 0 ? filteredSales : sales || []
    const pdfContent = generatePDF(salesToExport)
    downloadFile(pdfContent, 'sales-data.pdf', 'application/pdf')
    handleExportClose()
  }

  const generateCSV = (salesData) => {
    const headers = ['ID', 'Invoice #', 'Customer', 'Date', 'Amount', 'Payment Method', 'Payment Status', 'Status']
    const rows = salesData.map(sale => [
      sale.id,
      sale.invoice_no || 'N/A',
      sale.customerInfo?.name || sale.customer_info?.name || 'N/A',
      new Date(sale.created_at).toLocaleDateString(),
      parseFloat(sale.total || 0).toFixed(2),
      sale.payment_method || 'N/A',
      sale.payment_status || 'N/A',
      sale.status || 'N/A'
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const generateExcel = (salesData) => {
    // Simple Excel-like format (CSV with Excel MIME type)
    return generateCSV(salesData)
  }

  const generatePDF = (salesData) => {
    // Simple PDF content (text format)
    const content = `Sales Report\nGenerated: ${new Date().toLocaleDateString()}\n\n` +
      salesData.map(sale => 
        `Invoice: ${sale.invoice_no || 'N/A'}\n` +
        `Customer: ${sale.customerInfo?.name || sale.customer_info?.name || 'N/A'}\n` +
        `Date: ${new Date(sale.created_at).toLocaleDateString()}\n` +
        `Amount: $${parseFloat(sale.total || 0).toFixed(2)}\n` +
        `Payment: ${sale.payment_method || 'N/A'}\n` +
        `Status: ${sale.status || 'N/A'}\n` +
        '---\n'
      ).join('\n')
    
    return content
  }

  const downloadFile = (content, filename, mimeType) => {
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

  // Calculate sales statistics
  const salesStats = React.useMemo(() => {
    if (!sales || sales.length === 0) {
      return {
        totalSales: 0,
        totalTransactions: 0,
        averageOrderValue: 0,
        completedSales: 0
      }
    }

    const completedSales = sales.filter(sale => sale.status === 'COMPLETED')
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
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                Sales Management
              </Typography>
              <PollingStatusIndicator 
                isPolling={isPolling} 
                lastUpdate={lastUpdate}
                onRefresh={refreshData}
              />
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
                    startIcon={<ExportIcon />}
                    onClick={handleExportClick}
                    sx={{ minWidth: 120 }}
                  >
                    Export
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={handleRefresh}
                    sx={{ minWidth: 120 }}
                  >
                    Force Refresh
                  </Button>
                </Box>
              </Box>
              
              {/* Admin and Warehouse Keeper Filter Controls */}
              {(user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_KEEPER') && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2">
                      {user?.role === 'ADMIN' ? 'Filter Sales by Location' : 'Filter Sales by Retailer'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                      >
                        Clear
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<FilterIcon />}
                        onClick={applyFilters}
                        disabled={!hasActiveFilters}
                      >
                        Apply Filters
                      </Button>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {user?.role === 'ADMIN' && (
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Scope Type</InputLabel>
                        <Select
                          value={filters.scopeType}
                          label="Scope Type"
                          onChange={(e) => handleFilterChange('scopeType', e.target.value)}
                        >
                          <MenuItem value="all">All Types</MenuItem>
                          <MenuItem value="BRANCH">Branch Sales</MenuItem>
                          <MenuItem value="WAREHOUSE">Warehouse Sales</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                    
                    {user?.role === 'WAREHOUSE_KEEPER' && (
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Retailer</InputLabel>
                        <Select
                          value={filters.retailerId}
                          label="Retailer"
                          onChange={(e) => handleFilterChange('retailerId', e.target.value)}
                        >
                          <MenuItem value="all">All Retailers</MenuItem>
                          {(retailers || []).map((retailer) => (
                            <MenuItem key={retailer.id} value={retailer.id}>
                              {retailer.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    
                    {user?.role === 'ADMIN' && filters.scopeType !== 'all' && (
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>
                          {filters.scopeType === 'BRANCH' ? 'Branch' : 'Warehouse'}
                        </InputLabel>
                        <Select
                          value={filters.scopeId}
                          label={filters.scopeType === 'BRANCH' ? 'Branch' : 'Warehouse'}
                          onChange={(e) => handleFilterChange('scopeId', e.target.value)}
                        >
                          <MenuItem value="all">
                            All {filters.scopeType === 'BRANCH' ? 'Branches' : 'Warehouses'}
                          </MenuItem>
                          {filters.scopeType === 'BRANCH' 
                            ? (branches || []).map((branch) => (
                                <MenuItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </MenuItem>
                              ))
                            : (warehouses || []).map((warehouse) => (
                                <MenuItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </MenuItem>
                              ))
                          }
                        </Select>
                      </FormControl>
                    )}
                    
                    <TextField
                      size="small"
                      label="Start Date"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 150 }}
                    />
                    
                    <TextField
                      size="small"
                      label="End Date"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 150 }}
                    />
                  </Box>
                  
                  {hasActiveFilters && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {user?.role === 'ADMIN' && (
                        <Chip
                          label={`Type: ${filters.scopeType === 'BRANCH' ? 'Branch' : filters.scopeType === 'WAREHOUSE' ? 'Warehouse' : 'All'}`}
                          color="primary"
                          size="small"
                        />
                      )}
                      {user?.role === 'ADMIN' && filters.scopeId !== 'all' && (
                        <Chip
                          label={`Location: ${filters.scopeType === 'BRANCH' 
                            ? (branches || []).find(b => b.id === parseInt(filters.scopeId))?.name || filters.scopeId
                            : (warehouses || []).find(w => w.id === parseInt(filters.scopeId))?.name || filters.scopeId
                          }`}
                          color="secondary"
                          size="small"
                        />
                      )}
                      {user?.role === 'WAREHOUSE_KEEPER' && filters.retailerId !== 'all' && (
                        <Chip
                          label={`Retailer: ${(retailers || []).find(r => r.id === parseInt(filters.retailerId))?.name || filters.retailerId}`}
                          color="secondary"
                          size="small"
                        />
                      )}
                      {filters.startDate && (
                        <Chip
                          label={`From: ${new Date(filters.startDate).toLocaleDateString()}`}
                          color="info"
                          size="small"
                        />
                      )}
                      {filters.endDate && (
                        <Chip
                          label={`To: ${new Date(filters.endDate).toLocaleDateString()}`}
                          color="info"
                          size="small"
                        />
                      )}
                    </Box>
                  )}
                </Paper>
              )}
              <EntityTable
                data={sales || []}
                columns={columns}
                loading={salesLoading}
                error={salesError}
                onAdd={canEdit ? () => setOpenDialog(true) : null}
                onEdit={canEdit ? (entity) => {
                  setEditingEntity(entity)
                  setOpenDialog(true)
                } : null}
                onDelete={canEdit ? (entity) => {
                  setEntityToDelete(entity)
                  setOpenDeleteDialog(true)
                } : null}
                onRefresh={handleRefresh}
                entityName="Sale"
              />
            </Box>

            {/* Sales Returns Table - Hidden for Warehouse Keepers */}
            {user?.role !== 'WAREHOUSE_KEEPER' && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Sales Returns
                </Typography>
                <EntityTable
                  data={salesReturns || []}
                  columns={returnsColumns}
                  loading={salesLoading}
                  error={salesError}
                  onAdd={canEdit ? () => setOpenDialog(true) : null}
                  onEdit={canEdit ? (entity) => {
                    setEditingEntity(entity)
                    setOpenDialog(true)
                  } : null}
                  onDelete={canEdit ? (entity) => {
                    setEntityToDelete(entity)
                    setOpenDeleteDialog(true)
                  } : null}
                  onRefresh={handleRefresh}
                  entityName="Sales Return"
                />
              </Box>
            )}
          </Box>
        </PermissionCheck>
      </RouteGuard>
      
      {/* Add/Edit Sale Dialog */}
      <EntityFormDialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false)
          setEditingEntity(null)
        }}
        onSubmit={editingEntity ? handleUpdateSale : handleCreateSale}
        title={editingEntity ? 'Edit Sale' : 'Add New Sale'}
        fields={[
          { name: 'customerName', label: 'Customer Name', type: 'text', required: true },
          { name: 'customerEmail', label: 'Customer Email', type: 'email', required: false },
          { name: 'customerPhone', label: 'Customer Phone', type: 'text', required: false },
          { name: 'customerAddress', label: 'Customer Address', type: 'textarea', required: false },
          { name: 'subtotal', label: 'Subtotal', type: 'number', required: true, step: 0.01 },
          { name: 'tax', label: 'Tax Amount', type: 'number', required: false, step: 0.01, defaultValue: 0 },
          { name: 'discount', label: 'Discount', type: 'number', required: false, step: 0.01, defaultValue: 0 },
          { name: 'total', label: 'Total Amount (Calculated)', type: 'number', required: false, step: 0.01, disabled: true, value: calculatedTotal },
          { name: 'paymentMethod', label: 'Payment Method', type: 'select', required: true, options: [
            { value: 'CASH', label: 'Cash' },
            { value: 'CARD', label: 'Card' },
            { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
            { value: 'MOBILE_PAYMENT', label: 'Mobile Payment' }
          ]},
          { name: 'paymentStatus', label: 'Payment Status', type: 'select', required: true, options: [
            { value: 'PENDING', label: 'Pending' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'FAILED', label: 'Failed' },
            { value: 'REFUNDED', label: 'Refunded' }
          ]},
          { name: 'status', label: 'Sale Status', type: 'select', required: true, options: [
            { value: 'PENDING', label: 'Pending' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' }
          ]},
          { name: 'notes', label: 'Notes', type: 'textarea', required: false },
        ]}
        validationSchema={salesSchema}
        initialData={(() => {
          const transformed = transformSaleToFormData(editingEntity);
          return transformed || {
          scopeType: userScope.scopeType,
          scopeId: userScope.scopeId,
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          paymentMethod: 'CASH',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          customerName: 'Walk-in Customer',
          customerEmail: '',
          customerPhone: '',
          customerAddress: '',
          notes: ''
        };
        })()}
      />
      
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
                          secondary={`$${parseFloat(sale.total || 0).toFixed(2)}`}
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
    </DashboardLayout>
  )
}

export default withAuth(SalesPage)
