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
    if (userRole === 'WAREHOUSE_KEEPER' && warehouses.length > 0) {
      setFormData(prev => ({
        ...prev,
        warehouseId: warehouses[0].id
      }))
    }
  }, [userRole, warehouses])

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required')
      return false
    }
    if (!formData.phone.trim()) {
      setError('Phone is required')
      return false
    }
    if (!formData.warehouseId) {
      setError('Warehouse is required')
      return false
    }
    return true
  }

  const handleSave = async () => {
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
            <FormControl fullWidth required disabled={loading || !canSelectWarehouse}>
              <InputLabel>Warehouse</InputLabel>
              <Select
                value={formData.warehouseId}
                onChange={(e) => handleFieldChange('warehouseId', e.target.value)}
                label="Warehouse"
                disabled={!canSelectWarehouse}
              >
                {warehouses.map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {!canSelectWarehouse && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Warehouse is automatically assigned to your scope
              </Typography>
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
          disabled={loading}
        >
          {loading ? 'Saving...' : (isEditMode ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SalespersonForm
