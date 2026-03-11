'use client'
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTheme } from '@mui/material/styles'
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
  alpha,
  Checkbox
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
  DragHandle as DragHandleIcon,
  AddCircleOutline as AddRowIcon,
  DeleteSweep as DeleteSweepIcon
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

const statusConfig = {
  PENDING: { color: 'warning', icon: <PendingIcon />, label: 'Pending' },
  COMPLETED: { color: 'success', icon: <CheckIcon />, label: 'Completed' },
  CANCELLED: { color: 'error', icon: <CancelIcon />, label: 'Cancelled' }
}

// ── Enhanced Order Items Table ──────────────────────────────────────────────
// Shared between Create and Edit dialogs
function OrderItemsTable({
  items,
  formErrors,
  inventoryOptions,
  categoryOptions,
  onItemChange,
  onAddItemBelow,
  onDeleteSelected,
  selectedRows,
  onRowSelect,
  onSelectAll,
  getItemSearchState,       // ← add
  updateItemSearchState,    // ← add
  handleItemSearchChange,   // ← add
  handleItemSelect          // ← add
}) {
  const allSelected = items.length > 0 && selectedRows.length === items.length
  const someSelected = selectedRows.length > 0 && selectedRows.length < items.length

  return (
 <Box sx={{ overflow: 'visible' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h6" fontWeight="bold">Order Items</Typography>
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteSweepIcon />}
          disabled={selectedRows.length === 0}
          onClick={onDeleteSelected}
          sx={{ opacity: selectedRows.length === 0 ? 0.4 : 1, transition: 'opacity 0.2s' }}
        >
          Delete Selected {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
        </Button>
      </Box>

      {/* Column headers */}
      <Box sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        px: 1,
        mb: 0.5,
        color: 'text.secondary'
      }}>
        {/* Select all checkbox */}
        <Box sx={{ flexShrink: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            sx={{ p: 0 }}
            inputProps={{ 'aria-label': 'Select all rows' }}
          />
        </Box>
        <Box sx={{ flexShrink: 0, width: 36 }} />
        <Box sx={{ flex: 4 }}><Typography variant="caption" fontWeight="600">#&nbsp;&nbsp;Item Name</Typography></Box>
        <Box sx={{ flex: 2 }}><Typography variant="caption" fontWeight="600">Category</Typography></Box>
        <Box sx={{ flex: 1 }}><Typography variant="caption" fontWeight="600">SKU</Typography></Box>
        <Box sx={{ flexShrink: 0, width: 110 }}><Typography variant="caption" fontWeight="600">Qty</Typography></Box>
        <Box sx={{ flexShrink: 0, width: 160 }}><Typography variant="caption" fontWeight="600">Unit Price</Typography></Box>
        <Box sx={{ flexShrink: 0, width: 160 }}><Typography variant="caption" fontWeight="600">Total</Typography></Box>
        <Box sx={{ flexShrink: 0, width: 50 }} />
      </Box>

      {items.map((item, index) => (
       <ItemRow
    key={index}
    index={index}
    item={item}
    formErrors={formErrors}
    inventoryOptions={inventoryOptions}
    categoryOptions={categoryOptions}
    isSelected={selectedRows.includes(index)}
    isLast={index === items.length - 1}
    onItemChange={onItemChange}
    onAddBelow={() => onAddItemBelow(index)}
    onSelect={(checked) => onRowSelect(index, checked)}
    totalItems={items.length}
    getItemSearchState={getItemSearchState}         // ← add
    updateItemSearchState={updateItemSearchState}   // ← add
    handleItemSearchChange={handleItemSearchChange} // ← add
    handleItemSelect={handleItemSelect}             // ← add
  />
))}
    </Box>
  )
}

// ── Single Item Row ─────────────────────────────────────────────────────────
function ItemRow({
  index,
  item,
  formErrors,
  inventoryOptions,
  categoryOptions,
  isSelected,
  isLast,
  onItemChange,
  onAddBelow,
  onSelect,
  totalItems,
  getItemSearchState,       // ← add
  updateItemSearchState,    // ← add
  handleItemSearchChange,   // ← add
  handleItemSelect          // ← add
}) {
  const theme = useTheme()
  const addBtnRef = useRef(null)

  const handleAddKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onAddBelow()
    }
  }

  // Filtered items for search dropdown
  const filteredItems = useMemo(() => {
    const searchValue = item.itemName || ''
    if (!searchValue || searchValue.length < 1) return []
    const q = searchValue.toLowerCase()
    return inventoryOptions
      .filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
      .slice(0, 12)
  }, [item.itemName, inventoryOptions])

  // Reset highlight when dropdown contents change or it closes
  useEffect(() => {
    const state = getItemSearchState(index)
    if (!state.open) {
      updateItemSearchState(index, { highlightIndex: -1 })
    } else if (filteredItems.length > 0) {
      updateItemSearchState(index, { highlightIndex: 0 })
    }
  }, [filteredItems, index])

  // Ensure highlighted item is scrolled into view
  useEffect(() => {
    const state = getItemSearchState(index)
    if (state.open && state.highlightIndex >= 0) {
      const el = document.getElementById(`po-item-${index}-${state.highlightIndex}`)
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [index])

  return (
    <Card
      sx={{
        mb: 1.5,
        overflow: 'visible',
        border: isSelected
          ? '1.5px solid'
          : isLast
          ? '1px solid'
          : '1px solid transparent',
        borderColor: isSelected
          ? 'error.main'
          : isLast
          ? 'primary.main'
          : 'divider',
        bgcolor: isSelected
          ? (theme) => alpha(theme.palette.error.main, 0.04)
          : 'background.paper',
        transition: 'border-color 0.15s, background-color 0.15s'
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, overflow: 'visible' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>

          {/* Row selection checkbox */}
          <Box sx={{ flexShrink: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Checkbox
              size="small"
              checked={isSelected}
              onChange={(e) => onSelect(e.target.checked)}
              sx={{ p: 0 }}
              inputProps={{ 'aria-label': `Select row ${index + 1}` }}
            />
          </Box>

          {/* # badge */}
          <Box sx={{ flexShrink: 0, width: 36 }}>
            <Typography variant="body2" fontWeight="bold" sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28,
              bgcolor: isSelected ? 'error.main' : 'primary.main',
              color: 'white',
              borderRadius: '50%',
              transition: 'background-color 0.15s',
              fontSize: 12
            }}>
              {index + 1}
            </Typography>
          </Box>

          {/* Item Name — searchable dropdown */}
          <Box sx={{ flex: 4, minWidth: 0, position: 'relative' }}>
            <TextField
              fullWidth
              size="small"
              label="Item Name *"
              error={!!formErrors[`items[${index}].itemName`]}
              helperText={formErrors[`items[${index}].itemName`]}
              placeholder="Search or type item..."
              value={item.itemName || ''}
              onChange={(e) => handleItemSearchChange(index, e.target.value)}
              onFocus={() => {
                if (item.itemName && item.itemName.length >= 1) {
                  updateItemSearchState(index, { open: true })
                }
              }}
              onKeyDown={(e) => {
                const state = getItemSearchState(index)
                if (e.key === 'Escape') {
                  updateItemSearchState(index, { open: false, highlightIndex: -1 })
                }
                if (e.key === 'Tab' && item.itemName) {
                  updateItemSearchState(index, { open: false, highlightIndex: -1 })
                }
                if (state.open && filteredItems.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    updateItemSearchState(index, {
                      highlightIndex: Math.min(state.highlightIndex + 1, filteredItems.length - 1)
                    })
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    updateItemSearchState(index, {
                      highlightIndex: Math.max(state.highlightIndex - 1, 0)
                    })
                  } else if (e.key === 'Enter' && state.highlightIndex >= 0) {
                    e.preventDefault()
                    handleItemSelect(index, filteredItems[state.highlightIndex])
                  }
                }
              }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} />
              }}
            />
            {/* Custom Dropdown */}
            {getItemSearchState(index).open && filteredItems.length > 0 && (
              <Paper
                sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1400,
                  maxHeight: 320,
                  overflowY: 'auto',
                  boxShadow: 6,
                  border: `1px solid ${theme.palette.primary.main}`,
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px'
                }}
              >
                {filteredItems.map((product, pi) => (
                  <Box
                    id={`po-item-${index}-${pi}`}
                    key={product.sku || product.name}
                    onMouseDown={(e) => { e.preventDefault(); handleItemSelect(index, product) }}
                    sx={{
                      px: 2,
                      py: 1.25,
                      cursor: 'pointer',
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      bgcolor: pi === getItemSearchState(index).highlightIndex ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {product.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        SKU: {product.sku || '—'}
                        {product.category ? ` · ${product.category}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Paper>
            )}
            {getItemSearchState(index).open && item.itemName && item.itemName.length >= 2 && filteredItems.length === 0 && (
              <Paper sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1400,
                p: 2,
                boxShadow: 4,
                borderRadius: '0 0 8px 8px'
              }}>
               <Typography variant="body2" color="text.secondary">
  {`No items found matching "${item.itemName}"`}
</Typography>
              </Paper>
            )}
          </Box>

          {/* Category */}
          <Box sx={{ flex: 2, minWidth: 0 }}>
            <Autocomplete
              freeSolo
              size="small"
              options={categoryOptions}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option)}
              value={item.itemCategory || 'General'}
              onChange={(_, newValue) => {
                onItemChange(index, 'itemCategory', typeof newValue === 'string' ? newValue : (newValue || 'General'))
              }}
              onInputChange={(_, newInputValue) => {
                onItemChange(index, 'itemCategory', newInputValue)
              }}
              renderInput={(params) => (
                <TextField {...params} label="Category" size="small" />
              )}
            />
          </Box>

          {/* SKU */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              fullWidth size="small" label="SKU"
              value={item.itemSku}
              onChange={(e) => onItemChange(index, 'itemSku', e.target.value)}
            />
          </Box>

          {/* Qty */}
          <Box sx={{ flexShrink: 0, width: 110 }}>
            <TextField
              fullWidth size="small" label="Qty *" type="number"
              value={item.quantityOrdered}
              onChange={(e) => onItemChange(index, 'quantityOrdered', parseInt(e.target.value) || 0)}
              error={!!formErrors[`items[${index}].quantityOrdered`]}
              helperText={formErrors[`items[${index}].quantityOrdered`]}
              inputProps={{ min: 1 }}
            />
          </Box>

          {/* Price */}
          <Box sx={{ flexShrink: 0, width: 160 }}>
            <TextField
              fullWidth size="small" label="Price *" type="number"
              inputProps={{ step: '0.01' }}
              value={item.unitPrice}
              onChange={(e) => onItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
              error={!!formErrors[`items[${index}].unitPrice`]}
              helperText={formErrors[`items[${index}].unitPrice`]}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          </Box>

          {/* Total */}
          <Box sx={{ flexShrink: 0, width: 160 }}>
            <TextField
              fullWidth size="small" label="Total"
              value={(item.quantityOrdered * item.unitPrice).toFixed(2)}
              InputProps={{
                readOnly: true,
                startAdornment: <InputAdornment position="start">$</InputAdornment>
              }}
              sx={{
                '& .MuiInputBase-input.Mui-readOnly': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04)
                }
              }}
            />
          </Box>

          {/* Add row below button (replaces delete) */}
          <Box sx={{ flexShrink: 0, width: 50, textAlign: 'center' }}>
            <Tooltip title="Add row below (Enter)" arrow>
              <IconButton
                ref={addBtnRef}
                size="small"
                onClick={onAddBelow}
                onKeyDown={handleAddKeyDown}
                color="primary"
                tabIndex={0}
                aria-label={`Add new item row below row ${index + 1}`}
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18),
                  },
                  transition: 'background-color 0.15s'
                }}
              >
                <AddRowIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

        </Box>
      </CardContent>
    </Card>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
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
  
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [editingOrder, setEditingOrder] = useState(null) 
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Row selection state (shared — reset when dialog opens/closes)
  const [selectedRows, setSelectedRows] = useState([])

  const emptyItem = () => ({
    itemName: '', itemSku: '', itemCategory: 'General',
    itemDescription: '', quantityOrdered: 1, unitPrice: 0, notes: ''
  })

  const [formData, setFormData] = useState({
    supplierId: '',
    scopeType: user?.role === 'CASHIER' ? 'BRANCH' : user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : '',
    scopeId: user?.role === 'CASHIER' ? user?.branchId : user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: '',
    items: [emptyItem()]
  })
  
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inventoryOptions, setInventoryOptions] = useState([])
  const [categoriesFromApi, setCategoriesFromApi] = useState([])
  const [itemSearchStates, setItemSearchStates] = useState({}) // { [itemIndex]: { search: '', open: false, highlightIndex: -1 } }

  useEffect(() => {
    dispatch(fetchPurchaseOrders(filters))
  }, [dispatch, filters])
  
  useEffect(() => {
    dispatch(fetchSuppliers())
  }, [dispatch])

  useEffect(() => {
    const loadInventoryOptions = async () => {
      try {
        if (!formDialogOpen && !editDialogOpen) return
        const scopeType = formData.scopeType
        const scopeId = formData.scopeId
        if (!scopeType || !scopeId) return
        const res = await api.get('/inventory', {
          params: { scopeType, scopeId, limit: 'all' }
        })
        const data = res.data?.data || res.data || []
        const opts = Array.isArray(data)
          ? data.map(item => {
              const cat = item.category || item.category_name || item.categoryName || item.category_id || 'General'
              return { label: item.name, name: item.name, sku: item.sku, category: cat }
            }).filter(o => o.name)
          : []
        setInventoryOptions(opts)
      } catch (err) {
        setInventoryOptions([])
      }
    }
    loadInventoryOptions()
  }, [formDialogOpen, editDialogOpen, formData.scopeType, formData.scopeId])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.get('/categories')
        const data = res.data?.data || res.data || []
        const names = Array.isArray(data)
          ? data.map((c) => c?.name || c?.label || c?.category || c).filter(Boolean)
          : []
        setCategoriesFromApi(names)
      } catch (err) {
        setCategoriesFromApi([])
      }
    }
    if (formDialogOpen || editDialogOpen) loadCategories()
  }, [formDialogOpen, editDialogOpen])

  const categoryOptions = useMemo(() => {
    const merged = [...defaultCategories]
    categoriesFromApi.forEach((c) => { if (c && !merged.includes(c)) merged.push(c) })
    inventoryOptions.forEach((opt) => {
      const cat = opt?.category
      if (cat && !merged.includes(cat)) merged.push(cat)
    })
    return merged
  }, [categoriesFromApi, inventoryOptions])

  // Reset item search states when dialog closes
  useEffect(() => {
    if (!formDialogOpen && !editDialogOpen) {
      setItemSearchStates({})
    }
  }, [formDialogOpen, editDialogOpen])

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }

  // Item search state management
  const getItemSearchState = (index) => {
    return itemSearchStates[index] || { search: '', open: false, highlightIndex: -1 }
  }

  const updateItemSearchState = (index, updates) => {
    setItemSearchStates(prev => ({
      ...prev,
      [index]: { ...getItemSearchState(index), ...updates }
    }))
  }

  const handleItemSearchChange = (index, searchValue) => {
    updateItemSearchState(index, { search: searchValue, open: true })
    handleItemChange(index, 'itemName', searchValue)
  }

  const handleItemSelect = (index, item) => {
    handleItemChange(index, 'itemName', item.name)
    handleItemChange(index, 'itemSku', item.sku)
    handleItemChange(index, 'itemCategory', item.category)
    updateItemSearchState(index, { search: item.name, open: false, highlightIndex: -1 })
  }

  // Add new item row (at end or after a specific index)
  const addItem = (afterIndex = null) => {
    setFormData(prev => {
      const newItems = [...prev.items]
      const insertAt = afterIndex !== null ? afterIndex + 1 : newItems.length
      newItems.splice(insertAt, 0, emptyItem())
      return { ...prev, items: newItems }
    })
    // Deselect all when structure changes
    setSelectedRows([])
  }

  // Delete selected rows
  const deleteSelectedRows = () => {
    if (formData.items.length - selectedRows.length < 1) return // keep at least 1
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => !selectedRows.includes(i))
    }))
    setSelectedRows([])
  }

  // Row selection handlers
  const handleRowSelect = (index, checked) => {
    setSelectedRows(prev =>
      checked ? [...prev, index] : prev.filter(i => i !== index)
    )
  }

  const handleSelectAll = (checked) => {
    setSelectedRows(checked ? formData.items.map((_, i) => i) : [])
  }

  const totalAmount = useMemo(() => {
    return formData.items.reduce((total, item) => {
      return total + (item.quantityOrdered * item.unitPrice)
    }, 0)
  }, [formData.items])

  const validateForm = async () => {
    try {
      await purchaseOrderSchema.validate(formData, { abortEarly: false })
      setFormErrors({})
      return true
    } catch (error) {
      const errors = {}
      error.inner.forEach(err => { errors[err.path] = err.message })
      setFormErrors(errors)
      return false
    }
  }

  const handleEditOrder = async (order) => {
    try {
      const response = await dispatch(fetchPurchaseOrder(order.id));
      const fullOrder = response.payload.data;
      setEditingOrder(fullOrder);
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
      setSelectedRows([])
      setEditDialogOpen(true);
    } catch (error) {
      console.error('Error loading order for edit:', error);
    }
  };

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
      await dispatch(updatePurchaseOrder({ id: editingOrder.id, orderData }));
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

  const resetForm = () => {
    setFormData({
      supplierId: '',
      scopeType: user?.role === 'CASHIER' ? 'BRANCH' : user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : '',
      scopeId: user?.role === 'CASHIER' ? user?.branchId : user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      notes: '',
      items: [emptyItem()]
    });
    setFormErrors({});
    setEditingOrder(null);
    setSelectedRows([]);
  };

  const handleViewOrder = async (order) => {
    try {
      const response = await dispatch(fetchPurchaseOrder(order.id))
      setSelectedOrder(response.payload.data)
    } catch (error) {
      setSelectedOrder(order)
    }
    setViewDialogOpen(true)
  }

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

  const handleFilterChange = (field, value) => {
    dispatch(setFilters({ [field]: value }))
  }

  const handleClearFilters = () => {
    dispatch(clearFilters())
  }

  const handlePageChange = (event, newPage) => {
    dispatch(setPagination({ page: newPage }))
  }

  // Shared items section props
const itemsTableProps = {
  items: formData.items,
  formErrors,
  inventoryOptions,
  categoryOptions,
  onItemChange: handleItemChange,
  onAddItemBelow: (index) => addItem(index),
  onDeleteSelected: deleteSelectedRows,
  selectedRows,
  onRowSelect: handleRowSelect,
  onSelectAll: handleSelectAll,
  getItemSearchState,       // ← add
  updateItemSearchState,    // ← add
  handleItemSearchChange,   // ← add
  handleItemSelect          // ← add
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
              onClick={() => { resetForm(); setFormDialogOpen(true) }}
            >
              Create Order
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FilterIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Filters</Typography>
              {Object.values(filters).some(v => v) && (
                <Chip label="Clear All" size="small" onDelete={handleClearFilters} sx={{ ml: 2 }} />
              )}
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth size="small" label="Search Orders"
                  placeholder="Order # or supplier..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
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

              <Grid item xs={12} md={6} lg={3}>
                <FormControl fullWidth size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="filter-supplier-label">Supplier</InputLabel>
                  <Select
                    labelId="filter-supplier-label"
                    value={filters.supplierId}
                    label="Supplier"
                    onChange={(e) => handleFilterChange('supplierId', e.target.value ? Number(e.target.value) : '')}
                    renderValue={(v) => {
                      if (!v) return 'All Suppliers'
                      const s = suppliers.find(sup => sup.id === v || sup.id === Number(v))
                      return s ? s.name : 'All Suppliers'
                    }}
                    MenuProps={{ PaperProps: { sx: { maxWidth: 400 } } }}
                  >
                    <MenuItem value="">All Suppliers</MenuItem>
                    {suppliers.map((supplier) => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        <Typography noWrap sx={{ maxWidth: 300 }}>{supplier.name}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth size="small" label="From Date" type="date"
                  value={filters.orderDateFrom}
                  onChange={(e) => handleFilterChange('orderDateFrom', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={1}>
                <TextField
                  fullWidth size="small" label="To Date" type="date"
                  value={filters.orderDateTo}
                  onChange={(e) => handleFilterChange('orderDateTo', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={1}>
                <Button
                  fullWidth variant="outlined" onClick={handleClearFilters}
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
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
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
                      const rawStatus = order.status ?? order.order_status ?? order.orderStatus ?? ''
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
                            <Typography variant="body2" fontWeight="medium">{order.orderNumber}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BusinessIcon color="primary" fontSize="small" />
                              <Box>
                                <Typography variant="body2" fontWeight="medium">{order.supplierName}</Typography>
                                <Typography variant="caption" color="text.secondary">{order.supplierContact}</Typography>
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
                              {(user?.role === 'ADMIN' || (orderStatus === 'PENDING' &&
                                ((user?.role === 'WAREHOUSE_KEEPER' && order.scopeType === 'WAREHOUSE' && order.scopeId === user.warehouseId) ||
                                 (user?.role === 'CASHIER' && order.scopeType === 'BRANCH' && order.scopeId === user.branchId)))) && (
                                <Tooltip title="Edit Order">
                                  <IconButton size="small" onClick={() => handleEditOrder(order)} color="primary">
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {user?.role === 'ADMIN' && orderStatus === 'PENDING' && (
                                <Tooltip title="Mark as Completed (updates inventory)">
                                  <IconButton size="small" onClick={() => handleStatusUpdate(order.id, 'COMPLETED')} color="success">
                                    <CheckIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {user?.role === 'ADMIN' && orderStatus === 'PENDING' && (
                                <Tooltip title="Cancel Order">
                                  <IconButton size="small" onClick={() => handleStatusUpdate(order.id, 'CANCELLED')} color="error">
                                    <CancelIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

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

        {/* ── Create Order Dialog ──────────────────────────────────────────── */}
        <Dialog
          open={formDialogOpen}
          onClose={() => setFormDialogOpen(false)}
          maxWidth={false}
          fullWidth
          PaperProps={{
            sx: {
              minHeight: '80vh',
              maxHeight: '90vh',
              width: '98vw',
              maxWidth: '1800px'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: 1, borderColor: 'divider', pb: 2
          }}>
            <Typography variant="h5" fontWeight="bold">Create Purchase Order</Typography>
            <IconButton onClick={() => setFormDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
<DialogContent sx={{ pt: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
  <Box sx={{ overflowY: 'auto', overflowX: 'visible', flex: 1 }}>            {/* Header fields */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
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
                        <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>
                      ))}
                    </Select>
                    {formErrors.supplierId && (
                      <Typography variant="caption" color="error">{formErrors.supplierId}</Typography>
                    )}
                  </FormControl>
                </Grid>

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
                      <Typography variant="caption" color="error">{formErrors.scopeType}</Typography>
                    )}
                  </FormControl>
                </Grid>

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
                          fullWidth: true, size: 'small',
                          error: !!formErrors.orderDate,
                          helperText: formErrors.orderDate
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

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
                          fullWidth: true, size: 'small',
                          error: !!formErrors.expectedDelivery,
                          helperText: formErrors.expectedDelivery
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth size="small" label="Notes"
                    placeholder="Additional notes..."
                    value={formData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Paper>
            
            {/* Items table */}
            <OrderItemsTable {...itemsTableProps} />

            {/* Total */}
            <Paper elevation={0} sx={{
              p: 2, mt: 2,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              borderRadius: 2,
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
            }}>
              <Typography variant="h5" fontWeight="bold">
                Total Amount: <Box component="span" color="primary.main">${totalAmount.toFixed(2)}</Box>
              </Typography>
            </Paper>
          </Box>
          </DialogContent>
          
          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => addItem()}
                size="large"
              >
                Add Item
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon />}
                size="large"
                disabled={selectedRows.length === 0}
                onClick={deleteSelectedRows}
              >
                Delete Selected {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => setFormDialogOpen(false)} variant="outlined" size="large">
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

        {/* ── Edit Order Dialog ────────────────────────────────────────────── */}
        <Dialog
          open={editDialogOpen}
          onClose={() => { setEditDialogOpen(false); resetForm(); }}
          maxWidth={false}
          fullWidth
          PaperProps={{
            sx: {
              minHeight: '80vh',
              maxHeight: '90vh',
              width: '98vw',
              maxWidth: '1800px'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: 1, borderColor: 'divider', pb: 2
          }}>
            <Typography variant="h5" fontWeight="bold">
              Edit Purchase Order #{editingOrder?.orderNumber}
            </Typography>
            <IconButton onClick={() => { setEditDialogOpen(false); resetForm(); }} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
<DialogContent sx={{ pt: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
  <Box sx={{ overflowY: 'auto', overflowX: 'visible', flex: 1 }}>            {/* Header fields — same as Create */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
              <Grid container spacing={2} alignItems="center">
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
                        <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>
                      ))}
                    </Select>
                    {formErrors.supplierId && (
                      <Typography variant="caption" color="error">{formErrors.supplierId}</Typography>
                    )}
                  </FormControl>
                </Grid>

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
                      <Typography variant="caption" color="error">{formErrors.scopeType}</Typography>
                    )}
                  </FormControl>
                </Grid>

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
                          fullWidth: true, size: 'small',
                          error: !!formErrors.orderDate,
                          helperText: formErrors.orderDate
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

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
                          fullWidth: true, size: 'small',
                          error: !!formErrors.expectedDelivery,
                          helperText: formErrors.expectedDelivery
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Grid>

                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth size="small" label="Notes"
                    placeholder="Additional notes..."
                    value={formData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Paper>
            
            {/* Items table */}
            <OrderItemsTable {...itemsTableProps} />

            {/* Total */}
            <Paper elevation={0} sx={{
              p: 2, mt: 2,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              borderRadius: 2,
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
            }}>
              <Typography variant="h5" fontWeight="bold">
                Total Amount: <Box component="span" color="primary.main">${totalAmount.toFixed(2)}</Box>
              </Typography>
            </Paper>
            </Box>
          </DialogContent>
          
          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => addItem()}
                size="large"
              >
                Add Item
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon />}
                size="large"
                disabled={selectedRows.length === 0}
                onClick={deleteSelectedRows}
              >
                Delete Selected {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => { setEditDialogOpen(false); resetForm(); }} variant="outlined" size="large">
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

        {/* ── View Order Dialog ────────────────────────────────────────────── */}
        <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: 1, borderColor: 'divider', pb: 2
          }}>
            <Typography variant="h5" fontWeight="bold">Purchase Order Details</Typography>
            <IconButton onClick={() => setViewDialogOpen(false)} size="small"><CloseIcon /></IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3 }}>
            {selectedOrder && (
              <Box>
                <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Order Information</Typography>
                      <Stack spacing={1}>
                        {[
                          ['Order Number', selectedOrder.orderNumber],
                          ['Supplier', selectedOrder.supplierName],
                          ['Contact', selectedOrder.supplierContact],
                          ['Phone', selectedOrder.supplierPhone],
                          ['Email', selectedOrder.supplierEmail],
                        ].map(([label, value]) => (
                          <Box key={label} sx={{ display: 'flex', gap: 1 }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>{label}:</Typography>
                            <Typography variant="body2">{value}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Order Details</Typography>
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
                          <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>Exp. Delivery:</Typography>
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
                              <Chip icon={cfg?.icon} label={cfg?.label || key} color={cfg?.color || 'default'} size="small" />
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
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Notes</Typography>
                    <Typography variant="body2">{selectedOrder.notes}</Typography>
                  </Paper>
                )}
                
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>Order Items</Typography>
                
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
                          <TableCell><Typography variant="body2" color="text.secondary">{index + 1}</Typography></TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">{item.itemName}</Typography>
                            {item.itemDescription && (
                              <Typography variant="caption" color="text.secondary">{item.itemDescription}</Typography>
                            )}
                          </TableCell>
                          <TableCell><Typography variant="body2">{item.itemSku || '-'}</Typography></TableCell>
                          <TableCell>
                            <Chip label={item.itemCategory || 'General'} size="small" variant="outlined" />
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
            <Button onClick={() => setViewDialogOpen(false)} variant="contained">Close</Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: 1, borderColor: 'divider', pb: 2
          }}>
            <Typography variant="h6" fontWeight="bold">Delete Purchase Order</Typography>
            <IconButton onClick={() => setDeleteDialogOpen(false)} size="small"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>This action cannot be undone.</Alert>
            <Typography>
              Are you sure you want to delete purchase order <strong>{selectedOrder?.orderNumber}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={() => setDeleteDialogOpen(false)} variant="outlined">Cancel</Button>
            <Button onClick={handleDeleteOrder} color="error" variant="contained">Delete</Button>
          </DialogActions>
        </Dialog>

      </DashboardLayout>
    </RouteGuard>
  )
}

export default PurchaseOrdersPage 