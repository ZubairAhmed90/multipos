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
  Badge
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
  Cancel as CancelIcon
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
  deletePurchaseOrder,
  setFilters,
  clearFilters,
  setPagination
} from '../../store/slices/purchaseOrdersSlice'

// Validation schema for purchase orders
const purchaseOrderSchema = yup.object({
  supplierId: yup.number().required('Supplier is required'),
  scopeType: yup.string().oneOf(['BRANCH', 'WAREHOUSE']).required('Scope type is required'),
  scopeId: yup.number().required('Scope is required'),
  orderDate: yup.date()
    .required('Order date is required')
    .transform((value) => {
      if (value === '' || !value) return null;
      // Handle DD/MM/YY format
      if (typeof value === 'string' && value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          // Convert DD/MM/YY to YYYY-MM-DD
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
    .transform((value) => {
      if (value === '' || !value) return null;
      // Handle DD/MM/YY format
      if (typeof value === 'string' && value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          // Convert DD/MM/YY to YYYY-MM-DD
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          return new Date(`${year}-${month}-${day}`);
        }
      }
      return value;
    }),
  notes: yup.string().nullable(),
  items: yup.array().of(
    yup.object({
      itemName: yup.string().required('Item name is required'),
      itemSku: yup.string().nullable(),
      itemDescription: yup.string().nullable(),
      quantityOrdered: yup.number().min(1, 'Quantity must be at least 1').required('Quantity is required'),
      unitPrice: yup.number().min(0, 'Unit price must be positive').required('Unit price is required'),
      notes: yup.string().nullable()
    })
  ).min(1, 'At least one item is required')
})

// Status configuration
const statusConfig = {
  PENDING: { color: 'warning', icon: <PendingIcon />, label: 'Pending' },
  APPROVED: { color: 'info', icon: <CheckIcon />, label: 'Approved' },
  ORDERED: { color: 'primary', icon: <ShoppingCartIcon />, label: 'Ordered' },
  SHIPPED: { color: 'secondary', icon: <ShippingIcon />, label: 'Shipped' },
  DELIVERED: { color: 'success', icon: <CheckIcon />, label: 'Delivered' },
  COMPLETED: { color: 'success', icon: <CheckIcon />, label: 'Completed' },
  CANCELLED: { color: 'error', icon: <DeleteIcon />, label: 'Cancelled' }
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

  // Load data on component mount and when filters change
  useEffect(() => {
    dispatch(fetchPurchaseOrders(filters))
  }, [dispatch, filters])
  
  // Load suppliers once on mount
  useEffect(() => {
    dispatch(fetchSuppliers())
  }, [dispatch])

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
    })
    setFormErrors({})
  }

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
        actualDelivery: newStatus === 'DELIVERED' ? new Date().toISOString().split('T')[0] : null
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

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FilterIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Filters</Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={4} lg={4} xl={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Orders"
                  placeholder="Search by order number or supplier..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 320, lg: 360 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: filters.search && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => handleFilterChange('search', '')}>
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={4} lg={4} xl={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    sx={{ minWidth: { xs: '100%', md: 220, lg: 260 } }}
                  >
                    <MenuItem value="">All Status</MenuItem>
                    {Object.keys(statusConfig).map(status => (
                      <MenuItem key={status} value={status}>
                        {statusConfig[status].label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={4} lg={4} xl={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Supplier</InputLabel>
                  <Select
                    value={filters.supplierId}
                    label="Supplier"
                    onChange={(e) => handleFilterChange('supplierId', e.target.value)}
                    sx={{ minWidth: { xs: '100%', md: 220, lg: 260 } }}
                  >
                    <MenuItem value="">All Suppliers</MenuItem>
                    {suppliers.map(supplier => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3} lg={3} xl={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="From Date"
                  type="date"
                  value={filters.orderDateFrom}
                  onChange={(e) => handleFilterChange('orderDateFrom', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: { xs: '100%', md: 200 } }}
                />
              </Grid>
              
              <Grid item xs={12} md={3} lg={3} xl={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="To Date"
                  type="date"
                  value={filters.orderDateTo}
                  onChange={(e) => handleFilterChange('orderDateTo', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: { xs: '100%', md: 200 } }}
                />
              </Grid>
              
              <Grid item xs={12} md={2} lg={2} xl={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleClearFilters}
                  disabled={Object.values(filters).every(v => !v)}
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
                    {purchaseOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {order.orderNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BusinessIcon color="primary" />
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
                            icon={statusConfig[order.status]?.icon}
                            label={statusConfig[order.status]?.label || order.status}
                            color={statusConfig[order.status]?.color || 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {parseFloat(order.totalAmount || 0).toFixed(2)}
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
                              <IconButton
                                size="small"
                                onClick={() => handleViewOrder(order)}
                                color="primary"
                              >
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            
                            {order.status === 'PENDING' && user?.role !== 'CASHIER' && (
                              <Tooltip title="Approve & Receive (Update Inventory)">
                                <IconButton
                                  size="small"
                                  onClick={() => handleStatusUpdate(order.id, 'COMPLETED')}
                                  color="success"
                                >
                                  <CheckIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {user?.role === 'ADMIN' && order.status === 'PENDING' && (
                              <Tooltip title="Reject/Cancel Order">
                                <IconButton
                                  size="small"
                                  onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                                  color="error"
                                >
                                  <CancelIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {order.status === 'APPROVED' && (
                              <Tooltip title="Mark as Ordered">
                                <IconButton
                                  size="small"
                                  onClick={() => handleStatusUpdate(order.id, 'ORDERED')}
                                  color="info"
                                >
                                  <ShoppingCartIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {order.status === 'ORDERED' && (
                              <Tooltip title="Mark as Shipped">
                                <IconButton
                                  size="small"
                                  onClick={() => handleStatusUpdate(order.id, 'SHIPPED')}
                                  color="secondary"
                                >
                                  <ShippingIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {order.status === 'SHIPPED' && (
                              <Tooltip title="Mark as Delivered">
                                <IconButton
                                  size="small"
                                  onClick={() => handleStatusUpdate(order.id, 'DELIVERED')}
                                  color="success"
                                >
                                  <CheckIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {user?.role === 'ADMIN' && order.status === 'PENDING' && (
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedOrder(order)
                                    setDeleteDialogOpen(true)
                                  }}
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
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

        {/* Create Order Dialog */}
        <Dialog open={formDialogOpen} onClose={() => setFormDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Supplier Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.supplierId}>
                  <InputLabel>Supplier *</InputLabel>
                  <Select
                    value={formData.supplierId}
                    label="Supplier *"
                    onChange={(e) => handleFieldChange('supplierId', e.target.value)}
                  >
                    {suppliers.map(supplier => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.supplierId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {formErrors.supplierId}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              
              {/* Scope Type */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.scopeType}>
                  <InputLabel>Scope Type *</InputLabel>
                  <Select
                    value={formData.scopeType}
                    label="Scope Type *"
                    onChange={(e) => handleFieldChange('scopeType', e.target.value)}
                    disabled={user?.role !== 'ADMIN'}
                  >
                    <MenuItem value="BRANCH">Branch</MenuItem>
                    <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                  </Select>
                  {formErrors.scopeType && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {formErrors.scopeType}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              
              {/* Order Date */}
              <Grid item xs={12} md={6}>
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
                        error: !!formErrors.orderDate,
                        helperText: formErrors.orderDate,
                        InputLabelProps: { shrink: true }
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              
              {/* Expected Delivery */}
              <Grid item xs={12} md={6}>
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
                        error: !!formErrors.expectedDelivery,
                        helperText: formErrors.expectedDelivery,
                        InputLabelProps: { shrink: true }
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              
              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                />
              </Grid>
            </Grid>
            
            {/* Items Section */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Order Items
              </Typography>
              
              {formData.items.map((item, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          label="Item Name *"
                          value={item.itemName}
                          onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                          error={!!formErrors[`items.${index}.itemName`]}
                          helperText={formErrors[`items.${index}.itemName`]}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          fullWidth
                          label="SKU"
                          value={item.itemSku}
                          onChange={(e) => handleItemChange(index, 'itemSku', e.target.value)}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth>
                          <InputLabel>Category</InputLabel>
                          <Select
                            value={item.itemCategory || 'General'}
                            label="Category"
                            onChange={(e) => handleItemChange(index, 'itemCategory', e.target.value)}
                          >
                            <MenuItem value="General">General</MenuItem>
                            <MenuItem value="Food">Food</MenuItem>
                            <MenuItem value="Accessories">Accessories</MenuItem>
                            <MenuItem value="Medicine">Medicine</MenuItem>
                            <MenuItem value="Toys">Toys</MenuItem>
                            <MenuItem value="Grooming">Grooming</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          fullWidth
                          label="Quantity *"
                          type="number"
                          value={item.quantityOrdered}
                          onChange={(e) => handleItemChange(index, 'quantityOrdered', parseInt(e.target.value) || 0)}
                          error={!!formErrors[`items.${index}.quantityOrdered`]}
                          helperText={formErrors[`items.${index}.quantityOrdered`]}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          fullWidth
                          label="Unit Price *"
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          error={!!formErrors[`items.${index}.unitPrice`]}
                          helperText={formErrors[`items.${index}.unitPrice`]}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={1}>
                        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'space-between' }}>
                          <Typography variant="body2" fontWeight="medium">
                            Total: {(item.quantityOrdered * item.unitPrice).toFixed(2)}
                          </Typography>
                          {formData.items.length > 1 && (
                            <IconButton
                              size="small"
                              onClick={() => removeItem(index)}
                              color="error"
                              sx={{ ml: 1 }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Description"
                          multiline
                          rows={2}
                          value={item.itemDescription}
                          onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addItem}
                sx={{ mb: 2 }}
              >
                Add Item
              </Button>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  Total Amount: {totalAmount.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
            >
              {isSubmitting ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* View Order Dialog */}
        <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Purchase Order Details</DialogTitle>
          <DialogContent>
            {selectedOrder && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Order Information
                    </Typography>
                    <Typography variant="body2"><strong>Order Number:</strong> {selectedOrder.orderNumber}</Typography>
                    <Typography variant="body2"><strong>Supplier:</strong> {selectedOrder.supplierName}</Typography>
                    <Typography variant="body2"><strong>Contact:</strong> {selectedOrder.supplierContact}</Typography>
                    <Typography variant="body2"><strong>Phone:</strong> {selectedOrder.supplierPhone}</Typography>
                    <Typography variant="body2"><strong>Email:</strong> {selectedOrder.supplierEmail}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Order Details
                    </Typography>
                    <Typography variant="body2"><strong>Scope:</strong> {selectedOrder.scopeName || selectedOrder.scopeType || 'Unknown'}</Typography>
                    <Typography variant="body2"><strong>Order Date:</strong> {new Date(selectedOrder.orderDate).toLocaleDateString()}</Typography>
                    <Typography variant="body2"><strong>Expected Delivery:</strong> {selectedOrder.expectedDelivery ? new Date(selectedOrder.expectedDelivery).toLocaleDateString() : 'Not set'}</Typography>
                    <Typography variant="body2">
                      <strong>Status:</strong> 
                      {selectedOrder.status ? (
                        <Chip
                          icon={statusConfig[selectedOrder.status]?.icon}
                          label={statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                          color={statusConfig[selectedOrder.status]?.color || 'default'}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      ) : (
                        <span style={{ marginLeft: '8px', color: '#999' }}>No Status</span>
                      )}
                    </Typography>
                    <Typography variant="body2"><strong>Total Amount:</strong> {parseFloat(selectedOrder.totalAmount || 0).toFixed(2)}</Typography>
                  </Grid>
                </Grid>
                
                {selectedOrder.notes && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>Notes</Typography>
                    <Typography variant="body2">{selectedOrder.notes}</Typography>
                  </Box>
                )}
                
                <Typography variant="h6" gutterBottom>Order Items</Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item Name</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedOrder.items?.map((item, index) => (
                        <TableRow key={index}>
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
                          <TableCell>{item.itemSku || '-'}</TableCell>
                          <TableCell align="right">{item.quantityOrdered}</TableCell>
                          <TableCell align="right">{parseFloat(item.unitPrice || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(item.totalPrice || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Purchase Order</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete purchase order <strong>{selectedOrder?.orderNumber}</strong>?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
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
