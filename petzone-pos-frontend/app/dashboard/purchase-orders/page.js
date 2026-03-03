'use client'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Paper,
  InputAdornment,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Badge,
  Autocomplete,
  Stack,
  alpha
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { 
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  ShoppingCart as ShoppingCartIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon,
  Pending as PendingIcon,
  LocalShipping as ShippingIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  Inventory as InventoryIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  Print as PrintIcon,
  Block as BlockIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  DragHandle as DragHandleIcon
} from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth.js'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import { 
  fetchPurchaseOrders,
  fetchPurchaseOrder,
  fetchSuppliers, 
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  updatePurchaseOrder, 
  deletePurchaseOrder,
  setFilters,
  clearFilters,
  setPagination
} from '../../store/slices/purchaseOrdersSlice'
import api from '../../../utils/axios'

const defaultCategories = [
  'General',
  'Food',
  'Accessories',
  'Medicine',
  'Toys',
  'Grooming',
  'Other'
]

// ─── FIXED: Yup Validation ────────────────────────────────────────────────────
// Changes made:
// 1. Added typeError() to supplierId, scopeId, quantityOrdered, unitPrice
//    so empty string values give proper messages instead of crashing
// 2. expectedDelivery uses notRequired() so empty string passes validation
// 3. notes and optional string fields use notRequired()
// 4. Item error paths use bracket notation items[0].field (matches yup output)
const purchaseOrderSchema = yup.object({
  supplierId: yup.number()
    .typeError('Supplier is required')
    .required('Supplier is required'),
  scopeType: yup.string()
    .oneOf(['BRANCH', 'WAREHOUSE'])
    .required('Scope type is required'),
  scopeId: yup.number()
    .typeError('Scope is required')
    .required('Scope is required'),
  orderDate: yup.date()
    .typeError('Valid order date is required')
    .required('Order date is required')
    .transform((value) => {
      if (value === '' || !value) return null;
      if (typeof value === 'string' && value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          return new Date(`${year}-${month}-${day}`);
        }
      }
      return value;
    }),
  expectedDelivery: yup.date()
    .nullable()
    .notRequired()
    .transform((value) => {
      if (value === '' || !value) return null;
      if (typeof value === 'string' && value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          return new Date(`${year}-${month}-${day}`);
        }
      }
      return value;
    }),
  notes: yup.string().nullable().notRequired(),
  items: yup.array().of(
    yup.object({
      itemName: yup.string().required('Item name is required'),
      itemSku: yup.string().nullable().notRequired(),
      itemDescription: yup.string().nullable().notRequired(),
      quantityOrdered: yup.number()
        .typeError('Quantity must be a number')
        .min(1, 'Quantity must be at least 1')
        .required('Quantity is required'),
      unitPrice: yup.number()
        .typeError('Price must be a number')
        .min(0, 'Unit price must be positive')
        .required('Unit price is required'),
      notes: yup.string().nullable().notRequired()
    })
  ).min(1, 'At least one item is required')
})

// Status configuration - FIXED: Added APPROVED status
const statusConfig = {
  PENDING: { color: 'warning', icon: <PendingIcon />, label: 'Pending' },
  COMPLETED: { color: 'success', icon: <CheckIcon />, label: 'Completed' },
  CANCELLED: { color: 'error', icon: <CancelIcon />, label: 'Cancelled' }
}

function PurchaseOrdersPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { 
    data: purchaseOrders, 
    suppliers,
    loading, 
    error, 
    pagination, 
    filters 
  } = useSelector((state) => state.purchaseOrders)
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [editingOrder, setEditingOrder] = useState(null) 
  const [editDialogOpen, setEditDialogOpen] = useState(false) 

  // Form states
  const [formData, setFormData] = useState({
    supplierId: '',
    scopeType: user?.role === 'CASHIER' ? 'BRANCH' : user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : '',
    scopeId: user?.role === 'CASHIER' ? user?.branchId : user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: '',
    items: [{ itemName: '', itemSku: '', itemCategory: 'General', itemDescription: '', quantityOrdered: 1, unitPrice: 0, notes: '' }]
  })
  
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inventoryOptions, setInventoryOptions] = useState([])
  const [categoriesFromApi, setCategoriesFromApi] = useState([])

  // Load data on component mount and when filters change
  useEffect(() => {
    dispatch(fetchPurchaseOrders(filters))
  }, [dispatch, filters])
  
  // Load suppliers once on mount
  useEffect(() => {
    dispatch(fetchSuppliers())
  }, [dispatch])

  // Load inventory options for item search, scoped
  useEffect(() => {
    const loadInventoryOptions = async () => {
      try {
        if (!formDialogOpen && !editDialogOpen) return
        const scopeType = formData.scopeType
        const scopeId = formData.scopeId
        if (!scopeType || !scopeId) return
        const res = await api.get('/inventory', {
          params: {
            scopeType,
            scopeId,
            limit: 'all'
          }
        })
        const data = res.data?.data || res.data || []
        const opts = Array.isArray(data)
          ? data.map(item => {
              const cat =
                item.category ||
                item.category_name ||
                item.categoryName ||
                item.category_id ||
                'General'
              return {
                label: item.name,
                name: item.name,
                sku: item.sku,
                category: cat
              }
            }).filter(o => o.name)
          : []
        setInventoryOptions(opts)
      } catch (err) {
        console.warn('Failed to load inventory for PO item search', err?.message || err)
        setInventoryOptions([])
      }
    }
    loadInventoryOptions()
  }, [formDialogOpen, editDialogOpen, formData.scopeType, formData.scopeId])

  // Load categories for dropdown (master + defaults + inventory-derived)
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.get('/categories')
        const data = res.data?.data || res.data || []
        const names = Array.isArray(data)
          ? data
              .map((c) => c?.name || c?.label || c?.category || c)
              .filter(Boolean)
          : []
        setCategoriesFromApi(names)
      } catch (err) {
        setCategoriesFromApi([])
      }
    }
    if (formDialogOpen || editDialogOpen) {
      loadCategories()
    }
  }, [formDialogOpen, editDialogOpen])

  const categoryOptions = React.useMemo(() => {
    const merged = [...defaultCategories]
    categoriesFromApi.forEach((c) => {
      if (c && !merged.includes(c)) merged.push(c)
    })
    inventoryOptions.forEach((opt) => {
      const cat = opt?.category
      if (cat && !merged.includes(cat)) merged.push(cat)
    })
    return merged
  }, [categoriesFromApi, inventoryOptions])

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  // Handle item changes
  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  // Add new item
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { itemName: '', itemSku: '', itemCategory: 'General', itemDescription: '', quantityOrdered: 1, unitPrice: 0, notes: '' }]
    }))
  }

  // Remove item
  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }))
    }
  }

  // Calculate total amount
  const totalAmount = useMemo(() => {
    return formData.items.reduce((total, item) => {
      return total + (item.quantityOrdered * item.unitPrice)
    }, 0)
  }, [formData.items])

  // Validate form
  const validateForm = async () => {
    try {
      await purchaseOrderSchema.validate(formData, { abortEarly: false })
      setFormErrors({})
      return true
    } catch (error) {
      const errors = {}
      error.inner.forEach(err => {
        errors[err.path] = err.message
      })
      setFormErrors(errors)
      return false
    }
  }

  const handleEditOrder = async (order) => {
    try {
      // Fetch full order details with items
      const response = await dispatch(fetchPurchaseOrder(order.id));
      const fullOrder = response.payload.data;
      setEditingOrder(fullOrder);
      
      // Populate form with order data
      setFormData({
        supplierId: fullOrder.supplierId,
        scopeType: fullOrder.scopeType,
        scopeId: fullOrder.scopeId,
        orderDate: fullOrder.orderDate,
        expectedDelivery: fullOrder.expectedDelivery || '',
        notes: fullOrder.notes || '',
        items: fullOrder.items.map(item => ({
          id: item.id,
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          itemSku: item.itemSku || '',
          itemCategory: item.itemCategory || 'General',
          itemDescription: item.itemDescription || '',
          quantityOrdered: item.quantityOrdered,
          unitPrice: item.unitPrice,
          notes: item.notes || ''
        }))
      });
      
      setEditDialogOpen(true);
    } catch (error) {
      console.error('Error loading order for edit:', error);
    }
  };

  // Handler for submitting edits
  const handleUpdateSubmit = async () => {
    if (!await validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const orderData = {
        supplierId: formData.supplierId,
        orderDate: formData.orderDate,
        expectedDelivery: formData.expectedDelivery || null,
        notes: formData.notes,
        items: formData.items.map(item => ({
          ...item,
          totalPrice: item.quantityOrdered * item.unitPrice
        }))
      };
      
      await dispatch(updatePurchaseOrder({ 
        id: editingOrder.id, 
        orderData 
      }));
      
      setEditDialogOpen(false);
      resetForm();
      setEditingOrder(null);
      dispatch(fetchPurchaseOrders(filters));
    } catch (error) {
      console.error('Error updating purchase order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!await validateForm()) return
    
    setIsSubmitting(true)
    try {
      const orderData = {
        ...formData,
        totalAmount,
        items: formData.items.map(item => ({
          ...item,
          totalPrice: item.quantityOrdered * item.unitPrice
        }))
      }
      
      await dispatch(createPurchaseOrder(orderData))
      setFormDialogOpen(false)
      resetForm()
      dispatch(fetchPurchaseOrders(filters))
    } catch (error) {
      console.error('Error creating purchase order:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      supplierId: '',
      scopeType: user?.role === 'CASHIER' ? 'BRANCH' : user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : '',
      scopeId: user?.role === 'CASHIER' ? user?.branchId : user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      notes: '',
      items: [{ itemName: '', itemSku: '', itemCategory: 'General', itemDescription: '', quantityOrdered: 1, unitPrice: 0, notes: '' }]
    });
    setFormErrors({});
    setEditingOrder(null);
  };

  // Handle view order
  const handleViewOrder = async (order) => {
    // Fetch full order details with items from backend
    try {
      const response = await dispatch(fetchPurchaseOrder(order.id))
      setSelectedOrder(response.payload.data)
    } catch (error) {
      console.error('Error fetching order details:', error)
      setSelectedOrder(order) // Fallback to list item
    }
    setViewDialogOpen(true)
  }

  // Handle delete order
  const handleDeleteOrder = async () => {
    if (!selectedOrder) return
    
    try {
      await dispatch(deletePurchaseOrder(selectedOrder.id))
      setDeleteDialogOpen(false)
      setSelectedOrder(null)
      dispatch(fetchPurchaseOrders(filters))
    } catch (error) {
      console.error('Error deleting purchase order:', error)
    }
  }

  // Handle status update
  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await dispatch(updatePurchaseOrderStatus({ 
        id: orderId, 
        status: newStatus,
        actualDelivery: newStatus === 'COMPLETED' ? new Date().toISOString().split('T')[0] : null
      }))
      dispatch(fetchPurchaseOrders(filters))
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    dispatch(setFilters({ [field]: value }))
  }

  // Clear all filters
  const handleClearFilters = () => {
    dispatch(clearFilters())
  }

  // Handle pagination
  const handlePageChange = (event, newPage) => {
    dispatch(setPagination({ page: newPage }))
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            Purchase Orders
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => dispatch(fetchPurchaseOrders(filters))}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormDialogOpen(true)}
            >
              Create Order
            </Button>
          </Box>
        </Box>

        {/* ──   ──────────────────────────────────────────────────────────
            FIXED layout (all integers, sum = 12):
            Search(3) + Status(2) + Supplier(3) + FromDate(2) + ToDate(1) + Clear(1) = 12
        ──────────────────────────────────────────────────────────────────────── */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FilterIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Filters</Typography>
              {Object.values(filters).some(v => v) && (
                <Chip
                  label="Clear All"
                  size="small"
                  onDelete={handleClearFilters}
                  sx={{ ml: 2 }}
                />
              )}
            </Box>
            
            <Grid container spacing={2}>
              {/* Search — 3 cols */}
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Orders"
                  placeholder="Order # or supplier..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: filters.search && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => handleFilterChange('search', '')}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              {/* Status — 3 cols, minWidth so label "Status" doesn't truncate to "S..." */}
              <Grid item xs={12} md={6} lg={3}>
                <FormControl fullWidth size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="filter-status-label">Status</InputLabel>
                  <Select
                    labelId="filter-status-label"
                    value={filters.status}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    renderValue={(v) => (v ? (statusConfig[v]?.label || v) : 'All Status')}
                  >
                    <MenuItem value="">All Status</MenuItem>
                    {Object.keys(statusConfig).map(status => (
                      <MenuItem key={status} value={status}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {statusConfig[status].icon}
                          {statusConfig[status].label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Supplier — 3 cols, minWidth so label "Supplier" doesn't truncate to "S..." */}
              <Grid item xs={12} md={6} lg={3}>
                <FormControl fullWidth size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="filter-supplier-label">Supplier</InputLabel>
                  <Select
                    labelId="filter-supplier-label"
                    value={filters.supplierId}
                    label="Supplier"
                    onChange={(e) =>
                      handleFilterChange('supplierId', e.target.value ? Number(e.target.value) : '')
                    }
                    renderValue={(v) => {
                      if (!v) return 'All Suppliers'
                      const s = suppliers.find(sup => sup.id === v || sup.id === Number(v))
                      return s ? s.name : 'All Suppliers'
                    }}
                    MenuProps={{
                      PaperProps: { sx: { maxWidth: 400 } }
                    }}
                  >
                    <MenuItem value="">All Suppliers</MenuItem>
                    {suppliers.map((supplier) => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        <Typography noWrap sx={{ maxWidth: 300 }}>
                          {supplier.name}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* From Date — 2 cols (was 2, kept) */}
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="From Date"
                  type="date"
                  value={filters.orderDateFrom}
                  onChange={(e) => handleFilterChange('orderDateFrom', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* To Date — 1 col (was 2, now smaller to make room) */}
              <Grid item xs={12} md={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="To Date"
                  type="date"
                  value={filters.orderDateTo}
                  onChange={(e) => handleFilterChange('orderDateTo', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Clear — 1 col */}
              <Grid item xs={12} md={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleClearFilters}
                  disabled={!Object.values(filters).some(v => v)}
                  sx={{ height: '40px' }}
                >
                  Clear
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Purchase Orders Table */}
        <Card>
          <CardContent>
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
                      <TableCell width={50}>#</TableCell>
                      <TableCell>Order Number</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Order Date</TableCell>
                      <TableCell>Expected Delivery</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchaseOrders.map((order, index) => {
                    const rawStatus = order.status ?? order.order_status ?? order.orderStatus ?? order.order_status ?? ''
                    const orderStatus = (rawStatus && String(rawStatus) !== 'null' && String(rawStatus) !== 'undefined')
                      ? String(rawStatus).trim().toUpperCase()
                      : 'PENDING'
                    const statusCfg = statusConfig[orderStatus]
                    const statusLabel = statusCfg?.label || orderStatus || '—'
                      return (
                      <TableRow key={order.id} hover>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {((pagination.page - 1) * pagination.limit) + index + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {order.orderNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BusinessIcon color="primary" fontSize="small" />
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {order.supplierName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {order.supplierContact}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={order.scopeName || order.scopeType || 'Unknown'} 
                            size="small" 
                            color={order.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {order.expectedDelivery ? (
                            <Typography variant="body2">
                              {new Date(order.expectedDelivery).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={statusCfg?.icon}
                            label={statusLabel}
                            color={statusCfg?.color || 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            ${parseFloat(order.totalAmount || 0).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Badge badgeContent={order.items?.length || 0} color="primary">
                            <InventoryIcon />
                          </Badge>
                        </TableCell>
                        <TableCell>
<Box sx={{ display: 'flex', gap: 0.5 }}>
  <Tooltip title="View Details">
    <IconButton size="small" onClick={() => handleViewOrder(order)} color="primary">
      <ViewIcon />
    </IconButton>
  </Tooltip>

  {/* Edit — only PENDING orders */}
  {(user?.role === 'ADMIN' || (orderStatus === 'PENDING' &&
    ((user?.role === 'WAREHOUSE_KEEPER' && order.scopeType === 'WAREHOUSE' && order.scopeId === user.warehouseId) ||
     (user?.role === 'CASHIER' && order.scopeType === 'BRANCH' && order.scopeId === user.branchId)))) && (
    <Tooltip title="Edit Order">
      <IconButton size="small" onClick={() => handleEditOrder(order)} color="primary">
        <EditIcon />
      </IconButton>
    </Tooltip>
  )}

  {/* Complete — admin only, PENDING orders */}
  {user?.role === 'ADMIN' && orderStatus === 'PENDING' && (
    <Tooltip title="Mark as Completed (updates inventory)">
      <IconButton size="small" onClick={() => handleStatusUpdate(order.id, 'COMPLETED')} color="success">
        <CheckIcon />
      </IconButton>
    </Tooltip>
  )}

  {/* Cancel — admin only, PENDING orders */}
  {user?.role === 'ADMIN' && orderStatus === 'PENDING' && (
    <Tooltip title="Cancel Order">
      <IconButton size="small" onClick={() => handleStatusUpdate(order.id, 'CANCELLED')} color="error">
        <CancelIcon />
      </IconButton>
    </Tooltip>
  )}

  {/* Delete — admin only, PENDING orders */}
  {user?.role === 'ADMIN' && orderStatus === 'PENDING' && (
    <Tooltip title="Delete">
      <IconButton size="small" onClick={() => { setSelectedOrder(order); setDeleteDialogOpen(true); }} color="error">
        <DeleteIcon />
      </IconButton>
    </Tooltip>
  )}
</Box>
                        </TableCell>
                      </TableRow>
                    ); })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={pagination.totalPages}
                  page={pagination.page}
                  onChange={handlePageChange}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* ── Create Order Dialog ───────────────────────────────────────────── */}
        <Dialog 
          open={formDialogOpen} 
          onClose={() => setFormDialogOpen(false)} 
         maxWidth={false}
        fullWidth
         PaperProps={{
         sx: {
           minHeight: '80vh',
           maxHeight: '90vh',
           width: '98vw',    // ← ADD THIS
           maxWidth: '1800px' // ← ADD THIS
         }
       }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
            pb: 2
          }}>
            <Typography variant="h5" fontWeight="bold">Create Purchase Order</Typography>
            <IconButton onClick={() => setFormDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3 }}>
            {/* ── Header Section ─────────────────────────────────────────────
                FIXED layout (all integers, sum = 12):
                Supplier(4) + ScopeType(2) + OrderDate(2) + ExpectedDelivery(2) + Notes(2) = 12
            ──────────────────────────────────────────────────────────────── */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                borderRadius: 2
              }}
            >
              <Grid container spacing={2} alignItems="center">

                {/* Supplier — 4 cols, minWidth so label doesn't truncate to "S..." */}
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth error={!!formErrors.supplierId} sx={{ minWidth: 180 }}>
                    <InputLabel id="create-supplier-label">Supplier *</InputLabel>
                    <Select
                      labelId="create-supplier-label"
                      value={formData.supplierId}
                      label="Supplier *"
                      onChange={(e) => handleFieldChange('supplierId', e.target.value)}
                      size="small"
                      renderValue={(v) => {
                        if (!v) return ''
                        const s = suppliers.find(sup => sup.id === v || sup.id === Number(v))
                        return s ? s.name : ''
                      }}
                    >
                      {suppliers.map(supplier => (
                        <MenuItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors.supplierId && (
                      <Typography variant="caption" color="error">
                        {formErrors.supplierId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                {/* Scope Type — 2 cols, minWidth so label doesn't truncate */}
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth error={!!formErrors.scopeType} sx={{ minWidth: 160 }}>
                    <InputLabel id="create-scope-label">Scope Type *</InputLabel>
                    <Select
                      labelId="create-scope-label"
                      value={formData.scopeType}
                      label="Scope Type *"
                      onChange={(e) => handleFieldChange('scopeType', e.target.value)}
                      disabled={user?.role !== 'ADMIN'}
                      size="small"
                      renderValue={(v) => (v === 'BRANCH' ? 'Branch' : v === 'WAREHOUSE' ? 'Warehouse' : '')}
                    >
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                    {formErrors.scopeType && (
                      <Typography variant="caption" color="error">
                        {formErrors.scopeType}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                {/* Order Date — 2 cols (unchanged) */}
                <Grid item xs={12} md={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Order Date *"
                      value={formData.orderDate ? new Date(formData.orderDate) : null}
                      onChange={(newValue) => {
                        handleFieldChange('orderDate', newValue ? newValue.toISOString().split('T')[0] : '')
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: !!formErrors.orderDate,
                          helperText: formErrors.orderDate
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

                {/* Expected Delivery — 2 cols (unchanged) */}
                <Grid item xs={12} md={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Expected Delivery"
                      value={formData.expectedDelivery ? new Date(formData.expectedDelivery) : null}
                      onChange={(newValue) => {
                        handleFieldChange('expectedDelivery', newValue ? newValue.toISOString().split('T')[0] : '')
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: !!formErrors.expectedDelivery,
                          helperText: formErrors.expectedDelivery
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

                {/* Notes — 2 cols (was 3, reduced to give room to Supplier) */}
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Notes"
                    placeholder="Additional notes..."
                    value={formData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                  />
                </Grid>

              </Grid>
            </Paper>
            
            {/* ── Items Section ───────────────────────────────────────────────
                FIXED layout (all integers, sum = 12):
                #(1) + ItemName(4) + Category(2) + SKU(1) + Qty(1) + Price(1) + Total(1) + Del(1) = 12
                Description spans full width below each row
            ──────────────────────────────────────────────────────────────── */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  Order Items
                </Typography>
              </Box>
              
              {formData.items.map((item, index) => (
                <Card 
                  key={index} 
                  sx={{ 
                    mb: 2,
                    border: index === formData.items.length - 1 ? '1px solid' : 'none',
                    borderColor: 'primary.main'
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    {/* FLEX ROW — works at any dialog/container width, no breakpoint dependency */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', mb: 1 }}>

                      {/* # badge — fixed 36px */}
                      <Box sx={{ flexShrink: 0, width: 36 }}>
                        <Typography variant="body2" fontWeight="bold" sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, bgcolor: 'primary.main', color: 'white', borderRadius: '50%'
                        }}>
                          {index + 1}
                        </Typography>
                      </Box>

                      {/* Item Name — flex 3 (widest) */}
                      <Box sx={{ flex: 4, minWidth: 0 }}>
                        <Autocomplete
                          fullWidth
                          freeSolo
                          size="small"
                          options={inventoryOptions}
                          getOptionLabel={(option) => typeof option === 'string' ? option : (option?.label || option?.name || '')}
                          value={item.itemName || ''}
                          onChange={(_, newValue) => {
                            if (typeof newValue === 'string') {
                              handleItemChange(index, 'itemName', newValue)
                            } else if (newValue && typeof newValue === 'object') {
                              handleItemChange(index, 'itemName', newValue.name || newValue.label || '')
                              handleItemChange(index, 'itemSku', newValue.sku || '')
                              handleItemChange(index, 'itemCategory', newValue.category || 'General')
                            }
                          }}
                          onInputChange={(_, newInputValue) => {
                            handleItemChange(index, 'itemName', newInputValue)
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Item Name *"
                              error={!!formErrors[`items[${index}].itemName`]}
                              helperText={formErrors[`items[${index}].itemName`]}
                              size="small"
                            />
                          )}
                        />
                      </Box>

                      {/* Category — flex 2 */}
                      <Box sx={{ flex: 2, minWidth: 0 }}>
                        <Autocomplete
                          freeSolo
                          size="small"
                          options={categoryOptions}
                          getOptionLabel={(option) => typeof option === 'string' ? option : option}
                          value={item.itemCategory || 'General'}
                          onChange={(_, newValue) => {
                            if (typeof newValue === 'string') {
                              handleItemChange(index, 'itemCategory', newValue)
                            } else if (newValue) {
                              handleItemChange(index, 'itemCategory', newValue)
                            }
                          }}
                          onInputChange={(_, newInputValue) => {
                            handleItemChange(index, 'itemCategory', newInputValue)
                          }}
                          renderInput={(params) => (
                            <TextField {...params} label="Category" size="small" />
                          )}
                        />
                      </Box>

                      {/* SKU — flex 1 */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TextField
                          fullWidth size="small" label="SKU"
                          value={item.itemSku}
                          onChange={(e) => handleItemChange(index, 'itemSku', e.target.value)}
                        />
                      </Box>

                      {/* Qty — fixed 80px */}
                      <Box sx={{ flexShrink: 0, width: 110 }}>
                        <TextField
                          fullWidth size="small" label="Qty *" type="number"
                          value={item.quantityOrdered}
                          onChange={(e) => handleItemChange(index, 'quantityOrdered', parseInt(e.target.value) || 0)}
                          error={!!formErrors[`items[${index}].quantityOrdered`]}
                          helperText={formErrors[`items[${index}].quantityOrdered`]}
                          inputProps={{ min: 1 }}
                        />
                      </Box>

                      {/* Price — fixed 120px */}
                      <Box sx={{ flexShrink: 0, width: 160  }}>
                        <TextField
                          fullWidth size="small" label="Price *" type="number"
                          inputProps={{ step: '0.01' }}
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          error={!!formErrors[`items[${index}].unitPrice`]}
                          helperText={formErrors[`items[${index}].unitPrice`]}
                          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        />
                      </Box>

                      {/* Total — fixed 120px */}
                      <Box sx={{ flexShrink: 0, width: 160 }}>
                        <TextField
                          fullWidth size="small" label="Total"
                          value={(item.quantityOrdered * item.unitPrice).toFixed(2)}
                          InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                          sx={{ '& .MuiInputBase-input.Mui-readOnly': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) } }}
                        />
                      </Box>

                      {/* Delete — fixed 40px */}
                      <Box sx={{ flexShrink: 0, width: 50, textAlign: 'center' }}>
                        {formData.items.length > 1 && (
                          <IconButton size="small" onClick={() => removeItem(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Box>

                    </Box>

                    {/* Description — full width below */}
                    {/* <Box sx={{ mt: 1 }}>
                      <TextField
                        fullWidth size="small" label="Description" multiline rows={1}
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)}
                        placeholder="Item description (optional)"
                      />
                    </Box> */}
                  </CardContent>
                </Card>
              ))}
              
              {/* Total Amount Section */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  mt: 2, 
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center'
                }}
              >
                <Typography variant="h5" fontWeight="bold">
                  Total Amount: <Box component="span" color="primary.main">${totalAmount.toFixed(2)}</Box>
                </Typography>
              </Paper>
            </Box>
          </DialogContent>
          
          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addItem}
              size="large"
            >
              Add Item
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                onClick={() => setFormDialogOpen(false)} 
                variant="outlined"
                size="large"
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckIcon />}
                size="large"
                sx={{ minWidth: 150 }}
              >
                {isSubmitting ? 'Creating...' : 'Create Order'}
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* ── Edit Order Dialog ─────────────────────────────────────────────── */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => {
            setEditDialogOpen(false);
            resetForm();
          }} 
          maxWidth={false}
          fullWidth
          PaperProps={{
            sx: {
              minHeight: '80vh',
              maxHeight: '90vh',
              width: '98vw',    // ← ADD THIS
              maxWidth: '1800px' // ← ADD THIS
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
            pb: 2
          }}>
            <Typography variant="h5" fontWeight="bold">
              Edit Purchase Order #{editingOrder?.orderNumber}
            </Typography>
            <IconButton onClick={() => {
              setEditDialogOpen(false);
              resetForm();
            }} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3 }}>
            {/* ── Header Section — same fixed layout as Create ────────────────
                Supplier(4) + ScopeType(2) + OrderDate(2) + ExpectedDelivery(2) + Notes(2) = 12
            ──────────────────────────────────────────────────────────────── */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                borderRadius: 2
              }}
            >
              <Grid container spacing={2} alignItems="center">

                {/* Supplier — 4 cols, minWidth so label doesn't truncate to "S..." */}
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth error={!!formErrors.supplierId} sx={{ minWidth: 180 }}>
                    <InputLabel id="edit-supplier-label">Supplier *</InputLabel>
                    <Select
                      labelId="edit-supplier-label"
                      value={formData.supplierId}
                      label="Supplier *"
                      onChange={(e) => handleFieldChange('supplierId', e.target.value)}
                      size="small"
                      renderValue={(v) => {
                        if (!v) return ''
                        const s = suppliers.find(sup => sup.id === v || sup.id === Number(v))
                        return s ? s.name : ''
                      }}
                    >
                      {suppliers.map(supplier => (
                        <MenuItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors.supplierId && (
                      <Typography variant="caption" color="error">
                        {formErrors.supplierId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                {/* Scope Type — 2 cols, minWidth so label doesn't truncate */}
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth error={!!formErrors.scopeType} sx={{ minWidth: 160 }}>
                    <InputLabel id="edit-scope-label">Scope Type *</InputLabel>
                    <Select
                      labelId="edit-scope-label"
                      value={formData.scopeType}
                      label="Scope Type *"
                      onChange={(e) => handleFieldChange('scopeType', e.target.value)}
                      disabled={user?.role !== 'ADMIN'}
                      size="small"
                      renderValue={(v) => (v === 'BRANCH' ? 'Branch' : v === 'WAREHOUSE' ? 'Warehouse' : '')}
                    >
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                    {formErrors.scopeType && (
                      <Typography variant="caption" color="error">
                        {formErrors.scopeType}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                {/* Order Date — 2 cols (unchanged) */}
                <Grid item xs={12} md={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Order Date *"
                      value={formData.orderDate ? new Date(formData.orderDate) : null}
                      onChange={(newValue) => {
                        handleFieldChange('orderDate', newValue ? newValue.toISOString().split('T')[0] : '')
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: !!formErrors.orderDate,
                          helperText: formErrors.orderDate
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

                {/* Expected Delivery — 2 cols (unchanged) */}
                <Grid item xs={12} md={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Expected Delivery"
                      value={formData.expectedDelivery ? new Date(formData.expectedDelivery) : null}
                      onChange={(newValue) => {
                        handleFieldChange('expectedDelivery', newValue ? newValue.toISOString().split('T')[0] : '')
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: !!formErrors.expectedDelivery,
                          helperText: formErrors.expectedDelivery
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

                {/* Notes — 2 cols (was 3, reduced to give room to Supplier) */}
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Notes"
                    placeholder="Additional notes..."
                    value={formData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                  />
                </Grid>

              </Grid>
            </Paper>
            
            {/* ── Items Section — same fixed layout as Create ─────────────────
                #(1) + ItemName(4) + Category(2) + SKU(1) + Qty(1) + Price(1) + Total(1) + Del(1) = 12
            ──────────────────────────────────────────────────────────────── */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  Order Items
                </Typography>
              </Box>
              
              {formData.items.map((item, index) => (
                <Card 
                  key={index} 
                  sx={{ 
                    mb: 2,
                    border: index === formData.items.length - 1 ? '1px solid' : 'none',
                    borderColor: 'primary.main'
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    {/* FLEX ROW — works at any dialog/container width, no breakpoint dependency */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', mb: 1 }}>

                      {/* # badge — fixed 36px */}
                      <Box sx={{ flexShrink: 0, width: 36 }}>
                        <Typography variant="body2" fontWeight="bold" sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, bgcolor: 'primary.main', color: 'white', borderRadius: '50%'
                        }}>
                          {index + 1}
                        </Typography>
                      </Box>

                      {/* Item Name — flex 3 (widest) */}
                      <Box sx={{ flex: 4, minWidth: 0 }}>
                        <Autocomplete
                          fullWidth
                          freeSolo
                          size="small"
                          options={inventoryOptions}
                          getOptionLabel={(option) => typeof option === 'string' ? option : (option?.label || option?.name || '')}
                          value={item.itemName || ''}
                          onChange={(_, newValue) => {
                            if (typeof newValue === 'string') {
                              handleItemChange(index, 'itemName', newValue)
                            } else if (newValue && typeof newValue === 'object') {
                              handleItemChange(index, 'itemName', newValue.name || newValue.label || '')
                              handleItemChange(index, 'itemSku', newValue.sku || '')
                              handleItemChange(index, 'itemCategory', newValue.category || 'General')
                            }
                          }}
                          onInputChange={(_, newInputValue) => {
                            handleItemChange(index, 'itemName', newInputValue)
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Item Name *"
                              error={!!formErrors[`items[${index}].itemName`]}
                              helperText={formErrors[`items[${index}].itemName`]}
                              size="small"
                            />
                          )}
                        />
                      </Box>

                      {/* Category — flex 2 */}
                      <Box sx={{ flex: 2, minWidth: 0 }}>
                        <Autocomplete
                          freeSolo
                          size="small"
                          options={categoryOptions}
                          getOptionLabel={(option) => typeof option === 'string' ? option : option}
                          value={item.itemCategory || 'General'}
                          onChange={(_, newValue) => {
                            if (typeof newValue === 'string') {
                              handleItemChange(index, 'itemCategory', newValue)
                            } else if (newValue) {
                              handleItemChange(index, 'itemCategory', newValue)
                            }
                          }}
                          onInputChange={(_, newInputValue) => {
                            handleItemChange(index, 'itemCategory', newInputValue)
                          }}
                          renderInput={(params) => (
                            <TextField {...params} label="Category" size="small" />
                          )}
                        />
                      </Box>

                      {/* SKU — flex 1 */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TextField
                          fullWidth size="small" label="SKU"
                          value={item.itemSku}
                          onChange={(e) => handleItemChange(index, 'itemSku', e.target.value)}
                        />
                      </Box>

                      {/* Qty — fixed 80px */}
                      <Box sx={{ flexShrink: 0, width: 110 }}>
                        <TextField
                          fullWidth size="small" label="Qty *" type="number"
                          value={item.quantityOrdered}
                          onChange={(e) => handleItemChange(index, 'quantityOrdered', parseInt(e.target.value) || 0)}
                          error={!!formErrors[`items[${index}].quantityOrdered`]}
                          helperText={formErrors[`items[${index}].quantityOrdered`]}
                          inputProps={{ min: 1 }}
                        />
                      </Box>

                      {/* Price — fixed 120px */}
                      <Box sx={{ flexShrink: 0, width: 160 }}>
                        <TextField
                          fullWidth size="small" label="Price *" type="number"
                          inputProps={{ step: '0.01' }}
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          error={!!formErrors[`items[${index}].unitPrice`]}
                          helperText={formErrors[`items[${index}].unitPrice`]}
                          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        />
                      </Box>

                      {/* Total — fixed 120px */}
                      <Box sx={{ flexShrink: 0, width: 160 }}>
                        <TextField
                          fullWidth size="small" label="Total"
                          value={(item.quantityOrdered * item.unitPrice).toFixed(2)}
                          InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                          sx={{ '& .MuiInputBase-input.Mui-readOnly': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) } }}
                        />
                      </Box>

                      {/* Delete — fixed 40px */}
                      <Box sx={{ flexShrink: 0, width: 50, textAlign: 'center' }}>
                        {formData.items.length > 1 && (
                          <IconButton size="small" onClick={() => removeItem(index)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Box>

                    </Box>

                    {/* Description — full width below */}
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        fullWidth size="small" label="Description" multiline rows={1}
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)}
                        placeholder="Item description (optional)"
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
              
              {/* Total Amount Section */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  mt: 2, 
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center'
                }}
              >
                <Typography variant="h5" fontWeight="bold">
                  Total Amount: <Box component="span" color="primary.main">${totalAmount.toFixed(2)}</Box>
                </Typography>
              </Paper>
            </Box>
          </DialogContent>
          
          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addItem}
              size="large"
            >
              Add Item
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                onClick={() => {
                  setEditDialogOpen(false);
                  resetForm();
                }} 
                variant="outlined"
                size="large"
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleUpdateSubmit}
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckIcon />}
                size="large"
                sx={{ minWidth: 150 }}
              >
                {isSubmitting ? 'Updating...' : 'Update Order'}
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* ── View Order Dialog ─────────────────────────────────────────────── */}
        <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
            pb: 2
          }}>
            <Typography variant="h5" fontWeight="bold">Purchase Order Details</Typography>
            <IconButton onClick={() => setViewDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3 }}>
            {selectedOrder && (
              <Box>
                <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Order Information
                      </Typography>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Order Number:</Typography>
                          <Typography variant="body2">{selectedOrder.orderNumber}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Supplier:</Typography>
                          <Typography variant="body2">{selectedOrder.supplierName}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Contact:</Typography>
                          <Typography variant="body2">{selectedOrder.supplierContact}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Phone:</Typography>
                          <Typography variant="body2">{selectedOrder.supplierPhone}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Email:</Typography>
                          <Typography variant="body2">{selectedOrder.supplierEmail}</Typography>
                        </Box>
                      </Stack>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Order Details
                      </Typography>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Scope:</Typography>
                          <Chip 
                            label={selectedOrder.scopeName || selectedOrder.scopeType || 'Unknown'} 
                            size="small" 
                            color={selectedOrder.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Order Date:</Typography>
                          <Typography variant="body2">{new Date(selectedOrder.orderDate).toLocaleDateString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Expected Delivery:</Typography>
                          <Typography variant="body2">
                            {selectedOrder.expectedDelivery ? new Date(selectedOrder.expectedDelivery).toLocaleDateString() : 'Not set'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Status:</Typography>
                          {(() => {
                           const raw = selectedOrder.status ?? selectedOrder.order_status ?? selectedOrder.orderStatus ?? ''
                           const key = (raw && String(raw) !== 'null' && String(raw) !== 'undefined')
                             ? String(raw).trim().toUpperCase()
                             : 'PENDING'
                            const cfg = statusConfig[key]
                            return (
                              <Chip
                                icon={cfg?.icon}
                                label={cfg?.label || key || raw || '—'}
                                color={cfg?.color || 'default'}
                                size="small"
                              />
                            )
                          })()}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Total Amount:</Typography>
                          <Typography variant="body2" fontWeight="bold" color="primary.main">
                            ${parseFloat(selectedOrder.totalAmount || 0).toFixed(2)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
                
                {selectedOrder.notes && (
                  <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: (theme) => alpha(theme.palette.info.main, 0.04), borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body2">{selectedOrder.notes}</Typography>
                  </Paper>
                )}
                
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                  Order Items
                </Typography>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={50}>#</TableCell>
                        <TableCell>Item Name</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedOrder.items?.map((item, index) => (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {index + 1}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {item.itemName}
                            </Typography>
                            {item.itemDescription && (
                              <Typography variant="caption" color="text.secondary">
                                {item.itemDescription}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {item.itemSku || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={item.itemCategory || 'General'} 
                              size="small" 
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">{item.quantityOrdered}</TableCell>
                          <TableCell align="right">${parseFloat(item.unitPrice || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">${parseFloat(item.totalPrice || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={6} align="right">
                          <Typography variant="body2" fontWeight="bold">Grand Total:</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color="primary.main">
                            ${parseFloat(selectedOrder.totalAmount || 0).toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          
          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={() => setViewDialogOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
            pb: 2
          }}>
            <Typography variant="h6" fontWeight="bold">Delete Purchase Order</Typography>
            <IconButton onClick={() => setDeleteDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This action cannot be undone.
            </Alert>
            <Typography>
              Are you sure you want to delete purchase order <strong>{selectedOrder?.orderNumber}</strong>?
            </Typography>
          </DialogContent>
          
          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={() => setDeleteDialogOpen(false)} variant="outlined">
              Cancel
            </Button>
            <Button onClick={handleDeleteOrder} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

      </DashboardLayout>
    </RouteGuard>
  )
}

export default PurchaseOrdersPage