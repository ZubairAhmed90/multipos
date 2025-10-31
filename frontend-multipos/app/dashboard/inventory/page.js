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
  Pagination
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { 
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth.js'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import PollingStatusIndicator from '../../../components/polling/PollingStatusIndicator'
import ExcelUploadDialog from '../../../components/upload/ExcelUploadDialog'
import { useInventoryPolling } from '../../../hooks/usePolling'
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../store/slices/inventorySlice'
import { fetchBranchSettings } from '../../store/slices/branchesSlice'
import { fetchWarehouseSettings, fetchWarehouses } from '../../store/slices/warehousesSlice'
import ScopeField from '../../../components/forms/ScopeField'
import SupplierField from '../../../components/forms/SupplierField'

// Validation schema - matches backend validation exactly
const inventorySchema = yup.object({
  name: yup.string()
    .trim()
    .min(1, 'Item name must be between 1 and 200 characters')
    .max(200, 'Item name must be between 1 and 200 characters')
    .required('Item name is required'),
  sku: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('sku-validation', 'SKU must be between 1 and 20 characters and can only contain letters, numbers, and hyphens', function(value) {
      if (!value) return true // Allow empty/null values
      if (value.length < 1 || value.length > 20) return false
      return /^[A-Za-z0-9-]+$/.test(value)
    }),
  barcode: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('barcode-length', 'Barcode must be between 1 and 50 characters', function(value) {
      if (!value) return true // Allow empty/null values
      return value.length >= 1 && value.length <= 50
    }),
  description: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  category: yup.string()
    .trim()
    .min(1, 'Category must be between 1 and 100 characters')
    .max(100, 'Category must be between 1 and 100 characters')
    .required('Category is required'),
  unit: yup.string()
    .trim()
    .min(1, 'Unit must be between 1 and 20 characters')
    .max(20, 'Unit must be between 1 and 20 characters')
    .required('Unit is required'),
  costPrice: yup.number()
    .min(0, 'Cost price must be a positive number')
    .required('Cost price is required'),
  sellingPrice: yup.number()
    .min(0, 'Selling price must be a positive number')
    .required('Selling price is required'),
  currentStock: yup.number()
    .integer('Current stock must be an integer')
    .required('Current stock is required'), // Allow negative values
  minStockLevel: yup.number()
    .integer('Minimum stock level must be a non-negative integer')
    .min(0, 'Minimum stock level must be a non-negative integer')
    .required('Minimum stock level is required'),
  maxStockLevel: yup.number()
    .integer('Maximum stock level must be a non-negative integer')
    .min(0, 'Maximum stock level must be a non-negative integer')
    .required('Maximum stock level is required'),
  scopeType: yup.string()
    .oneOf(['BRANCH', 'WAREHOUSE'], 'Scope type must be BRANCH or WAREHOUSE')
    .required('Scope type is required'),
  scopeId: yup.string()
    .min(1, 'Scope name must be between 1 and 100 characters')
    .max(100, 'Scope name must be between 1 and 100 characters')
    .required('Scope name is required'),
  // Supplier tracking fields
  supplierId: yup.number()
    .nullable()
    .transform((value) => value === '' ? null : value),
  supplierName: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  purchaseDate: yup.date()
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
    })
    .test('is-valid-date', 'Please enter a valid date (DD/MM/YY or use date picker)', function(value) {
      if (!value) return true; // Allow null/empty values
      return value instanceof Date && !isNaN(value.getTime());
    }),
  purchasePrice: yup.number()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .min(0, 'Purchase price must be a positive number'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Product Name', width: 200 },
  { field: 'category', headerName: 'Category', width: 120 },
  { field: 'unit', headerName: 'Unit', width: 80 },
  { field: 'costPrice', headerName: 'Cost Price', width: 100, type: 'number', renderCell: (params) => {
    const value = params.value
    if (value === null || value === undefined || isNaN(value)) return '$0.00'
    return `${Number(value).toFixed(2)}`
  }},
  { field: 'sellingPrice', headerName: 'Selling Price', width: 120, type: 'number', renderCell: (params) => {
    const value = params.value
    if (value === null || value === undefined || isNaN(value)) return '$0.00'
    return `${Number(value).toFixed(2)}`
  }},
  { 
    field: 'currentStock', 
    headerName: 'Current Stock', 
    width: 140, 
    type: 'number',
    renderCell: (params) => {
      const stock = params.value || 0
      const minStock = params.row.minStockLevel || 0
      const maxStock = params.row.maxStockLevel || 0
      
      let color = 'default'
      let icon = null
      
      if (stock === 0) {
        color = 'error'
        icon = <WarningIcon fontSize="small" />
      } else if (stock <= minStock) {
        color = 'warning'
        icon = <WarningIcon fontSize="small" />
      } else if (maxStock > 0 && stock > maxStock) {
        color = 'info'
        icon = <InventoryIcon fontSize="small" />
      } else {
        color = 'success'
        icon = <CheckIcon fontSize="small" />
      }
      
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {icon}
          <Chip 
            label={stock} 
            size="small" 
            color={color}
            variant="outlined"
          />
        </Box>
      )
    }
  },
  { field: 'minStockLevel', headerName: 'Min Stock', width: 100, type: 'number' },
  { field: 'maxStockLevel', headerName: 'Max Stock', width: 100, type: 'number' },
  { 
    field: 'scopeType', 
    headerName: 'Scope Type', 
    width: 120,
    renderCell: (params) => (
      <Chip 
        label={params.value} 
        size="small" 
        color={params.value === 'BRANCH' ? 'primary' : 'secondary'}
        variant="outlined"
      />
    )
  },
  { field: 'scopeId', headerName: 'Scope Name', width: 100 },
  { field: 'supplierName', headerName: 'Supplier', width: 150 },
  { field: 'purchaseDate', headerName: 'Purchase Date', width: 120, type: 'date', renderCell: (params) => {
    if (!params.value) return '-'
    return new Date(params.value).toLocaleDateString()
  }},
  { field: 'purchasePrice', headerName: 'Purchase Price', width: 120, type: 'number', renderCell: (params) => {
    const value = params.value
    if (value === null || value === undefined || isNaN(value)) return '-'
    return `$${Number(value).toFixed(2)}`
  }},
  { field: 'createdAt', headerName: 'Created', width: 150 },
]

// Form fields configuration
const getFields = (user) => {
  const baseFields = [
    { name: 'name', label: 'Product Name', type: 'text', required: true },
    { name: 'barcode', label: 'Barcode', type: 'text', required: false },
    { name: 'description', label: 'Description', type: 'textarea', required: false },
    { 
      name: 'category', 
      label: 'Category', 
      type: 'select', 
      required: true,
      options: [
        { value: 'Food', label: 'Food' },
        { value: 'Accessories', label: 'Accessories' },
        { value: 'Medicine', label: 'Medicine' },
        { value: 'Litters', label: 'Litters' },
        { value: 'Toys', label: 'Toys' },
        { value: 'Grooming', label: 'Grooming' },
        { value: 'Bedding', label: 'Bedding' },
        { value: 'Collars & Leashes', label: 'Collars & Leashes' },
        { value: 'Bowls & Feeders', label: 'Bowls & Feeders' },
        { value: 'Health & Wellness', label: 'Health & Wellness' },
        { value: 'Other', label: 'Other' },
      ]
    },
    { 
      name: 'unit', 
      label: 'Unit', 
      type: 'select', 
      required: false,
      options: [
        { value: 'piece', label: 'Piece' },
        { value: 'kg', label: 'Kilogram (kg)' },
        { value: 'g', label: 'Gram (g)' },
        { value: 'lb', label: 'Pound (lb)' },
        { value: 'oz', label: 'Ounce (oz)' },
        { value: 'ml', label: 'Milliliter (ml)' },
        { value: 'l', label: 'Liter (l)' },
        { value: 'pack', label: 'Pack' },
        { value: 'box', label: 'Box' },
        { value: 'bag', label: 'Bag' },
        { value: 'set', label: 'Set' },
        { value: 'pair', label: 'Pair' },
        { value: 'tablet', label: 'Tablet' },
        { value: 'capsule', label: 'Capsule' },
        { value: 'bottle', label: 'Bottle' },
        { value: 'tube', label: 'Tube' },
        { value: 'roll', label: 'Roll' },
        { value: 'sheet', label: 'Sheet' },
        { value: 'meter', label: 'Meter' },
        { value: 'cm', label: 'Centimeter (cm)' },
        { value: 'inch', label: 'Inch' },
        { value: 'ft', label: 'Foot (ft)' },
        { value: 'yard', label: 'Yard' },
        { value: 'dozen', label: 'Dozen' },
        { value: 'gross', label: 'Gross' },
        { value: 'other', label: 'Other' },
      ]
    },
    { name: 'costPrice', label: 'Cost Price', type: 'number', required: true, step: 0.01 },
    { name: 'sellingPrice', label: 'Selling Price', type: 'number', required: true, step: 0.01 },
    { name: 'currentStock', label: 'Current Stock', type: 'number', required: true },
    { name: 'minStockLevel', label: 'Minimum Stock Level', type: 'number', required: true },
    { name: 'maxStockLevel', label: 'Maximum Stock Level', type: 'number', required: false },
    
    // Supplier tracking fields
    { 
      name: 'supplierId', 
      label: 'Supplier', 
      type: 'custom', 
      required: false,
      render: ({ register, errors, setValue, watch }) => (
        <SupplierField 
          register={register}
          errors={errors}
          setValue={setValue}
          watch={watch}
          label="Supplier"
          required={false}
        />
      )
    },
    { name: 'supplierName', label: 'Supplier Name (Manual)', type: 'text', required: false },
    { name: 'purchaseDate', label: 'Purchase Date', type: 'date', required: false },
    { name: 'purchasePrice', label: 'Purchase Price', type: 'number', required: false, step: 0.01 },
  ]

  // Add scope fields based on user role
  if (user?.role === 'ADMIN') {
    // Admin can choose any scope
    baseFields.push(
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'select', 
        required: true,
        options: [
          { value: 'BRANCH', label: 'Branch' },
          { value: 'WAREHOUSE', label: 'Warehouse' },
        ]
      },
      { 
        name: 'scopeId', 
        label: 'Scope Name', 
        type: 'custom', 
        required: true,
        render: ({ register, errors, setValue, watch }) => (
          <ScopeField 
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
            label="Scope Name"
            required={true}
          />
        )
      }
    )
  } else if (user?.role === 'CASHIER' && user?.branchId) {
    // Cashier is automatically assigned to their branch
    baseFields.push(
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'text', 
        required: true,
        defaultValue: 'BRANCH',
        disabled: true
      },
      { 
        name: 'scopeId', 
        label: 'Branch Name', 
        type: 'text', 
        required: true,
        defaultValue: user.branchName,
        disabled: true
      }
    )
  } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
    // Warehouse keeper is automatically assigned to their warehouse
    baseFields.push(
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'text', 
        required: true,
        defaultValue: 'WAREHOUSE',
        disabled: true
      },
      { 
        name: 'scopeId', 
        label: 'Warehouse Name', 
        type: 'text', 
        required: true,
        defaultValue: user.warehouseName,
        disabled: true
      }
    )
  } else {
    // Fallback for users without proper scope assignment
    baseFields.push(
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'select', 
        required: true,
        options: [
          { value: 'BRANCH', label: 'Branch' },
          { value: 'WAREHOUSE', label: 'Warehouse' },
        ]
      },
      { name: 'scopeId', label: 'Scope Name', type: 'text', required: true }
    )
  }

  return baseFields
}

function InventoryPage() {
  const dispatch = useDispatch()
  const { data: inventory, loading, error } = useSelector((state) => state.inventory)
  
  // Ensure inventory is always an array — memoized to avoid changing identity across renders
  const safeInventory = useMemo(() => Array.isArray(inventory) ? inventory : [], [inventory])
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
  
  const user = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])
  const { branchSettings } = useSelector((state) => state.branches)
  const { warehouseSettings, data: warehouses } = useSelector((state) => state.warehouses)
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false)
  const [excelUploadOpen, setExcelUploadOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  
  // Tab state for warehouse keepers - removed, only show current warehouse
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [soldFilter, setSoldFilter] = useState('all')
  const [returnedFilter, setReturnedFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  // Auto-set scope filter based on admin role simulation
  useEffect(() => {
    if (isAdminMode && scopeInfo) {
      // When admin is acting as cashier/warehouse keeper, automatically filter to their scope
      setScopeFilter(scopeInfo.scopeType)
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // Regular cashier - show only their branch
      setScopeFilter('BRANCH')
    } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      // Regular warehouse keeper - show only their warehouse
      setScopeFilter('WAREHOUSE')
    } else {
      // Admin or other roles - show all scopes
      setScopeFilter('all')
    }
  }, [isAdminMode, scopeInfo, user])
  
  // Pagination states
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  
  // Enable real-time polling for inventory
  const { isPolling, lastUpdate, refreshData } = useInventoryPolling({
    enabled: true,
    immediate: true
  })

  // Filter and search logic
  const filteredAndSortedInventory = useMemo(() => {
    let filtered = [...safeInventory]

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.barcode?.toLowerCase().includes(searchLower)
      )
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    // Apply stock filter
    if (stockFilter === 'low') {
      filtered = filtered.filter(item => item.currentStock <= item.minStockLevel)
    } else if (stockFilter === 'out') {
      filtered = filtered.filter(item => item.currentStock <= 0) // Include zero and negative stock
    } else if (stockFilter === 'negative') {
      filtered = filtered.filter(item => item.currentStock < 0) // Only negative stock
    } else if (stockFilter === 'high') {
      filtered = filtered.filter(item => item.currentStock > item.maxStockLevel)
    }

    // Apply scope filter
    if (scopeFilter !== 'all') {
      filtered = filtered.filter(item => {
        // First check scope type
        if (item.scopeType !== scopeFilter) {
          return false
        }
        
        // If admin is acting as cashier/warehouse keeper, also filter by specific scope ID
        if (isAdminMode && scopeInfo) {
          return item.scopeId === scopeInfo.scopeId
        }
        
        // For regular cashiers, filter by their branch ID
        if (user?.role === 'CASHIER' && user?.branchId) {
          return item.scopeId === String(user.branchId)
        }
        
        // For regular warehouse keepers, filter by their warehouse ID
        if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
          return item.scopeId === String(user.warehouseId)
        }
        
        // For admins or other cases, just filter by scope type
        return true
      })
    }

    // Apply sold filter
    if (soldFilter === 'sold') {
      filtered = filtered.filter(item => item.totalSold > 0)
    } else if (soldFilter === 'not_sold') {
      filtered = filtered.filter(item => item.totalSold === 0)
    }

    // Apply returned filter
    if (returnedFilter === 'returned') {
      filtered = filtered.filter(item => item.totalReturned > 0)
    } else if (returnedFilter === 'not_returned') {
      filtered = filtered.filter(item => item.totalReturned === 0)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy]
      let bValue = b[sortBy]

      // Handle null/undefined values
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''

      // Convert to string for comparison if needed
      if (typeof aValue === 'string') aValue = aValue.toLowerCase()
      if (typeof bValue === 'string') bValue = bValue.toLowerCase()

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [safeInventory, searchTerm, categoryFilter, stockFilter, scopeFilter, soldFilter, returnedFilter, sortBy, sortOrder, isAdminMode, scopeInfo, user])

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(safeInventory.map(item => item.category).filter(Boolean))]
    return uniqueCategories.sort()
  }, [safeInventory])

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('')
    setCategoryFilter('all')
    setStockFilter('all')
    setScopeFilter('all')
    setSoldFilter('all')
    setReturnedFilter('all')
    setSortBy('name')
    setSortOrder('asc')
    setPage(1) // Reset to first page when clearing filters
  }

  // Get filter summary
  const getFilterSummary = () => {
    const filters = []
    if (searchTerm) filters.push(`Search: "${searchTerm}"`)
    if (categoryFilter !== 'all') filters.push(`Category: ${categoryFilter}`)
    if (stockFilter !== 'all') filters.push(`Stock: ${stockFilter}`)
    
    // Show specific scope info when automatically filtered
    if (scopeFilter !== 'all') {
      if (isAdminMode && scopeInfo) {
        filters.push(`Scope: ${scopeInfo.scopeName}`)
      } else if (user?.role === 'CASHIER' && user?.branchId) {
        filters.push(`Scope: Branch ${user.branchId}`)
      } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        filters.push(`Scope: Warehouse ${user.warehouseId}`)
      } else {
        filters.push(`Scope: ${scopeFilter}`)
      }
    }
    
    if (soldFilter !== 'all') filters.push(`Sold: ${soldFilter}`)
    if (returnedFilter !== 'all') filters.push(`Returned: ${returnedFilter}`)
    return filters
  }

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchInventory())
    
    // Load branch settings for cashiers
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
    
    // Load warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
    
    // Removed warehouse loading for warehouse keepers - they only see their own warehouse
  }, [dispatch, user])


  // Form dialog handlers
  const handleAdd = () => {
    // Auto-fill scope fields for non-admin users
    const initialData = {}
    
    if (user?.role === 'CASHIER' && user?.branchId) {
      initialData.scopeType = 'BRANCH'
      initialData.scopeId = user.branchId
    } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      initialData.scopeType = 'WAREHOUSE'
      initialData.scopeId = user.warehouseId
    }
    
    setSelectedEntity(initialData)
    setIsEdit(false)
    setFormDialogOpen(true)
  }

  const handleEdit = (entity) => {
    setSelectedEntity(entity)
    setIsEdit(true)
    setFormDialogOpen(true)
  }

  const handleFormClose = () => {
    setFormDialogOpen(false)
    setSelectedEntity(null)
    setIsEdit(false)
  }

  // Confirmation dialog handlers
  const handleDeleteClick = (entity) => {
    setSelectedEntity(entity)
    setConfirmationDialogOpen(true)
  }

  const handleConfirmationClose = () => {
    setConfirmationDialogOpen(false)
    setSelectedEntity(null)
  }

  // Excel upload handlers
  const handleExcelUploadSuccess = (result) => {
    console.log('Excel upload successful:', result)
    dispatch(fetchInventory()) // Refresh inventory data
    setExcelUploadOpen(false)
  }

  // Handle CRUD operations
  const handleCreate = async (data) => {
    setFormSubmitting(true)
    try {
      const result = await dispatch(createInventoryItem(data))
      if (createInventoryItem.fulfilled.match(result)) {
        handleFormClose()
        dispatch(fetchInventory()) // Refresh data
      } else if (createInventoryItem.rejected.match(result)) {
        alert('Failed to create inventory item: ' + result.payload)
      }
    } catch (error) {
      alert('Error creating inventory item: ' + error.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleUpdate = async (data) => {
    setFormSubmitting(true)
    try {
      const result = await dispatch(updateInventoryItem({ id: selectedEntity.id, data }))
      if (updateInventoryItem.fulfilled.match(result)) {
        handleFormClose()
        dispatch(fetchInventory()) // Refresh data
      } else if (updateInventoryItem.rejected.match(result)) {
        alert('Failed to update inventory item: ' + result.payload)
      }
    } catch (error) {
      alert('Error updating inventory item: ' + error.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async () => {
    try {
      const result = await dispatch(deleteInventoryItem(selectedEntity.id))
      if (deleteInventoryItem.fulfilled.match(result)) {
        handleConfirmationClose()
        dispatch(fetchInventory()) // Refresh data
      } else if (deleteInventoryItem.rejected.match(result)) {
        alert('Failed to delete inventory item: ' + result.payload)
      }
    } catch (error) {
      alert('Error deleting inventory item: ' + error.message)
    }
  }

  // Combined form submit handler
  const handleFormSubmit = (formData) => {
    if (isEdit) {
      handleUpdate(formData)
    } else {
      handleCreate(formData)
    }
  }
  
  // Removed tab change handler - warehouse keepers only see their own warehouse
  
  // Filter inventory based on user role
  const getFilteredInventory = () => {
    let filtered = filteredAndSortedInventory

    // Debug logging
    console.log('[InventoryPage] User info:', {
      role: user?.role,
      branchId: user?.branchId,
      branchName: user?.branchName,
      warehouseId: user?.warehouseId,
      warehouseName: user?.warehouseName
    })
    
    console.log('[InventoryPage] Total inventory items before filtering:', filtered.length)
    console.log('[InventoryPage] Sample inventory items:', filtered.slice(0, 3).map(item => ({
      name: item.name,
      scopeType: item.scopeType,
      scopeId: item.scopeId
    })))

    // Note: Backend already applies role-based filtering, so we don't need to filter again here
    // The backend returns only the inventory items that the user is allowed to see
    // This prevents double-filtering which was causing items to be hidden

    console.log('[InventoryPage] Final filtered items (no additional filtering):', filtered.length)
    return filtered
  }

  // Pagination logic
  const totalItems = getFilteredInventory().length
  const totalPages = Math.ceil(totalItems / rowsPerPage)
  const startIndex = (page - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedInventory = getFilteredInventory().slice(startIndex, endIndex)

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(1) // Reset to first page when changing page size
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
      <DashboardLayout>
        {/* Admin Mode Indicator */}
        {isAdminMode && scopeInfo && (
          <Box sx={{ 
            bgcolor: 'warning.light', 
            color: 'warning.contrastText', 
            p: 1, 
            textAlign: 'center',
            borderBottom: 1,
            borderColor: 'warning.main'
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h5">Inventory Management</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setExcelUploadOpen(true)}
              size="small"
            >
              Import from Excel
            </Button>
            <Button
              variant="contained"
              onClick={handleAdd}
              size="small"
            >
              Add Item
            </Button>
          </Box>
        </Box>

        {/* Simple Inventory Table */}
        <Card>
          <CardContent>

            {/* Search and Filter Section */}
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <FilterIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="subtitle2">Search & Filters</Typography>
              </Box>
              
              <Grid container spacing={1} sx={{ mb: 0.5 }} alignItems="center">
                {/* Search Input */}
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Products"
                    placeholder="Search by name, category..."
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

                {/* Category Filter */}
                <Grid item xs={12} md={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Categories</MenuItem>
                      {categories.map(category => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Stock Filter */}
                <Grid item xs={12} md={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Stock Status</InputLabel>
                    <Select
                      value={stockFilter}
                      label="Stock Status"
                      onChange={(e) => setStockFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Stock</MenuItem>
                      <MenuItem value="low">Low Stock</MenuItem>
                      <MenuItem value="out">Out of Stock (≤0)</MenuItem>
                      <MenuItem value="negative">Negative Stock (&lt;0)</MenuItem>
                      <MenuItem value="high">Overstocked</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Scope Filter */}
                <Grid item xs={12} md={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Scope</InputLabel>
                    <Select
                      value={scopeFilter}
                      label="Scope"
                      onChange={(e) => setScopeFilter(e.target.value)}
                      disabled={isAdminMode || (user?.role === 'CASHIER') || (user?.role === 'WAREHOUSE_KEEPER')}
                    >
                      <MenuItem value="all">All Scopes</MenuItem>
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Sold Filter */}
                <Grid item xs={12} md={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sold Status</InputLabel>
                    <Select
                      value={soldFilter}
                      label="Sold Status"
                      onChange={(e) => setSoldFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Items</MenuItem>
                      <MenuItem value="sold">Has Sales</MenuItem>
                      <MenuItem value="not_sold">No Sales</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Returned Filter */}
                <Grid item xs={12} md={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Returned Status</InputLabel>
                    <Select
                      value={returnedFilter}
                      label="Returned Status"
                      onChange={(e) => setReturnedFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Items</MenuItem>
                      <MenuItem value="returned">Has Returns</MenuItem>
                      <MenuItem value="not_returned">No Returns</MenuItem>
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
                      <MenuItem value="name">Name</MenuItem>
                      <MenuItem value="category">Category</MenuItem>
                      <MenuItem value="currentStock">Stock</MenuItem>
                      <MenuItem value="totalSold">Sold</MenuItem>
                      <MenuItem value="totalReturned">Returned</MenuItem>
                      <MenuItem value="totalPurchased">Purchased</MenuItem>
                      <MenuItem value="sellingPrice">Price</MenuItem>
                      <MenuItem value="createdAt">Date Created</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Action Icons */}
                <Grid item xs={12} md={1}>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
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
              <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} items
                </Typography>
                
                {totalItems !== safeInventory.length && (
                  <Chip
                    icon={<FilterIcon />}
                    label={`${safeInventory.length - totalItems} items filtered out`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                )}
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
                <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.8rem', py: 0.5 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell align="right">Cost Price</TableCell>
                      <TableCell align="right">Selling Price</TableCell>
                      <TableCell align="right">Current Stock</TableCell>
                      <TableCell align="right">Sold</TableCell>
                      <TableCell align="right">Returned</TableCell>
                      <TableCell align="right">Purchased</TableCell>
                      <TableCell align="right">Min Stock</TableCell>
                      <TableCell align="right">Max Stock</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Purchase Date</TableCell>
                      <TableCell>Purchase Price</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Chip label={item.category} size="small" />
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell align="right">{parseFloat(item.costPrice || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">{parseFloat(item.sellingPrice || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={item.currentStock || 0} 
                            size="small" 
                            color={
                              item.currentStock < 0 ? 'error' : // Negative stock - critical
                              item.currentStock === 0 ? 'error' : // Zero stock - critical
                              item.currentStock <= item.minStockLevel ? 'warning' : 'success' // Low stock - warning, good stock - success
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={item.totalSold || 0} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={item.totalReturned || 0} 
                            size="small" 
                            color="warning"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={item.totalPurchased || 0} 
                            size="small" 
                            color="success"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">{item.minStockLevel}</TableCell>
                        <TableCell align="right">{item.maxStockLevel}</TableCell>
                        <TableCell>
                          <Chip 
                            label={item.scopeType} 
                            size="small" 
                            color={item.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {item.supplierName ? (
                            <Chip 
                              label={item.supplierName} 
                              size="small" 
                              color="info"
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.purchaseDate ? (
                            <Typography variant="body2">
                              {new Date(item.purchaseDate).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {item.purchasePrice ? (
                            <Typography variant="body2" fontWeight="medium">
                              ${parseFloat(item.purchasePrice).toFixed(2)}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(item)}
                                color="primary"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            {user?.role === 'ADMIN' && (
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteClick(item)}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

        <EntityFormDialog
          open={formDialogOpen}
          onClose={handleFormClose}
          title={isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}
          fields={getFields(user)}
          validationSchema={inventorySchema}
          initialData={selectedEntity}
          isEdit={isEdit}
          onSubmit={handleFormSubmit}
          loading={formSubmitting}
          error={error}
        />

        <ConfirmationDialog
          open={confirmationDialogOpen}
          onClose={handleConfirmationClose}
          title="Delete Inventory Item"
          message="Are you sure you want to delete this inventory item? This action cannot be undone."
          onConfirm={handleDelete}
          loading={loading}
          severity="error"
        />

        <ExcelUploadDialog
          open={excelUploadOpen}
          onClose={() => setExcelUploadOpen(false)}
          onSuccess={handleExcelUploadSuccess}
          title="Import Inventory from Excel"
          scopeType={user?.role === 'CASHIER' ? 'BRANCH' : user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : 'BRANCH'}
          scopeId={user?.role === 'CASHIER' ? user?.branchId : user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : null}
        />
      </DashboardLayout>
    </RouteGuard>
  )
}

export default InventoryPage