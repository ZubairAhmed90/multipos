'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormGroup,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  Typography,
  Alert,
  CircularProgress,
  Switch,
  Divider,
  useTheme,
  InputAdornment,
  IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'

const EntityFormDialog = ({
  // Dialog state
  open = false,
  onClose,
  
  // Form configuration
  title = 'Add Entity',
  submitText = 'Save',
  cancelText = 'Cancel',
  
  // Form data
  initialData = null,
  isEdit = false,
  
  // Validation
  validationSchema,
  
  // Form fields configuration
  fields = [],
  
  // Actions
  onSubmit,
  
  // Loading state
  loading = false,
  
  // Error handling
  error = null,
  
  // Customization
  maxWidth = 'sm',
  fullWidth = true,
}) => {
  const theme = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    reset,
    setValue,
    watch,
    getValues,
  } = useForm({
    resolver: validationSchema ? yupResolver(validationSchema) : undefined,
    defaultValues: initialData || {},
  })

  // Store fields in ref to avoid dependency issues
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      // Create default values object with field defaults
      const defaultValues = { ...initialData }
      fieldsRef.current.forEach(field => {
        if (field.defaultValue !== undefined && !(field.name in defaultValues)) {
          defaultValues[field.name] = field.defaultValue
        }
      })
      reset(defaultValues)
    }
  }, [open, initialData, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFormSubmit = (data) => {
    if (typeof onSubmit === 'function') {
      try {
        onSubmit(data)
      } catch (error) {
        // Handle error silently
      }
    }
  }

  const renderField = (field) => {
    const { name, label, type = 'text', options = [], required = false, defaultValue, ...fieldProps } = field

    switch (type) {
      case 'text':
      case 'email':
      case 'number':
      case 'tel':
        return (
          <TextField
            key={name}
            fullWidth
            label={label}
            type={type}
            margin="normal"
            {...register(name, { required })}
            defaultValue={defaultValue}
            error={!!errors[name]}
            helperText={errors[name]?.message}
            {...fieldProps}
          />
        )

      case 'password':
        return (
          <TextField
            key={name}
            fullWidth
            label={label}
            type={showPassword ? 'text' : 'password'}
            margin="normal"
            {...register(name, { required })}
            defaultValue={defaultValue}
            error={!!errors[name]}
            helperText={errors[name]?.message}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                    sx={{ color: theme.palette.text.secondary }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            {...fieldProps}
          />
        )

      case 'textarea':
        return (
          <TextField
            key={name}
            fullWidth
            label={label}
            multiline
            rows={4}
            margin="normal"
            {...register(name, { required })}
            defaultValue={defaultValue}
            error={!!errors[name]}
            helperText={errors[name]?.message}
            {...fieldProps}
          />
        )

      case 'select':
        return (
          <FormControl key={name} fullWidth margin="normal">
            <InputLabel>{label}</InputLabel>
            <Select
              label={label}
              {...register(name, { required })}
              defaultValue={defaultValue}
              error={!!errors[name]}
              value={watch(name) || defaultValue || ''}
              {...fieldProps}
            >
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {errors[name] && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {errors[name]?.message}
              </Typography>
            )}
          </FormControl>
        )

      case 'radio':
        return (
          <FormControl key={name} component="fieldset" margin="normal">
            <FormLabel component="legend">{label}</FormLabel>
            <RadioGroup
              {...register(name, { required })}
              {...fieldProps}
            >
              {options.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
            {errors[name] && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {errors[name]?.message}
              </Typography>
            )}
          </FormControl>
        )

      case 'checkbox':
        return (
          <FormControl key={name} component="fieldset" margin="normal">
            <FormLabel component="legend">{label}</FormLabel>
            <FormGroup>
              {options.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      {...register(name)}
                      value={option.value}
                      {...fieldProps}
                    />
                  }
                  label={option.label}
                />
              ))}
            </FormGroup>
            {errors[name] && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {errors[name]?.message}
              </Typography>
            )}
          </FormControl>
        )

      case 'switch':
        return (
          <FormControlLabel
            key={name}
            control={
              <Switch
                {...register(name)}
                checked={watch(name) || defaultValue || false}
                {...fieldProps}
              />
            }
            label={
              <Box>
                <Typography variant="body1" component="div">
                  {label}
                </Typography>
                {field.description && (
                  <Typography variant="body2" color="textSecondary">
                    {field.description}
                  </Typography>
                )}
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 2 }}
          />
        )

      case 'section':
        return (
          <Box key={name} sx={{ mt: 3, mb: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 600 }}>
              {field.sectionTitle || label}
            </Typography>
          </Box>
        )

      case 'custom':
        // For custom field components
        return field.render ? field.render({ register, errors, setValue, watch }) : null

      default:
        return (
          <TextField
            key={name}
            fullWidth
            label={label}
            margin="normal"
            {...register(name, { required })}
            error={!!errors[name]}
            helperText={errors[name]?.message}
            {...fieldProps}
          />
        )
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disableEnforceFocus
      disableAutoFocus
      PaperProps={{
        sx: { 
          minHeight: '400px',
          borderRadius: '16px',
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 255, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            : '0 16px 48px rgba(102, 126, 234, 0.2), 0 0 0 1px rgba(102, 126, 234, 0.1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: theme.palette.mode === 'dark'
              ? 'radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.05) 0%, transparent 50%)',
            pointerEvents: 'none',
          }
        }
      }}
    >
      <DialogTitle sx={{
        position: 'relative',
        zIndex: 1,
        fontWeight: 600,
        letterSpacing: '0.5px',
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(45deg, #ffffff 30%, #e3f2fd 90%)'
          : 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        pb: 2,
      }}>
        {title}
      </DialogTitle>
      
      <DialogContent sx={{ position: 'relative', zIndex: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" noValidate onSubmit={handleSubmit(handleFormSubmit)}>
          {fields.map((field) => renderField(field))}
          
          {/* Submit button inside the form */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 2, 
            mt: 3,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider'
          }}>
            <Button 
              onClick={handleClose} 
              disabled={loading}
              sx={{
                borderRadius: '12px',
                px: 3,
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
                border: '2px solid',
                borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                color: theme.palette.mode === 'dark' ? 'white' : 'black',
                '&:hover': {
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                },
                '&:disabled': {
                  opacity: 0.6,
                }
              }}
            >
              {cancelText}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : null}
              sx={{
                borderRadius: '12px',
                px: 3,
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
                background: theme.palette.mode === 'dark'
                  ? 'linear-gradient(45deg, #667eea, #764ba2)'
                  : 'linear-gradient(45deg, #667eea, #764ba2)',
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 16px rgba(102, 126, 234, 0.4)'
                  : '0 4px 16px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 8px 24px rgba(102, 126, 234, 0.5)'
                    : '0 8px 24px rgba(102, 126, 234, 0.4)',
                },
                '&:disabled': {
                  opacity: 0.6,
                }
              }}
            >
              {submitText}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export default EntityFormDialog
