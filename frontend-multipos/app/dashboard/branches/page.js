'use client'

import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as yup from 'yup'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../hooks/useEntityCRUD'
import { fetchBranches, createBranch, updateBranch, deleteBranch } from '../../store/slices/branchesSlice'

// Validation schema
const branchSchema = yup.object({
  name: yup.string().required('Branch name is required'),
  code: yup.string().required('Branch code is required'),
  location: yup.string().required('Location is required'),
  phone: yup.string().nullable(),
  email: yup.string().nullable().test('email', 'Invalid email format', function(value) {
    if (!value || value.trim() === '') {
      return true; // Allow empty or null values
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }),
  managerName: yup.string().nullable(),
  managerPhone: yup.string().nullable(),
  managerEmail: yup.string().nullable().test('email', 'Invalid email format', function(value) {
    if (!value || value.trim() === '') {
      return true; // Allow empty or null values
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }),
  linkedWarehouseId: yup.number().nullable().transform((value, originalValue) => {
    if (originalValue === '' || originalValue === null || originalValue === undefined) {
      return null;
    }
    const num = Number(originalValue);
    return isNaN(num) ? null : num;
  }),
  status: yup.string().oneOf(['active', 'inactive', 'maintenance']).default('active')
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Branch Name', width: 200 },
  { field: 'code', headerName: 'Code', width: 100 },
  { field: 'location', headerName: 'Location', width: 200 },
  { field: 'phone', headerName: 'Phone', width: 120 },
  { field: 'email', headerName: 'Email', width: 150 },
  { field: 'managerName', headerName: 'Manager', width: 120 },
  { field: 'status', headerName: 'Status', width: 100 },
  { field: 'created_at', headerName: 'Created', width: 150 },
]

// Form fields configuration
const fields = [
  { name: 'name', label: 'Branch Name', type: 'text', required: true },
  { name: 'code', label: 'Branch Code', type: 'text', required: true },
  { name: 'location', label: 'Location', type: 'textarea', required: true },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'managerName', label: 'Manager Name', type: 'text' },
  { name: 'managerPhone', label: 'Manager Phone', type: 'tel' },
  { name: 'managerEmail', label: 'Manager Email', type: 'email' },
  { name: 'linkedWarehouseId', label: 'Linked Warehouse ID', type: 'number' },
  { 
    name: 'status', 
    label: 'Status', 
    type: 'select', 
    defaultValue: 'active',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'maintenance', label: 'Maintenance' }
    ]
  },
]

function BranchesPage() {
  const dispatch = useDispatch()
  const crud = useEntityCRUD('branches', 'branch')

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchBranches())
  }, [dispatch])

  // Handle CRUD operations
  const handleCreate = (data) => {
    dispatch(createBranch(data)).then(() => {
      // Close modal after successful creation
      crud.handleFormClose()
    })
  }

  const handleUpdate = (data) => {
    dispatch(updateBranch({ branchId: crud.selectedEntity.id, branchData: data })).then(() => {
      // Close modal after successful update
      crud.handleFormClose()
    })
  }

  const handleDelete = () => {
    dispatch(deleteBranch(crud.selectedEntity.id)).then(() => {
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
    dispatch(fetchBranches())
  }

  return (
    <DashboardLayout>
      <EntityTable
        data={crud.data}
        loading={crud.loading}
        columns={columns}
        title="Branches Management"
        entityName="Branch"
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
        validationSchema={branchSchema}
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
  )
}

export default BranchesPage
