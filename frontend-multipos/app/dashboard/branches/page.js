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

// Validation schema - matches backend validation exactly
const branchSchema = yup.object({
  name: yup.string()
    .trim()
    .min(1, 'Branch name must be between 1 and 100 characters')
    .max(100, 'Branch name must be between 1 and 100 characters')
    .required('Branch name is required'),
  code: yup.string()
    .trim()
    .min(1, 'Branch code must be between 1 and 10 characters')
    .max(10, 'Branch code must be between 1 and 10 characters')
    .matches(/^[a-zA-Z0-9\-_]+$/, 'Branch code can only contain letters, numbers, hyphens, and underscores')
    .required('Branch code is required'),
  location: yup.string()
    .trim()
    .min(1, 'Location must be between 1 and 200 characters')
    .max(200, 'Location must be between 1 and 200 characters')
    .required('Location is required'),
  phone: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('phone-length', 'Phone must not exceed 20 characters', function(value) {
      if (!value || value.trim() === '') return true
      return value.length <= 20
    }),
  email: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('email-format', 'Email must be a valid email address', function(value) {
      if (!value || value.trim() === '') return true
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    }),
  managerName: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('manager-name-length', 'Manager name must not exceed 100 characters', function(value) {
      if (!value || value.trim() === '') return true
      return value.length <= 100
    }),
  managerPhone: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('manager-phone-length', 'Manager phone must not exceed 20 characters', function(value) {
      if (!value || value.trim() === '') return true
      return value.length <= 20
    }),
  managerEmail: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('manager-email-format', 'Manager email must be a valid email address', function(value) {
      if (!value || value.trim() === '') return true
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    }),
  linkedWarehouseId: yup.mixed()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      const num = parseInt(value)
      if (isNaN(num) || num < 1) {
        throw new yup.ValidationError('Linked warehouse ID must be a valid positive integer', value, 'linkedWarehouseId')
      }
      return num
    }),
  status: yup.string()
    .oneOf(['active', 'inactive', 'maintenance'], 'Status must be active, inactive, or maintenance')
    .nullable()
    .transform((value) => value === '' ? null : value),
  'settings.openAccount': yup.boolean()
    .nullable()
    .transform((value) => value === '' ? null : value),
  'settings.allowCashierInventoryEdit': yup.boolean()
    .nullable()
    .transform((value) => value === '' ? null : value),
  'settings.allowWarehouseInventoryEdit': yup.boolean()
    .nullable()
    .transform((value) => value === '' ? null : value),
  'settings.allowWarehouseKeeperCompanyAdd': yup.boolean()
    .nullable()
    .transform((value) => value === '' ? null : value),
  'settings.allowReturnsByCashier': yup.boolean()
    .nullable()
    .transform((value) => value === '' ? null : value),
  'settings.allowReturnsByWarehouseKeeper': yup.boolean()
    .nullable()
    .transform((value) => value === '' ? null : value),
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
