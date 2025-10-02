'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Paper
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import EntityTable from '../../../../components/crud/EntityTable'
import EntityFormDialog from '../../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../../components/crud/ConfirmationDialog'
import {
  fetchLedgerEntries,
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  setSelectedEntry
} from '../../../store/slices/ledgerSlice'

// Validation schema
const entrySchema = yup.object({
  type: yup.string().required('Transaction type is required'),
  amount: yup.number().min(0.01, 'Amount must be greater than 0').required('Amount is required'),
  description: yup.string().required('Description is required'),
  reference: yup.string().optional(),
  reference_id: yup.string().optional(),
})

// Table columns
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { 
    field: 'date', 
    headerName: 'Date', 
    width: 120, 
    type: 'date',
    valueGetter: (params) => {
      if (!params.value) return null;
      return new Date(params.value);
    }
  },
  { 
    field: 'type', 
    headerName: 'Type', 
    width: 100,
    renderCell: (params) => (
      <Chip 
        label={params.value} 
        color={params.value === 'DEBIT' ? 'success' : 'error'}
        size="small"
      />
    )
  },
  { 
    field: 'amount', 
    headerName: 'Amount', 
    width: 120, 
    type: 'number', 
    renderCell: (params) => {
      const value = params.value;
      if (!value || isNaN(value)) return '$0.00';
      return `$${parseFloat(value).toFixed(2)}`;
    }
  },
  { field: 'description', headerName: 'Description', width: 250 },
  { field: 'reference', headerName: 'Reference', width: 120 },
  { field: 'reference_id', headerName: 'Ref. ID', width: 100 },
  { field: 'account_name', headerName: 'Account', width: 150 }
]

// Form fields
const fields = [
  { 
    name: 'type', 
    label: 'Transaction Type', 
    type: 'select', 
    required: true,
    options: [
      { value: 'DEBIT', label: 'Debit (Increase Asset/Expense)' },
      { value: 'CREDIT', label: 'Credit (Increase Liability/Revenue)' },
    ]
  },
  { 
    name: 'amount', 
    label: 'Amount', 
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
    placeholder: 'Transaction description'
  },
  { 
    name: 'reference', 
    label: 'Reference', 
    type: 'text', 
    required: false,
    placeholder: 'e.g., Invoice, Receipt, Payment'
  },
  { 
    name: 'reference_id', 
    label: 'Reference ID', 
    type: 'text', 
    required: false,
    placeholder: 'e.g., INV-001, RCP-123'
  }
]

function LedgerEntriesTab() {
  const dispatch = useDispatch()
  const { 
    entries, 
    entriesLoading, 
    entriesError,
    accounts,
    selectedAccount 
  } = useSelector((state) => state.ledger)
  
  const [formOpen, setFormOpen] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState({
    accountId: '',
    type: '',
    startDate: '',
    endDate: ''
  })

  // Memoize filter params to prevent infinite loops
  const filterParams = useMemo(() => {
    const params = {}
    if (filters.accountId) params.ledgerId = filters.accountId
    if (filters.type) params.type = filters.type
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate
    return params
  }, [filters.accountId, filters.type, filters.startDate, filters.endDate])

  // Load entries when filters change
  useEffect(() => {
    dispatch(fetchLedgerEntries(filterParams))
  }, [dispatch, filterParams])

  const handleAdd = () => {
    setSelectedEntry(null)
    setIsEdit(false)
    setFormOpen(true)
  }

  const handleEdit = (entry) => {
    setSelectedEntry(entry)
    setIsEdit(true)
    setFormOpen(true)
  }

  const handleDelete = (entry) => {
    setSelectedEntry(entry)
    setConfirmationOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setSelectedEntry(null)
    setIsEdit(false)
  }

  const handleConfirmationClose = () => {
    setConfirmationOpen(false)
    setSelectedEntry(null)
  }

  const handleSubmit = (data) => {
    if (isEdit) {
      dispatch(updateLedgerEntry({ id: selectedEntry.id, data }))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchLedgerEntries(filters))
            handleFormClose()
          }
        })
    } else {
      // For new entries, we need to determine which account to add to
      const entryData = {
        ...data,
        ledgerId: filters.accountId || accounts[0]?.id,
        scopeType: 'COMPANY',
        scopeId: 1,
        partyType: 'ACCOUNT',
        partyId: filters.accountId || accounts[0]?.id
      }
      
      dispatch(createLedgerEntry(entryData))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchLedgerEntries(filters))
            handleFormClose()
          }
        })
    }
  }

  const handleConfirmDelete = () => {
    if (selectedEntry) {
      dispatch(deleteLedgerEntry(selectedEntry.id))
        .then((result) => {
          if (result.type.endsWith('/fulfilled')) {
            dispatch(fetchLedgerEntries(filters))
            handleConfirmationClose()
          }
        })
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setFilters({
      accountId: '',
      type: '',
      startDate: '',
      endDate: ''
    })
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">
          Transaction Entries
        </Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Account</InputLabel>
              <Select
                value={filters.accountId}
                onChange={(e) => handleFilterChange('accountId', e.target.value)}
                label="Account"
              >
                <MenuItem value="">All Accounts</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.accountName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                label="Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="DEBIT">Debit</MenuItem>
                <MenuItem value="CREDIT">Credit</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            onClick={clearFilters}
            sx={{ textTransform: 'none' }}
          >
            Clear Filters
          </Button>
        </Box>
      </Paper>

      {entriesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {entriesError}
        </Alert>
      )}

      <EntityTable
        data={entries?.filter(entry => entry && entry.id) || []}
        loading={entriesLoading}
        columns={columns}
        title=""
        entityName="Entry"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        error={entriesError}
      />

      <EntityFormDialog
        open={formOpen}
        onClose={handleFormClose}
        title={isEdit ? 'Edit Entry' : 'Add New Entry'}
        fields={fields}
        validationSchema={entrySchema}
        initialData={selectedEntry}
        isEdit={isEdit}
        onSubmit={handleSubmit}
        loading={entriesLoading}
        error={entriesError}
      />

      <ConfirmationDialog
        open={confirmationOpen}
        onClose={handleConfirmationClose}
        title="Delete Entry"
        message={`Are you sure you want to delete this entry? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        loading={entriesLoading}
        severity="error"
      />
    </Box>
  )
}

export default LedgerEntriesTab
