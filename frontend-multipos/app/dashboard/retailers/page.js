'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../hooks/useEntityCRUD'
import { fetchRetailers, createRetailer, updateRetailer, deleteRetailer } from '../../store/slices/retailersSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchInvoiceDetails, updateInvoice, clearInvoiceDetails } from '../../store/slices/invoiceDetailsSlice'
import api from '../../../utils/axios'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material'
import {
  Add,
  Refresh,
  Store,
  TrendingUp,
  LocationOn,
  Phone,
  Email,
  AccountBalance,
} from '@mui/icons-material'
import * as yup from 'yup'

const RetailersPage = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: invoiceDetails, loading: invoiceLoading, updating: invoiceUpdating, error: invoiceError } = useSelector((state) => state.invoiceDetails)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  
  // Check permissions for warehouse keepers (like retailers management)
  const canManageRetailers = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseRetailerCRUD)
  
  const [filters, setFilters] = useState({
    status: 'all',
    location: 'all',
    search: ''
  })

  // Ledger dialog state
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [ledgerBalance, setLedgerBalance] = useState({ totalDebits: 0, totalCredits: 0, balance: 0 })
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // Invoice details dialog state
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [editFormData, setEditFormData] = useState({})

  const columns = [
    { 
      field: 'name', 
      headerName: 'Retailer Name', 
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            <Store />
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {params.value}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {params.row.business_type || 'No business type'}
            </Typography>
          </Box>
        </Box>
      )
    },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 150 },
    { 
      field: 'address', 
      headerName: 'Address', 
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocationOn fontSize="small" color="action" />
          <Typography variant="body2" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {params.value || 'No address'}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'unknown'} 
          color={params.value === 'active' ? 'success' : 'default'}
          size="small"
        />
      )
    },
    { 
      field: 'business_type', 
      headerName: 'Business Type', 
      width: 150,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'Unknown'} 
          color="info"
          size="small"
        />
      )
    },
    { 
      field: 'payment_terms', 
      headerName: 'Payment Terms', 
      width: 140,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'CASH'} 
          color={params.value === 'CASH' ? 'success' : 'warning'}
          size="small"
        />
      )
    },
    { 
      field: 'credit_limit', 
      headerName: 'Credit Limit', 
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {parseFloat(params.value || 0).toFixed(2)}
        </Typography>
      )
    },
    { 
      field: 'createdAt', 
      headerName: 'Created', 
      width: 120,
      renderCell: (params) => {
        if (!params.value) return 'Unknown';
        try {
          return new Date(params.value).toLocaleDateString();
        } catch (error) {
          return 'Invalid date';
        }
      }
    },
  ]

  const validationSchema = yup.object({
    name: yup.string().required('Retailer name is required'),
    email: yup.string().email('Invalid email').optional(),
    phone: yup.string().optional(),
    address: yup.string().optional(),
    city: yup.string().optional(),
    state: yup.string().optional(),
    zipCode: yup.string().optional(),
    businessType: yup.string().optional(),
    taxId: yup.string().optional(),
    creditLimit: yup.number().min(0).optional(),
    paymentTerms: yup.string().optional(),
    status: yup.string().required('Status is required'),
    notes: yup.string().optional(),
  })

  // Form fields configuration based on user role
  const getFormFields = (user) => {
    const baseFields = [
      { name: 'name', label: 'Retailer Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
      { name: 'phone', label: 'Phone', type: 'text', required: false },
      { name: 'address', label: 'Address', type: 'text', required: false },
      { name: 'city', label: 'City', type: 'text', required: false },
      { name: 'state', label: 'State', type: 'text', required: false },
      { name: 'zipCode', label: 'Zip Code', type: 'text', required: false },
      { name: 'businessType', label: 'Business Type', type: 'text', required: false },
      { name: 'taxId', label: 'Tax ID', type: 'text', required: false },
      { name: 'creditLimit', label: 'Credit Limit', type: 'number', required: false },
      { name: 'paymentTerms', label: 'Payment Terms', type: 'select', required: false, options: [
        { value: 'CASH', label: 'Cash' },
        { value: 'NET_15', label: 'Net 15' },
        { value: 'NET_30', label: 'Net 30' },
        { value: 'NET_45', label: 'Net 45' },
        { value: 'NET_60', label: 'Net 60' }
      ]},
      { name: 'notes', label: 'Notes', type: 'textarea', required: false },
      { 
        name: 'status', 
        label: 'Status', 
        type: 'select', 
        required: true,
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
          { value: 'SUSPENDED', label: 'Suspended' }
        ]
      },
    ]

    // Retailers are now warehouse-scoped, no additional scope fields needed

    return baseFields
  }

  const formFields = getFormFields(user)

  const {
    data: retailers,
    loading,
    error,
    formDialogOpen: openDialog,
    confirmationDialogOpen: openDeleteDialog,
    selectedEntity: editingEntity,
    selectedEntity: entityToDelete,
    handleAdd: handleCreate,
    handleEdit: handleUpdate,
    handleDeleteClick: handleDelete,
    handleFormClose,
    handleFormSubmit
  } = useEntityCRUD('retailers', 'retailer')

  // Load warehouse settings for permission checking
  useEffect(() => {
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }, [dispatch, user])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Ledger functions
  const handleViewLedger = async (company) => {
    setSelectedCompany(company)
    setLedgerDialogOpen(true)
    setLedgerLoading(true)
    
    try {
      // Get the API base URL
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'
      
      // Fetch ledger entries and balance
      const [entriesResponse, balanceResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/company-ledger/entries/${company.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${apiBaseUrl}/company-ledger/balance/${company.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        })
      ])
      
      if (entriesResponse.ok && balanceResponse.ok) {
        const entriesData = await entriesResponse.json()
        const balanceData = await balanceResponse.json()
        
        setLedgerEntries(entriesData.data || [])
        setLedgerBalance(balanceData.data || { totalDebits: 0, totalCredits: 0, balance: 0 })
      } else {
        setLedgerEntries([])
        setLedgerBalance({ totalDebits: 0, totalCredits: 0, balance: 0 })
      }
    } catch (error) {
      setLedgerEntries([])
      setLedgerBalance({ totalDebits: 0, totalCredits: 0, balance: 0 })
    } finally {
      setLedgerLoading(false)
    }
  }

  const handleCloseLedgerDialog = () => {
    setLedgerDialogOpen(false)
    setSelectedCompany(null)
    setLedgerEntries([])
    setLedgerBalance({ totalDebits: 0, totalCredits: 0, balance: 0 })
  }

  // Invoice details functions
  const handleViewInvoice = async (invoiceId) => {
    dispatch(fetchInvoiceDetails(invoiceId))
    setInvoiceDialogOpen(true)
  }

  const handleEditInvoice = () => {
    setEditingInvoice(true)
    setEditFormData({
      paymentMethod: invoiceDetails?.paymentMethod || '',
      paymentStatus: invoiceDetails?.paymentStatus || '',
      notes: invoiceDetails?.notes || ''
    })
  }

  const handleSaveInvoice = async () => {
    if (!invoiceDetails?.id) return
    
    try {
      await dispatch(updateInvoice({
        invoiceId: invoiceDetails.id,
        updateData: editFormData
      })).unwrap()
      
      setEditingInvoice(false)
      // Refresh invoice details
      dispatch(fetchInvoiceDetails(invoiceDetails.id))
    } catch (error) {
    }
  }

  const handleCloseInvoiceDialog = () => {
    setInvoiceDialogOpen(false)
    setEditingInvoice(false)
    setEditFormData({})
    dispatch(clearInvoiceDetails())
  }

  // Load retailers data on component mount
  useEffect(() => {
    dispatch(fetchRetailers())
    
    // Load warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }, [dispatch, user?.role, user?.warehouseId])

  // Handle refresh - fetch retailers data again
  const handleRefresh = () => {
    dispatch(fetchRetailers())
    
    // Reload warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }

  const getRetailerStats = () => {
    if (!retailers || !Array.isArray(retailers)) {
      return { total: 0, active: 0, inactive: 0, warehouse: 0, branch: 0 }
    }
    
    const total = retailers.length
    const active = retailers.filter(r => r.status === 'active').length
    const inactive = retailers.filter(r => r.status === 'inactive').length
    const warehouse = retailers.filter(r => r.scopeType === 'WAREHOUSE').length
    const branch = retailers.filter(r => r.scopeType === 'BRANCH').length

    return { total, active, inactive, warehouse, branch }
  }

  const stats = getRetailerStats()

  return (
    <DashboardLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
          <Typography variant="h4" gutterBottom>
            Retailers Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Manage retailer accounts and relationships
            </Typography>
          </Box>
          {canManageRetailers && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreate}
              >
                Add Company
              </Button>
            </Box>
          )}
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Total Companies
                    </Typography>
                    <Typography variant="h4">
                      {stats.total}
                    </Typography>
                  </Box>
                  <Store sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Active
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {stats.active}
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Inactive
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {stats.inactive}
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: 'error.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Warehouse
                    </Typography>
                    <Typography variant="h4" color="info.main">
                      {stats.warehouse}
                    </Typography>
                  </Box>
                  <Store sx={{ fontSize: 40, color: 'info.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Branch
                    </Typography>
                    <Typography variant="h4" color="secondary.main">
                      {stats.branch}
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: 'secondary.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Search Companies"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Scope Type</InputLabel>
            <Select
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              label="Scope Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
              <MenuItem value="BRANCH">Branch</MenuItem>
              <MenuItem value="COMPANY">Company</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Retailers Table */}
        <EntityTable
          data={retailers}
          columns={columns}
          loading={loading}
          error={error}
          onEdit={canManageRetailers ? handleUpdate : undefined}
          onDelete={canManageRetailers ? handleDelete : undefined}
          onAdd={canManageRetailers ? handleCreate : undefined}
          onRefresh={canManageRetailers ? handleRefresh : undefined}
          entityName="Retailer"
          title="Retailers"
          showAddButton={canManageRetailers}
          showActions={canManageRetailers}
          showToolbar={canManageRetailers}
          customActions={[
            {
              icon: <AccountBalance />,
              label: "View Ledger",
              onClick: handleViewLedger,
              color: "info"
            }
          ]}
        />

        {/* Form Dialog */}
        <EntityFormDialog
          open={openDialog}
          onClose={handleFormClose}
          entity={editingEntity}
          onSubmit={async (formData) => {
            // Retailers are now warehouse-scoped, add warehouse_id for warehouse keepers
            const retailerData = {
              ...formData,
              status: 'ACTIVE',
              // Add warehouse_id for warehouse keepers
              ...(user?.role === 'WAREHOUSE_KEEPER' && { warehouseId: user.warehouseId })
            }
            
            try {
              const result = await dispatch(createRetailer(retailerData))
              
              if (createRetailer.fulfilled.match(result)) {
                handleFormClose()
                // Refresh the retailers list
                dispatch(fetchRetailers())
              } else if (createRetailer.rejected.match(result)) {
              }
            } catch (error) {
            }
          }}
          loading={loading}
          title={editingEntity ? 'Edit Retailer' : 'Add New Retailer'}
          fields={formFields}
          validationSchema={validationSchema}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={openDeleteDialog}
          onClose={() => {
            setOpenDeleteDialog(false)
            setEntityToDelete(null)
          }}
          onConfirm={handleDelete}
          title="Delete Company"
          message={`Are you sure you want to delete company ${entityToDelete?.name}?`}
          loading={loading}
        />

        {/* Company Ledger Dialog */}
        <Dialog 
          open={ledgerDialogOpen} 
          onClose={handleCloseLedgerDialog}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalance />
              <Typography variant="h6">
                Ledger - {selectedCompany?.name}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            {ledgerLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                {/* Balance Summary */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={4}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Total Credits
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {ledgerBalance.totalCredits?.toLocaleString() || '0'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={4}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Total Debits
                        </Typography>
                        <Typography variant="h6" color="error.main">
                          {ledgerBalance.totalDebits?.toLocaleString() || '0'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={4}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Current Balance
                        </Typography>
                        <Typography 
                          variant="h6" 
                          color={ledgerBalance.balance >= 0 ? 'success.main' : 'error.main'}
                        >
                          {ledgerBalance.balance?.toLocaleString() || '0'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Ledger Entries Table */}
                <Typography variant="h6" gutterBottom>
                  Transaction History
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ledgerEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="textSecondary">
                              No ledger entries found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        ledgerEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={entry.type} 
                                color={entry.type === 'CREDIT' ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const description = entry.description || ''
                                // Extract invoice number from description (e.g., "Invoice #7")
                                const invoiceMatch = description.match(/Invoice #(\d+)/)
                                if (invoiceMatch) {
                                  const invoiceId = invoiceMatch[1]
                                  return (
                                    <Box>
                                      <Typography variant="body2" component="span">
                                        {description.replace(/Invoice #\d+/, '')}
                                      </Typography>
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => handleViewInvoice(invoiceId)}
                                        sx={{ ml: 1, minWidth: 'auto', px: 1 }}
                                      >
                                        Invoice #{invoiceId}
                                      </Button>
                                    </Box>
                                  )
                                }
                                return description
                              })()}
                            </TableCell>
                            <TableCell>{entry.reference}</TableCell>
                            <TableCell align="right">
                              <Typography 
                                color={entry.type === 'CREDIT' ? 'success.main' : 'error.main'}
                                fontWeight="bold"
                              >
                                {entry.amount?.toLocaleString() || '0'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseLedgerDialog}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Invoice Details Dialog */}
        <Dialog 
          open={invoiceDialogOpen} 
          onClose={handleCloseInvoiceDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Invoice Details
              </Typography>
              {!editingInvoice && (
                <Button
                  variant="outlined"
                  onClick={handleEditInvoice}
                  disabled={invoiceLoading}
                >
                  Edit
                </Button>
              )}
            </Box>
          </DialogTitle>
          <DialogContent>
            {invoiceLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : invoiceDetails ? (
              <Box>
                {/* Invoice Header */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="h6" gutterBottom>
                      {invoiceDetails.invoiceNo}
                    </Typography>
                    <Typography color="textSecondary">
                      Date: {new Date(invoiceDetails.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography color="textSecondary">
                      Created by: {invoiceDetails.createdBy?.username}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" color="primary">
                        {invoiceDetails.total?.toLocaleString()}
                      </Typography>
                      <Chip 
                        label={invoiceDetails.paymentStatus} 
                        color={invoiceDetails.paymentStatus === 'COMPLETED' ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                  </Grid>
                </Grid>

                {/* Payment Information */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Payment Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Payment Method
                        </Typography>
                        {editingInvoice ? (
                          <FormControl fullWidth size="small">
                            <Select
                              value={editFormData.paymentMethod}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                            >
                              <MenuItem value="CASH">Cash</MenuItem>
                              <MenuItem value="CARD">Card</MenuItem>
                              <MenuItem value="CREDIT">Credit</MenuItem>
                              <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                              <MenuItem value="CHEQUE">Cheque</MenuItem>
                              <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography variant="body1">
                            {invoiceDetails.paymentMethod}
                          </Typography>
                        )}
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Payment Status
                        </Typography>
                        {editingInvoice ? (
                          <FormControl fullWidth size="small">
                            <Select
                              value={editFormData.paymentStatus}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, paymentStatus: e.target.value }))}
                            >
                              <MenuItem value="PENDING">Pending</MenuItem>
                              <MenuItem value="COMPLETED">Completed</MenuItem>
                              <MenuItem value="FAILED">Failed</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Chip 
                            label={invoiceDetails.paymentStatus} 
                            color={invoiceDetails.paymentStatus === 'COMPLETED' ? 'success' : 'warning'}
                            size="small"
                          />
                        )}
                      </Grid>
                    </Grid>
                    {editingInvoice && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          Notes
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          value={editFormData.notes}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                          size="small"
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {/* Items */}
                <Typography variant="h6" gutterBottom>
                  Items Sold
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invoiceDetails.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {item.itemName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {item.category}
                            </Typography>
                          </TableCell>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{item.unitPrice?.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold">
                              {item.total?.toFixed(2)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Totals */}
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Typography variant="body2" color="textSecondary">
                    Subtotal: {invoiceDetails.subtotal?.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Tax: {invoiceDetails.tax?.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Discount: {invoiceDetails.discount?.toFixed(2)}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    Total: {invoiceDetails.total?.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Typography color="textSecondary">
                No invoice details available
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            {editingInvoice ? (
              <>
                <Button onClick={() => setEditingInvoice(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveInvoice}
                  variant="contained"
                  disabled={invoiceUpdating}
                >
                  {invoiceUpdating ? <CircularProgress size={20} /> : 'Save'}
                </Button>
              </>
            ) : (
              <Button onClick={handleCloseInvoiceDialog}>
                Close
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}

export default RetailersPage
