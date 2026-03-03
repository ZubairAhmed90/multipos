'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
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
  Snackbar
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
  Delete as DeleteIcon,
  Store as StoreIcon,
  Business as BusinessIcon
} from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth.js'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import PollingStatusIndicator from '../../../components/polling/PollingStatusIndicator'
import ExcelUploadDialog from '../../../components/upload/ExcelUploadDialog'
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../store/slices/inventorySlice'
import { fetchBranchSettings } from '../../store/slices/branchesSlice'
import { fetchWarehouseSettings, fetchWarehouses } from '../../store/slices/warehousesSlice'
import ScopeField from '../../../components/forms/ScopeField'
import SupplierField from '../../../components/forms/SupplierField'
import api from '../../../utils/axios'
import { usePermissions } from '../../../hooks/usePermissions'

// Validation schema - matches backend validation exactly
const inventorySchema = yup.object({
  name: yup.string()
    .trim()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be between 1 and 200 characters')
    .required('Item name is required'),
  sku: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  barcode: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  description: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  category: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  unit: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  costPrice: yup.number()
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? null : value)
    .min(0, 'Cost price must be a positive number'),
  sellingPrice: yup.number()
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? null : value)
    .min(0, 'Selling price must be a positive number'),
  currentStock: yup.number()
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? null : value),
  scopeType: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
  scopeId: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value),
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
  purchasePrice: yup.number()
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? null : value)
    .min(0, 'Purchase price must be a positive number'),
})

// Form fields configuration
const defaultCategories = [
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

const getFields = (user, categoryOptions) => {
  const categoryOpts = categoryOptions && categoryOptions.length > 0 ? categoryOptions : defaultCategories
  const baseFields = [
    { name: 'name', label: 'Product Name', type: 'text', required: true },
    { name: 'barcode', label: 'Barcode', type: 'text', required: false },
    { name: 'description', label: 'Description', type: 'textarea', required: false },
    { 
      name: 'category', 
      label: 'Category', 
      type: 'select', 
      required: true,
      options: categoryOpts
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

  if (user?.role === 'ADMIN') {
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
    baseFields.push(
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'text', 
        required: true,
        defaultValue: 'BRANCH',
        InputProps: { readOnly: true }
      },
      { 
        name: 'scopeId', 
        label: 'Branch ID', 
        type: 'text', 
        required: true,
        defaultValue: user.branchId,
        helperText: user.branchName ? `Branch: ${user.branchName}` : undefined,
        InputProps: { readOnly: true }
      }
    )
  } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
    baseFields.push(
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'text', 
        required: true,
        defaultValue: 'WAREHOUSE',
        InputProps: { readOnly: true }
      },
      { 
        name: 'scopeId', 
        label: 'Warehouse ID', 
        type: 'text', 
        required: true,
        defaultValue: user.warehouseId,
        helperText: user.warehouseName ? `Warehouse: ${user.warehouseName}` : undefined,
        InputProps: { readOnly: true }
      }
    )
  } else {
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
  const { data: inventory, total: totalFromServer, loading, error } = useSelector((state) => state.inventory)
  
  const { user: originalUser } = useSelector((state) => state.auth)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity })
  }, [])
  const handleToastClose = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])
  
  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [initialized, setInitialized] = useState(false)

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
    setInitialized(true)  // ← mark ready after URL parsed
  }
}, [originalUser])
  
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
  const { hasPermission } = usePermissions()
  
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false)
  const [excelUploadOpen, setExcelUploadOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  
  // States for admin filtering
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null)
  const [selectedBranchId, setSelectedBranchId] = useState(null)
  const [branches, setBranches] = useState([])
  const [warehousesList, setWarehousesList] = useState([])
  const [scopeNameMap, setScopeNameMap] = useState({ branches: {}, warehouses: {} })

  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [soldFilter, setSoldFilter] = useState('all')
  const [returnedFilter, setReturnedFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  useEffect(() => {
    if (isAdminMode && scopeInfo) {
    setScopeFilter(scopeInfo.scopeType)    } 
    else if (user?.role === 'CASHIER') {
      setScopeFilter('BRANCH')
    } else if (user?.role === 'WAREHOUSE_KEEPER') {
      setScopeFilter('WAREHOUSE')
    } else {
      setScopeFilter('all')
    }
  }, [isAdminMode, scopeInfo, user?.role])

  useEffect(() => {
    if (scopeFilter === 'WAREHOUSE') {
      setSelectedBranchId(null)
    } else if (scopeFilter === 'BRANCH') {
      setSelectedWarehouseId(null)
    } else {
      setSelectedWarehouseId(null)
      setSelectedBranchId(null)
    }
  }, [scopeFilter])
  
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [categoriesFromApi, setCategoriesFromApi] = useState([])

  // Fetch branches and warehouses
  useEffect(() => {
    const fetchScopes = async () => {
      try {
        if (user?.role === 'ADMIN') {
          // Fetch warehouses
          const warehouseRes = await api.get('/warehouses')
          const warehouseData = warehouseRes.data?.data || warehouseRes.data || []
          setWarehousesList(warehouseData)
          
          const warehouseMap = {}
          warehouseData.forEach(w => {
            warehouseMap[w.id] = w.name
          })
          
          // Fetch branches
          const branchRes = await api.get('/branches')
          const branchData = branchRes.data?.data || branchRes.data || []
          setBranches(branchData)
          
          const branchMap = {}
          branchData.forEach(b => {
            branchMap[b.id] = b.name
          })
          
          setScopeNameMap({ branches: branchMap, warehouses: warehouseMap })
        } else if (user?.role === 'CASHIER' && user?.branchId) {
          try {
            const branchRes = await api.get(`/branches/${user.branchId}`)
            const branchData = branchRes.data?.data || branchRes.data
            if (branchData) {
              setScopeNameMap(prev => ({
                ...prev,
                branches: { ...prev.branches, [user.branchId]: branchData.name }
              }))
            }
          } catch (err) {
            console.warn('Failed to fetch branch name:', err)
          }
        } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
          try {
            const warehouseRes = await api.get(`/warehouses/${user.warehouseId}`)
            const warehouseData = warehouseRes.data?.data || warehouseRes.data
            if (warehouseData) {
              setScopeNameMap(prev => ({
                ...prev,
                warehouses: { ...prev.warehouses, [user.warehouseId]: warehouseData.name }
              }))
            }
          } catch (err) {
            console.warn('Failed to fetch warehouse name:', err)
          }
        }
      } catch (err) {
        console.error('Failed to fetch scopes:', err)
      }
    }
    
    fetchScopes()
  }, [user])

  // Fetch categories
  useEffect(() => {
    let isMounted = true
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories')
        if (isMounted) {
          const data = res.data?.data || res.data || []
          const mapped = Array.isArray(data)
            ? data
                .filter(c => c?.name)
                .map(c => ({ value: c.name, label: c.name, name: c.name }))
            : []
          setCategoriesFromApi(mapped)
        }
      } catch (err) {
        console.warn('Failed to load categories, using defaults/inventory list', err?.message || err)
      }
    }
    fetchCategories()
    return () => {
      isMounted = false
    }
  }, [])

const getFetchParams = useCallback(() => {
  const params = { page, limit: rowsPerPage }
  
  if (searchTerm.trim()) params.search = searchTerm.trim()
  if (categoryFilter !== 'all') params.category = categoryFilter

  // Admin simulation takes absolute priority
  if (isAdminMode && urlParams.scope && urlParams.id) {
    params.scopeType = urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE'
    params.scopeId = String(urlParams.id)
  } else if (originalUser?.role === 'CASHIER' && originalUser?.branchId) {
    params.scopeType = 'BRANCH'
    params.scopeId = String(originalUser.branchId)
  } else if (originalUser?.role === 'WAREHOUSE_KEEPER' && originalUser?.warehouseId) {
    params.scopeType = 'WAREHOUSE'
    params.scopeId = String(originalUser.warehouseId)
  } else if (originalUser?.role === 'ADMIN') {
    if (scopeFilter === 'WAREHOUSE' && selectedWarehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId = String(selectedWarehouseId)
    } else if (scopeFilter === 'BRANCH' && selectedBranchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = String(selectedBranchId)
    } else if (scopeFilter === 'WAREHOUSE') {
      params.scopeType = 'WAREHOUSE'
    } else if (scopeFilter === 'BRANCH') {
      params.scopeType = 'BRANCH'
    }
  }

  params.sortBy = sortBy
  params.sortOrder = sortOrder
  
  return params
}, [
  page, rowsPerPage, searchTerm, categoryFilter,
  isAdminMode, urlParams,           // ← use urlParams directly, not derived scopeInfo
  originalUser,                     // ← use originalUser, not derived user
  scopeFilter, selectedWarehouseId, selectedBranchId,
  sortBy, sortOrder
])

  const categories = useMemo(() => {
    const apiCats = categoriesFromApi.map(c => c.name).filter(Boolean)
    const inventoryCats = (inventory || []).map(item => item.category).filter(Boolean)
    const merged = [...new Set([...apiCats, ...inventoryCats])]
    return merged.sort()
  }, [inventory, categoriesFromApi])

  const clearFilters = () => {
    setSearchTerm('')
    setCategoryFilter('all')
    setStockFilter('all')
    setScopeFilter('all')
    setSoldFilter('all')
    setReturnedFilter('all')
    setSortBy('name')
    setSortOrder('asc')
    setSelectedWarehouseId(null)
    setSelectedBranchId(null)
    setPage(1)
    
 
  }

  const getFilterSummary = () => {
    const filters = []
    if (searchTerm) filters.push(`Search: "${searchTerm}"`)
    if (categoryFilter !== 'all') filters.push(`Category: ${categoryFilter}`)
    if (stockFilter !== 'all') filters.push(`Stock: ${stockFilter}`)
    
    if (scopeFilter !== 'all') {
      if (isAdminMode && scopeInfo) {
        filters.push(`Scope: ${scopeInfo.scopeName}`)
      } else if (user?.role === 'CASHIER' && user?.branchId) {
        const branchName = scopeNameMap.branches[user.branchId]
        filters.push(`Branch: ${branchName || `ID ${user.branchId}`}`)
      } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        const warehouseName = scopeNameMap.warehouses[user.warehouseId]
        filters.push(`Warehouse: ${warehouseName || `ID ${user.warehouseId}`}`)
      } else if (scopeFilter === 'WAREHOUSE' && selectedWarehouseId) {
        const warehouseName = scopeNameMap.warehouses[selectedWarehouseId]
        filters.push(`Warehouse: ${warehouseName || `ID ${selectedWarehouseId}`}`)
      } else if (scopeFilter === 'BRANCH' && selectedBranchId) {
        const branchName = scopeNameMap.branches[selectedBranchId]
        filters.push(`Branch: ${branchName || `ID ${selectedBranchId}`}`)
      } else if (scopeFilter === 'WAREHOUSE') {
        filters.push('All Warehouses')
      } else if (scopeFilter === 'BRANCH') {
        filters.push('All Branches')
      }
    }
    
    if (soldFilter !== 'all') filters.push(`Sold: ${soldFilter}`)
    if (returnedFilter !== 'all') filters.push(`Returned: ${returnedFilter}`)
    return filters
  }

  // Reset page when server-side filters change
  useEffect(() => {
    setPage(1)
  }, [searchTerm, categoryFilter, scopeFilter, selectedWarehouseId, selectedBranchId, sortBy, sortOrder])

useEffect(() => {
  if (!initialized) return  // ← wait for URL params to be read
  dispatch(fetchInventory(getFetchParams()))
}, [dispatch, getFetchParams, initialized])


  const handleAdd = () => {
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

  const handleDeleteClick = (entity) => {
    setSelectedEntity(entity)
    setConfirmationDialogOpen(true)
  }

  const handleConfirmationClose = () => {
    setConfirmationDialogOpen(false)
    setSelectedEntity(null)
  }

  const handleExcelUploadSuccess = (result) => {
    // Clear cache and refresh
    dispatch(fetchInventory(getFetchParams()))
    setExcelUploadOpen(false)
  }

const handleCreate = async (data) => {
  setFormSubmitting(true)
  try {
    const result = await dispatch(createInventoryItem(data))
    if (createInventoryItem.fulfilled.match(result)) {
      handleFormClose()
      dispatch(fetchInventory(getFetchParams()))
      showToast('Inventory item created', 'success')
    } else if (createInventoryItem.rejected.match(result)) {
      const err = result.payload || result.error
      let message = 'Failed to create inventory item'
      if (err) {
        if (err?.status === 403 || err?.statusCode === 403) {
          // Role-specific 403 message
          if (originalUser?.role === 'CASHIER') {
            message = '🔒 Access denied. You do not have permission to add inventory items. Please contact your Admin to enable this permission.'
          } else if (originalUser?.role === 'WAREHOUSE_KEEPER') {
            message = '🔒 Access denied. You do not have permission to add inventory items. Please contact your Admin to enable this permission.'
          } else {
            message = '🔒 Access denied. Please select a valid Branch or Warehouse scope from the Admin Dashboard before adding items.'
          }
        } else if (Array.isArray(err.errors) && err.errors.length) {
          message = err.errors.map(e => e.msg || e.message || String(e)).join(', ')
        } else if (typeof err.apiError === 'string') {
          message = err.apiError
        } else if (typeof err.message === 'string') {
          message = err.message
        } else if (typeof err.error === 'string') {
          message = err.error
        } else if (typeof err.message === 'object') {
          message = JSON.stringify(err.message)
        }
      }
      const severity = err?.status === 403 || err?.statusCode === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }
  } catch (error) {
    const msg = (error && error.message)
      ? (typeof error.message === 'string' ? error.message : JSON.stringify(error.message))
      : 'Error creating inventory item'
    showToast(msg, 'error')
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
      dispatch(fetchInventory(getFetchParams()))
      showToast('Inventory item updated', 'success')
    } else if (updateInventoryItem.rejected.match(result)) {
      const err = result.payload || result.error
      let message = 'Failed to update inventory item'
      if (err) {
        if (err?.status === 403 || err?.statusCode === 403) {
          if (originalUser?.role === 'CASHIER') {
            message = '🔒 Access denied. You do not have permission to edit inventory items. Please contact your Admin to enable this permission.'
          } else if (originalUser?.role === 'WAREHOUSE_KEEPER') {
            message = '🔒 Access denied. You do not have permission to edit inventory items. Please contact your Admin to enable this permission.'
          } else {
            message = '🔒 Access denied. Please ensure you have the correct scope selected.'
          }
        } else if (Array.isArray(err.errors) && err.errors.length) {
          message = err.errors.map(e => e.msg || e.message || String(e)).join(', ')
        } else if (typeof err.apiError === 'string') {
          message = err.apiError
        } else if (typeof err.message === 'string') {
          message = err.message
        } else if (typeof err.error === 'string') {
          message = err.error
        } else if (typeof err.message === 'object') {
          message = JSON.stringify(err.message)
        }
      }
      const severity = err?.status === 403 || err?.statusCode === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }
  } catch (error) {
    const msg = (error && error.message)
      ? (typeof error.message === 'string' ? error.message : JSON.stringify(error.message))
      : 'Error updating inventory item'
    showToast(msg, 'error')
  } finally {
    setFormSubmitting(false)
  }
}

  const handleDelete = async () => {
    try {
      const result = await dispatch(deleteInventoryItem(selectedEntity.id))
      if (deleteInventoryItem.fulfilled.match(result)) {
        handleConfirmationClose()
        // Clear cache and refresh
        dispatch(fetchInventory(getFetchParams()))
        showToast('Inventory item deleted', 'success')
      } else if (deleteInventoryItem.rejected.match(result)) {
        const err = result.payload || result.error
        const message = err?.message || 'Failed to delete inventory item'
        const severity = err?.status === 403 ? 'warning' : 'error'
        showToast(message, severity)
      }
    } catch (error) {
      const msg = (error && error.message) ? (typeof error.message === 'string' ? error.message : JSON.stringify(error.message)) : 'Error deleting inventory item'
      showToast(msg, 'error')
    }
  }

const handleFormSubmit = (formData) => {
  const normNum = (val) => {
    if (val === '' || val === null || val === undefined) return undefined
    const n = Number(val)
    return Number.isNaN(n) ? undefined : n
  }

  const fallbackScopeType = isEdit && selectedEntity?.scopeType 
    ? String(selectedEntity.scopeType).trim().toUpperCase() 
    : ''
  const fallbackScopeId = isEdit && selectedEntity?.scopeId !== undefined && selectedEntity?.scopeId !== null
    ? String(selectedEntity.scopeId).trim()
    : ''
  const userScopeType = user?.role === 'WAREHOUSE_KEEPER'
    ? 'WAREHOUSE'
    : (user?.role === 'CASHIER' ? 'BRANCH' : '')
  const userScopeId = user?.role === 'WAREHOUSE_KEEPER'
    ? (user?.warehouseId ? String(user.warehouseId) : '')
    : (user?.role === 'CASHIER' ? (user?.branchId ? String(user.branchId) : '') : '')

  const normalized = {
    ...formData,
    scopeId: formData.scopeId !== undefined && formData.scopeId !== null && String(formData.scopeId).trim() !== ''
      ? String(formData.scopeId).trim()
      : fallbackScopeId,
    scopeType: formData.scopeType && String(formData.scopeType).trim() !== ''
      ? String(formData.scopeType).trim().toUpperCase()
      : fallbackScopeType,
    costPrice: normNum(formData.costPrice),
    sellingPrice: normNum(formData.sellingPrice),
    currentStock: normNum(formData.currentStock),
    purchasePrice: normNum(formData.purchasePrice),
  }

  // Apply fallback scope from user role if still empty
  if (!normalized.scopeType || normalized.scopeType === '') {
    normalized.scopeType = fallbackScopeType || userScopeType || null
  }
  if (!normalized.scopeId || normalized.scopeId === '') {
    normalized.scopeId = fallbackScopeId || userScopeId || null
  }

  // Clean up all empty/null/undefined/NaN values
  Object.keys(normalized).forEach((key) => {
    const v = normalized[key]
    if (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) {
      delete normalized[key]
    }
  })

  // ── ADMIN scope guard ──────────────────────────────────────────────
  // Admin must select a branch/warehouse before creating items
  if (originalUser?.role === 'ADMIN' && !isAdminMode) {
    if (!normalized.scopeType || !normalized.scopeId) {
      showToast(
        '⚠️ Please select a Scope Type and Scope Name (Branch or Warehouse) before adding an item. If managing a specific branch/warehouse, use the Admin Dashboard to navigate to that scope first.',
        'warning'
      )
      return
    }
  }

  // ── CASHIER / WAREHOUSE_KEEPER scope guard ─────────────────────────
  if (user?.role === 'CASHIER' && !user?.branchId) {
    showToast('Your account is not assigned to a branch. Please contact your Admin.', 'warning')
    return
  }
  if (user?.role === 'WAREHOUSE_KEEPER' && !user?.warehouseId) {
    showToast('Your account is not assigned to a warehouse. Please contact your Admin.', 'warning')
    return
  }

  const requiredFields = [{ key: 'name', label: 'Item Name' }]

  const missing = requiredFields.filter(f => {
    const v = normalized[f.key]
    return v === undefined || v === null || v === '' || Number.isNaN(v)
  })

  if (missing.length > 0) {
    showToast(`Please fill: ${missing.map(m => m.label).join(', ')}`, 'warning')
    return
  }

  if (isEdit) {
    handleUpdate(normalized)
  } else {
    handleCreate(normalized)
  }
}
  
  // Raw data from server (paginated)
const rawInventory = Array.isArray(inventory) ? inventory : []
  
  // Apply client-side filters (stock, sold, returned) to the server-paginated data
  const displayInventory = useMemo(() => {
    let filtered = Array.isArray(rawInventory) ? [...rawInventory] : []
    
    if (stockFilter === 'low') {
      filtered = filtered.filter(item => item.currentStock > 0 && item.currentStock <= item.minStockLevel)
    } else if (stockFilter === 'out') {
      filtered = filtered.filter(item => item.currentStock <= 0)
    } else if (stockFilter === 'negative') {
      filtered = filtered.filter(item => item.currentStock < 0)
    } else if (stockFilter === 'high') {
      filtered = filtered.filter(item => item.currentStock > item.maxStockLevel)
    }

    if (soldFilter === 'sold') {
      filtered = filtered.filter(item => item.totalSold > 0)
    } else if (soldFilter === 'not_sold') {
      filtered = filtered.filter(item => item.totalSold === 0)
    }

    if (returnedFilter === 'returned') {
      filtered = filtered.filter(item => item.totalReturned > 0)
    } else if (returnedFilter === 'not_returned') {
      filtered = filtered.filter(item => item.totalReturned === 0)
    }

    return filtered
  }, [rawInventory, stockFilter, soldFilter, returnedFilter])

  const totalItems = totalFromServer ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage))

  const canEditInventory = useMemo(() => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    if (user.role === 'WAREHOUSE_KEEPER') return hasPermission('WAREHOUSE_INVENTORY_EDIT')
    if (user.role === 'CASHIER') return hasPermission('CASHIER_INVENTORY_EDIT')
    return false
  }, [user, hasPermission])

  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(1)
  }

  // Get scope display name with proper formatting
  const getScopeDisplayName = (item) => {
    if (item.scopeType === 'BRANCH') {
      const branchName = scopeNameMap.branches[item.scopeId]
      return branchName || `Branch ${item.scopeId}`
    } else {
      const warehouseName = scopeNameMap.warehouses[item.scopeId]
      return warehouseName || `Warehouse ${item.scopeId}`
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
      <DashboardLayout>
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

        <Card>
          <CardContent>
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <FilterIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="subtitle2">Search & Filters</Typography>
              </Box>
              
              <Grid container spacing={1} sx={{ mb: 0.5 }} alignItems="center">
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

                <Grid item xs={12} md={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Scope</InputLabel>
                    <Select
                      value={scopeFilter}
                      label="Scope"
                      onChange={(e) => {
                        setScopeFilter(e.target.value)
                        setPage(1)
                      }}
                      disabled={isAdminMode || (user?.role === 'CASHIER') || (user?.role === 'WAREHOUSE_KEEPER')}
                    >
                      <MenuItem value="all">All Scopes</MenuItem>
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {user?.role === 'ADMIN' && scopeFilter === 'WAREHOUSE' && (
                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Warehouse</InputLabel>
                      <Select
                        value={selectedWarehouseId || ''}
                        label="Select Warehouse"
                        onChange={(e) => {
                          setSelectedWarehouseId(e.target.value)
                          setPage(1)
                        }}
                      >
                        <MenuItem value="">All Warehouses</MenuItem>
                        {warehousesList.map(warehouse => (
                          <MenuItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} (ID: {warehouse.id})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {user?.role === 'ADMIN' && scopeFilter === 'BRANCH' && (
                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Branch</InputLabel>
                      <Select
                        value={selectedBranchId || ''}
                        label="Select Branch"
                        onChange={(e) => {
                          setSelectedBranchId(e.target.value)
                          setPage(1)
                        }}
                      >
                        <MenuItem value="">All Branches</MenuItem>
                        {branches.map(branch => (
                          <MenuItem key={branch.id} value={branch.id}>
                            {branch.name} (ID: {branch.id})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

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

              <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Showing {displayInventory.length > 0 ? Math.min((page - 1) * rowsPerPage + 1, totalItems) : 0}-{Math.min((page - 1) * rowsPerPage + displayInventory.length, totalItems)} of {totalItems} items
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
              <>
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
                      <TableCell align="right">Purchase Price</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayInventory.map((item) => (
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
                              item.currentStock < 0 ? 'error' :
                              item.currentStock === 0 ? 'error' :
                              item.currentStock <= item.minStockLevel ? 'warning' : 'success'
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
                            icon={item.scopeType === 'BRANCH' ? <StoreIcon /> : <BusinessIcon />}
                            label={getScopeDisplayName(item)} 
                            size="small" 
                            color={item.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                            variant="filled"
                            sx={{ 
                              fontWeight: 'bold',
                              maxWidth: '200px',
                              '& .MuiChip-label': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }
                            }}
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
                              {parseFloat(item.purchasePrice).toFixed(2)}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {canEditInventory && (
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(item)}
                                  color="primary"
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                            )}
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
              </>
            )}

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
          fields={getFields(user, categoriesFromApi)}
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

        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toast.severity || 'info'}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default InventoryPage