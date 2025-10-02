'use client'

import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as yup from 'yup'
import withAuth from '../../components/auth/withAuth'
import ResponsiveLayout from '../../components/layout/ResponsiveLayout'
import EntityTable from '../../components/crud/EntityTable'
import EntityFormDialog from '../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../hooks/useEntityCRUD'
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../store/slices/inventorySlice'

// Validation schema
const inventorySchema = yup.object({
  name: yup.string().required('Product name is required'),
  category: yup.string().required('Category is required'),
  sku: yup.string().required('SKU is required'),
  price: yup.number().required('Price is required').min(0, 'Price must be positive'),
  stock: yup.number().required('Stock is required').min(0, 'Stock cannot be negative'),
  minStock: yup.number().required('Minimum stock is required').min(0, 'Minimum stock cannot be negative'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Product Name', width: 200 },
  { field: 'category', headerName: 'Category', width: 120 },
  { field: 'sku', headerName: 'SKU', width: 120 },
  { field: 'price', headerName: 'Price', width: 100, type: 'number', renderCell: (params) => `$${params.value}` },
  { field: 'stock', headerName: 'Stock', width: 80, type: 'number' },
  { field: 'minStock', headerName: 'Min Stock', width: 100, type: 'number' },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 120,
    renderCell: (params) => {
      const colors = {
        active: 'green',
        'low-stock': 'orange',
        'out-of-stock': 'red'
      }
      return (
        <span style={{ 
          color: colors[params.value] || 'black',
          fontWeight: 'bold'
        }}>
          {params.value.replace('-', ' ').toUpperCase()}
        </span>
      )
    }
  },
  { field: 'createdAt', headerName: 'Created', width: 120 },
]

// Form fields configuration
const fields = [
  { name: 'name', label: 'Product Name', type: 'text', required: true },
  { 
    name: 'category', 
    label: 'Category', 
    type: 'select', 
    required: true,
    options: [
      { value: 'Electronics', label: 'Electronics' },
      { value: 'Furniture', label: 'Furniture' },
      { value: 'Appliances', label: 'Appliances' },
      { value: 'Office Supplies', label: 'Office Supplies' },
      { value: 'Other', label: 'Other' },
    ]
  },
  { name: 'sku', label: 'SKU', type: 'text', required: true },
  { name: 'price', label: 'Price', type: 'number', required: true, step: 0.01 },
  { name: 'stock', label: 'Current Stock', type: 'number', required: true },
  { name: 'minStock', label: 'Minimum Stock', type: 'number', required: true },
]

function InventoryPage() {
  const dispatch = useDispatch()
  const crud = useEntityCRUD('inventory', 'inventory item')

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchInventory())
  }, [dispatch])

  // Handle CRUD operations
  const handleCreate = (data) => {
    dispatch(createInventoryItem(data))
  }

  const handleUpdate = (data) => {
    dispatch(updateInventoryItem({ id: crud.selectedEntity.id, data }))
  }

  const handleDelete = () => {
    dispatch(deleteInventoryItem(crud.selectedEntity.id))
  }

  return (
    <ResponsiveLayout>
      <EntityTable
        data={crud.data}
        loading={crud.loading}
        columns={columns}
        title="Inventory Management"
        entityName="Inventory Item"
        onAdd={crud.handleAdd}
        onEdit={crud.handleEdit}
        onDelete={crud.handleDeleteClick}
        error={crud.error}
      />

      <EntityFormDialog
        open={crud.formDialogOpen}
        onClose={crud.handleFormClose}
        title={crud.dialogTitle}
        fields={fields}
        validationSchema={inventorySchema}
        initialData={crud.selectedEntity}
        isEdit={crud.isEdit}
        onSubmit={crud.handleFormSubmit}
        loading={crud.loading}
        error={crud.error}
      />

      <ConfirmationDialog
        open={crud.confirmationDialogOpen}
        onClose={crud.handleConfirmationClose}
        title={crud.confirmationTitle}
        message={crud.confirmationMessage}
        onConfirm={handleDelete}
        loading={crud.loading}
        severity="error"
      />
    </ResponsiveLayout>
  )
}

export default withAuth(InventoryPage)
