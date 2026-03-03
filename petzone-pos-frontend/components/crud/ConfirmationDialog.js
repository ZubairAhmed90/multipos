'use client'

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  CircularProgress,
} from '@mui/material'
import {
  Warning as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material'

const ConfirmationDialog = ({
  // Dialog state
  open = false,
  onClose,
  
  // Content
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  
  // Actions
  onConfirm,
  
  // Loading state
  loading = false,
  
  // Styling
  severity = 'warning', // 'warning', 'error', 'info'
  maxWidth = 'sm',
  fullWidth = true,
  
  // Customization
  showIcon = true,
  icon,
}) => {
  const getIcon = () => {
    if (icon) return icon
    
    switch (severity) {
      case 'error':
        return <WarningIcon color="error" />
      case 'warning':
        return <WarningIcon color="warning" />
      case 'info':
        return <WarningIcon color="info" />
      default:
        return <WarningIcon color="warning" />
    }
  }

  const getIconColor = () => {
    switch (severity) {
      case 'error':
        return 'error'
      case 'warning':
        return 'warning'
      case 'info':
        return 'info'
      default:
        return 'warning'
    }
  }

  const handleConfirm = () => {
    onConfirm()
  }

  const handleCancel = () => {
    if (!loading) {
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disableEnforceFocus
      disableAutoFocus
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {showIcon && (
              <Box sx={{ color: `${getIconColor()}.main` }}>
                {getIcon()}
              </Box>
            )}
            <Typography variant="h6" component="span">
              {title}
            </Typography>
          </Box>
          <IconButton
            onClick={handleCancel}
            disabled={loading}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body1" sx={{ mt: 1 }}>
          {message}
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={loading}
          color="inherit"
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading}
          variant="contained"
          color={getIconColor()}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmationDialog
