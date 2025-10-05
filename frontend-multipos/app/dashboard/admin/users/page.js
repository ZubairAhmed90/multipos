'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import withAuth from '../../../../components/auth/withAuth'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import EntityTable from '../../../../components/crud/EntityTable'
import EntityFormDialog from '../../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../../hooks/useEntityCRUD'
import { fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../../store/slices/adminUsersSlice'
import { fetchAllBranches } from '../../../store/slices/branchesSlice'
import { fetchWarehouses } from '../../../store/slices/warehousesSlice'

// Validation schemas - matches backend validation exactly
const createUserSchema = yup.object({
  username: yup.string()
    .trim()
    .min(3, 'Username must be between 3 and 30 characters')
    .max(30, 'Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .required('Username is required'),
  email: yup.string()
    .email('Please provide a valid email address')
    .required('Email is required'),
  password: yup.string()
    .min(6, 'Password must be at least 6 characters long')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    )
    .required('Password is required'),
  role: yup.string()
    .oneOf(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'], 'Role must be ADMIN, WAREHOUSE_KEEPER, or CASHIER')
    .required('Role is required'),
  branchId: yup.mixed()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      const num = parseInt(value)
      if (isNaN(num) || num < 1) {
        throw new yup.ValidationError('Branch ID must be a valid positive integer', value, 'branchId')
      }
      return num
    }),
  warehouseId: yup.mixed()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      const num = parseInt(value)
      if (isNaN(num) || num < 1) {
        throw new yup.ValidationError('Warehouse ID must be a valid positive integer', value, 'warehouseId')
      }
      return num
    }),
  shift: yup.string()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      if (!['MORNING', 'AFTERNOON', 'NIGHT'].includes(value)) {
        throw new yup.ValidationError('Shift must be MORNING, AFTERNOON, or NIGHT', value, 'shift')
      }
      return value
    }),
})

const updateUserSchema = yup.object({
  username: yup.string()
    .trim()
    .min(3, 'Username must be between 3 and 30 characters')
    .max(30, 'Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .required('Username is required'),
  email: yup.string()
    .email('Please provide a valid email address')
    .required('Email is required'),
  role: yup.string()
    .oneOf(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'], 'Role must be ADMIN, WAREHOUSE_KEEPER, or CASHIER')
    .required('Role is required'),
  branchId: yup.mixed()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      const num = parseInt(value)
      if (isNaN(num) || num < 1) {
        throw new yup.ValidationError('Branch ID must be a valid positive integer', value, 'branchId')
      }
      return num
    }),
  warehouseId: yup.mixed()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      const num = parseInt(value)
      if (isNaN(num) || num < 1) {
        throw new yup.ValidationError('Warehouse ID must be a valid positive integer', value, 'warehouseId')
      }
      return num
    }),
  shift: yup.string()
    .nullable()
    .transform((value) => {
      if (value === '' || value === null || value === undefined) return null
      if (!['MORNING', 'AFTERNOON', 'NIGHT'].includes(value)) {
        throw new yup.ValidationError('Shift must be MORNING, AFTERNOON, or NIGHT', value, 'shift')
      }
      return value
    }),
})

function AdminUsersPage() {
  const dispatch = useDispatch()
  const crud = useEntityCRUD('adminUsers', 'admin user')
  
  // Get branches and warehouses from Redux store
  const { branches, loading: branchesLoading } = useSelector((state) => state.branches)
  const { data: warehouses, loading: warehousesLoading } = useSelector((state) => state.warehouses)

  // Create table columns with dynamic branch/warehouse names
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'username', headerName: 'Username', width: 150 },
    { field: 'email', headerName: 'Email', width: 250 },
    { field: 'role', headerName: 'Role', width: 150 },
    { 
      field: 'branch_name', 
      headerName: 'Branch', 
      width: 150,
      renderCell: (params) => {
        const branchName = params.row.branch_name
        const branchCode = params.row.branch_code
        return branchName ? `${branchName} (${branchCode})` : 'N/A'
      }
    },
    { 
      field: 'warehouse_name', 
      headerName: 'Warehouse', 
      width: 150,
      renderCell: (params) => {
        const warehouseName = params.row.warehouse_name
        const warehouseCode = params.row.warehouse_code
        return warehouseName ? `${warehouseName} (${warehouseCode})` : 'N/A'
      }
    },
    { field: 'shift', headerName: 'Shift', width: 100 },
    { field: 'createdAt', headerName: 'Created At', width: 180 },
  ]

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchAdminUsers())
    dispatch(fetchAllBranches())
    dispatch(fetchWarehouses())
  }, [dispatch])

  // Create dynamic form fields with branches and warehouses
  const getFields = (isEdit) => {
    const baseFields = [
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { 
        name: 'role', 
        label: 'Role', 
        type: 'select', 
        required: true,
        options: [
          { value: 'ADMIN', label: 'Admin' },
          { value: 'WAREHOUSE_KEEPER', label: 'Warehouse Keeper' },
          { value: 'CASHIER', label: 'Cashier' },
        ]
      },
      { 
        name: 'branchId', 
        label: 'Branch (Optional)', 
        type: 'select', 
        required: false,
        options: [
          { value: '', label: 'No Branch Assigned' },
          ...(branches?.map(branch => ({
            value: branch.id?.toString(),
            label: `${branch.name} (${branch.code})`
          })) || [])
        ]
      },
      { 
        name: 'warehouseId', 
        label: 'Warehouse (Optional)', 
        type: 'select', 
        required: false,
        options: [
          { value: '', label: 'No Warehouse Assigned' },
          ...(warehouses?.map(warehouse => ({
            value: warehouse.id?.toString(),
            label: `${warehouse.name} (${warehouse.code})`
          })) || [])
        ]
      },
      { 
        name: 'shift', 
        label: 'Shift (Optional)', 
        type: 'select', 
        required: false,
        options: [
          { value: '', label: 'No Shift Assigned' },
          { value: 'MORNING', label: 'Morning' },
          { value: 'AFTERNOON', label: 'Afternoon' },
          { value: 'NIGHT', label: 'Night' },
        ]
      },
    ]

    // Add password field only for create mode
    if (!isEdit) {
      baseFields.splice(2, 0, { name: 'password', label: 'Password', type: 'password', required: true })
    }

    return baseFields
  }

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchAdminUsers())
  }, [dispatch])

  // Handle CRUD operations
  const handleCreate = (data) => {
('handleCreate called with data:', data)
    // Convert empty strings to null for optional fields
    const processedData = {
      ...data,
      branchId: data.branchId === '' ? null : (data.branchId ? parseInt(data.branchId) : null),
      warehouseId: data.warehouseId === '' ? null : (data.warehouseId ? parseInt(data.warehouseId) : null),
      shift: data.shift === '' ? null : data.shift
    }
('processedData:', processedData)
    dispatch(createAdminUser(processedData)).then((result) => {
      if (result.type.endsWith('/fulfilled')) {
        // Refresh the user list after successful creation
        dispatch(fetchAdminUsers())
        // Close the form dialog
        crud.handleFormClose()
      }
    })
  }

  const handleUpdate = (data) => {
    // Convert empty strings to null for optional fields
    const processedData = {
      ...data,
      branchId: data.branchId === '' ? null : (data.branchId ? parseInt(data.branchId) : null),
      warehouseId: data.warehouseId === '' ? null : (data.warehouseId ? parseInt(data.warehouseId) : null),
      shift: data.shift === '' ? null : data.shift
    }
    
    // Password field is not included in edit mode, so no need to handle it
    
    dispatch(updateAdminUser({ id: crud.selectedEntity.id, data: processedData })).then((result) => {
      if (result.type.endsWith('/fulfilled')) {
        // Refresh the user list after successful update
        dispatch(fetchAdminUsers())
        // Close the form dialog
        crud.handleFormClose()
      }
    })
  }

  const handleDelete = () => {
    dispatch(deleteAdminUser(crud.selectedEntity.id)).then((result) => {
      if (result.type.endsWith('/fulfilled')) {
        // Refresh the user list after successful deletion
        dispatch(fetchAdminUsers())
        // Close the confirmation dialog
        crud.handleConfirmationClose()
      }
    })
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <EntityTable
          data={Array.isArray(crud.data) ? crud.data : []}
          loading={crud.loading}
          columns={columns}
          title="Admin Users Management"
          entityName="Admin User"
          onAdd={crud.handleAdd}
          onEdit={crud.handleEdit}
          onDelete={crud.handleDeleteClick}
          error={crud.error}
        />

        <EntityFormDialog
          open={crud.formDialogOpen}
          onClose={crud.handleFormClose}
          title={crud.dialogTitle}
          fields={getFields(crud.isEdit)}
          validationSchema={crud.isEdit ? updateUserSchema : createUserSchema}
          initialData={crud.selectedEntity}
          isEdit={crud.isEdit}
          onSubmit={crud.isEdit ? handleUpdate : handleCreate}
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

export default withAuth(AdminUsersPage)
