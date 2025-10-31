'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import { usePermissions } from '../../../hooks/usePermissions'
import { fetchReturns, createReturn, updateReturn, deleteReturn } from '../../store/slices/returnsSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchBranchSettings } from '../../store/slices/branchesSlice'
import api from '../../../utils/axios'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Pagination,
  Paper,
  Autocomplete,
} from '@mui/material'
import {
  Add,
  Refresh,
  Receipt,
  TrendingDown,
  Delete,
  Edit,
  Search,
  Clear,
  FilterList,
  Visibility as ViewIcon,
  Inventory as RestockIcon,
} from '@mui/icons-material'
import * as yup from 'yup'

const ReturnsPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: returns, loading, error } = useSelector((state) => state.returns)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  const { branchSettings } = useSelector((state) => state.branches || { branchSettings: null })
  
  // Check if user can manage returns based on role and settings
  const canManageReturns = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseReturns) ||
    (user?.role === 'CASHIER' && branchSettings?.allowCashierReturns)
  
  
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: '7days',
    search: ''
  })

  const columns = [
    { field: 'return_no', headerName: 'Return #', width: 120 },
    { field: 'invoice_no', headerName: 'Original Invoice', width: 150 },
    { field: 'reason', headerName: 'Reason', width: 150 },
    { field: 'total_refund', headerName: 'Refund Amount', width: 120, renderCell: (params) => `${params.value || 0}` },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'pending'} 
          color={
            params.value === 'completed' ? 'success' :
            params.value === 'approved' ? 'primary' :
            params.value === 'pending' ? 'warning' : 'error'
          }
          size="small"
        />
      )
    },
    { field: 'created_at', headerName: 'Return Date', width: 120, renderCell: (params) => new Date(params.value).toLocaleDateString() },
    { field: 'username', headerName: 'Processed By', width: 150 },
    { 
      field: 'scope_type', 
      headerName: 'Location', 
      width: 120,
      renderCell: (params) => {
        const row = params.row;
        if (row.scope_type === 'BRANCH') {
          return row.branch_name || `Branch ${row.scope_id}`;
        } else if (row.scope_type === 'WAREHOUSE') {
          return row.warehouse_name || `Warehouse ${row.scope_id}`;
        }
        return row.branch_name || row.warehouse_name || 'Unknown';
      }
    },
  ]

  const validationSchema = yup.object({
    saleId: yup.number().required('Sale ID is required').min(1, 'Sale ID must be valid'),
    reason: yup.string().required('Reason is required').max(500, 'Reason cannot exceed 500 characters'),
    notes: yup.string().max(500, 'Notes cannot exceed 500 characters'),
    items: yup.array().min(1, 'At least one item is required').of(
      yup.object({
        productName: yup.string().required('Product name is required'),
        quantity: yup.number().required('Quantity is required').min(0.01, 'Quantity must be greater than 0'),
        refundAmount: yup.number().required('Refund amount is required').min(0, 'Refund amount must be positive'),
      })
    ),
  })

  const formFields = [
    { name: 'saleId', label: 'Sale ID', type: 'number', required: true },
    { 
      name: 'reason', 
      label: 'Reason', 
      type: 'select', 
      required: true,
      options: [
        { value: 'defective', label: 'Defective' },
        { value: 'changed_mind', label: 'Changed Mind' },
        { value: 'wrong_model', label: 'Wrong Model' },
        { value: 'damaged_shipping', label: 'Damaged in Shipping' },
        { value: 'other', label: 'Other' }
      ]
    },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ]

  // Dialog state management
  const [openDialog, setOpenDialog] = useState(false)
  const [editingEntity, setEditingEntity] = useState(null)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [entityToDelete, setEntityToDelete] = useState(null)
  
  // View details dialog state
  const [viewDetailsDialog, setViewDetailsDialog] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState(null)
  const [returnDetails, setReturnDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Pagination states
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  
  // Return form state
  const [returnForm, setReturnForm] = useState({
    saleId: '',
    reason: '',
    notes: '',
    items: [{ productName: '', quantity: 1, refundAmount: 0 }]
  })

  // Product search state
  const [productSearchResults, setProductSearchResults] = useState({})
  const [productSearchLoading, setProductSearchLoading] = useState({})

  // Invoice search state
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false)
  const [invoiceItems, setInvoiceItems] = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  
  // Restock functionality state
  const [restockDialog, setRestockDialog] = useState(false)
  const [selectedItemForRestock, setSelectedItemForRestock] = useState(null)
  const [restockQuantity, setRestockQuantity] = useState(0)
  const [restockLoading, setRestockLoading] = useState(false)

  const getScopeParams = useCallback(() => {
    const params = {}

    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId = user.warehouseId
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = user.branchId
    }

    return params
  }, [user])

  // Load returns data on component mount or when scope changes
  useEffect(() => {
    const params = getScopeParams()

    dispatch(fetchReturns(params))
    
    // Load warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
    
    // Load branch settings for cashiers
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }, [dispatch, user, getScopeParams])

  const handleCreate = (data) => {
    dispatch(createReturn(data))
    setOpenDialog(false)
  }

  // Handle view return details
  const handleViewDetails = async (returnItem) => {
    setSelectedReturn(returnItem)
    setLoadingDetails(true)
    setViewDetailsDialog(true)
    
    try {
      // Fetch detailed return information including items
      const response = await api.get(`/sales/returns/${returnItem.id}`)
      if (response.data.success) {
        setReturnDetails(response.data.data)
      } else {
        // Fallback to using the return item data if API fails
        setReturnDetails(returnItem)
      }
    } catch (error) {
      console.error('Error fetching return details:', error)
      // Fallback to using the return item data
      setReturnDetails(returnItem)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleCloseViewDetails = () => {
    setViewDetailsDialog(false)
    setSelectedReturn(null)
    setReturnDetails(null)
  }

  const handleReturnFormChange = (field, value) => {
    setReturnForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index, field, value) => {
    setReturnForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  // Restock functionality
  const handleRestockItem = (returnItem, item) => {
    const remainingQty = item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity
    setSelectedItemForRestock({
      returnId: returnItem.id,
      itemId: item.id,
      itemName: item.name || item.productName || item.itemName,
      sku: item.sku,
      totalQuantity: Math.max(0, parseFloat(item.quantity) || 0),
      remainingQuantity: Math.max(0, parseFloat(remainingQty) || 0)
    })
    setRestockQuantity(0)
    setRestockDialog(true)
  }

  const handleRestockConfirm = async () => {
    if (!selectedItemForRestock || restockQuantity <= 0) {
      return
    }

    const { returnId } = selectedItemForRestock
    setRestockLoading(true)
    try {
      const response = await api.post(
        `/returns/${selectedItemForRestock.returnId}/items/${selectedItemForRestock.itemId}/restock`,
        { qty: restockQuantity }
      )

      if (response.data.success) {
        const scopeParams = getScopeParams()
        await dispatch(fetchReturns(scopeParams))
        
        // Refresh selected return details if dialog is open
        if (viewDetailsDialog || returnDetails) {
          try {
            const detailsResponse = await api.get(`/sales/returns/${returnId}`)
            if (detailsResponse.data.success) {
              setReturnDetails(detailsResponse.data.data)
              setSelectedReturn(detailsResponse.data.data)
            }
          } catch (detailsError) {
            console.error('Error refreshing return details:', detailsError)
          }
        }
        
        // Close dialog and show success message
        setRestockDialog(false)
        setSelectedItemForRestock(null)
        setRestockQuantity(0)
        
        // You could add a success notification here
        console.log('Restock successful:', response.data.data)
      }
    } catch (error) {
      console.error('Error restocking item:', error)
      // You could add an error notification here
    } finally {
      setRestockLoading(false)
    }
  }

  const handleRestockCancel = () => {
    setRestockDialog(false)
    setSelectedItemForRestock(null)
    setRestockQuantity(0)
  }

  // Search products function
  const searchProducts = async (query, itemIndex) => {
    if (!query || query.length < 2) {
      setProductSearchResults(prev => ({ ...prev, [itemIndex]: [] }))
      return
    }

    setProductSearchLoading(prev => ({ ...prev, [itemIndex]: true }))
    
    try {
      const response = await api.get(`/sales/products/search?q=${encodeURIComponent(query)}&limit=10`)
      
      setProductSearchResults(prev => ({ ...prev, [itemIndex]: response.data.data || [] }))
    } catch (error) {
      console.error('Error searching products:', error)
      setProductSearchResults(prev => ({ ...prev, [itemIndex]: [] }))
    } finally {
      setProductSearchLoading(prev => ({ ...prev, [itemIndex]: false }))
    }
  }

  // Search invoice by invoice number
  const searchInvoice = async (invoiceNumber) => {
    
    if (!invoiceNumber || invoiceNumber.trim().length < 3) {
      setInvoiceItems([])
      setSelectedInvoice(null)
      return
    }

    setInvoiceSearchLoading(true)
    
    try {
      
      const response = await api.get(`/sales/search?invoiceNumber=${encodeURIComponent(invoiceNumber.trim())}`)
      
      
      const data = response.data;
      
      if (data.success && data.data && data.data.length > 0) {
        const sale = data.data[0] // Get the first matching sale
        
        setSelectedInvoice(sale)
        setInvoiceItems(sale.items || [])
        
        // Auto-populate the sale ID
        setReturnForm(prev => ({
          ...prev,
          saleId: sale.id
        }))
      } else {
        setInvoiceItems([])
        setSelectedInvoice(null)
        alert('Invoice not found. Please check the invoice number.')
      }
    } catch (error) {
      console.error('Error searching invoice:', error)
      setInvoiceItems([])
      setSelectedInvoice(null)
      alert('Error searching for invoice. Please try again.')
    } finally {
      setInvoiceSearchLoading(false)
    }
  }

  // Add item from invoice to return form
  const addInvoiceItem = (invoiceItem) => {
    const newItem = {
      productName: invoiceItem.itemName || invoiceItem.name,
      quantity: invoiceItem.quantity || 1, // Use invoice quantity or default to 1
      refundAmount: invoiceItem.unitPrice || 0
    }
    
    
    setReturnForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  // Add all items from invoice to return form
  const addAllInvoiceItems = (invoiceItems) => {
    const allItems = invoiceItems.map(invoiceItem => ({
      productName: invoiceItem.itemName || invoiceItem.name,
      quantity: invoiceItem.quantity || 1,
      refundAmount: invoiceItem.unitPrice || 0
    }))
    
    setReturnForm(prev => ({
      ...prev,
      items: allItems
    }))
  }

  const addItem = () => {
    setReturnForm(prev => ({
      ...prev,
      items: [...prev.items, { productName: '', quantity: 1, refundAmount: 0 }]
    }))
  }

  const removeItem = (index) => {
    if (returnForm.items.length > 1) {
      setReturnForm(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }))
    }
  }

  const handleCreateReturn = () => {
    
    // Validate form data
    if (!returnForm.saleId) {
      alert('Please select an invoice first');
      return;
    }
    
    if (!returnForm.reason || returnForm.reason.trim() === '') {
      alert('Please enter a return reason');
      return;
    }
    
    // Filter out empty items
    const validItems = returnForm.items.filter(item => 
      item.productName && item.productName.trim() !== '' &&
      item.quantity && parseFloat(item.quantity) > 0 &&
      item.refundAmount && parseFloat(item.refundAmount) > 0
    );
    
    if (validItems.length === 0) {
      alert('Please add at least one item to return');
      return;
    }
    
    const returnData = {
      saleId: parseInt(returnForm.saleId),
      reason: returnForm.reason.trim(),
      notes: returnForm.notes || '',
      items: validItems.map(item => ({
        productName: item.productName.trim(),
        quantity: parseFloat(item.quantity),
        refundAmount: parseFloat(item.refundAmount)
      }))
    }
    
    dispatch(createReturn(returnData))
    setOpenDialog(false)
    setReturnForm({
      saleId: '',
      reason: '',
      notes: '',
      items: [{ productName: '', quantity: 1, refundAmount: 0 }]
    })
  }

  const handleUpdate = () => {
    
    // Validate form data
    if (!returnForm.saleId) {
      alert('Please select an invoice first');
      return;
    }
    
    if (!returnForm.reason || returnForm.reason.trim() === '') {
      alert('Please enter a return reason');
      return;
    }
    
    // Filter out empty items
    const validItems = returnForm.items.filter(item => 
      item.productName && item.productName.trim() !== '' &&
      item.quantity && parseFloat(item.quantity) > 0 &&
      item.refundAmount && parseFloat(item.refundAmount) > 0
    );
    
    if (validItems.length === 0) {
      alert('Please add at least one item to return');
      return;
    }
    
    const updateData = {
      saleId: parseInt(returnForm.saleId),
      reason: returnForm.reason.trim(),
      notes: returnForm.notes || '',
      items: validItems.map(item => ({
        productName: item.productName.trim(),
        quantity: parseFloat(item.quantity),
        refundAmount: parseFloat(item.refundAmount)
      }))
    }
    
    dispatch(updateReturn({ id: editingEntity.id, data: updateData }))
    setOpenDialog(false)
    setEditingEntity(null)
    setReturnForm({
      saleId: '',
      reason: '',
      notes: '',
      items: [{ productName: '', quantity: 1, refundAmount: 0 }]
    })
  }

  const handleDelete = () => {
    dispatch(deleteReturn(entityToDelete.id))
    setOpenDeleteDialog(false)
    setEntityToDelete(null)
  }

  const handleRefresh = () => {
    // Pass user scope for filtering
    const params = {};
    if (user?.role === 'WAREHOUSE_KEEPER') {
      params.scopeType = 'WAREHOUSE';
      params.scopeId = user.warehouseId;
    } else if (user?.role === 'CASHIER') {
      params.scopeType = 'BRANCH';
      params.scopeId = user.branchId;
    }
    // Admin doesn't need scope filtering - can see all returns
    
    dispatch(fetchReturns(params))
    
    // Reload warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
    
    // Reload branch settings for cashiers
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('')
    setReasonFilter('all')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1) // Reset to first page when clearing filters
  }

  // Get filter summary
  const getFilterSummary = () => {
    const filters = []
    if (searchTerm) filters.push(`Search: "${searchTerm}"`)
    if (reasonFilter !== 'all') filters.push(`Reason: ${reasonFilter}`)
    return filters
  }

  // Filter and sort returns
  const getFilteredAndSortedReturns = () => {
    let filtered = (returns || []).filter(returnItem => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const saleIdMatch = (returnItem.original_sale_id || returnItem.sale_id)?.toString().includes(searchLower)
        const reasonMatch = returnItem.reason?.toLowerCase().includes(searchLower)
        const notesMatch = returnItem.notes?.toLowerCase().includes(searchLower)
        if (!saleIdMatch && !reasonMatch && !notesMatch) return false
      }

      // Reason filter
      if (reasonFilter !== 'all') {
        if (returnItem.reason !== reasonFilter) return false
      }

      return true
    })

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'sale_id':
          aValue = a.sale_id || 0
          bValue = b.sale_id || 0
          break
        case 'reason':
          aValue = a.reason || ''
          bValue = b.reason || ''
          break
        case 'total_refund':
          aValue = parseFloat(a.total_refund || 0)
          bValue = parseFloat(b.total_refund || 0)
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
  const totalItems = getFilteredAndSortedReturns().length
  const totalPages = Math.ceil(totalItems / rowsPerPage)
  const startIndex = (page - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedReturns = getFilteredAndSortedReturns().slice(startIndex, endIndex)

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(1) // Reset to first page when changing page size
  }

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }


  const getReturnStats = () => {
    try {
      if (!returns || !Array.isArray(returns) || returns.length === undefined) {
        return { total: 0, totalAmount: 0 }
      }
      
      const total = returns.length
      const totalAmount = returns.reduce((sum, r) => {
        const refund = r && r.total_refund ? parseFloat(r.total_refund) : 0
        return sum + (isNaN(refund) ? 0 : refund)
      }, 0)

      return { total, totalAmount }
    } catch (error) {
      console.error('Error calculating return stats:', error)
      return { total: 0, totalAmount: 0 }
    }
  }

  const stats = getReturnStats()

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>
        <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Returns Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Process and manage product returns
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
          </Box>
        </Box>

        {/* Stats Cards */}
         <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={6}>
             <Card sx={{ 
               height: '100%', 
               background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
               color: 'white',
               boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
               transition: 'transform 0.2s ease-in-out',
               '&:hover': { transform: 'translateY(-2px)' }
             }}>
               <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                     <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                      Total Returns
                    </Typography>
                     <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                      {stats.total}
                    </Typography>
                  </Box>
                   <Receipt sx={{ fontSize: 32, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={6}>
             <Card sx={{ 
               height: '100%', 
               background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
               color: 'white',
               boxShadow: '0 4px 20px rgba(250, 112, 154, 0.3)',
               transition: 'transform 0.2s ease-in-out',
               '&:hover': { transform: 'translateY(-2px)' }
             }}>
               <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                     <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                      Total Amount
                    </Typography>
                     <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                       {(parseFloat(stats.totalAmount) || 0).toFixed(2)}
                    </Typography>
                  </Box>
                   <TrendingDown sx={{ fontSize: 32, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          </Grid>

        {/* Returns Table */}
            <Card>
              <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {canManageReturns && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenDialog(true)}
                    size="small"
                  >
                    Add Return
                  </Button>
                )}
                  </Box>
                </Box>

            {/* Search and Filter Section */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FilterList sx={{ mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle2">Search & Filters</Typography>
                  </Box>
              
              <Grid container spacing={2} sx={{ mb: 1 }} alignItems="center">
                {/* Search Input */}
                <Grid item xs={12} md={4}>
          <TextField
                    fullWidth
            size="small"
                    label="Search Returns"
                    placeholder="Search by sale ID, reason..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                      endAdornment: searchTerm && (
                        <InputAdornment position="end">
                          <IconButton
            size="small"
                            onClick={() => setSearchTerm('')}
                            edge="end"
                          >
                            <Clear />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>


                {/* Reason Filter */}
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Reason</InputLabel>
            <Select
                      value={reasonFilter}
                      label="Reason"
                      onChange={(e) => setReasonFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Reasons</MenuItem>
                      <MenuItem value="defective">Defective</MenuItem>
                      <MenuItem value="changed_mind">Changed Mind</MenuItem>
                      <MenuItem value="wrong_model">Wrong Model</MenuItem>
                      <MenuItem value="damaged_shipping">Damaged Shipping</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
                </Grid>

                {/* Sort By */}
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sort By</InputLabel>
            <Select
                      value={sortBy}
                      label="Sort By"
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <MenuItem value="created_at">Date</MenuItem>
                      <MenuItem value="original_sale_id">Sale ID</MenuItem>
                      <MenuItem value="reason">Reason</MenuItem>
                      <MenuItem value="total_refund">Amount</MenuItem>
            </Select>
          </FormControl>
                </Grid>

                {/* Action Icons */}
                <Grid item xs={12} md={2}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Tooltip title="Clear all filters">
                      <IconButton
                        size="small"
                        onClick={clearFilters}
                        disabled={getFilterSummary().length === 0}
                      >
                        <Clear />
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
                  Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} returns
                </Typography>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Sale ID</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Processed By</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Notes</TableCell>
                      {canManageReturns && <TableCell>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedReturns.map((returnItem) => (
                      <TableRow key={returnItem.id}>
                        <TableCell>{returnItem.id}</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {returnItem.original_sale_id || returnItem.sale_id || 'N/A'}
                            </Typography>
                            {returnItem.invoice_no && (
                              <Typography variant="caption" color="text.secondary">
                                {returnItem.invoice_no}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={returnItem.reason?.replace('_', ' ').toUpperCase() || 'N/A'} 
                            size="small"
                            color="secondary"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {parseFloat(returnItem.total_refund || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {returnItem.processed_by_name || returnItem.processed_by_username || 'N/A'}
                            </Typography>
                            {returnItem.user_name && returnItem.user_name !== returnItem.processed_by_name && (
                              <Typography variant="caption" color="text.secondary">
                                Created by: {returnItem.user_name}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {new Date(returnItem.created_at || returnItem.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {returnItem.notes || 'N/A'}
                        </TableCell>
                        {canManageReturns && (
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewDetails(returnItem)}
                                  color="info"
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingEntity(returnItem)
                                    // Populate form with existing data
                                    setReturnForm({
                                      saleId: returnItem.original_sale_id || returnItem.sale_id || '',
                                      reason: returnItem.reason || '',
                                      notes: returnItem.notes || '',
                                      items: returnItem.items || [{ productName: '', quantity: 1, refundAmount: 0 }]
                                    })
            setOpenDialog(true)
                                  }}
                                  color="primary"
                                >
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEntityToDelete(returnItem)
            setOpenDeleteDialog(true)
                                  }}
                                  color="error"
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        )}
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

        {/* Return Form Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingEntity ? 'Edit Return' : 'Create New Return'}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    label="Sale ID / Invoice Number"
                    type="text"
                    value={returnForm.saleId}
                    onChange={(e) => {
                      handleReturnFormChange('saleId', e.target.value)
                      // Search for invoice when user types
                      if (e.target.value.length >= 3) {
                        searchInvoice(e.target.value)
                      } else {
                        setInvoiceItems([])
                        setSelectedInvoice(null)
                      }
                    }}
                    placeholder="Enter Sale ID or Invoice Number"
                    InputProps={{
                      endAdornment: invoiceSearchLoading ? (
                        <InputAdornment position="end">
                          <CircularProgress size={20} />
                        </InputAdornment>
                      ) : null
                    }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required>
                    <InputLabel>Reason</InputLabel>
                    <Select
                      value={returnForm.reason}
                      onChange={(e) => handleReturnFormChange('reason', e.target.value)}
                      label="Reason"
                    >
                      <MenuItem value="defective">Defective</MenuItem>
                      <MenuItem value="changed_mind">Changed Mind</MenuItem>
                      <MenuItem value="wrong_model">Wrong Model</MenuItem>
                      <MenuItem value="damaged_shipping">Damaged in Shipping</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={3}
                    value={returnForm.notes}
                    onChange={(e) => handleReturnFormChange('notes', e.target.value)}
                  />
                </Grid>

                {/* Invoice Items Section */}
                {selectedInvoice && invoiceItems.length > 0 && (
                  <Grid item xs={12}>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                      <Typography variant="h6" sx={{ mb: 2, color: 'white' }}>
                        📋 Invoice Items - {selectedInvoice.invoice_no}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          Select items to return (click to add to return form):
                        </Typography>
                        <Button
                          variant="contained"
                          color="secondary"
                          size="small"
                          startIcon={<Add />}
                          onClick={() => addAllInvoiceItems(invoiceItems)}
                          sx={{ 
                            bgcolor: 'white', 
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'grey.100' }
                          }}
                        >
                          Add All Items ({invoiceItems.length})
                        </Button>
                      </Box>
                      <Grid container spacing={1}>
                        {invoiceItems.map((item, index) => (
                          <Grid item xs={12} sm={6} md={4} key={index}>
                            <Card 
                              sx={{ 
                                cursor: 'pointer', 
                                bgcolor: 'white',
                                '&:hover': { bgcolor: 'grey.100' },
                                transition: 'background-color 0.2s'
                              }}
                              onClick={() => addInvoiceItem(item)}
                            >
                              <CardContent sx={{ p: 1.5 }}>
                                <Typography variant="body2" fontWeight="bold" noWrap>
                                  {item.itemName || item.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  SKU: {item.sku}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                  Qty: {item.quantity} × {(parseFloat(item.unitPrice) || 0).toFixed(2).replace(/\.00$/, '')} = ${(parseFloat(item.total) || 0).toFixed(2).replace(/\.00$/, '')}
                                </Typography>
                                <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'block' }}>
                                  Click to add to return
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  </Grid>
                )}
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Return Items</Typography>
                <Button startIcon={<Add />} onClick={addItem} variant="outlined">
                  Add Item
                </Button>
              </Box>
              
              {returnForm.items.map((item, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={7}>
                        <Autocomplete
                          freeSolo
                          options={productSearchResults[index] || []}
                          getOptionLabel={(option) => {
                            if (typeof option === 'string') return option
                            return `${option.name} (${option.sku}) - ${option.sellingPrice}`
                          }}
                          value={item.productName}
                          onInputChange={(event, newValue) => {
                            handleItemChange(index, 'productName', newValue)
                            if (newValue && newValue.length >= 2) {
                              searchProducts(newValue, index)
                            }
                          }}
                          onChange={(event, newValue) => {
                            if (newValue && typeof newValue === 'object') {
                              handleItemChange(index, 'productName', newValue.name)
                              // Auto-fill refund amount with selling price
                              handleItemChange(index, 'refundAmount', newValue.sellingPrice)
                            }
                          }}
                          loading={productSearchLoading[index]}
                          renderInput={(params) => (
                        <TextField
                              {...params}
                              label="Product Name"
                              placeholder="Enter product name or SKU"
                          required
                              fullWidth
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {productSearchLoading[index] ? <CircularProgress color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                          renderOption={(props, option) => (
                            <Box component="li" {...props}>
                              <Box>
                                <Typography variant="body1" fontWeight="bold">
                                  {option.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  SKU: {option.sku} | Price: {option.sellingPrice} | Stock: {option.currentStock}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          fullWidth
                          label="Quantity"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          fullWidth
                          label="Refund Amount"
                          type="number"
                          value={item.refundAmount}
                          onChange={(e) => handleItemChange(index, 'refundAmount', e.target.value)}
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={1}>
                        <IconButton 
                          onClick={() => removeItem(index)}
                          disabled={returnForm.items.length === 1}
                          color="error"
                          size="small"
                        >
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setOpenDialog(false)
              setEditingEntity(null)
              setReturnForm({
                saleId: '',
                reason: '',
                notes: '',
                items: [{ productName: '', quantity: 1, refundAmount: 0 }]
              })
            }}>Cancel</Button>
            <Button 
              onClick={editingEntity ? handleUpdate : handleCreateReturn} 
              variant="contained" 
              disabled={loading}
            >
              {editingEntity ? 'Update Return' : 'Create Return'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={openDeleteDialog}
          onClose={() => {
            setOpenDeleteDialog(false)
            setEntityToDelete(null)
          }}
          onConfirm={handleDelete}
          title="Delete Return"
          message={`Are you sure you want to delete return ${entityToDelete?.return_no}?`}
          loading={loading}
        />

        {/* View Return Details Dialog */}
        <Dialog 
          open={viewDetailsDialog} 
          onClose={handleCloseViewDetails}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { minHeight: '60vh' }
          }}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Return Details #{selectedReturn?.return_no || selectedReturn?.id}
              </Typography>
              <IconButton onClick={handleCloseViewDetails} size="small">
                <Clear />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent dividers>
            {loadingDetails ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : returnDetails ? (
              <Box>
                {/* Return Information */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Return Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Return Number:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.return_no || returnDetails.id}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Original Sale ID:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.original_sale_id || returnDetails.sale_id || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Reason:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.reason || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status:
                        </Typography>
                        <Chip 
                          label={returnDetails.status || 'pending'} 
                          color={
                            returnDetails.status === 'completed' ? 'success' :
                            returnDetails.status === 'approved' ? 'primary' :
                            returnDetails.status === 'pending' ? 'warning' : 'error'
                          }
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Total Refund:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" color="error.main">
                          ${parseFloat(returnDetails.total_refund || 0).toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Return Date:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {new Date(returnDetails.created_at || returnDetails.createdAt).toLocaleDateString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Processed By:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.username || returnDetails.processed_by || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Location:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.scope_type === 'BRANCH' 
                            ? (returnDetails.branch_name || `Branch ${returnDetails.scope_id}`)
                            : returnDetails.scope_type === 'WAREHOUSE'
                            ? (returnDetails.warehouse_name || `Warehouse ${returnDetails.scope_id}`)
                            : 'N/A'
                          }
                        </Typography>
                      </Grid>
                      {returnDetails.notes && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Notes:
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {returnDetails.notes}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>

                {/* Returned Items */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Returned Items
                    </Typography>
                    {returnDetails.items && returnDetails.items.length > 0 ? (
                      <TableContainer component={Paper} variant="outlined">
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Item Name</TableCell>
                              <TableCell>SKU</TableCell>
                              <TableCell align="right">Quantity</TableCell>
                              <TableCell align="right">Unit Price</TableCell>
                              <TableCell align="right">Refund Amount</TableCell>
                              <TableCell align="center">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {returnDetails.items.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                      {item.name || item.productName || item.itemName || 'N/A'}
                                    </Typography>
                                    {item.category && (
                                      <Typography variant="caption" color="text.secondary">
                                        {item.category}
                                      </Typography>
                                    )}
                                    {item.barcode && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Barcode: {item.barcode}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">
                                    {item.sku || 'N/A'}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                      {parseFloat(item.quantity || 0).toFixed(2)}
                                    </Typography>
                                    {item.originalQuantity && item.originalQuantity !== item.quantity && (
                                      <Typography variant="caption" color="text.secondary">
                                        (of {parseFloat(item.originalQuantity).toFixed(2)} purchased)
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="medium">
                                    ${parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2)}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="medium" color="error.main">
                                    ${parseFloat(item.refund_amount || item.refundAmount || 0).toFixed(2)}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                    <Tooltip title="Restock Item">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleRestockItem(returnDetails, item)}
                                        color="success"
                                        disabled={restockLoading || (item.remainingQuantity !== undefined && item.remainingQuantity <= 0)}
                                      >
                                        <RestockIcon />
                                      </IconButton>
                                    </Tooltip>
                                    {item.remainingQuantity !== undefined && (
                                      <Typography variant="caption" color="text.secondary">
                                        {parseFloat(item.remainingQuantity).toFixed(2)} remaining
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="info">
                        No items found for this return.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Alert severity="error">
                Failed to load return details.
              </Alert>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseViewDetails} variant="outlined">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Restock Dialog */}
        <Dialog 
          open={restockDialog} 
          onClose={handleRestockCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6">
              Restock Item
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {selectedItemForRestock && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Item Details:
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {selectedItemForRestock.itemName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  SKU: {selectedItemForRestock.sku || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Quantity: {selectedItemForRestock.remainingQuantity}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Returned Quantity: {selectedItemForRestock.totalQuantity}
                </Typography>
                
                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    label="Restock Quantity"
                    type="number"
                    value={restockQuantity}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      setRestockQuantity(Number.isFinite(value) && value > 0 ? value : 0)
                    }}
                    inputProps={{ 
                      min: 0, 
                      max: selectedItemForRestock.remainingQuantity 
                    }}
                    helperText={`Enter quantity to restock (max: ${selectedItemForRestock.remainingQuantity})`}
                  />
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleRestockCancel} variant="outlined">
              Cancel
            </Button>
            <Button 
              onClick={handleRestockConfirm} 
              variant="contained" 
              color="success"
              disabled={restockLoading || restockQuantity <= 0 || restockQuantity > selectedItemForRestock?.remainingQuantity}
            >
              {restockLoading ? 'Restocking...' : 'Restock Item'}
            </Button>
          </DialogActions>
        </Dialog>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default ReturnsPage
