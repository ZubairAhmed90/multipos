'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography, 
  Box, 
  Alert,
  IconButton,
  Tooltip
} from '@mui/material'
import { 
  VpnKey as ResetPasswordIcon, 
  Visibility as ViewPasswordIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material'
import withAuth from '../../../../components/auth/withAuth'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import EntityTable from '../../../../components/crud/EntityTable'
import EntityFormDialog from '../../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../../hooks/useEntityCRUD'
import { fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, resetUserPassword, getUserPassword, clearPasswordResetResult, clearPasswordInfo } from '../../../store/slices/adminUsersSlice'
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
  const { passwordResetResult, passwordInfo, loading: adminUsersLoading } = useSelector((state) => state.adminUsers)

  // Password management state
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [viewPasswordDialogOpen, setViewPasswordDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Password management functions
  const handleResetPassword = (user) => {
    setSelectedUser(user)
    setNewPassword('')
    setPasswordError('')
    setResetPasswordDialogOpen(true)
  }

  const handleViewPassword = (user) => {
    setSelectedUser(user)
    setViewPasswordDialogOpen(true)
    dispatch(getUserPassword(user.id))
  }

  const handleResetPasswordSubmit = () => {
    if (!newPassword) {
      setPasswordError('Password is required')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
    if (!passwordRegex.test(newPassword)) {
      setPasswordError('Password must contain at least one lowercase letter, one uppercase letter, and one number')
      return
    }

    setPasswordError('')
    dispatch(resetUserPassword({ id: selectedUser.id, newPassword }))
  }

  const handleCopyPassword = (password) => {
    navigator.clipboard.writeText(password)
    // You could add a toast notification here
  }

  const handleCloseResetDialog = () => {
    setResetPasswordDialogOpen(false)
    setSelectedUser(null)
    setNewPassword('')
    setPasswordError('')
    dispatch(clearPasswordResetResult())
  }

  const handleCloseViewDialog = () => {
    setViewPasswordDialogOpen(false)
    setSelectedUser(null)
    dispatch(clearPasswordInfo())
  }

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

  // Define custom actions for password management
  const customActions = [
    {
      icon: <ResetPasswordIcon />,
      label: 'Reset Password',
      onClick: handleResetPassword,
      color: 'primary'
    },
    {
      icon: <ViewPasswordIcon />,
      label: 'View Password Info',
      onClick: handleViewPassword,
      color: 'secondary'
    }
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

  // Handle CRUD operations
  const handleCreate = (data) => {
    // Convert empty strings to null for optional fields
    const processedData = {
      ...data,
      branchId: data.branchId === '' ? null : (data.branchId ? parseInt(data.branchId) : null),
      warehouseId: data.warehouseId === '' ? null : (data.warehouseId ? parseInt(data.warehouseId) : null),
      shift: data.shift === '' ? null : data.shift
    }
    
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
    if (!crud.selectedEntity?.id) {
      console.error('Cannot update: selectedEntity.id is missing')
      return
    }
    
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
    if (!crud.selectedEntity?.id) {
      console.error('Cannot delete: selectedEntity.id is missing')
      return
    }
    
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
          customActions={customActions}
          error={crud.error}
        />

        <EntityFormDialog
          open={crud.formDialogOpen}
          onClose={crud.handleFormClose}
          title={crud.dialogTitle}
          fields={getFields(crud.isEdit)}
          validationSchema={crud.isEdit ? updateUserSchema : createUserSchema}
          initialData={crud.selectedEntity || {}}
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

        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordDialogOpen} onClose={handleCloseResetDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Reset Password for {selectedUser?.username}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={!!passwordError}
                helperText={passwordError || "Password must be at least 6 characters with uppercase, lowercase, and number"}
                margin="normal"
              />
              
              {passwordResetResult && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Password reset successfully!
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>New Password:</strong> {passwordResetResult.data?.newPassword}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<CopyIcon />}
                      onClick={() => handleCopyPassword(passwordResetResult.data?.newPassword)}
                      sx={{ mt: 1 }}
                    >
                      Copy Password
                    </Button>
                  </Box>
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseResetDialog}>Cancel</Button>
            <Button 
              onClick={handleResetPasswordSubmit} 
              variant="contained" 
              color="primary"
              disabled={adminUsersLoading}
            >
              Reset Password
            </Button>
          </DialogActions>
        </Dialog>

        {/* View Password Dialog */}
        <Dialog open={viewPasswordDialogOpen} onClose={handleCloseViewDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Password Information for {selectedUser?.username}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              {passwordInfo ? (
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Username:</strong> {passwordInfo.data?.username}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Email:</strong> {passwordInfo.data?.email}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Note:</strong> {passwordInfo.data?.note}
                  </Typography>
                </Alert>
              ) : (
                <Typography>Loading password information...</Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseViewDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(AdminUsersPage)
