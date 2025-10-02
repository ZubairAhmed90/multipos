'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  InputAdornment,
} from '@mui/material'
import { Search, Business, BusinessCenter } from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../hooks/useEntityCRUD'
import { fetchCompanies, createCompany, updateCompany, deleteCompany } from '../../store/slices/companiesSlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'

// Validation schema
const companySchema = yup.object({
  name: yup.string().required('Company name is required'),
  code: yup.string().required('Company code is required'),
  contactPerson: yup.string().required('Contact person is required'),
  phone: yup.string().optional(),
  email: yup.string().email('Invalid email').optional(),
  address: yup.string().required('Address is required'),
  transactionType: yup.string().required('Transaction type is required'),
  scopeType: yup.string().required('Scope type is required'),
  scopeId: yup.number().required('Scope ID is required'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Company Name', width: 200 },
  { field: 'code', headerName: 'Code', width: 100 },
  { field: 'contactPerson', headerName: 'Contact Person', width: 150 },
  { field: 'phone', headerName: 'Phone', width: 120 },
  { field: 'email', headerName: 'Email', width: 180 },
  { field: 'status', headerName: 'Status', width: 100 },
  { field: 'address', headerName: 'Address', width: 200 },
  { field: 'transactionType', headerName: 'Transaction Type', width: 150 },
  { field: 'scopeType', headerName: 'Scope Type', width: 120 },
  { field: 'scopeId', headerName: 'Scope ID', width: 100 },
  { field: 'created_at', headerName: 'Created', width: 150 },
]

// Form fields configuration
const getFields = (user) => {
  return [
    { name: 'name', label: 'Company Name', type: 'text', required: true },
    { name: 'code', label: 'Company Code', type: 'text', required: true },
    { name: 'contactPerson', label: 'Contact Person', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'text', required: false },
    { name: 'email', label: 'Email', type: 'email', required: false },
    { name: 'address', label: 'Address', type: 'textarea', required: true },
    { 
      name: 'transactionType', 
      label: 'Transaction Type', 
      type: 'select', 
      required: true,
      defaultValue: 'CASH',
      options: [
        { value: 'CASH', label: 'Cash' },
        { value: 'CREDIT', label: 'Credit' },
        { value: 'DEBIT', label: 'Debit' },
      ]
    },
    // Scope fields based on user role
    ...(user?.role === 'ADMIN' ? [
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'select', 
        required: true,
        options: [
          { value: 'BRANCH', label: 'Branch' },
          { value: 'WAREHOUSE', label: 'Warehouse' },
        ]
      },
      { 
        name: 'scopeId', 
        label: 'Scope ID', 
        type: 'number', 
        required: true,
      }
    ] : user?.role === 'CASHIER' && user?.branchId ? [
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'text', 
        required: true,
        defaultValue: 'BRANCH',
        disabled: true
      },
      { 
        name: 'scopeId', 
        label: 'Branch ID', 
        type: 'number', 
        required: true,
        defaultValue: user.branchId,
        disabled: true
      }
    ] : user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId ? [
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'text', 
        required: true,
        defaultValue: 'WAREHOUSE',
        disabled: true
      },
      { 
        name: 'scopeId', 
        label: 'Warehouse ID', 
        type: 'number', 
        required: true,
        defaultValue: user.warehouseId,
        disabled: true
      }
    ] : [
      // Fallback for users without proper scope assignment
      { 
        name: 'scopeType', 
        label: 'Scope Type', 
        type: 'select', 
        required: true,
        options: [
          { value: 'BRANCH', label: 'Branch' },
          { value: 'WAREHOUSE', label: 'Warehouse' },
        ]
      },
      { 
        name: 'scopeId', 
        label: 'Scope ID', 
        type: 'number', 
        required: true,
      }
    ]),
  ]
}

function CompaniesPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  const crud = useEntityCRUD('companies', 'company')
  
  // Debug the crud object
  // Check permissions for warehouse keepers (like inventory management)
  const canManageCompanies = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseCompanyCRUD)
  
  
  
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    scopeType: 'all',
    transactionType: 'all'
  })

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchCompanies())
    
    // Load warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
  }, [dispatch, user?.role, user?.warehouseId])


  // Filter companies based on current filters and user role
  const filteredCompanies = crud.data?.filter(company => {
    const matchesSearch = !filters.search || 
      company.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      company.code.toLowerCase().includes(filters.search.toLowerCase()) ||
      company.contactPerson.toLowerCase().includes(filters.search.toLowerCase())
    
    const matchesScopeType = filters.scopeType === 'all' || company.scopeType === filters.scopeType
    const matchesTransactionType = filters.transactionType === 'all' || company.transactionType === filters.transactionType
    
    // Role-based filtering: 
    // - Admins see all companies
    // - Warehouse keepers only see companies for their specific warehouse
    const matchesRoleScope = user?.role === 'ADMIN' || 
      (user?.role === 'WAREHOUSE_KEEPER' && 
       company.scopeType === 'WAREHOUSE' && 
       company.scopeId === user?.warehouseId)
    
    return matchesSearch && matchesScopeType && matchesTransactionType && matchesRoleScope
  }) || []

  // Debug permission check (only log once when values change)

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }


  // Handle CRUD operations
  const handleCreate = (data) => {
    // Add default values for warehouse keepers
    const companyData = {
      ...data,
      status: 'active',
      // For warehouse keepers, set scope automatically
      scopeType: user?.role === 'WAREHOUSE_KEEPER' ? 'WAREHOUSE' : data.scopeType,
      scopeId: user?.role === 'WAREHOUSE_KEEPER' ? user?.warehouseId : data.scopeId,
    }
    
    dispatch(createCompany(companyData))
  }

  const handleUpdate = (data) => {
    dispatch(updateCompany({ id: crud.selectedEntity.id, data }))
  }

  const handleDelete = () => {
    dispatch(deleteCompany(crud.selectedEntity.id))
  }

  const handleRefresh = () => {
    dispatch(fetchCompanies())
  }

  // Handle form submission
  const handleFormSubmit = useCallback((data) => {
    if (crud.isEdit) {
      handleUpdate(data)
    } else {
      handleCreate(data)
    }
  }, [crud.isEdit, handleCreate, handleUpdate])

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessCenter />
            Companies Management
          </Typography>
        </Box>

        {/* Role-specific information */}
        {user?.role === 'WAREHOUSE_KEEPER' && (
          <Box sx={{ mb: 2, p: 2, bgcolor: canManageCompanies ? 'info.light' : 'warning.light', borderRadius: 1 }}>
            <Typography variant="body2" color={canManageCompanies ? 'info.contrastText' : 'warning.contrastText'}>
              <strong>Warehouse Keeper Access:</strong> {
                canManageCompanies 
                  ? `You can view and manage companies for your warehouse (ID: ${user?.warehouseId}). Use the search and transaction type filters below to find specific companies.`
                  : 'Company management is currently disabled for your warehouse. Contact your administrator to enable this feature.'
              }
            </Typography>
            {!warehouseSettings && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Settings are loading... Using default permissions.
              </Typography>
            )}
          </Box>
        )}


        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="Search Companies"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              size="small"
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
            
            {user?.role === 'ADMIN' && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Scope Type</InputLabel>
                <Select
                  value={filters.scopeType}
                  onChange={(e) => handleFilterChange('scopeType', e.target.value)}
                  label="Scope Type"
                >
                  <MenuItem value="all">All Scopes</MenuItem>
                  <MenuItem value="BRANCH">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business />
                      Branch Companies
                    </Box>
                  </MenuItem>
                  <MenuItem value="WAREHOUSE">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessCenter />
                      Warehouse Companies
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={filters.transactionType}
                onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                label="Transaction Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="CREDIT">Credit</MenuItem>
                <MenuItem value="DEBIT">Debit</MenuItem>
              </Select>
            </FormControl>

            {/* Active Filters Display */}
            {(filters.scopeType !== 'all' || filters.transactionType !== 'all') && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Active filters:
                </Typography>
                {user?.role === 'ADMIN' && filters.scopeType !== 'all' && (
                  <Chip
                    label={`Scope: ${filters.scopeType}`}
                    size="small"
                    onDelete={() => handleFilterChange('scopeType', 'all')}
                  />
                )}
                {filters.transactionType !== 'all' && (
                  <Chip
                    label={`Type: ${filters.transactionType}`}
                    size="small"
                    onDelete={() => handleFilterChange('transactionType', 'all')}
                  />
                )}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      <EntityTable
        data={Array.isArray(filteredCompanies) ? filteredCompanies : []}
        loading={crud.loading}
        columns={columns}
        title=""
        entityName="Company"
        onAdd={canManageCompanies ? crud.handleAdd : null}
        onEdit={canManageCompanies ? crud.handleEdit : null}
        onDelete={canManageCompanies ? crud.handleDeleteClick : null}
        onRefresh={canManageCompanies ? handleRefresh : null}
        showAddButton={canManageCompanies}
        showActions={canManageCompanies}
        showToolbar={canManageCompanies}
        error={crud.error}
      />
      
      {/* Debug EntityTable props */}
      {('🔍 EntityTable Props Debug:', {
        canManageCompanies,
        onAdd: canManageCompanies ? crud.handleAdd : null,
        showAddButton: canManageCompanies,
        showActions: canManageCompanies,
        showToolbar: canManageCompanies,
        crudHandleAdd: crud.handleAdd,
        crudHandleEdit: crud.handleEdit,
        crudHandleDeleteClick: crud.handleDeleteClick,
        handleRefresh: handleRefresh
      })}

      <EntityFormDialog
        open={canManageCompanies && crud.formDialogOpen}
        onClose={crud.handleFormClose}
        title={crud.dialogTitle}
        fields={(() => {
          const fields = getFields(user)
('🔍 ===== ENTITY FORM DIALOG DEBUG =====')
('🔍 EntityFormDialog fields:', fields)
('🔍 Fields count:', fields.length)
('🔍 User passed to getFields:', user)
('🔍 Dialog open:', canManageCompanies && crud.formDialogOpen)
('🔍 Can manage companies:', canManageCompanies)
('🔍 Form dialog open:', crud.formDialogOpen)
('🔍 ===== END ENTITY FORM DIALOG DEBUG =====')
          return fields
        })()}
        validationSchema={companySchema}
        initialData={crud.selectedEntity}
        isEdit={crud.isEdit}
        onSubmit={(() => {
('🔍 ===== ONSUBMIT PROP DEBUG =====')
('🔍 About to return onSubmit function')
          
          return async (formData) => {
('🔍 ===== DIRECT ONSUBMIT HANDLER =====')
('🔍 Form data received:', formData)
('🔍 About to dispatch createCompany...')
            
            try {
              const result = await dispatch(createCompany(formData))
('🔍 createCompany result:', result)
              
              if (createCompany.fulfilled.match(result)) {
('🔍 ✅ Company created successfully!')
                crud.handleFormClose()
              } else if (createCompany.rejected.match(result)) {
('🔍 ❌ Company creation failed:', result.payload)
              }
            } catch (error) {
('🔍 ❌ Error dispatching createCompany:', error)
            }
            
('🔍 ===== END DIRECT ONSUBMIT HANDLER =====')
          }
        })()}
        loading={false}
        error={crud.error}
      />

      <ConfirmationDialog
        open={canManageCompanies && crud.confirmationDialogOpen}
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

export default CompaniesPage
