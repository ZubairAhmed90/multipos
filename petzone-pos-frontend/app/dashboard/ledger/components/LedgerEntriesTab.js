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
  Paper,
  Card,
  CardContent,
  InputAdornment
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Clear as ClearIcon,
  Receipt as TransactionIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon
} from '@mui/icons-material'
import { DataGrid } from '@mui/x-data-grid'
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
      return `${parseFloat(value).toFixed(2)}`;
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
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
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
    setSearchTerm('')
    setFilters({
      accountId: '',
      type: '',
      startDate: '',
      endDate: ''
    })
  }

  // Filter entries based on search and filters
  const filteredEntries = useMemo(() => {
    if (!entries) return []
    
    return entries.filter(entry => {
      const matchesSearch = !searchTerm || 
        entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.account_name?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesAccount = !filters.accountId || entry.ledgerId === parseInt(filters.accountId)
      const matchesType = !filters.type || entry.type === filters.type
      
      // Date filtering
      let matchesDate = true
      if (filters.startDate || filters.endDate) {
        const entryDate = new Date(entry.date)
        if (filters.startDate) {
          const startDate = new Date(filters.startDate)
          matchesDate = matchesDate && entryDate >= startDate
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate)
          endDate.setHours(23, 59, 59, 999) // Include entire end date
          matchesDate = matchesDate && entryDate <= endDate
        }
      }
      
      return matchesSearch && matchesAccount && matchesType && matchesDate
    })
  }, [entries, searchTerm, filters])

  // Enhanced columns with actions
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { 
      field: 'date', 
      headerName: 'Date', 
      width: 120, 
      type: 'date',
      valueGetter: (params) => {
        if (!params || !params.value) return null;
        return new Date(params.value);
      },
      renderCell: (params) => {
        if (!params || !params.value) return 'N/A';
        return new Date(params.value).toLocaleDateString();
      }
    },
    { 
      field: 'type', 
      headerName: 'Type', 
      width: 100,
      renderCell: (params) => {
        if (!params || !params.value) return <Chip label="N/A" size="small" />
        return (
          <Chip 
            label={params.value} 
            color={params.value === 'DEBIT' ? 'success' : 'error'}
            size="small"
          />
        )
      }
    },
    { 
      field: 'amount', 
      headerName: 'Amount', 
      width: 120, 
      type: 'number', 
      renderCell: (params) => {
        if (!params) return '$0.00'
        const value = params.value;
        if (!value || isNaN(value)) return '$0.00';
        return `$${parseFloat(value).toFixed(2)}`;
      }
    },
    { field: 'description', headerName: 'Description', width: 250, flex: 1 },
    { field: 'reference', headerName: 'Reference', width: 120 },
    { field: 'reference_id', headerName: 'Ref. ID', width: 100 },
    { field: 'account_name', headerName: 'Account', width: 150 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => {
        if (!params || !params.row) return null
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Edit Entry">
              <IconButton
                size="small"
                onClick={() => handleEdit(params.row)}
                color="primary"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Entry">
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
          <TransactionIcon sx={{ fontSize: 30, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5">
              Transaction Entries
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage all ledger transactions
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            sx={{ textTransform: 'none' }}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            sx={{ textTransform: 'none' }}
          >
            Add Entry
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search transactions..."
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
          <Grid item xs={12} sm={6} md={2}>
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
                    {account.accountName || account.account_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
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
          <Grid item xs={12} sm={6} md={2}>
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
          <Grid item xs={12} sm={6} md={2}>
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
            startIcon={<ClearIcon />}
            onClick={clearFilters}
            sx={{ textTransform: 'none' }}
          >
            Clear Filters
          </Button>
        </Box>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Entries
              </Typography>
              <Typography variant="h4">
                {filteredEntries.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Debits
              </Typography>
              <Typography variant="h4" color="success.main">
                ${filteredEntries
                  .filter(entry => entry.type === 'DEBIT')
                  .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0)
                  .toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Credits
              </Typography>
              <Typography variant="h4" color="error.main">
                ${filteredEntries
                  .filter(entry => entry.type === 'CREDIT')
                  .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0)
                  .toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Net Balance
              </Typography>
              <Typography variant="h4" color="info.main">
                ${(filteredEntries
                  .filter(entry => entry.type === 'DEBIT')
                  .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0) -
                  filteredEntries
                  .filter(entry => entry.type === 'CREDIT')
                  .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0)
                ).toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {entriesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {entriesError}
        </Alert>
      )}

      {/* DataGrid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredEntries}
          columns={columns}
          loading={entriesLoading}
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
