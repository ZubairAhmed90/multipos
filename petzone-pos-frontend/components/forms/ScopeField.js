'use client'

import React, { useEffect, useState, useRef } from 'react'
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
  const scopeIdValue = watch('scopeId')
  const previousScopeTypeRef = useRef()
  
  // Load data when scopeType changes
  useEffect(() => {
    if (!scopeType) {
      previousScopeTypeRef.current = scopeType
      return
    }

    const hasData = scopeType === 'BRANCH' 
      ? branches && branches.length > 0 
      : warehouses && warehouses.length > 0

    if (!hasData) {
      setLoading(true)
      setError(null)

      if (scopeType === 'BRANCH') {
        dispatch(fetchAllBranches())
          .unwrap()
          .catch((err) => {
            setError('Failed to load branches')
            console.error('Error loading branches:', err)
          })
          .finally(() => {
            setLoading(false)
          })
      } else if (scopeType === 'WAREHOUSE') {
        dispatch(fetchWarehouses())
          .unwrap()
          .catch((err) => {
            setError('Failed to load warehouses')
            console.error('Error loading warehouses:', err)
          })
          .finally(() => {
            setLoading(false)
          })
      }
    }

    // Clear scopeId only when the user changes scope type after initial load
    const previousScopeType = previousScopeTypeRef.current
    if (previousScopeType && previousScopeType !== scopeType) {
      setValue('scopeId', '')
    }
    previousScopeTypeRef.current = scopeType
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
    .map(option => ({
      value: option.value,
      label: option.label,
    }))

  const normalizedOptions = [...scopeOptions]
  if (scopeIdValue && !normalizedOptions.some(option => String(option.value) === String(scopeIdValue))) {
    normalizedOptions.push({ value: scopeIdValue, label: scopeIdValue })
  }
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
          value={scopeIdValue ?? ''}
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
          ) : normalizedOptions.length === 0 ? (
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {scopeType === 'BRANCH' ? 'No branches available' : 'No warehouses available'}
              </Typography>
            </MenuItem>
          ) : (
            normalizedOptions.map((option) => (
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
