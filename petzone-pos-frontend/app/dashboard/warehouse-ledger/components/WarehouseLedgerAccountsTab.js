'use client'

import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import * as yup from 'yup'
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon
} from '@mui/icons-material'
import EntityTable from '../../../../components/crud/EntityTable'
import EntityFormDialog from '../../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../../components/crud/ConfirmationDialog'
import {
  fetchWarehouseLedgerAccounts,
  createWarehouseLedgerAccount,
  updateWarehouseLedgerAccount,
  deleteWarehouseLedgerAccount,
  setSelectedAccount
} from '../../../store/slices/warehouseLedgerSlice'

// Validation schema
const accountSchema = yup.object({
  accountName: yup.string().required('Account name is required'),
  accountType: yup.string().required('Account type is required'),
  balance: yup.number().min(0, 'Balance cannot be negative').required('Balance is required'),
  description: yup.string().required('Description is required'),
  status: yup.string().required('Status is required'),
})

// Table columns
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'accountName', headerName: 'Account Name', width: 200 },
  { 
    field: 'accountType', 
    headerName: 'Type', 
    width: 120,
    renderCell: (params) => (
      <Chip 
        label={params.value} 
        color={params.value === 'asset' ? 'success' : 
               params.value === 'liability' ? 'error' : 
               params.value === 'equity' ? 'info' : 
               params.value === 'revenue' ? 'warning' : 'default'}
        size="small"
      />
    )
  },
  { 
    field: 'balance', 
    headerName: 'Balance', 
    width: 120, 
    type: 'number', 
    renderCell: (params) => {
      const value = params.value;
      if (!value || isNaN(value)) return '0.00';
      return `${parseFloat(value).toFixed(2)}`;
    }
  },
  { field: 'description', headerName: 'Description', width: 250 },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 120,
    renderCell: (params) => (
      <Chip 
        label={params.value} 
        color={params.value === 'ACTIVE' ? 'success' : 'error'}
        size="small"
      />
    )
  }
]

// Form fields
const fields = [
  { 
    name: 'accountName', 
    label: 'Account Name', 
    type: 'text', 
    required: true,
    placeholder: 'e.g., Warehouse Cash Account, Accounts Receivable'
  },
  { 
    name: 'accountType', 
    label: 'Account Type', 
    type: 'select', 
    required: true,
    options: [
      { value: 'asset', label: 'Asset' },
      { value: 'liability', label: 'Liability' },
      { value: 'equity', label: 'Equity' },
      { value: 'revenue', label: 'Revenue' },
      { value: 'expense', label: 'Expense' },
    ]
  },
  { 
    name: 'balance', 
    label: 'Opening Balance', 
    type: 'number', 
    required: true, 
    step: 0.01,
    placeholder: '0.00'
  },
  { 
    name: 'description', 
    label: 'Description', 
    type: 'textarea', 
    required: true,
    placeholder: 'Account description and purpose'
  },
  { 
    name: 'status', 
    label: 'Status', 
    type: 'select', 
    required: true,
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'INACTIVE', label: 'Inactive' },
    ]
  }
]

function WarehouseLedgerAccountsTab({ warehouseId }) {
  const dispatch = useDispatch()
  const { accounts, accountsLoading, accountsError } = useSelector((state) => state.warehouseLedger)
  const { user } = useSelector((state) => state.auth)
  const { warehouseSettings } = useSelector((state) => state.warehouses)
  
  
  const [formOpen, setFormOpen] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [selectedAccount, setLocalSelectedAccount] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  // Check if user has permission to edit ledger
  const canEditLedger = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseLedgerEdit)

  const handleAdd = () => {
    setLocalSelectedAccount(null)
    setIsEdit(false)
    setFormOpen(true)
  }

  const handleEdit = (account) => {
    setLocalSelectedAccount(account)
    setIsEdit(true)
    setFormOpen(true)
  }

  const handleDelete = (account) => {
    setLocalSelectedAccount(account)
    setConfirmationOpen(true)
  }

  const handleViewTransactions = (account) => {
    dispatch(setSelectedAccount(account))
    // This will be handled by the parent component to switch tabs
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setLocalSelectedAccount(null)
    setIsEdit(false)
  }

  const handleConfirmationClose = () => {
    setConfirmationOpen(false)
    setLocalSelectedAccount(null)
  }

  const handleSubmit = (data) => {
    // Transform camelCase to snake_case for backend
    const backendData = {
      account_name: data.accountName,
      account_type: data.accountType,
      balance: data.balance,
      description: data.description,
      status: data.status,
      warehouse_id: warehouseId
    };

    if (isEdit) {
      dispatch(updateWarehouseLedgerAccount({ id: selectedAccount.id, data: backendData }))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchWarehouseLedgerAccounts({ warehouseId }))
            handleFormClose()
          }
        })
    } else {
      dispatch(createWarehouseLedgerAccount(backendData))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchWarehouseLedgerAccounts({ warehouseId }))
            handleFormClose()
          }
        })
    }
  }

  const handleConfirmDelete = () => {
    if (selectedAccount) {
      dispatch(deleteWarehouseLedgerAccount(selectedAccount.id))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchWarehouseLedgerAccounts({ warehouseId }))
            handleConfirmationClose()
          }
        })
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">
          Warehouse Chart of Accounts
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Manage accounting accounts for this warehouse
        </Typography>
      </Box>

      {!canEditLedger && user?.role === 'WAREHOUSE_KEEPER' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            You have view-only access to the warehouse ledger. Contact your administrator to enable editing permissions.
          </Typography>
        </Alert>
      )}

      <EntityTable
        data={accounts}
        loading={accountsLoading}
        columns={columns}
        title=""
        entityName="Account"
        onAdd={canEditLedger ? handleAdd : null}
        onEdit={canEditLedger ? handleEdit : null}
        onDelete={canEditLedger ? handleDelete : null}
        onView={handleViewTransactions}
        error={accountsError}
      />

      <EntityFormDialog
        open={formOpen}
        onClose={handleFormClose}
        title={isEdit ? 'Edit Account' : 'Add New Account'}
        fields={fields}
        validationSchema={accountSchema}
        initialData={selectedAccount}
        isEdit={isEdit}
        onSubmit={handleSubmit}
        loading={accountsLoading}
        error={accountsError}
      />

      <ConfirmationDialog
        open={confirmationOpen}
        onClose={handleConfirmationClose}
        title="Delete Account"
        message={`Are you sure you want to delete "${selectedAccount?.accountName}"? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        loading={accountsLoading}
        severity="error"
      />
    </Box>
  )
}

export default WarehouseLedgerAccountsTab
