'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import { Box, Typography } from '@mui/material'
import withAuth from '../../../components/auth/withAuth.js'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import PollingStatusIndicator from '../../../components/polling/PollingStatusIndicator'
import { useInventoryPolling } from '../../../hooks/usePolling'
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../store/slices/inventorySlice'
import { fetchBranchSettings } from '../../store/slices/branchesSlice'
import { fetchWarehouseSettings, fetchWarehouses } from '../../store/slices/warehousesSlice'

// Validation schema - matches backend validation exactly
const inventorySchema = yup.object({
  name: yup.string()
    .trim()
    .min(1, 'Item name must be between 1 and 200 characters')
    .max(200, 'Item name must be between 1 and 200 characters')
    .required('Item name is required'),
  sku: yup.string()
    .trim()
    .min(1, 'SKU must be between 1 and 20 characters')
    .max(20, 'SKU must be between 1 and 20 characters')
    .matches(/^[A-Za-z0-9-]+$/, 'SKU can only contain letters, numbers, and hyphens')
    .required('SKU is required'),
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
    .integer('Current stock must be a non-negative integer')
    .min(0, 'Current stock must be a non-negative integer')
    .required('Current stock is required'),
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
  scopeId: yup.number()
    .integer('Scope ID must be a valid positive integer')
    .min(1, 'Scope ID must be a valid positive integer')
    .required('Scope ID is required'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Product Name', width: 200 },
  { field: 'sku', headerName: 'SKU', width: 120 },
  { field: 'category', headerName: 'Category', width: 120 },
  { field: 'unit', headerName: 'Unit', width: 80 },
  { field: 'costPrice', headerName: 'Cost Price', width: 100, type: 'number', renderCell: (params) => `${params.value}` },
  { field: 'sellingPrice', headerName: 'Selling Price', width: 120, type: 'number', renderCell: (params) => `${params.value}` },
  { field: 'currentStock', headerName: 'Current Stock', width: 120, type: 'number' },
  { field: 'minStockLevel', headerName: 'Min Stock', width: 100, type: 'number' },
  { field: 'maxStockLevel', headerName: 'Max Stock', width: 100, type: 'number' },
  { field: 'scopeType', headerName: 'Scope Type', width: 120 },
  { field: 'scopeId', headerName: 'Scope ID', width: 100 },
  { field: 'createdAt', headerName: 'Created', width: 150 },
]

// Form fields configuration
const getFields = (user) => {
  const baseFields = [
    { name: 'name', label: 'Product Name', type: 'text', required: true },
    { name: 'sku', label: 'SKU', type: 'text', required: true },
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
      { name: 'scopeId', label: 'Scope ID', type: 'number', required: true }
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
        label: 'Branch ID', 
        type: 'number', 
        required: true,
        defaultValue: user.branchId,
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
        label: 'Warehouse ID', 
        type: 'number', 
        required: true,
        defaultValue: user.warehouseId,
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
      { name: 'scopeId', label: 'Scope ID', type: 'number', required: true }
    )
  }

  return baseFields
}

function InventoryPage() {
  const dispatch = useDispatch()
  const { data: inventory, loading, error } = useSelector((state) => state.inventory)
  
  // Ensure inventory is always an array
  const safeInventory = Array.isArray(inventory) ? inventory : []
  const { user } = useSelector((state) => state.auth)
  const { branchSettings } = useSelector((state) => state.branches)
  const { warehouseSettings, warehouses } = useSelector((state) => state.warehouses)
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  
  // Tab state for warehouse keepers - removed, only show current warehouse
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null)
  
  // Enable real-time polling for inventory
  const { isPolling, lastUpdate, refreshData } = useInventoryPolling({
    enabled: true,
    immediate: true
  })

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

  // Handle CRUD operations
  const handleCreate = async (data) => {
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
    }
  }

  const handleUpdate = async (data) => {
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
    if (user?.role === 'WAREHOUSE_KEEPER') {
      // Show only current warehouse inventory
      return safeInventory.filter(item => 
        item.scopeType === 'WAREHOUSE' && item.scopeId === user?.warehouseId
      )
    }
    // For other roles, show all inventory
    return safeInventory
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4">Inventory Management</Typography>
          <PollingStatusIndicator dataType="inventory" showControls={true} />
        </Box>
        
        {/* Removed tabs for warehouse keepers - they only see their own warehouse */}
        
        {(() => {
          // Check permissions for both cashiers and warehouse keepers
          const canEdit = user?.role === 'ADMIN' || 
            (user?.role === 'CASHIER' && branchSettings?.allowCashierInventoryEdit) ||
            (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseInventoryEdit);
          
          // Cashiers and warehouse keepers can also delete inventory items
          const canDelete = canEdit;
          
          // Get filtered inventory based on user role and tab
          const filteredInventory = getFilteredInventory();
          
          if (canEdit) {
            return (
              <EntityTable
                data={filteredInventory}
                loading={loading}
                columns={columns}
                title={user?.role === 'WAREHOUSE_KEEPER' ? 
                  "My Warehouse Inventory" : 
                  "Inventory Management"
                }
                entityName="Inventory Item"
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={canDelete ? handleDeleteClick : null}
                error={error}
              />
            );
          } else {
            return (
              <EntityTable
                data={filteredInventory}
                loading={loading}
                columns={columns}
                title={user?.role === 'WAREHOUSE_KEEPER' ? 
                  "My Warehouse Inventory (View Only)" : 
                  "Inventory Management (View Only)"
                }
                entityName="Inventory Item"
                onAdd={null}
                onEdit={null}
                onDelete={null}
                error={error}
              />
            );
          }
        })()}

        <EntityFormDialog
          open={formDialogOpen}
          onClose={handleFormClose}
          title={isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}
          fields={getFields(user)}
          validationSchema={inventorySchema}
          initialData={selectedEntity}
          isEdit={isEdit}
          onSubmit={handleFormSubmit}
          loading={loading}
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
      </DashboardLayout>
    </RouteGuard>
  )
}

export default InventoryPage
