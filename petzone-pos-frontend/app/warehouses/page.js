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
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../store/slices/warehousesSlice'

// Validation schema
const warehouseSchema = yup.object({
  name: yup.string().required('Warehouse name is required'),
  location: yup.string().required('Location is required'),
  capacity: yup.mixed()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      const num = Number(value)
      return isNaN(num) ? null : num
    })
    .nullable()
    .optional(),
  stock: yup.mixed()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      const num = Number(value)
      return isNaN(num) ? null : num
    })
    .nullable()
    .optional(),
  manager: yup.string().required('Manager name is required'),
  status: yup.string().required('Status is required'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Warehouse Name', width: 200 },
  { field: 'location', headerName: 'Location', width: 150 },
  { field: 'capacity', headerName: 'Capacity', width: 100, type: 'number' },
  { field: 'currentStock', headerName: 'Current Stock', width: 120, type: 'number' },
  { field: 'manager', headerName: 'Manager', width: 150 },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 120,
    renderCell: (params) => {
      const colors = {
        active: 'green',
        maintenance: 'orange',
        inactive: 'red'
      }
      return (
        <span style={{ 
          color: colors[params.value] || 'black',
          fontWeight: 'bold'
        }}>
          {params.value}
        </span>
      )
    }
  },
  { field: 'createdAt', headerName: 'Created', width: 120 },
]

// Form fields configuration
const fields = [
  { name: 'name', label: 'Warehouse Name', type: 'text', required: true },
  { name: 'location', label: 'Location', type: 'text', required: true },
  { name: 'capacity', label: 'Capacity', type: 'number', required: false },
  { name: 'stock', label: 'Stock', type: 'number', required: false },
  { name: 'manager', label: 'Manager Name', type: 'text', required: true },
  { 
    name: 'status', 
    label: 'Status', 
    type: 'select', 
    required: true,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'inactive', label: 'Inactive' },
    ]
  },
]

function WarehousesPage() {
  const dispatch = useDispatch()
  const crud = useEntityCRUD('warehouses', 'warehouse')

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchWarehouses())
  }, [dispatch])

  // Handle CRUD operations
  const handleCreate = (data) => {
    dispatch(createWarehouse(data))
  }

  const handleUpdate = (data) => {
    dispatch(updateWarehouse({ id: crud.selectedEntity.id, data }))
  }

  const handleDelete = () => {
    dispatch(deleteWarehouse(crud.selectedEntity.id))
  }

  return (
    <ResponsiveLayout>
      <EntityTable
        data={crud.data}
        loading={crud.loading}
        columns={columns}
        title="Warehouses Management"
        entityName="Warehouse"
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
        validationSchema={warehouseSchema}
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

export default withAuth(WarehousesPage)
