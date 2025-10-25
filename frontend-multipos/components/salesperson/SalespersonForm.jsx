'use client'
import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Grid,
  IconButton
} from '@mui/material'
import {
  Close as CloseIcon,
  Save as SaveIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material'
import api from '../../utils/axios'

const SalespersonForm = ({ 
  open, 
  onClose, 
  salesperson = null, 
  onSave,
  warehouses = [],
  userRole = 'ADMIN'
}) => {
  console.log('🔧 SalespersonForm props:', { open, salesperson: !!salesperson, warehousesLength: warehouses.length, userRole })
  console.log('🔧 warehouses prop:', warehouses)
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    warehouseId: '',
    status: 'ACTIVE'
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Initialize form data when salesperson changes
  useEffect(() => {
    if (salesperson) {
      setFormData({
        name: salesperson.name || '',
        phone: salesperson.phone || '',
        email: salesperson.email || '',
        warehouseId: salesperson.warehouse_id || '',
        status: salesperson.status || 'ACTIVE'
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        warehouseId: '',
        status: 'ACTIVE'
      })
    }
    setError(null)
    setSuccess(null)
  }, [salesperson, open])

  // Set warehouse ID for warehouse keepers
  useEffect(() => {
    console.log('🔧 useEffect triggered:', { userRole, warehousesLength: warehouses.length, salesperson: !!salesperson })
    console.log('🔧 warehouses data:', warehouses)
    
    if (userRole === 'WAREHOUSE_KEEPER' && warehouses.length > 0 && !salesperson) {
      // Only set warehouse ID for new salespeople, not when editing
      console.log('🔧 Setting warehouse ID for warehouse keeper:', warehouses[0])
      setFormData(prev => {
        const newState = {
          ...prev,
          warehouseId: warehouses[0].id
        }
        console.log('🔧 formData after setting warehouseId:', newState)
        return newState
      })
    } else {
      console.log('🔧 useEffect conditions not met:', {
        isWarehouseKeeper: userRole === 'WAREHOUSE_KEEPER',
        hasWarehouses: warehouses.length > 0,
        isNewSalesperson: !salesperson
      })
    }
  }, [userRole, warehouses, salesperson])

  // Additional useEffect to handle form initialization when dialog opens
  useEffect(() => {
    if (open && userRole === 'WAREHOUSE_KEEPER' && warehouses.length > 0 && !salesperson) {
      console.log('🔧 Dialog opened - setting warehouse ID:', warehouses[0])
      setFormData(prev => {
        if (!prev.warehouseId || prev.warehouseId === '') {
          const newState = {
            ...prev,
            warehouseId: warehouses[0].id
          }
          console.log('🔧 formData updated on dialog open:', newState)
          return newState
        }
        return prev
      })
    }
  }, [open, userRole, warehouses, salesperson])

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateForm = () => {
    console.log('🔍 Validating form data:', formData)
    if (!formData.name.trim()) {
      setError('Name is required')
      return false
    }
    if (!formData.phone.trim()) {
      setError('Phone is required')
      return false
    }
    // Check if warehouseId is valid (not empty, null, undefined, or empty string)
    if (!formData.warehouseId || formData.warehouseId === '' || formData.warehouseId === null || formData.warehouseId === undefined) {
      console.log('❌ Warehouse validation failed. warehouseId:', formData.warehouseId)
      setError('Warehouse is required')
      return false
    }
    console.log('✅ Form validation passed')
    return true
  }

  const handleSave = async () => {
    console.log('🔍 handleSave called. Current formData:', formData)
    
    // Additional check for warehouse keepers
    if (userRole === 'WAREHOUSE_KEEPER' && (!formData.warehouseId || formData.warehouseId === '')) {
      console.log('❌ Warehouse keeper form submitted without warehouse ID')
      setError('Warehouse is required. Please wait for the form to load completely.')
      return
    }
    
    if (!validateForm()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        warehouseId: parseInt(formData.warehouseId),
        status: formData.status
      }
      
      console.log('🔧 API payload being sent:', payload)
      console.log('🔧 warehouseId type:', typeof payload.warehouseId, 'value:', payload.warehouseId)

      let response
      if (salesperson) {
        // Update existing salesperson
        response = await api.put(`/salespeople/${salesperson.id}`, payload)
        setSuccess('Salesperson updated successfully!')
      } else {
        // Create new salesperson
        response = await api.post('/salespeople', payload)
        setSuccess('Salesperson created successfully!')
      }

      if (response.data.success) {
        if (onSave) {
          onSave(response.data.data)
        }
        
        // Close dialog after a short delay
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(response.data.message || 'Failed to save salesperson')
      }
    } catch (err) {
      console.error('Error saving salesperson:', err)
      setError(err.response?.data?.message || err.message || 'Failed to save salesperson')
    } finally {
      setLoading(false)
    }
  }

  const isEditMode = !!salesperson
  const canSelectWarehouse = userRole === 'ADMIN'
  
  // Check if form is ready for warehouse keepers
  const isFormReady = userRole !== 'WAREHOUSE_KEEPER' || (formData.warehouseId && formData.warehouseId !== '')

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: '50vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              {isEditMode ? 'Edit Salesperson' : 'Add New Salesperson'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              required
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              required
              disabled={loading}
              inputProps={{ maxLength: 20 }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            {canSelectWarehouse ? (
              <FormControl fullWidth required disabled={loading}>
                <InputLabel>Warehouse</InputLabel>
                <Select
                  value={formData.warehouseId}
                  onChange={(e) => handleFieldChange('warehouseId', e.target.value)}
                  label="Warehouse"
                >
                  {warehouses.map((warehouse) => (
                    <MenuItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}{warehouse.code ? ` (${warehouse.code})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Warehouse
                </Typography>
                {warehouses.length > 0 ? (
                  <>
                    <Typography variant="body1" fontWeight="medium">
                      {`${warehouses[0].name}${warehouses[0].code ? ` (${warehouses[0].code})` : ''}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Warehouse is automatically assigned to your scope
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="body1" fontWeight="medium" color="text.secondary">
                      Loading warehouse...
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Please wait while we load your warehouse information
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </Grid>

          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth disabled={loading}>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                label="Status"
              >
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={loading || !isFormReady}
        >
          {loading ? 'Saving...' : (isEditMode ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SalespersonForm
