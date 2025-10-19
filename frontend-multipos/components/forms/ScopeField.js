'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material'
import { fetchAllBranches } from '../../app/store/slices/branchesSlice'
import { fetchWarehouses } from '../../app/store/slices/warehousesSlice'

const ScopeField = ({ 
  register, 
  errors, 
  setValue, 
  watch, 
  label = 'Scope Name',
  required = true,
  disabled = false 
}) => {
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Get Redux state
  const { branches, loading: branchesLoading } = useSelector(state => state.branches)
  const { data: warehouses, loading: warehousesLoading } = useSelector(state => state.warehouses)
  
  // Watch the scopeType field
  const scopeType = watch('scopeType')
  
  // Load data when scopeType changes
  useEffect(() => {
    if (scopeType) {
      // Check if data is already loaded to prevent unnecessary API calls
      const hasData = scopeType === 'BRANCH' 
        ? branches && branches.length > 0 
        : warehouses && warehouses.length > 0
      
      if (!hasData) {
        setLoading(true)
        setError(null)
        
        // Clear the current scopeId when scopeType changes
        setValue('scopeId', '')
        
        if (scopeType === 'BRANCH') {
          dispatch(fetchAllBranches())
            .unwrap()
            .then(() => {
              setLoading(false)
            })
            .catch((err) => {
              setError('Failed to load branches')
              setLoading(false)
              console.error('Error loading branches:', err)
            })
        } else if (scopeType === 'WAREHOUSE') {
          dispatch(fetchWarehouses())
            .unwrap()
            .then(() => {
              setLoading(false)
            })
            .catch((err) => {
              setError('Failed to load warehouses')
              setLoading(false)
              console.error('Error loading warehouses:', err)
            })
        }
      } else {
        // Data already exists, just clear the scopeId
        setValue('scopeId', '')
      }
    }
  }, [scopeType, dispatch, branches, warehouses, setValue])
  
  // Get current options based on scopeType
  const getScopeOptions = () => {
    if (scopeType === 'BRANCH') {
      return branches?.map(branch => ({
        value: branch.id,
        label: branch.name || branch.branchName || `Branch ${branch.id}`
      })) || []
    } else if (scopeType === 'WAREHOUSE') {
      return warehouses?.map(warehouse => ({
        value: warehouse.id,
        label: warehouse.name || warehouse.warehouseName || `Warehouse ${warehouse.id}`
      })) || []
    }
    return []
  }
  
  const scopeOptions = getScopeOptions()
  const isLoading = loading || branchesLoading || warehousesLoading
  
  return (
    <Box>
      <FormControl 
        fullWidth 
        margin="normal"
        error={!!errors.scopeId}
        disabled={disabled || isLoading}
      >
        <InputLabel>{label}</InputLabel>
        <Select
          label={label}
          {...register('scopeId', { required })}
          value={watch('scopeId') || ''}
          disabled={disabled || isLoading || !scopeType}
        >
          {isLoading ? (
            <MenuItem disabled>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">
                  {scopeType === 'BRANCH' ? 'Loading branches...' : 'Loading warehouses...'}
                </Typography>
              </Box>
            </MenuItem>
          ) : scopeOptions.length === 0 ? (
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {scopeType === 'BRANCH' ? 'No branches available' : 'No warehouses available'}
              </Typography>
            </MenuItem>
          ) : (
            scopeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
      
      {errors.scopeId && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
          {errors.scopeId?.message}
        </Typography>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      
      {scopeType && !isLoading && scopeOptions.length === 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {scopeType === 'BRANCH' 
            ? 'No branches found. Please create a branch first.' 
            : 'No warehouses found. Please create a warehouse first.'
          }
        </Alert>
      )}
    </Box>
  )
}

export default ScopeField
