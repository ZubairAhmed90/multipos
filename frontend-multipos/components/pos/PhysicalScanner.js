'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  IconButton,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Snackbar
} from '@mui/material'
import {
  QrCodeScanner as ScannerIcon,
  Keyboard as KeyboardIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  Usb as UsbIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'

const PhysicalScanner = ({ onScan, onClose, open, inventoryItems = [] }) => {
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanHistory, setScanHistory] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false)
  const [physicalScannerConnected, setPhysicalScannerConnected] = useState(false)
  
  const manualInputRef = useRef(null)
  const lastScanTimeRef = useRef(0)
  const scanBufferRef = useRef('')

  // Load scan history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('barcodeScanHistory')
    if (savedHistory) {
      setScanHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Physical Scanner Integration
  useEffect(() => {
    if (!open) return

    // Focus the manual input field for physical scanner
    if (manualInputRef.current) {
      manualInputRef.current.focus()
    }

    // Handle physical scanner input (keyboard events)
    const handleKeyDown = (event) => {
      // Check if it's a scanner input (usually rapid keystrokes)
      const now = Date.now()
      const timeDiff = now - lastScanTimeRef.current
      
      if (timeDiff < 50) { // Rapid keystrokes indicate scanner
        scanBufferRef.current += event.key
        lastScanTimeRef.current = now
        setPhysicalScannerConnected(true)
        return
      }

      // Handle Enter key from scanner
      if (event.key === 'Enter' && scanBufferRef.current.trim().length > 0) {
        event.preventDefault()
        const barcode = scanBufferRef.current.trim()
        scanBufferRef.current = ''
        handleScan(barcode)
        return
      }

      // Handle manual typing
      if (event.key === 'Enter' && manualCode.trim().length > 0) {
        event.preventDefault()
        handleScan(manualCode.trim())
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, manualCode])

  const handleScan = (barcode) => {
    if (!barcode) return

    setLoading(true)
    setError('')

    // Search for product in inventory
    const product = inventoryItems.find(p => {
      const skuMatch = p.sku && p.sku.toString().toLowerCase() === barcode.toLowerCase()
      const barcodeMatch = p.barcode && p.barcode.toString().toLowerCase() === barcode.toLowerCase()
      const nameMatch = p.name && p.name.toLowerCase().includes(barcode.toLowerCase())
      
      return skuMatch || barcodeMatch || nameMatch
    })

    // Add to scan history
    const scanEntry = {
      barcode,
      product: product ? product.name : 'Not found',
      success: !!product,
      timestamp: new Date().toISOString(),
      method: 'physical'
    }

    const newHistory = [scanEntry, ...scanHistory.slice(0, 49)] // Keep last 50 scans
    setScanHistory(newHistory)
    localStorage.setItem('barcodeScanHistory', JSON.stringify(newHistory))

    if (product) {
      setSuccessMessage(`Product found: ${product.name}`)
      setShowSuccessSnackbar(true)
      onScan(barcode)
      setManualCode('')
    } else {
      setError('Product not found. Please check the barcode or try manual search.')
      // Show search results for partial matches
      const matches = inventoryItems.filter(p => {
        const skuMatch = p.sku && p.sku.toString().toLowerCase().includes(barcode.toLowerCase())
        const barcodeMatch = p.barcode && p.barcode.toString().toLowerCase().includes(barcode.toLowerCase())
        const nameMatch = p.name && p.name.toLowerCase().includes(barcode.toLowerCase())
        
        return skuMatch || barcodeMatch || nameMatch
      }).map(item => ({
        id: item.id,
        name: item.name,
        price: item.sellingPrice,
        stock: item.currentStock,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        unit: item.unit
      }))
      
      setSearchResults(matches)
      setShowSearchResults(true)
    }

    setLoading(false)
  }

  const handleManualSearch = (query) => {
    if (query.length >= 2) {
      const matches = inventoryItems.filter(p => 
        p.sku?.toLowerCase().includes(query.toLowerCase()) || 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(query.toLowerCase())
      ).map(item => ({
        id: item.id,
        name: item.name,
        price: item.sellingPrice,
        stock: item.currentStock,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        unit: item.unit
      }))
      
      setSearchResults(matches)
      setShowSearchResults(true)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }

  const handleProductSelect = (product) => {
    onScan(product.barcode || product.sku)
    setShowSearchResults(false)
    setManualCode('')
  }

  const handleDeleteScan = (index) => {
    const newHistory = scanHistory.filter((_, i) => i !== index)
    setScanHistory(newHistory)
    localStorage.setItem('barcodeScanHistory', JSON.stringify(newHistory))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScannerIcon />
          <Typography variant="h6">Physical Scanner</Typography>
          <Chip 
            icon={<ScannerIcon />} 
            label={`${scanHistory.length} scans`} 
            size="small" 
            color="primary" 
            sx={{ ml: 'auto' }}
          />
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, height: '600px' }}>
          {/* Left Column - Scanner Interface */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            
            {/* Physical Scanner Interface */}
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle1" gutterBottom>
                Physical Scanner Ready
              </Typography>
              <Box sx={{ mb: 2 }}>
                {physicalScannerConnected ? (
                  <Alert severity="success" icon={<UsbIcon />}>
                    Scanner connected via WebHID
                  </Alert>
                ) : (
                  <Alert severity="info" icon={<KeyboardIcon />}>
                    Scanner will work as keyboard input. Just scan!
                  </Alert>
                )}
              </Box>
              
              <TextField
                ref={manualInputRef}
                fullWidth
                label="Scan barcode with physical scanner"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Point scanner at barcode and scan..."
                disabled={loading}
                autoFocus
                InputProps={{
                  startAdornment: <ScannerIcon sx={{ mr: 1, color: 'primary.main' }} />
                }}
              />
              
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<ScannerIcon />}
                  onClick={() => {
                    if (manualCode.trim()) {
                      handleScan(manualCode.trim())
                    }
                  }}
                  disabled={loading || !manualCode.trim()}
                  sx={{ mr: 1 }}
                >
                  {loading ? <CircularProgress size={20} /> : 'RECONNECT SCANNER'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => handleManualSearch(manualCode)}
                  disabled={!manualCode.trim()}
                >
                  SEARCH
                </Button>
              </Box>
            </Paper>

            {/* Error Display */}
            {error && (
              <Alert severity="error" icon={<ErrorIcon />}>
                {error}
              </Alert>
            )}

            {/* Search Results */}
            {showSearchResults && searchResults.length > 0 && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Search Results ({searchResults.length})
                </Typography>
                <List dense>
                  {searchResults.slice(0, 5).map((product) => (
                    <ListItem 
                      key={product.id}
                      button
                      onClick={() => handleProductSelect(product)}
                    >
                      <ListItemText
                        primary={product.name}
                        secondary={`SKU: ${product.sku} | Price: $${product.price} | Stock: ${product.stock}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          {/* Right Column - Scan History */}
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Scan History
              </Typography>
              
              {scanHistory.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  No scans yet. Start scanning to see history here.
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: '500px', overflow: 'auto' }}>
                  {scanHistory.map((scan, index) => (
                    <React.Fragment key={index}>
                      <ListItem
                        secondaryAction={
                          <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => handleDeleteScan(index)}
                            size="small"
                            sx={{ 
                              color: 'error.main',
                              '&:hover': {
                                backgroundColor: 'error.light',
                                color: 'error.contrastText'
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {scan.success ? (
                                <CheckIcon color="success" fontSize="small" />
                              ) : (
                                <ErrorIcon color="error" fontSize="small" />
                              )}
                              {scan.product}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" component="div">
                              <Typography variant="caption" color="text.secondary" component="span">
                                Barcode: {scan.barcode}
                              </Typography>
                              <br />
                              <Typography variant="caption" color="text.secondary" component="span">
                                {new Date(scan.timestamp).toLocaleString()}
                              </Typography>
                              <Chip 
                                label={scan.method.replace('_', ' ')} 
                                size="small" 
                                sx={{ ml: 1 }}
                                color={scan.success ? 'success' : 'error'}
                              />
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < scanHistory.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Box>
            {scanHistory.filter(s => !s.success).length > 0 && (
              <Chip 
                icon={<ErrorIcon />} 
                label={`${scanHistory.filter(s => !s.success).length} Issues`} 
                color="error" 
                size="small"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ alignSelf: 'center', mr: 2 }}>
              TOTAL: $0.00
            </Typography>
            <Button onClick={onClose}>CLOSE</Button>
          </Box>
        </Box>
      </DialogActions>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSuccessSnackbar(false)}
        message={successMessage}
      />
    </Dialog>
  )
}

export default PhysicalScanner
