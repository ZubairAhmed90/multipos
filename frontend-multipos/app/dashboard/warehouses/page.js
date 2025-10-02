'use client'

import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as yup from 'yup'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../hooks/useEntityCRUD'
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../../store/slices/warehousesSlice'

// Validation schema
const warehouseSchema = yup.object({
  name: yup.string().required('Warehouse name is required'),
  code: yup.string().required('Warehouse code is required'),
  location: yup.string().required('Location is required'),
  capacity: yup.number().required('Capacity is required').min(1, 'Capacity must be greater than 0'),
  stock: yup.number().required('Stock is required').min(0, 'Stock must be 0 or greater'),
  manager: yup.string().required('Manager name is required'),
  status: yup.string().required('Status is required')
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Warehouse Name', width: 200 },
  { field: 'location', headerName: 'Location', width: 150 },
  { field: 'capacity', headerName: 'Capacity', width: 100, type: 'number' },
  { field: 'stock', headerName: 'Stock', width: 100, type: 'number' },
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
  { 
    field: 'settings', 
    headerName: 'Settings', 
    width: 150,
    renderCell: (params) => {
      const settings = params.row.settings
      if (!settings) return 'Default'
      
      const enabledCount = Object.values(settings).filter(Boolean).length
      const totalCount = Object.keys(settings).length
      
      return `${enabledCount}/${totalCount} enabled`
    }
  },
  { field: 'createdAt', headerName: 'Created', width: 120 },
]

// Form fields configuration
const fields = [
  { name: 'name', label: 'Warehouse Name', type: 'text', required: true },
  { name: 'code', label: 'Warehouse Code', type: 'text', required: true },
  { name: 'location', label: 'Location', type: 'text', required: true },
  { name: 'capacity', label: 'Capacity', type: 'number', required: true },
  { name: 'stock', label: 'Stock', type: 'number', required: true },
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
    dispatch(createWarehouse(data)).then(() => {
      // Close modal after successful creation
      crud.handleFormClose()
    })
  }

  const handleUpdate = (data) => {
    dispatch(updateWarehouse({ id: crud.selectedEntity.id, data })).then(() => {
      // Close modal after successful update
      crud.handleFormClose()
    })
  }

  const handleDelete = () => {
    dispatch(deleteWarehouse(crud.selectedEntity.id)).then(() => {
      // Close confirmation dialog after successful deletion
      crud.handleConfirmationClose()
    })
  }

  // Custom form submit handler that uses the correct thunk calls
  const handleFormSubmit = (formData) => {
    if (crud.isEdit) {
      handleUpdate(formData)
    } else {
      handleCreate(formData)
    }
  }

  // Refresh functionality
  const handleRefresh = () => {
    dispatch(fetchWarehouses())
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>
        <EntityTable
          data={crud.data}
          loading={crud.loading}
          columns={columns}
          title="Warehouses Management"
          entityName="Warehouse"
          onAdd={crud.handleAdd}
          onEdit={crud.handleEdit}
          onDelete={crud.handleDeleteClick}
          onRefresh={handleRefresh}
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
          onSubmit={handleFormSubmit}
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
      </DashboardLayout>
    </RouteGuard>
  )
}

export default WarehousesPage
