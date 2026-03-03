'use client'

import React, { useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  InputAdornment,
  Grid,
  Card,
  CardContent
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  AccountBalance as AccountIcon
} from '@mui/icons-material'
import { DataGrid } from '@mui/x-data-grid'
import EntityFormDialog from '../../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../../components/crud/ConfirmationDialog'
import {
  fetchLedgerAccounts,
  createLedgerAccount,
  updateLedgerAccount,
  deleteLedgerAccount,
  setSelectedAccount
} from '../../../store/slices/ledgerSlice'

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
      if (!value || isNaN(value)) return '$0.00';
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
    placeholder: 'e.g., Cash Account, Accounts Receivable'
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

function LedgerAccountsTab() {
  const dispatch = useDispatch()
  const { accounts, accountsLoading, accountsError } = useSelector((state) => state.ledger)
  
  const [formOpen, setFormOpen] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [selectedAccount, setLocalSelectedAccount] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

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
      status: data.status
    };

    if (isEdit) {
      dispatch(updateLedgerAccount({ id: selectedAccount.id, data: backendData }))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchLedgerAccounts())
            handleFormClose()
          }
        })
    } else {
      dispatch(createLedgerAccount(backendData))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchLedgerAccounts())
            handleFormClose()
          }
        })
    }
  }

  const handleConfirmDelete = () => {
    if (selectedAccount) {
      dispatch(deleteLedgerAccount(selectedAccount.id))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchLedgerAccounts())
            handleConfirmationClose()
          }
        })
    }
  }

  // Filter accounts based on search and filters
  const filteredAccounts = useMemo(() => {
    if (!accounts) return []
    
    return accounts.filter(account => {
      const accountName = account.accountName || account.account_name
      const description = account.description
      
      const matchesSearch = !searchTerm || 
        accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const accountType = account.accountType || account.account_type
      const status = account.status
      
      const matchesType = !accountTypeFilter || accountType === accountTypeFilter
      const matchesStatus = !statusFilter || status === statusFilter
      
      return matchesSearch && matchesType && matchesStatus
    })
  }, [accounts, searchTerm, accountTypeFilter, statusFilter])

  const clearFilters = () => {
    setSearchTerm('')
    setAccountTypeFilter('')
    setStatusFilter('')
  }

  // Enhanced columns with actions
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { 
      field: 'accountName', 
      headerName: 'Account Name', 
      width: 200, 
      flex: 1,
      valueGetter: (params) => {
        if (!params || !params.row) return 'N/A'
        return params.row.accountName || params.row.account_name || 'N/A'
      }
    },
    { 
      field: 'accountType', 
      headerName: 'Type', 
      width: 120,
      valueGetter: (params) => {
        if (!params || !params.row) return 'N/A'
        return params.row.accountType || params.row.account_type || 'N/A'
      },
      renderCell: (params) => {
        if (!params || !params.row) return <Chip label="N/A" size="small" />
        const accountType = params.row.accountType || params.row.account_type
        return (
          <Chip 
            label={accountType?.toUpperCase() || 'N/A'} 
            color={accountType === 'asset' ? 'success' : 
                   accountType === 'liability' ? 'error' : 
                   accountType === 'equity' ? 'info' : 
                   accountType === 'revenue' ? 'warning' : 'default'}
            size="small"
          />
        )
      }
    },
    { 
      field: 'balance', 
      headerName: 'Balance', 
      width: 120, 
      type: 'number', 
      renderCell: (params) => {
        if (!params) return '$0.00'
        const value = params.value;
        if (!value || isNaN(value)) return '$0.00';
        return `$${parseFloat(value).toFixed(2)}`;
      }
    },
    { 
      field: 'description', 
      headerName: 'Description', 
      width: 250, 
      flex: 1,
      valueGetter: (params) => {
        if (!params || !params.row) return 'N/A'
        return params.row.description || 'N/A'
      }
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      valueGetter: (params) => {
        if (!params || !params.row) return 'N/A'
        return params.row.status || 'N/A'
      },
      renderCell: (params) => {
        if (!params) return <Chip label="N/A" size="small" />
        return (
          <Chip 
            label={params.value || 'N/A'} 
            color={params.value === 'ACTIVE' ? 'success' : 'error'}
            size="small"
          />
        )
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => {
        if (!params || !params.row) return null
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="View Transactions">
              <IconButton
                size="small"
                onClick={() => handleViewTransactions(params.row)}
                color="primary"
              >
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Account">
              <IconButton
                size="small"
                onClick={() => handleEdit(params.row)}
                color="primary"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Account">
              <IconButton
                size="small"
                onClick={() => handleDelete(params.row)}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )
      }
    }
  ]

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccountIcon sx={{ fontSize: 30, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5">
              Chart of Accounts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your accounting accounts and categories
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{ textTransform: 'none' }}
        >
          Add Account
        </Button>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Account Type</InputLabel>
              <Select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                label="Account Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="asset">Asset</MenuItem>
                <MenuItem value="liability">Liability</MenuItem>
                <MenuItem value="equity">Equity</MenuItem>
                <MenuItem value="revenue">Revenue</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={clearFilters}
              sx={{ textTransform: 'none' }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Accounts
              </Typography>
              <Typography variant="h4">
                {filteredAccounts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Active Accounts
              </Typography>
              <Typography variant="h4" color="success.main">
                {filteredAccounts.filter(acc => acc.status === 'ACTIVE').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Balance
              </Typography>
              <Typography variant="h4">
                ${filteredAccounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0).toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Asset Accounts
              </Typography>
              <Typography variant="h4" color="success.main">
                {filteredAccounts.filter(acc => acc.accountType === 'asset').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {accountsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {accountsError}
        </Alert>
      )}

      {/* DataGrid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredAccounts}
          columns={columns}
          loading={accountsLoading}
          pageSize={25}
          rowsPerPageOptions={[25, 50, 100]}
          disableSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #e0e0e0',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#f5f5f5',
              borderBottom: '2px solid #e0e0e0',
            },
          }}
        />
      </Paper>

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

export default LedgerAccountsTab
