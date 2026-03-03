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
  Tooltip,
  Checkbox
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
  showSettings = true,
  defaultLayout = 'thermal'
}) => {
  const [printSettings, setPrintSettings] = useState({
    width: 300,
    showCompanyInfo: true,
    showFooter: true,
    fontSize: '12px',
    paperSize: '80mm',
    copies: 1,
    layout: defaultLayout,
    orientation: 'portrait'
  })
  
  const [previewMode, setPreviewMode] = useState(true)
  const printRef = useRef(null)
  const printContentRef = useRef(null)
  const [dontAskAgain, setDontAskAgain] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('autoDirectPrint') === '1'
    } catch (e) {
      return false
    }
  })

  React.useEffect(() => {
    setPrintSettings(prev => ({
      ...prev,
      layout: defaultLayout,
      paperSize: defaultLayout === 'thermal' ? '80mm' : 'A4',
      width: defaultLayout === 'thermal' ? 280 : 800
    }))
  }, [defaultLayout])

  const handlePrint = () => {
    // Persist user's preference
    try {
      if (typeof window !== 'undefined') {
        if (dontAskAgain) {
          window.localStorage.setItem('autoDirectPrint', '1')
        } else {
          window.localStorage.removeItem('autoDirectPrint')
        }
      }
    } catch (e) {
      // ignore
    }

    if (onPrint) {
      onPrint(printData, printSettings)
    } else {
      // Get the HTML content from the print layout
      const printContent = printContentRef.current?.innerHTML || printRef.current?.innerHTML || '';
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        alert('Please allow pop-ups to print');
        return;
      }

      // Determine if this is thermal or A4/Legal
      const isThermal = printSettings.layout === 'thermal';
      const isLandscape = printSettings.orientation === 'landscape';
      
      // Set up CSS based on layout type
      let pageSize = '';
      let margin = '';
      let width = '';
      
      if (isThermal) {
        pageSize = '80mm auto';
        width = '280px';
        margin = '0';
      } else {
        // For A4/Letter printers
        pageSize = printSettings.paperSize === 'Letter' ? 'Letter' : 'A4';
        if (isLandscape) {
          pageSize += ' landscape';
        }
        margin = '0.5in';
        width = '100%';
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Receipt - ${printData?.invoiceNo || 'Invoice'}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              /* Reset styles */
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              /* Print styles */
              @media print {
                @page {
                  size: ${pageSize};
                  margin: ${margin};
                }
                
                html, body {
                  width: 100%;
                  height: 100%;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                
                body {
                  font-family: ${isThermal ? 'monospace' : 'Arial, Helvetica, sans-serif'};
                  font-size: ${isThermal ? '11px' : printSettings.fontSize || '12px'};
                  line-height: ${isThermal ? '1.1' : '1.5'};
                  color: #000;
                  background: #fff;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                
                .print-wrapper {
                  width: ${isThermal ? width : '100%'};
                  max-width: ${isThermal ? width : '100%'};
                  margin: 0 auto;
                  padding: ${isThermal ? '4px' : '20px'};
                }
                
                /* Ensure tables look good */
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 10px 0;
                }
                
                th, td {
                  padding: ${isThermal ? '2px 4px' : '8px 12px'};
                  text-align: left;
                  border-bottom: 1px solid #ddd;
                }
                
                th {
                  font-weight: bold;
                  background-color: ${isThermal ? 'transparent' : '#f5f5f5'};
                }
                
                /* Hide any dialog elements */
                .no-print {
                  display: none !important;
                }
              }
              
              /* Screen styles */
              body {
                font-family: ${isThermal ? 'monospace' : 'Arial, Helvetica, sans-serif'};
                font-size: ${isThermal ? '11px' : printSettings.fontSize || '12px'};
                line-height: ${isThermal ? '1.1' : '1.5'};
                padding: 20px;
                background: #fff;
              }
              
              .print-wrapper {
                width: ${isThermal ? width : '100%'};
                max-width: ${isThermal ? width : '1200px'};
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            <div class="print-wrapper">
              ${printContent}
            </div>
            
            <script>
              // Automatically trigger print dialog when page loads
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 250);
              };
              
              // Close window after printing (optional)
              window.onafterprint = function() {
                window.close();
              };
              
              // Fallback for browsers that don't support afterprint
              setTimeout(function() {
                if (!window.closed) {
                  window.close();
                }
              }, 1000);
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
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
      maxWidth="lg"
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
                    min: printSettings.layout === 'thermal' ? 200 : 600, 
                    max: printSettings.layout === 'thermal' ? 400 : 1200 
                  }}
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
                  <Box 
                    ref={printContentRef}
                    sx={{
                      width: printSettings.layout === 'thermal' ? '280px' : '100%',
                      maxWidth: printSettings.layout === 'thermal' ? '280px' : '100%',
                      transform: printSettings.layout === 'thermal' ? 'none' : 'scale(0.9)',
                      transformOrigin: 'top center'
                    }}
                  >
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

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Print Tips:</strong>
            <br />
            • For thermal printers, use 80mm paper size
            <br />
            • For A4/Letter printers, ensure printer is loaded with correct paper size
            <br />
            • Click Print Receipt to open the system print dialog
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <FormControlLabel
          control={<Checkbox checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />}
          label="Direct print (Don't show this dialog again)"
          sx={{ mr: 'auto' }}
        />
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