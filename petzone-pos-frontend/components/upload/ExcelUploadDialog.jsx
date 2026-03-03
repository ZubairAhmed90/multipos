'use client'
import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material'
import api from '../../utils/axios'
import ScopeField from '../forms/ScopeField'

const ExcelUploadDialog = ({
  open = false,
  onClose,
  onSuccess,
  title = 'Import Inventory from Excel',
  scopeType = 'WAREHOUSE',
  scopeId = null,
  scopeOptions = []
}) => {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedScopeType, setSelectedScopeType] = useState(scopeType)
  const [selectedScopeId, setSelectedScopeId] = useState(scopeId)
  const [uploadResult, setUploadResult] = useState(null)
  const [error, setError] = useState(null)

  // Mock form methods for ScopeField compatibility
  const mockFormMethods = {
    register: (name) => ({
      onChange: (e) => {
        if (name === 'scopeType') {
          setSelectedScopeType(e.target.value)
        } else if (name === 'scopeId') {
          setSelectedScopeId(e.target.value)
        }
      }
    }),
    watch: (name) => {
      if (name === 'scopeType') return selectedScopeType
      if (name === 'scopeId') return selectedScopeId
      return ''
    },
    setValue: (name, value) => {
      if (name === 'scopeType') setSelectedScopeType(value)
      if (name === 'scopeId') setSelectedScopeId(value)
    },
    errors: {}
  }


  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0]
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/csv'
      ]
      
      const allowedExtensions = ['.xlsx', '.xls', '.csv']
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'))
      
      if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(fileExtension)) {
        setError('Please select a valid Excel file (.xlsx, .xls) or CSV file')
        return
      }
      
      // Validate file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      
      setFile(selectedFile)
      setError(null)
      setUploadResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload')
      return
    }

    if (!selectedScopeId) {
      setError('Please select a scope (Branch/Warehouse)')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('scopeType', selectedScopeType)
      formData.append('scopeId', selectedScopeId)

      const response = await api.post('/inventory/import-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(progress)
        },
      })

      setUploadResult(response.data)
      setUploading(false)
      
      if (response.data.success && onSuccess) {
        onSuccess(response.data)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setError(error.response?.data?.message || 'Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/inventory/excel-template', {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'inventory_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Template download error:', error)
      setError('Failed to download template. Please try again.')
    }
  }

  const handleClose = () => {
    setFile(null)
    setUploading(false)
    setUploadProgress(0)
    setUploadResult(null)
    setError(null)
    setSelectedScopeType(scopeType)
    setSelectedScopeId(scopeId)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const getStatusIcon = (type) => {
    switch (type) {
      case 'success':
        return <SuccessIcon color="success" />
      case 'error':
        return <ErrorIcon color="error" />
      case 'warning':
        return <WarningIcon color="warning" />
      default:
        return null
    }
  }

  const renderUploadResult = () => {
    if (!uploadResult) return null

    const { summary, insertedItems, duplicateItems, failedItems, warnings } = uploadResult

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Import Results
        </Typography>
        
        {/* Summary */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`Total Rows: ${summary.totalRows}`} variant="outlined" />
            <Chip label={`Processed: ${summary.processedItems}`} variant="outlined" />
            <Chip label={`Inserted: ${summary.insertedItems}`} color="success" />
            <Chip label={`Duplicates: ${summary.duplicateItems}`} color="warning" />
            <Chip label={`Failed: ${summary.failedItems}`} color="error" />
            {summary.warnings > 0 && (
              <Chip label={`Warnings: ${summary.warnings}`} color="warning" />
            )}
          </Box>
        </Paper>

        {/* Inserted Items */}
        {insertedItems.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom color="success.main">
              Successfully Inserted ({insertedItems.length})
            </Typography>
            <List dense>
              {insertedItems.slice(0, 5).map((item, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <SuccessIcon color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name}
                    secondary={`Code: ${item.code}`}
                  />
                </ListItem>
              ))}
              {insertedItems.length > 5 && (
                <ListItem>
                  <ListItemText 
                    primary={`... and ${insertedItems.length - 5} more items`}
                    sx={{ fontStyle: 'italic' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        )}

        {/* Duplicate Items */}
        {duplicateItems.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom color="warning.main">
              Duplicate Items ({duplicateItems.length})
            </Typography>
            <List dense>
              {duplicateItems.slice(0, 5).map((item, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <WarningIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name}
                    secondary={`Code: ${item.code} - ${item.reason}`}
                  />
                </ListItem>
              ))}
              {duplicateItems.length > 5 && (
                <ListItem>
                  <ListItemText 
                    primary={`... and ${duplicateItems.length - 5} more items`}
                    sx={{ fontStyle: 'italic' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        )}

        {/* Failed Items */}
        {failedItems.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom color="error.main">
              Failed Items ({failedItems.length})
            </Typography>
            <List dense>
              {failedItems.slice(0, 5).map((item, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <ErrorIcon color="error" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name}
                    secondary={`Code: ${item.code} - ${item.reason}`}
                  />
                </ListItem>
              ))}
              {failedItems.length > 5 && (
                <ListItem>
                  <ListItemText 
                    primary={`... and ${failedItems.length - 5} more items`}
                    sx={{ fontStyle: 'italic' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom color="warning.main">
              Warnings ({warnings.length})
            </Typography>
            <List dense>
              {warnings.slice(0, 5).map((warning, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <WarningIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText primary={warning} />
                </ListItem>
              ))}
              {warnings.length > 5 && (
                <ListItem>
                  <ListItemText 
                    primary={`... and ${warnings.length - 5} more warnings`}
                    sx={{ fontStyle: 'italic' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        )}
      </Box>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '500px',
          borderRadius: '16px',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{title}</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Template Download */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Need a template?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Download our Excel template with the correct column format
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleDownloadTemplate}
              size="small"
            >
              Download Template
            </Button>
          </Box>
        </Paper>

        {/* Scope Selection */}
        <Box sx={{ mb: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Scope Type</InputLabel>
            <Select
              value={selectedScopeType}
              onChange={(e) => setSelectedScopeType(e.target.value)}
              label="Scope Type"
            >
              <MenuItem value="BRANCH">Branch</MenuItem>
              <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
            </Select>
          </FormControl>

          <ScopeField 
            register={mockFormMethods.register}
            errors={mockFormMethods.errors}
            setValue={mockFormMethods.setValue}
            watch={mockFormMethods.watch}
            label="Scope Name"
            required={true}
          />
        </Box>

        {/* File Upload */}
        <Paper
          sx={{
            p: 3,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: file ? 'success.main' : 'grey.300',
            bgcolor: file ? 'success.light' : 'grey.50',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'primary.light',
            },
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <UploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
          
          <Typography variant="h6" gutterBottom>
            {file ? file.name : 'Click to select Excel file'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Supported formats: .xlsx, .xls, .csv (Max 10MB)
          </Typography>
        </Paper>

        {/* Upload Progress */}
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Uploading... {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        {/* Upload Results */}
        {renderUploadResult()}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={uploading}>
          {uploadResult ? 'Close' : 'Cancel'}
        </Button>
        {!uploadResult && (
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!file || uploading || !selectedScopeId}
            startIcon={<UploadIcon />}
          >
            {uploading ? 'Uploading...' : 'Upload & Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default ExcelUploadDialog


