'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchTransfers,
  fetchTransferStatistics,
  createTransfer,
  updateTransferStatus,
  clearError,
  setPagination
} from '../../store/slices/transfersSlice'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Card,
  Autocomplete,
  CardContent,
  Divider,
  Tooltip,
  Fab,
  Tabs,
  Tab,
  Badge
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Send as SendIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Inventory as InventoryIcon,
  TrendingUp as TrendingIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Print as PrintIcon
} from '@mui/icons-material'
import api from '../../../utils/axios'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'

const TransferManagementPage = () => {
  const dispatch = useDispatch()
  const authState = useSelector((state) => state.auth)
  const transferState = useSelector((state) => state.transfers)
  const { user: originalUser, isAuthenticated } = authState
  const { transfers, statistics, loading, error, pagination } = transferState
  
  // URL-based role switching for admin users
  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)
  
  // Parse URL parameters for role simulation (admin only)
  useEffect(() => {
    if (typeof window !== 'undefined' && originalUser?.role === 'ADMIN') {
      const params = new URLSearchParams(window.location.search)
      const role = params.get('role')
      const scope = params.get('scope')
      const id = params.get('id')
      
      if (role && scope && id) {
        setUrlParams({ role, scope, id })
        setIsAdminMode(true)
      } else {
        setUrlParams({})
        setIsAdminMode(false)
      }
    }
  }, [originalUser])
  
  // Get effective user based on URL parameters or original user
  const effectiveUser = useMemo(() => {
    if (!originalUser) return null
    
    // If admin is simulating another role via URL params
    if (isAdminMode && urlParams.role && originalUser.role === 'ADMIN') {
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
    }
    
    // Return original user for normal access
    return originalUser
  }, [originalUser, isAdminMode, urlParams])
  
  // Get scope info for admin mode
  const scopeInfo = useMemo(() => {
    if (!isAdminMode || !urlParams.role) return null
    
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`
    }
  }, [isAdminMode, urlParams])
  
  // Safe user role and ID access
  const currentUserRole = effectiveUser?.role
  const currentBranchId = effectiveUser?.branchId
  const currentWarehouseId = effectiveUser?.warehouseId
  
  // Local UI state
  const [selectedTransfer, setSelectedTransfer] = useState(null)
  const [viewDialog, setViewDialog] = useState(false)
  const [createDialog, setCreateDialog] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [isClient, setIsClient] = useState(false)

  // Create transfer form state
  const [newTransfer, setNewTransfer] = useState({
    transferType: 'WAREHOUSE',
    fromWarehouseId: '',
    toWarehouseId: '',
    fromBranchId: '',
    toBranchId: '',
    items: [],
    notes: ''
  })
  const [availableItems, setAvailableItems] = useState([])
  const [availableBranches, setAvailableBranches] = useState([])
  const [availableWarehouses, setAvailableWarehouses] = useState([])
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState(null)
  
  // Transfer settings based on user role
  const [transferSettings, setTransferSettings] = useState({
    allowBranchTransfers: false,
    allowWarehouseTransfers: false,
    requireApproval: true
  })

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    transferType: 'all',
    startDate: '',
    endDate: '',
    search: ''
  })

  // Initialize client-side rendering
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load transfers using Redux
  const loadTransfers = useCallback(() => {
    if (!effectiveUser) return

    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...filters
    }
    
    // Add role-based filtering
    if (currentUserRole === 'CASHIER') {
      params.cashierBranchId = currentBranchId
    } else if (currentUserRole === 'WAREHOUSE_KEEPER') {
      params.warehouseKeeperWarehouseId = currentWarehouseId
    }
    
    dispatch(fetchTransfers(params))
  }, [dispatch, effectiveUser, pagination.page, pagination.limit, filters, currentUserRole, currentBranchId, currentWarehouseId])

  // Load statistics using Redux
  const loadStatistics = useCallback(() => {
    if (!effectiveUser) return
    
    // Only load statistics for ADMIN and WAREHOUSE_KEEPER
    if (currentUserRole === 'CASHIER') return

    const params = {}
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate
    
    // Add role-based filtering
    if (currentUserRole === 'WAREHOUSE_KEEPER') {
      params.fromWarehouseId = currentWarehouseId
    }
    
    dispatch(fetchTransferStatistics(params))
  }, [dispatch, effectiveUser, filters.startDate, filters.endDate, currentUserRole, currentWarehouseId])

  // Load available inventory items for transfer
  const loadAvailableItems = useCallback(async (scopeType, scopeId) => {
    try {
      const response = await api.get(`/inventory?scopeType=${scopeType}&scopeId=${scopeId}`)
      const items = response.data.data || []
      
      // Transform items to ensure proper field names for frontend
      const transformedItems = items.map(item => ({
        ...item,
        currentStock: item.current_stock || item.currentStock || 0,
        name: item.name || item.item_name,
        id: item.id || item.inventory_item_id
      }))
      
      setAvailableItems(transformedItems)
    } catch (error) {
      console.error('Error loading available items:', error)
      setAvailableItems([])
    }
  }, [])

  // Load available branches
  const loadAvailableBranches = useCallback(async () => {
    try {
      const response = await api.get('/branches')
      setAvailableBranches(response.data.data || [])
    } catch (error) {
      console.error('Error loading branches:', error)
      setAvailableBranches([])
    }
  }, [])

  // Load available warehouses
  const loadAvailableWarehouses = useCallback(async () => {
    try {
      console.log('🔍 Loading warehouses for role:', currentUserRole)
      
      // For warehouse keepers, we need to load ALL warehouses (not just their own)
      // because they need to select destination warehouses for transfers
      let response
      if (currentUserRole === 'WAREHOUSE_KEEPER') {
        // Use forTransfer parameter to get all warehouses
        response = await api.get('/warehouses?forTransfer=true')
        console.log('🔍 Warehouse keeper warehouses response:', response.data)
      } else {
        response = await api.get('/warehouses')
        console.log('🔍 Admin warehouses response:', response.data)
      }
      
      const warehouses = response.data.data || []
      
      // Transform warehouses to ensure proper field names
      const transformedWarehouses = warehouses.map(warehouse => ({
        ...warehouse,
        name: warehouse.name || warehouse.warehouse_name,
        id: warehouse.id || warehouse.warehouse_id
      }))
      
      console.log('🔍 Transformed warehouses:', transformedWarehouses)
      setAvailableWarehouses(transformedWarehouses)
    } catch (error) {
      console.error('Error loading warehouses:', error)
      setAvailableWarehouses([])
    }
  }, [currentUserRole])

  // Load transfer settings for current user's location
  const loadTransferSettings = useCallback(async () => {
    if (!effectiveUser) return

    try {
      if (currentUserRole === 'CASHIER') {
        if (!currentBranchId) {
          setTransferSettings({ allowBranchTransfers: false })
          return
        }
        
        const response = await api.get(`/branches/${currentBranchId}`)
        if (response.data.success) {
          const branch = response.data.data
          let settings = branch.settings
          if (typeof settings === 'string') {
            try {
              settings = JSON.parse(settings)
            } catch (error) {
              settings = {}
            }
          }
          
          setTransferSettings({
            allowBranchTransfers: settings?.allowBranchTransfers || false,
            allowBranchToBranchTransfers: settings?.allowBranchToBranchTransfers || false,
            allowBranchToWarehouseTransfers: settings?.allowBranchToWarehouseTransfers || false,
            requireApproval: settings?.requireApprovalForBranchTransfers !== false,
            maxTransferAmount: settings?.maxTransferAmount || 10000
          })
        }
      } else if (currentUserRole === 'WAREHOUSE_KEEPER') {
        if (!currentWarehouseId) {
          setTransferSettings({ allowWarehouseTransfers: false })
          return
        }
        
        const response = await api.get(`/warehouses/${currentWarehouseId}`)
        if (response.data.success) {
          const warehouse = response.data.data
          let settings = warehouse.settings
          if (typeof settings === 'string') {
            try {
              settings = JSON.parse(settings)
            } catch (error) {
              settings = {}
            }
          }
          
          setTransferSettings({
            allowWarehouseTransfers: settings?.allowWarehouseTransfers || true,
            allowWarehouseToWarehouseTransfers: settings?.allowWarehouseToWarehouseTransfers || true,
            allowWarehouseToBranchTransfers: settings?.allowWarehouseToBranchTransfers || false,
            requireApproval: settings?.requireApprovalForWarehouseTransfers !== false,
            maxTransferAmount: settings?.maxTransferAmount || 50000
          })
        }
      } else if (currentUserRole === 'ADMIN') {
        // Admin has full access
        setTransferSettings({
          allowBranchTransfers: true,
          allowWarehouseTransfers: true,
          allowBranchToBranchTransfers: true,
          allowWarehouseToWarehouseTransfers: true,
          allowBranchToWarehouseTransfers: true,
          allowWarehouseToBranchTransfers: true,
          requireApproval: true,
          maxTransferAmount: 100000
        })
      }
    } catch (error) {
      console.error('Error loading transfer settings:', error)
      // Set default settings based on role
      if (currentUserRole === 'CASHIER') {
        setTransferSettings({ allowBranchTransfers: false })
      } else if (currentUserRole === 'WAREHOUSE_KEEPER') {
        setTransferSettings({ allowWarehouseTransfers: false })
      } else {
        setTransferSettings({})
      }
    }
  }, [effectiveUser, currentUserRole, currentBranchId, currentWarehouseId])

  // Handle create transfer
  const handleCreateTransfer = async () => {
    try {
      setCreateLoading(true)
      setCreateError(null)

      console.log('🔍 Transfer validation debug:', {
        currentUserRole,
        currentBranchId,
        currentWarehouseId,
        newTransfer,
        transferSettings
      })

      // Role-based validation
      if (currentUserRole === 'CASHIER') {
        if (!transferSettings?.allowBranchTransfers) {
          throw new Error('Branch transfers are not enabled by admin')
        }
        if (!newTransfer.toBranchId) {
          throw new Error('Destination branch is required')
        }
        // For cashiers, fromBranchId is not set in the form (disabled field)
        // We validate that they can only transfer from their current branch
        if (newTransfer.fromBranchId && newTransfer.fromBranchId !== currentBranchId) {
          throw new Error('You can only transfer from your own branch')
        }
      } else if (currentUserRole === 'WAREHOUSE_KEEPER') {
        if (!transferSettings?.allowWarehouseTransfers) {
          throw new Error('Warehouse transfers are not enabled by admin')
        }
        if (!newTransfer.toWarehouseId) {
          throw new Error('Destination warehouse is required')
        }
        // For warehouse keepers, fromWarehouseId is not set in the form (disabled field)
        // We validate that they can only transfer from their current warehouse
        if (newTransfer.fromWarehouseId && newTransfer.fromWarehouseId !== currentWarehouseId) {
          throw new Error('You can only transfer from your own warehouse')
        }
        // Additional validation: ensure currentWarehouseId is available
        if (!currentWarehouseId) {
          throw new Error('Warehouse keeper must be assigned to a warehouse')
        }
      } else if (currentUserRole === 'ADMIN') {
        if (newTransfer.transferType === 'WAREHOUSE') {
          if (!newTransfer.fromWarehouseId || !newTransfer.toWarehouseId) {
            throw new Error('Both source and destination warehouses are required')
          }
        } else if (newTransfer.transferType === 'BRANCH') {
          if (!newTransfer.fromBranchId || !newTransfer.toBranchId) {
            throw new Error('Both source and destination branches are required')
          }
        }
      }

      // Common validation
      if (newTransfer.items.length === 0) {
        throw new Error('At least one item is required')
      }

      // Prepare transfer data with correct backend format
      let transferData = {
        items: newTransfer.items.map(item => ({
          inventoryItemId: parseInt(item.inventoryItemId),
          quantityRequested: parseFloat(item.quantity)
        })),
        notes: newTransfer.notes
      }

      // Add role-specific data with correct scope format
      if (currentUserRole === 'CASHIER') {
        transferData = {
          ...transferData,
          transferType: 'BRANCH_TO_BRANCH',
          fromScopeType: 'BRANCH',
          fromScopeId: parseInt(currentBranchId),
          toScopeType: 'BRANCH',
          toScopeId: parseInt(newTransfer.toBranchId)
        }
      } else if (currentUserRole === 'WAREHOUSE_KEEPER') {
        transferData = {
          ...transferData,
          transferType: 'WAREHOUSE_TO_WAREHOUSE',
          fromScopeType: 'WAREHOUSE',
          fromScopeId: parseInt(currentWarehouseId),
          toScopeType: 'WAREHOUSE',
          toScopeId: parseInt(newTransfer.toWarehouseId)
        }
      } else if (currentUserRole === 'ADMIN') {
        if (newTransfer.transferType === 'WAREHOUSE') {
          transferData = {
            ...transferData,
            transferType: 'WAREHOUSE_TO_WAREHOUSE',
            fromScopeType: 'WAREHOUSE',
            fromScopeId: parseInt(newTransfer.fromWarehouseId),
            toScopeType: 'WAREHOUSE',
            toScopeId: parseInt(newTransfer.toWarehouseId)
          }
        } else {
          transferData = {
            ...transferData,
            transferType: 'BRANCH_TO_BRANCH',
            fromScopeType: 'BRANCH',
            fromScopeId: parseInt(newTransfer.fromBranchId),
            toScopeType: 'BRANCH',
            toScopeId: parseInt(newTransfer.toBranchId)
          }
        }
      }

      console.log('🔍 Sending transfer data:', transferData)
      const response = await api.post('/transfers', transferData)
      
      if (response.data.success) {
        // Reset form
        setNewTransfer({
          transferType: 'WAREHOUSE',
          fromWarehouseId: '',
          toWarehouseId: '',
          fromBranchId: '',
          toBranchId: '',
          items: [],
          notes: ''
        })
        setCreateDialog(false)
        
        // Reload data
        loadTransfers()
        loadStatistics()
      }
    } catch (error) {
      console.error('Error creating transfer:', error)
      setCreateError(error.response?.data?.message || error.message || 'Failed to create transfer')
    } finally {
      setCreateLoading(false)
    }
  }

  // Add item to transfer
  const addItemToTransfer = () => {
    setNewTransfer(prev => ({
      ...prev,
      items: [...prev.items, { inventoryItemId: '', quantity: '' }]
    }))
  }

  // Remove item from transfer
  const removeItemFromTransfer = (index) => {
    setNewTransfer(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Update item in transfer
  const updateTransferItem = (index, field, value) => {
    setNewTransfer(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  // Load data when user changes
  useEffect(() => {
    if (!effectiveUser) return
    
    loadTransfers()
    loadStatistics()
    loadTransferSettings()
    
    // Load data based on user role
    if (currentUserRole === 'ADMIN') {
      loadAvailableBranches()
      loadAvailableWarehouses()
    } else if (currentUserRole === 'WAREHOUSE_KEEPER') {
      loadAvailableWarehouses()
      loadAvailableItems('WAREHOUSE', currentWarehouseId)
    } else if (currentUserRole === 'CASHIER') {
      loadAvailableBranches()
      loadAvailableItems('BRANCH', currentBranchId)
    }
  }, [effectiveUser, loadTransfers, loadStatistics, loadTransferSettings, loadAvailableBranches, loadAvailableWarehouses, loadAvailableItems, currentUserRole, currentBranchId, currentWarehouseId])

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    dispatch(setPagination({ page: 1 }))
  }

  // Handle status update using Redux
  const handleStatusUpdate = async (transferId, newStatus, notes = '') => {
    try {
      const result = await dispatch(updateTransferStatus({ transferId, status: newStatus, notes }))
      
      if (result.type.endsWith('/fulfilled')) {
        loadTransfers()
        loadStatistics()
        setViewDialog(false)
      }
    } catch (err) {
      console.error('Error updating transfer status:', err)
    }
  }

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      // Database status values (lowercase)
      'pending': 'warning',
      'approved': 'info',
      'shipped': 'primary',
      'delivered': 'success',
      'cancelled': 'error',
      // Frontend status values (uppercase)
      'PENDING': 'warning',
      'APPROVED': 'info',
      'IN_TRANSIT': 'primary',
      'COMPLETED': 'success',
      'REJECTED': 'error',
      'CANCELLED': 'default'
    }
    return colors[status] || 'default'
  }

  // Get transfer type display
  const getTransferTypeDisplay = (type) => {
    // Handle null, undefined, or empty values
    if (!type || type === '' || type === 'null' || type === 'undefined') {
      return 'Unknown';
    }
    
    const types = {
      // Full format values
      'BRANCH_TO_BRANCH': 'Branch → Branch',
      'WAREHOUSE_TO_WAREHOUSE': 'Warehouse → Warehouse',
      'BRANCH_TO_WAREHOUSE': 'Branch → Warehouse',
      'WAREHOUSE_TO_BRANCH': 'Warehouse → Branch',
      // Simple format values
      'BRANCH': 'Branch Transfer',
      'WAREHOUSE': 'Warehouse Transfer',
      // Lowercase variants
      'branch_to_branch': 'Branch → Branch',
      'warehouse_to_warehouse': 'Warehouse → Warehouse',
      'branch_to_warehouse': 'Branch → Warehouse',
      'warehouse_to_branch': 'Warehouse → Branch',
      'branch': 'Branch Transfer',
      'warehouse': 'Warehouse Transfer'
    }
    
    return types[type] || `Unknown (${type})`;
  }

  // Render statistics cards
  const renderStatistics = () => {
    // Don't show statistics for CASHIER users
    if (currentUserRole === 'CASHIER') return null
    if (!statistics) return null

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Transfers
                  </Typography>
                  <Typography variant="h4">
                    {statistics.total_transfers || 0}
                  </Typography>
                </Box>
                <InventoryIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Pending
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {statistics.pending_transfers || 0}
                  </Typography>
                </Box>
                <TrendingIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Approved
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {statistics.approved_transfers || 0}
                  </Typography>
                </Box>
                <ApproveIcon color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    In Transit
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {statistics.in_transit_transfers || 0}
                  </Typography>
                </Box>
                <SendIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {statistics.completed_transfers || 0}
                  </Typography>
                </Box>
                <ApproveIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  // Render transfers table
  const renderTransfersTable = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )
    }

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Transfer #</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Initiated By</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transfers && transfers.length > 0 ? (
              transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {transfer.transfer_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getTransferTypeDisplay(transfer.transfer_type)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transfer.from_branch_name || transfer.from_warehouse_name || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transfer.to_branch_name || transfer.to_warehouse_name || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={transfer.status} 
                      color={getStatusColor(transfer.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transfer.created_by_name || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(transfer.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={async () => {
                            console.log('🔍 Opening transfer details for:', transfer.id)
                            setSelectedTransfer(transfer)
                            setViewDialog(true)
                            
                            // Load transfer details with items
                            try {
                              const response = await api.get(`/transfers/${transfer.id}`)
                              if (response.data.success) {
                                console.log('🔍 Transfer details loaded:', response.data.data)
                                setSelectedTransfer(response.data.data)
                              }
                            } catch (error) {
                              console.error('Error loading transfer details:', error)
                            }
                          }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      
                      {(transfer.status === 'pending' || transfer.status === 'PENDING') && currentUserRole === 'ADMIN' && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleStatusUpdate(transfer.id, 'APPROVED')}
                            >
                              <ApproveIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleStatusUpdate(transfer.id, 'REJECTED')}
                            >
                              <RejectIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="h6" color="text.secondary">
                      No transfers found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {currentUserRole === 'CASHIER' && 'You haven\'t created any branch transfers yet.'}
                      {currentUserRole === 'WAREHOUSE_KEEPER' && 'You haven\'t created any warehouse transfers yet.'}
                      {currentUserRole === 'ADMIN' && 'No transfers have been created yet.'}
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setCreateDialog(true)}
                      sx={{ mt: 1 }}
                    >
                      Create Your First Transfer
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  // Show loading state during client-side hydration
  if (!isClient) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  // Show error if user is not authenticated
  if (!isAuthenticated || !effectiveUser) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Authentication required. Please log in to access this page.
          </Alert>
        </Box>
      </DashboardLayout>
    )
  }

  // Show error if user role is not supported
  if (!['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'].includes(currentUserRole)) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Your role ({currentUserRole}) does not have access to transfer management.
          </Alert>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
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
              Transfer Management
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  loadTransfers()
                  loadStatistics()
                }}
              >
                Refresh
              </Button>
              <PermissionCheck 
                roles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}
                fallback={<Button variant="contained" disabled>New Transfer</Button>}
              >
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialog(true)}
                >
                  New Transfer
                </Button>
              </PermissionCheck>
            </Box>
          </Box>

          {/* Statistics */}
          {renderStatistics()}

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Filters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="APPROVED">Approved</MenuItem>
                    <MenuItem value="IN_TRANSIT">In Transit</MenuItem>
                    <MenuItem value="COMPLETED">Completed</MenuItem>
                    <MenuItem value="REJECTED">Rejected</MenuItem>
                    <MenuItem value="CANCELLED">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Transfer Type</InputLabel>
                  <Select
                    value={filters.transferType}
                    label="Transfer Type"
                    onChange={(e) => handleFilterChange('transferType', e.target.value)}
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    <MenuItem value="BRANCH_TO_BRANCH">Branch → Branch</MenuItem>
                    <MenuItem value="WAREHOUSE_TO_WAREHOUSE">Warehouse → Warehouse</MenuItem>
                    <MenuItem value="BRANCH_TO_WAREHOUSE">Branch → Warehouse</MenuItem>
                    <MenuItem value="WAREHOUSE_TO_BRANCH">Warehouse → Branch</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="End Date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Transfers Table */}
          {renderTransfersTable()}

          {/* View Transfer Dialog */}
          <Dialog
            open={viewDialog}
            onClose={() => setViewDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Transfer Details - {selectedTransfer?.transfer_number}
            </DialogTitle>
            <DialogContent>
              {selectedTransfer && (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        From:
                      </Typography>
                      <Typography variant="body1">
                        {selectedTransfer.from_branch_name || selectedTransfer.from_warehouse_name || 'Unknown'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        To:
                      </Typography>
                      <Typography variant="body1">
                        {selectedTransfer.to_branch_name || selectedTransfer.to_warehouse_name || 'Unknown'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Transfer Type:
                      </Typography>
                      <Typography variant="body1">
                        {getTransferTypeDisplay(selectedTransfer.transfer_type)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Status:
                      </Typography>
                      <Chip 
                        label={selectedTransfer.status} 
                        color={getStatusColor(selectedTransfer.status)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Initiated By:
                      </Typography>
                      <Typography variant="body1">
                        {selectedTransfer.created_by_name || 'Unknown'}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="h6" gutterBottom>
                    Transfer Items
                  </Typography>
                  
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Debug: Transfer ID: {selectedTransfer.id}, Items count: {selectedTransfer.items?.length || 0}
                      </Typography>
                      {selectedTransfer.items && selectedTransfer.items.length > 0 && (
                        <Typography variant="caption" color="textSecondary" display="block">
                          Items: {JSON.stringify(selectedTransfer.items.map(item => ({ id: item.id, name: item.item_name, quantity: item.quantity })))}
                        </Typography>
                      )}
                    </Box>
                  )}
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Category</TableCell>
                          <TableCell align="right">Current Stock</TableCell>
                          <TableCell align="right">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedTransfer.items && selectedTransfer.items.length > 0 ? (
                          selectedTransfer.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.item_name || item.name}</TableCell>
                              <TableCell>{item.sku}</TableCell>
                              <TableCell align="right">{item.quantity}</TableCell>
                              <TableCell align="right">{item.category}</TableCell>
                              <TableCell align="right">{item.current_stock}</TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={selectedTransfer.status === 'approved' ? 'Approved' : 'Pending'} 
                                  color={selectedTransfer.status === 'approved' ? 'success' : 'warning'} 
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ textAlign: 'center', py: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                No transfer items found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDialog(false)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>

          {/* Create Transfer Dialog - Role-Based */}
          <Dialog
            open={createDialog}
            onClose={() => setCreateDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Create New Transfer
              {currentUserRole === 'CASHIER' && ' (Branch Transfer)'}
              {currentUserRole === 'WAREHOUSE_KEEPER' && ' (Warehouse Transfer)'}
              {currentUserRole === 'ADMIN' && ' (Admin Transfer)'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                {createError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {createError}
                  </Alert>
                )}

                {/* Admin Transfer Type Selection */}
                {currentUserRole === 'ADMIN' && (
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Transfer Type</InputLabel>
                        <Select
                          value={newTransfer.transferType}
                          onChange={(e) => setNewTransfer(prev => ({ 
                            ...prev, 
                            transferType: e.target.value,
                            fromWarehouseId: '',
                            toWarehouseId: '',
                            fromBranchId: '',
                            toBranchId: ''
                          }))}
                          label="Transfer Type"
                        >
                          <MenuItem value="WAREHOUSE">Warehouse to Warehouse</MenuItem>
                          <MenuItem value="BRANCH">Branch to Branch</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                )}

                <Grid container spacing={2}>
                  {/* CASHIER: From Branch (Read-only) */}
                  {currentUserRole === 'CASHIER' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="From Branch"
                          value={effectiveUser.branchName || `Branch ${currentBranchId}`}
                          disabled
                          helperText="Your current branch"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>To Branch</InputLabel>
                          <Select
                            value={newTransfer.toBranchId}
                            onChange={(e) => setNewTransfer(prev => ({ ...prev, toBranchId: e.target.value }))}
                            label="To Branch"
                          >
                            <MenuItem value="">Select Destination Branch</MenuItem>
                            {availableBranches
                              .filter(branch => branch.id !== currentBranchId)
                              .map((branch) => (
                                <MenuItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}

                  {/* WAREHOUSE_KEEPER: From Warehouse (Read-only) */}
                  {currentUserRole === 'WAREHOUSE_KEEPER' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="From Warehouse"
                          value={effectiveUser.warehouseName || `Warehouse ${currentWarehouseId}`}
                          disabled
                          helperText="Your current warehouse"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>To Warehouse</InputLabel>
                          <Select
                            value={newTransfer.toWarehouseId}
                            onChange={(e) => setNewTransfer(prev => ({ ...prev, toWarehouseId: e.target.value }))}
                            label="To Warehouse"
                          >
                            <MenuItem value="">Select Destination Warehouse</MenuItem>
                            {availableWarehouses
                              .filter(warehouse => warehouse.id !== currentWarehouseId)
                              .map((warehouse) => (
                                <MenuItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}

                  {/* ADMIN: Warehouse Transfer */}
                  {currentUserRole === 'ADMIN' && newTransfer.transferType === 'WAREHOUSE' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>From Warehouse</InputLabel>
                          <Select
                            value={newTransfer.fromWarehouseId}
                            onChange={(e) => {
                              setNewTransfer(prev => ({ ...prev, fromWarehouseId: e.target.value }))
                              if (e.target.value) {
                                loadAvailableItems('WAREHOUSE', e.target.value)
                              }
                            }}
                            label="From Warehouse"
                          >
                            <MenuItem value="">Select Source Warehouse</MenuItem>
                            {availableWarehouses.map((warehouse) => (
                              <MenuItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>To Warehouse</InputLabel>
                          <Select
                            value={newTransfer.toWarehouseId}
                            onChange={(e) => setNewTransfer(prev => ({ ...prev, toWarehouseId: e.target.value }))}
                            label="To Warehouse"
                          >
                            <MenuItem value="">Select Destination Warehouse</MenuItem>
                            {availableWarehouses
                              .filter(warehouse => warehouse.id !== newTransfer.fromWarehouseId)
                              .map((warehouse) => (
                                <MenuItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}

                  {/* ADMIN: Branch Transfer */}
                  {currentUserRole === 'ADMIN' && newTransfer.transferType === 'BRANCH' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>From Branch</InputLabel>
                          <Select
                            value={newTransfer.fromBranchId}
                            onChange={(e) => {
                              setNewTransfer(prev => ({ ...prev, fromBranchId: e.target.value }))
                              if (e.target.value) {
                                loadAvailableItems('BRANCH', e.target.value)
                              }
                            }}
                            label="From Branch"
                          >
                            <MenuItem value="">Select Source Branch</MenuItem>
                            {availableBranches.map((branch) => (
                              <MenuItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>To Branch</InputLabel>
                          <Select
                            value={newTransfer.toBranchId}
                            onChange={(e) => setNewTransfer(prev => ({ ...prev, toBranchId: e.target.value }))}
                            label="To Branch"
                          >
                            <MenuItem value="">Select Destination Branch</MenuItem>
                            {availableBranches
                              .filter(branch => branch.id !== newTransfer.fromBranchId)
                              .map((branch) => (
                                <MenuItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}

                  {/* Transfer Items */}
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                      Transfer Items
                    </Typography>
                    
                    {newTransfer.items.map((item, index) => (
                      <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                            <Autocomplete
                              options={availableItems}
                              getOptionLabel={(option) => `${option.name} (Stock: ${option.currentStock || option.current_stock || 0})`}
                              value={availableItems.find(availableItem => availableItem.id === item.inventoryItemId) || null}
                              onChange={(event, newValue) => {
                                updateTransferItem(index, 'inventoryItemId', newValue?.id || '')
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Product"
                                  placeholder="Search for a product..."
                                  variant="outlined"
                                />
                              )}
                              sx={{ minWidth: 250 }}
                              noOptionsText="No products found"
                              clearOnEscape
                              selectOnFocus
                              handleHomeEndKeys
                            />
                        
                        <TextField
                          label="Quantity"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateTransferItem(index, 'quantity', e.target.value)}
                          sx={{ width: 120 }}
                          inputProps={{ min: 0.01, step: 0.01 }}
                          helperText="Amount to transfer"
                        />
                        
                        <IconButton
                          onClick={() => removeItemFromTransfer(index)}
                          color="error"
                          title="Remove item"
                        >
                          <RejectIcon />
                        </IconButton>
                      </Box>
                    ))}
                    
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={addItemToTransfer}
                      sx={{ mb: 2 }}
                    >
                      Add Product
                    </Button>
                  </Grid>

                  {/* Notes */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Notes"
                      value={newTransfer.notes}
                      onChange={(e) => setNewTransfer(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional notes about this transfer..."
                    />
                  </Grid>

                  {/* Permission Status */}
                  <Grid item xs={12}>
                    <Alert 
                      severity={currentUserRole === 'CASHIER' && !transferSettings?.allowBranchTransfers ? 'warning' : 
                              currentUserRole === 'WAREHOUSE_KEEPER' && !transferSettings?.allowWarehouseTransfers ? 'warning' : 'info'}
                      sx={{ mt: 2 }}
                    >
                      {currentUserRole === 'CASHIER' && !transferSettings?.allowBranchTransfers && 
                        'Branch transfers are disabled for your branch. Contact admin to enable.'}
                      {currentUserRole === 'WAREHOUSE_KEEPER' && !transferSettings?.allowWarehouseTransfers && 
                        'Warehouse transfers are disabled for your warehouse. Contact admin to enable.'}
                      {currentUserRole === 'ADMIN' && 'You have full control over all transfers'}
                      {currentUserRole === 'CASHIER' && transferSettings?.allowBranchTransfers && 
                        'Branch transfers are enabled for your branch'}
                      {currentUserRole === 'WAREHOUSE_KEEPER' && transferSettings?.allowWarehouseTransfers && 
                        'Warehouse transfers are enabled for your warehouse'}
                    </Alert>
                  </Grid>
                </Grid>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTransfer}
                variant="contained"
                disabled={createLoading || 
                  (currentUserRole === 'CASHIER' && !transferSettings?.allowBranchTransfers) ||
                  (currentUserRole === 'WAREHOUSE_KEEPER' && !transferSettings?.allowWarehouseTransfers)}
                startIcon={createLoading ? <CircularProgress size={20} /> : <SendIcon />}
              >
                {createLoading ? 'Creating...' : 'Create Transfer'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </RouteGuard>
    </DashboardLayout>
  )
}

export default TransferManagementPage