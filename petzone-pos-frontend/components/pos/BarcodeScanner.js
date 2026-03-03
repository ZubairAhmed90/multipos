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
  ListItemSecondaryAction,
  Divider,
  Snackbar
} from '@mui/material'
import {
  QrCodeScanner as ScannerIcon,
  CameraAlt as CameraIcon,
  Keyboard as KeyboardIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  Search as SearchIcon
} from '@mui/icons-material'

const BarcodeScanner = ({ onScan, onClose, open, inventoryItems = [] }) => {
  const [isScanning, setIsScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanHistory, setScanHistory] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Load scan history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('barcodeScanHistory')
    if (savedHistory) {
      setScanHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Save scan history to localStorage
  const saveScanHistory = (scanData) => {
    const newHistory = [scanData, ...scanHistory.slice(0, 19)] // Keep last 20 scans
    setScanHistory(newHistory)
    localStorage.setItem('barcodeScanHistory', JSON.stringify(newHistory))
  }

  // Start camera scanning
  const startScanning = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsScanning(true)
      }
    } catch (err) {
      setError('Camera access denied or not available. Please use manual entry.')
    }
  }

  // Stop camera scanning
  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  // Enhanced barcode processing with validation and search
  const processBarcode = async (barcode) => {
    setLoading(true)
    setError('')
    
    try {
      // First, try exact match
      let product = inventoryItems.find(p => 
        p.sku === barcode || 
        p.barcode === barcode ||
        p.name.toLowerCase() === barcode.toLowerCase()
      )
      
      if (product) {
        // Success - product found
        const scanData = {
          barcode,
          product: product.name,
          success: true,
          timestamp: new Date().toISOString(),
          method: 'exact_match'
        }
        saveScanHistory(scanData)
        
        setSuccessMessage(`✅ Found: ${product.name}`)
        setShowSuccessSnackbar(true)
        onScan(barcode)
        setManualCode('')
        setShowSearchResults(false)
        return
      }
      
      // If no exact match, try fuzzy search
      const fuzzyResults = inventoryItems.filter(p => 
        p.sku?.includes(barcode) ||
        p.barcode?.includes(barcode) ||
        p.name.toLowerCase().includes(barcode.toLowerCase())
      ).slice(0, 5) // Limit to 5 results
      
      if (fuzzyResults.length > 0) {
        // Show search results
        setSearchResults(fuzzyResults)
        setShowSearchResults(true)
        
        const scanData = {
          barcode,
          product: 'Multiple matches found',
          success: false,
          timestamp: new Date().toISOString(),
          method: 'fuzzy_search',
          results: fuzzyResults.length
        }
        saveScanHistory(scanData)
        
        setError(`No exact match found. Found ${fuzzyResults.length} similar products.`)
      } else {
        // No matches found
        const scanData = {
          barcode,
          product: 'Not found',
          success: false,
          timestamp: new Date().toISOString(),
          method: 'no_match'
        }
        saveScanHistory(scanData)
        
        setError('❌ Product not found. Please check the barcode or try manual search.')
      }
    } catch (err) {
      setError('Error processing barcode. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle manual barcode entry
  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      processBarcode(manualCode.trim())
    }
  }

  // Handle product selection from search results
  const handleProductSelect = (product) => {
    const scanData = {
      barcode: manualCode,
      product: product.name,
      success: true,
      timestamp: new Date().toISOString(),
      method: 'manual_selection'
    }
    saveScanHistory(scanData)
    
    setSuccessMessage(`✅ Selected: ${product.name}`)
    setShowSuccessSnackbar(true)
    onScan(product.sku || product.barcode || manualCode)
    setManualCode('')
    setShowSearchResults(false)
  }

  // Handle key press for manual entry
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleManualSubmit()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Close dialog and cleanup
  const handleClose = () => {
    stopScanning()
    onClose()
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScannerIcon />
            <Typography variant="h6">Enhanced Barcode Scanner</Typography>
            {scanHistory.length > 0 && (
              <Chip 
                icon={<HistoryIcon />} 
                label={`${scanHistory.length} scans`} 
                size="small" 
                color="primary" 
              />
            )}
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, height: '600px' }}>
            {/* Left Column - Scanner */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Camera View */}
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Camera Scanner
                </Typography>
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      maxWidth: '400px',
                      height: '250px',
                      backgroundColor: '#000',
                      borderRadius: '8px'
                    }}
                  />
                  {!isScanning && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        color: 'white'
                      }}
                    >
                      <CameraIcon sx={{ fontSize: 48, mb: 1 }} />
                      <Typography>Camera not active</Typography>
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ mt: 2 }}>
                  {!isScanning ? (
                    <Button
                      variant="contained"
                      startIcon={<ScannerIcon />}
                      onClick={startScanning}
                      sx={{ mr: 1 }}
                    >
                      Start Scanning
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      onClick={stopScanning}
                    >
                      Stop Scanning
                    </Button>
                  )}
                </Box>
              </Paper>

              {/* Manual Entry */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Manual Entry
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    label="Enter barcode manually"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="1234567890123"
                    disabled={loading}
                    InputProps={{
                      startAdornment: <KeyboardIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleManualSubmit}
                    disabled={!manualCode.trim() || loading}
                    sx={{ minWidth: '120px' }}
                    startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </Box>
              </Paper>

              {/* Error Display */}
              {error && (
                <Alert severity="warning" icon={<ErrorIcon />}>
                  {error}
                </Alert>
              )}

              {/* Search Results */}
              {showSearchResults && searchResults.length > 0 && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Search Results ({searchResults.length} found)
                  </Typography>
                  <List dense>
                    {searchResults.map((product, index) => (
                      <ListItem 
                        key={index}
                        button
                        onClick={() => handleProductSelect(product)}
                        sx={{ borderRadius: 1, mb: 0.5 }}
                      >
                        <ListItemText
                          primary={product.name}
                          secondary={`SKU: ${product.sku} | Price: $${product.sellingPrice}`}
                        />
                        <ListItemSecondaryAction>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleProductSelect(product)}
                          >
                            Select
                          </Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>

            {/* Right Column - Scan History */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
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
                        <ListItem>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {scan.success ? (
                                  <CheckIcon color="success" fontSize="small" />
                                ) : (
                                  <ErrorIcon color="error" fontSize="small" />
                                )}
                                <Typography variant="body2">
                                  {scan.product}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Barcode: {scan.barcode}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(scan.timestamp).toLocaleString()}
                                </Typography>
                                <Chip 
                                  label={scan.method.replace('_', ' ')} 
                                  size="small" 
                                  sx={{ ml: 1 }}
                                  color={scan.success ? 'success' : 'error'}
                                />
                              </Box>
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
          <Button onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSuccessSnackbar(false)}
        message={successMessage}
      />
    </>
  )
}

export default BarcodeScanner

