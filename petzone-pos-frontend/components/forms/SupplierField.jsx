'use client'

import React, { useState, useEffect } from 'react'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Autocomplete
} from '@mui/material'
import { Business as BusinessIcon } from '@mui/icons-material'
import { useDispatch, useSelector } from 'react-redux'
import { fetchSuppliers } from '../../app/store/slices/purchaseOrdersSlice'

const SupplierField = ({ 
  register, 
  errors, 
  setValue, 
  watch, 
  label = 'Supplier', 
  required = false 
}) => {
  const dispatch = useDispatch()
  const { suppliers, loading, error } = useSelector((state) => state.purchaseOrders)
  const { user } = useSelector((state) => state.auth) // Get current user for scope filtering

  const [searchTerm, setSearchTerm] = useState('')
  const selectedSupplierId = watch('supplierId')
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  useEffect(() => {
    // Fetch suppliers based on user's role and scope
    const fetchParams = {}
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      fetchParams.scopeType = 'WAREHOUSE'
      fetchParams.scopeId = user.warehouseId
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      fetchParams.scopeType = 'BRANCH'
      fetchParams.scopeId = user.branchId
    }
    dispatch(fetchSuppliers(fetchParams))
  }, [dispatch, user])

  useEffect(() => {
    // Set initial value if available
    if (selectedSupplierId && !selectedSupplier) {
      // If initialData has a supplierId but it's not in the fetched suppliers,
      // we might need to fetch it specifically or handle it as a manual entry.
      // For now, we'll assume it will be in the fetched list or handled by manualName.
    }
  }, [selectedSupplierId, selectedSupplier, suppliers])

  const handleSupplierChange = (event, newValue) => {
    if (newValue) {
      setValue('supplierId', newValue.id)
      setValue('supplierName', newValue.name)
    } else {
      setValue('supplierId', null)
      setValue('supplierName', '')
    }
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Box sx={{ mt: 2, mb: 1 }}>
      <FormControl fullWidth error={!!errors.supplierId}>
        <InputLabel>{label}</InputLabel>
        <Autocomplete
          options={filteredSuppliers}
          getOptionLabel={(option) => option.name}
          value={selectedSupplier || null}
          onChange={handleSupplierChange}
          onInputChange={(event, newInputValue) => {
            setSearchTerm(newInputValue)
          }}
          loading={loading}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              error={!!errors.supplierId}
              helperText={errors.supplierId?.message}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <BusinessIcon color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight="medium">
                    {option.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.contact_person && `Contact: ${option.contact_person}`}
                    {option.phone && ` • ${option.phone}`}
                  </Typography>
                </Box>
                <Chip 
                  label={option.transactionType || 'CASH'} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                />
              </Box>
            </Box>
          )}
          noOptionsText={
            loading ? 'Loading suppliers...' : 
            searchTerm ? 'No suppliers found' : 'No suppliers available'
          }
          clearOnEscape
          selectOnFocus
          handleHomeEndKeys
        />
      </FormControl>
      
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      
      {suppliers.length === 0 && !loading && (
        <Alert severity="info" sx={{ mt: 1 }}>
          No suppliers found. Create companies first to use as suppliers.
        </Alert>
      )}
    </Box>
  )
}

export default SupplierField
