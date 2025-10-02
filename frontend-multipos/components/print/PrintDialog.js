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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Print as PrintIcon,
  Close as CloseIcon,
  Preview as PreviewIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import PrintLayout from './PrintLayout'

const PrintDialog = ({
  open,
  onClose,
  printData,
  onPrint,
  onPrintComplete,
  title = 'Print Receipt',
  showPreview = true,
  showSettings = true
}) => {
  const [printSettings, setPrintSettings] = useState({
    width: 300,
    showCompanyInfo: true,
    showFooter: true,
    fontSize: '12px',
    paperSize: '80mm',
    copies: 1,
    layout: 'thermal', // 'thermal' or 'color'
    orientation: 'portrait' // 'portrait' or 'landscape'
  })
  
  const [previewMode, setPreviewMode] = useState(true)
  const printRef = useRef(null)

  const handlePrint = () => {
    if (onPrint) {
      onPrint(printData, printSettings)
    } else {
      // Default print behavior
      const printWindow = window.open('', '_blank')
      const printContent = printRef.current?.innerHTML || ''
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Receipt</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              @media print {
                @page {
                  size: ${printSettings.layout === 'thermal' ? '80mm auto' : printSettings.paperSize + ' ' + printSettings.orientation};
                  margin: 0;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  font-family: ${printSettings.layout === 'thermal' ? 'monospace' : 'Arial, sans-serif'} !important;
                  font-size: ${printSettings.layout === 'thermal' ? '11px' : printSettings.fontSize} !important;
                  line-height: ${printSettings.layout === 'thermal' ? '1.1' : '1.4'} !important;
                  color: #000 !important;
                  background: #fff !important;
                }
                .MuiBox-root {
                  font-family: monospace !important;
                  font-size: 11px !important;
                  line-height: 1.1 !important;
                }
                .MuiTypography-root {
                  font-family: monospace !important;
                  line-height: 1.1 !important;
                }
              }
              body {
                font-family: ${printSettings.layout === 'thermal' ? 'monospace' : 'Arial, sans-serif'} !important;
                font-size: ${printSettings.layout === 'thermal' ? '11px' : printSettings.fontSize} !important;
                line-height: ${printSettings.layout === 'thermal' ? '1.1' : '1.4'} !important;
                margin: 0;
                padding: ${printSettings.layout === 'thermal' ? '4px' : '20px'};
                color: #000;
                background: #fff;
                width: ${printSettings.layout === 'thermal' ? '280px' : printSettings.width + 'px'};
                max-width: ${printSettings.layout === 'thermal' ? '280px' : printSettings.width + 'px'};
              }
              .print-container {
                width: ${printSettings.layout === 'thermal' ? '280px' : printSettings.width + 'px'};
                max-width: ${printSettings.layout === 'thermal' ? '280px' : printSettings.width + 'px'};
                margin: 0 auto;
                font-family: ${printSettings.layout === 'thermal' ? 'monospace' : 'Arial, sans-serif'};
                font-size: ${printSettings.layout === 'thermal' ? '11px' : printSettings.fontSize};
                line-height: ${printSettings.layout === 'thermal' ? '1.1' : '1.4'};
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${printContent}
            </div>
          </body>
        </html>
      `)
      
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      
      // Handle print completion
      printWindow.addEventListener('afterprint', () => {
        printWindow.close()
        if (onPrintComplete) {
          onPrintComplete()
        }
      })
      
      // Fallback for browsers that don't support afterprint
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.close()
          if (onPrintComplete) {
            onPrintComplete()
          }
        }
      }, 1000)
    }
  }

  const handleSettingChange = (setting, value) => {
    setPrintSettings(prev => ({
      ...prev,
      [setting]: value
    }))
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrintIcon />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Settings Panel */}
          {showSettings && (
            <Grid item xs={12} md={4}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon />
                  Print Settings
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Print Layout</InputLabel>
                  <Select
                    value={printSettings.layout}
                    onChange={(e) => handleSettingChange('layout', e.target.value)}
                    label="Print Layout"
                  >
                    <MenuItem value="thermal">Thermal Printer (80mm)</MenuItem>
                    <MenuItem value="color">Color Printer (A4/Letter)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Paper Size</InputLabel>
                  <Select
                    value={printSettings.paperSize}
                    onChange={(e) => handleSettingChange('paperSize', e.target.value)}
                    label="Paper Size"
                    disabled={printSettings.layout === 'thermal'}
                  >
                    <MenuItem value="80mm">80mm (Thermal)</MenuItem>
                    <MenuItem value="A4">A4</MenuItem>
                    <MenuItem value="Letter">Letter</MenuItem>
                  </Select>
                </FormControl>

                {printSettings.layout === 'color' && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Orientation</InputLabel>
                    <Select
                      value={printSettings.orientation}
                      onChange={(e) => handleSettingChange('orientation', e.target.value)}
                      label="Orientation"
                    >
                      <MenuItem value="portrait">Portrait</MenuItem>
                      <MenuItem value="landscape">Landscape</MenuItem>
                    </Select>
                  </FormControl>
                )}

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Font Size</InputLabel>
                  <Select
                    value={printSettings.fontSize}
                    onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                    label="Font Size"
                  >
                    <MenuItem value="10px">Small (10px)</MenuItem>
                    <MenuItem value="11px">Medium (11px)</MenuItem>
                    <MenuItem value="12px">Large (12px)</MenuItem>
                    <MenuItem value="14px">Extra Large (14px)</MenuItem>
                    <MenuItem value="16px">XXL (16px)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Receipt Width (px)"
                  type="number"
                  value={printSettings.width}
                  onChange={(e) => handleSettingChange('width', parseInt(e.target.value))}
                  sx={{ mb: 2 }}
                  inputProps={{ 
                    min: printSettings.layout === 'thermal' ? 200 : 400, 
                    max: printSettings.layout === 'thermal' ? 400 : 800 
                  }}
                  disabled={printSettings.layout === 'thermal'}
                />

                <TextField
                  fullWidth
                  label="Copies"
                  type="number"
                  value={printSettings.copies}
                  onChange={(e) => handleSettingChange('copies', parseInt(e.target.value))}
                  sx={{ mb: 2 }}
                  inputProps={{ min: 1, max: 10 }}
                />

                <Divider sx={{ my: 2 }} />


                <FormControlLabel
                  control={
                    <Switch
                      checked={printSettings.showCompanyInfo}
                      onChange={(e) => handleSettingChange('showCompanyInfo', e.target.checked)}
                    />
                  }
                  label="Show Company Info"
                />

              </Box>
            </Grid>
          )}

          {/* Preview Panel */}
          {showPreview && (
            <Grid item xs={12} md={showSettings ? 8 : 12}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PreviewIcon />
                  Print Preview
                </Typography>
                
                <Box
                  sx={{
                    border: '1px solid #ddd',
                    borderRadius: 1,
                    p: 2,
                    backgroundColor: '#f9f9f9',
                    maxHeight: '500px',
                    overflow: 'auto',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <Box ref={printRef}>
                    <PrintLayout
                      {...printData}
                      width={printSettings.layout === 'thermal' ? 280 : printSettings.width}
                      showLogo={true}
                      layout={printSettings.layout}
                      orientation={printSettings.orientation}
                      fontSize={printSettings.fontSize}
                    />
                  </Box>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* Print Info */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Print Tips:</strong>
            <br />
            • For thermal printers, use 80mm paper size
            <br />
            • Ensure your printer is connected and ready
            <br />
            • Check printer settings for proper paper size
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handlePrint}
          variant="contained"
          startIcon={<PrintIcon />}
          sx={{ minWidth: 120 }}
        >
          Print Receipt
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PrintDialog
