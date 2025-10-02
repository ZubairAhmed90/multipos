'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material'
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Clear as ClearIcon
} from '@mui/icons-material'
import PrintDialog from '../../../components/print/PrintDialog'
import withAuth from '../../../components/auth/withAuth.js'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { createSale, createWarehouseSale, fetchSales } from '../../store/slices/salesSlice'
import { createWarehouseLedgerEntry } from '../../store/slices/warehouseLedgerSlice'
import { fetchCompanySalesHistory, clearCompanySalesHistory } from '../../store/slices/companySalesHistorySlice'
import { fetchRetailers } from '../../store/slices/retailersSlice'

// Validation schema for warehouse billing
const warehouseBillingSchema = yup.object({
  retailerId: yup.number().required('Retailer is required'),
  paymentMethod: yup.string().required('Payment method is required').oneOf(['CASH', 'CREDIT', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'MOBILE_MONEY']),
  paymentTerms: yup.string().when('paymentMethod', {
    is: 'CREDIT',
    then: (schema) => schema.required('Payment terms are required for credit sales'),
    otherwise: (schema) => schema.optional()
  }),
  notes: yup.string().optional().max(500, 'Notes cannot exceed 500 characters'),
})

function WarehouseBillingPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: inventoryItems, loading: inventoryLoading } = useSelector((state) => state.inventory)
  const { data: retailers, loading: retailersLoading } = useSelector((state) => state.retailers)
  const { data: companyHistory, loading: companyHistoryLoading, error: companyHistoryError } = useSelector((state) => state.companySalesHistory)
  
  // State management
  const [cart, setCart] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedRetailer, setSelectedRetailer] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [showCompanyHistory, setShowCompanyHistory] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [taxRate, setTaxRate] = useState(0) // Tax rate as percentage (0-100)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printData, setPrintData] = useState(null)

  // Load data on component mount
  useEffect(() => {
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      // Load warehouse inventory
      dispatch(fetchInventory({
        scopeType: 'WAREHOUSE',
        scopeId: user.warehouseId
      }))
      
      // Load retailers (customers) for this warehouse
      dispatch(fetchRetailers({ warehouseId: user.warehouseId }))
    }
  }, [dispatch, user])

  // Fetch retailer history when retailer is selected
  const handleRetailerSelect = (retailerId) => {
    setSelectedRetailer(retailerId)
    if (retailerId) {
      dispatch(fetchCompanySalesHistory({ companyId: retailerId }))
    } else {
      dispatch(clearCompanySalesHistory())
    }
  }

  // Filter inventory items based on search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const matches = inventoryItems?.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.includes(searchQuery) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      ).map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        sellingPrice: item.sellingPrice,
        currentStock: item.currentStock,
        unit: item.unit
      })) || []
      
      setSearchResults(matches)
      setShowSearchResults(true)
    } else {
      setShowSearchResults(false)
    }
  }, [searchQuery, inventoryItems])

  // Add product to cart
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id)
    if (existingItem) {
      if (existingItem.quantity < product.currentStock) {
        setCart(cart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
      }
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
    setShowSearchResults(false)
    setSearchQuery('')
  }

  // Remove product from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId))
  }

  // Update quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
    } else {
      const product = inventoryItems.find(item => item.id === productId)
      if (product && newQuantity <= product.currentStock) {
        setCart(cart.map(item => 
          item.id === productId 
            ? { ...item, quantity: newQuantity }
            : item
        ))
      }
    }
  }

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.sellingPrice || 0) * item.quantity), 0)
  const tax = subtotal * (taxRate / 100) // Tax based on editable rate
  const total = subtotal + tax

  // Handle billing
  const handleBilling = async () => {
    try {
      setIsProcessing(true)
      setError('')

      // Validate form
        await warehouseBillingSchema.validate({
          retailerId: selectedRetailer,
        paymentMethod,
        paymentTerms: paymentMethod === 'CREDIT' ? paymentTerms : undefined,
        notes
      })

      if (cart.length === 0) {
        throw new Error('Please add items to cart')
      }

      // Determine user's scope
      const getUserScope = () => {
        if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
          return { scopeType: 'WAREHOUSE', scopeId: user.warehouseId }
        }
        return { scopeType: 'WAREHOUSE', scopeId: 1 }
      }
      
      const userScope = getUserScope()
      const selectedRetailerData = retailers.find(r => r.id === parseInt(selectedRetailer))

      // Create warehouse sale data (different format than regular sales)
      const warehouseSaleData = {
        retailerId: parseInt(selectedRetailer), // Retailer ID
        items: cart.map(item => ({
          itemId: parseInt(item.id),
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.sellingPrice || 0),
          totalPrice: parseFloat(item.sellingPrice || 0) * item.quantity,
          discount: 0,
          name: item.name,
          sku: item.sku || ''
        })),
        totalAmount: parseFloat(subtotal),
        taxAmount: parseFloat(tax),
        discountAmount: 0,
        finalAmount: parseFloat(total),
        paymentMethod: paymentMethod,
        paymentTerms: paymentMethod === 'CREDIT' ? paymentTerms : undefined,
        notes: `Warehouse Billing - ${paymentMethod === 'CREDIT' ? `Credit Terms: ${paymentTerms}` : 'Cash Sale'}${notes ? ` | ${notes}` : ''}`
      }
      
      
      
      // Create the warehouse sale
      const result = await dispatch(createWarehouseSale(warehouseSaleData))
      
      
      if (createWarehouseSale.fulfilled.match(result)) {
        
        // Create ledger entries for the sale
        try {
          const warehouseId = userScope.scopeId
          const invoiceId = result.payload.data?.id || 'N/A'
          const retailerName = selectedRetailerData?.name || 'Retailer'
          
          // Create Sales Revenue entry (Credit)
          await dispatch(createWarehouseLedgerEntry({
            type: 'CREDIT',
            amount: total,
            description: `Sales revenue from ${retailerName} - Invoice #${invoiceId}`,
            reference: 'SALES_REVENUE',
            reference_id: invoiceId.toString(),
            warehouseId: warehouseId
          }))
          
          // Create payment method specific entry (Debit)
          let paymentDescription = ''
          let paymentReference = ''
          
          switch (paymentMethod) {
            case 'CASH':
              paymentDescription = `Cash received from ${retailerName} - Invoice #${invoiceId}`
              paymentReference = 'CASH_RECEIPT'
              break
            case 'BANK_TRANSFER':
              paymentDescription = `Bank transfer received from ${retailerName} - Invoice #${invoiceId}`
              paymentReference = 'BANK_TRANSFER'
              break
            case 'CARD':
              paymentDescription = `Card payment received from ${retailerName} - Invoice #${invoiceId}`
              paymentReference = 'CARD_PAYMENT'
              break
            case 'CHEQUE':
              paymentDescription = `Cheque payment received from ${retailerName} - Invoice #${invoiceId}`
              paymentReference = 'CHEQUE_PAYMENT'
              break
            case 'MOBILE_MONEY':
              paymentDescription = `Mobile money received from ${retailerName} - Invoice #${invoiceId}`
              paymentReference = 'MOBILE_MONEY'
              break
            case 'CREDIT':
              paymentDescription = `Accounts Receivable from ${retailerName} - Invoice #${invoiceId}${paymentTerms ? ` (Terms: ${paymentTerms})` : ''}`
              paymentReference = 'ACCOUNTS_RECEIVABLE'
              break
            default:
              paymentDescription = `Payment received from ${retailerName} - Invoice #${invoiceId}`
              paymentReference = 'PAYMENT_RECEIVED'
          }
          
          await dispatch(createWarehouseLedgerEntry({
            type: 'DEBIT',
            amount: total,
            description: paymentDescription,
            reference: paymentReference,
            reference_id: invoiceId.toString(),
            warehouseId: warehouseId
          }))
          
        } catch (ledgerError) {
          // Don't fail the sale if ledger entry fails
        }
        
        // Prepare print data and open receipt modal directly
        const invoiceNumber = result.payload.data?.invoiceNumber || result.payload.data?.invoice_number || result.payload.invoiceNumber || result.payload.invoice_number || 'N/A'
        
        const printData = {
          type: 'invoice',
          title: 'WAREHOUSE INVOICE',
          companyName: 'PetZone',
          companyAddress: '123 Pet Street, City, State 12345',
          companyPhone: '(555) 123-4567',
          companyEmail: 'info@petzone.com',
          receiptNumber: invoiceNumber,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
          cashierName: user?.username || user?.name || 'Warehouse Keeper',
          customerName: selectedRetailerData?.name || 'Retailer Sale',
          items: cart.map(item => ({
            name: item.name,
            sku: item.sku || '',
            quantity: item.quantity,
            unitPrice: parseFloat(item.sellingPrice) || 0,
            total: (parseFloat(item.sellingPrice) || 0) * item.quantity
          })),
          subtotal: subtotal,
          tax: tax,
          total: total,
          paymentMethod: paymentMethod,
          change: 0,
          notes: notes || '',
          footerMessage: 'Thank you for your business!'
        }
        
        setPrintData(printData)
        setShowPrintDialog(true)
        
        // Refresh sales data to show the new sale in sales management
        dispatch(fetchSales())
      } else if (createWarehouseSale.rejected.match(result)) {
        
        // Extract validation errors if available
        let errorMessage = result.payload
        if (result.payload?.response?.data?.errors) {
          const validationErrors = result.payload.response.data.errors
          errorMessage = `Validation errors: ${validationErrors.map(err => err.msg).join(', ')}`
        } else if (result.payload?.response?.data?.message) {
          errorMessage = result.payload.response.data.message
        }
        
        setError(`Failed to create bill: ${errorMessage}`)
      } else {
        setError('Unexpected error occurred')
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Print warehouse receipt function
  const printWarehouseReceipt = async (sale) => {
    try {
      // Check if printer is available
      if (!navigator.serial) {
        throw new Error('Serial API not supported - no printer available')
      }
      
      // Try to connect to printer
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })
      
      const writer = port.writable.getWriter()
      
      // Format receipt using backend utility
      const receiptData = await fetch('/api/receipt/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sale: sale,
          scopeType: 'WAREHOUSE',
          scopeId: user.warehouseId
        })
      })
      
      if (!receiptData.ok) {
        throw new Error('Failed to format receipt')
      }
      
      const receiptText = await receiptData.text()
      
      // Send to printer
      await writer.write(new TextEncoder().encode(receiptText))
      
      // Close connection
      writer.releaseLock()
      await port.close()
      
    } catch (error) {
      
      // Handle specific error types
      if (error.name === 'NotFoundError') {
        throw new Error('No printer selected - user cancelled port selection')
      } else if (error.name === 'NotAllowedError') {
        throw new Error('Printer access denied - please allow serial port access')
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Serial API not supported in this browser')
      } else if (error.message.includes('Serial API not supported')) {
        throw new Error('No printer available - Serial API not supported')
      } else {
        throw new Error(`Printer error: ${error.message}`)
      }
    }
  }

  // Clear cart
  const clearCart = () => {
    setCart([])
    setSelectedRetailer('')
    setPaymentMethod('CASH')
    setPaymentTerms('')
    setNotes('')
    setError('')
  }

  // Handle print completion
  const handlePrintComplete = () => {
    setShowPrintDialog(false)
    setPrintData(null)
    // Clear the form after successful printing
    clearCart()
  }

  return (
    <RouteGuard allowedRoles={['WAREHOUSE_KEEPER', 'ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon />
                Warehouse Billing
              </Typography>
              <Chip 
                label={`Warehouse: ${user?.warehouseId || 'Unknown'}`}
                color="primary"
                variant="outlined"
              />
            </Box>
          </Paper>

          <Grid container spacing={3}>
            {/* Left Column - Product Search & Cart */}
            <Grid item xs={12} md={8}>
              {/* Product Search */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Product Search
                </Typography>
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    placeholder="Search products by name, SKU, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                  
                  {/* Search Results */}
                  {showSearchResults && searchResults.length > 0 && (
                    <Paper sx={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0, 
                      zIndex: 1000,
                      maxHeight: 300,
                      overflow: 'auto'
                    }}>
                      {searchResults.map((product) => (
                        <Box
                          key={product.id}
                          sx={{ 
                            p: 2, 
                            borderBottom: '1px solid #eee',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#f5f5f5' }
                          }}
                          onClick={() => addToCart(product)}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle1">{product.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                SKU: {product.sku} | Stock: {product.currentStock} {product.unit}
                              </Typography>
                            </Box>
                            <Typography variant="h6" color="primary">
                              ${product.sellingPrice}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Paper>
                  )}
                </Box>
              </Paper>

              {/* Cart */}
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Cart ({cart.length} items)
                  </Typography>
                  <Button
                    startIcon={<ClearIcon />}
                    onClick={clearCart}
                    disabled={cart.length === 0}
                  >
                    Clear Cart
                  </Button>
                </Box>

                {cart.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No items in cart. Search and add products to create a bill.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell>Price</TableCell>
                          <TableCell>Quantity</TableCell>
                          <TableCell>Total</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Typography variant="subtitle2">{item.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.category}
                              </Typography>
                            </TableCell>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell>${parseFloat(item.sellingPrice || 0).toFixed(2)}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                  <RemoveIcon />
                                </IconButton>
                                <TextField
                                  size="small"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                                  sx={{ width: 60 }}
                                  inputProps={{ min: 1, max: item.currentStock }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.currentStock}
                                >
                                  <AddIcon />
                                </IconButton>
                              </Box>
                            </TableCell>
                            <TableCell>${(parseFloat(item.sellingPrice || 0) * item.quantity).toFixed(2)}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <RemoveIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Grid>

            {/* Right Column - Billing Details */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Billing Details
                </Typography>

                {/* Retailer Selection */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Retailer</InputLabel>
                  <Select
                    value={selectedRetailer}
                    onChange={(e) => handleRetailerSelect(e.target.value)}
                    label="Retailer"
                  >
                    {retailers?.map((retailer) => (
                      <MenuItem key={retailer.id} value={retailer.id}>
                        {retailer.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Retailer History Button */}
                {selectedRetailer && (
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ mb: 2 }}
                    onClick={() => {
                      setShowCompanyHistory(true)
                    }}
                    disabled={companyHistoryLoading}
                  >
                    {companyHistoryLoading ? <CircularProgress size={20} /> : 'View Retailer History'}
                  </Button>
                )}

                {/* Payment Method */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    label="Payment Method"
                  >
                    <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="CREDIT">Credit</MenuItem>
                    <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                    <MenuItem value="CARD">Card Payment</MenuItem>
                    <MenuItem value="CHEQUE">Cheque</MenuItem>
                    <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
                  </Select>
                </FormControl>

                {/* Payment Terms (for credit) */}
                {paymentMethod === 'CREDIT' && (
                  <TextField
                    fullWidth
                    label="Payment Terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g., Net 30, Net 60"
                    sx={{ mb: 2 }}
                  />
                )}

                {/* Notes */}
                <TextField
                  fullWidth
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  rows={3}
                  sx={{ mb: 2 }}
                />

                {/* Totals */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Subtotal:</Typography>
                    <Typography>${subtotal.toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>Tax:</Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                        inputProps={{ 
                          min: 0, 
                          max: 100, 
                          step: 0.1,
                          style: { width: '60px', textAlign: 'center' }
                        }}
                        sx={{ width: '80px' }}
                      />
                      <Typography sx={{ fontSize: '0.8rem' }}>%</Typography>
                    </Box>
                    <Typography>${tax.toFixed(2)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Total:</Typography>
                    <Typography variant="h6">${total.toFixed(2)}</Typography>
                  </Box>
                </Box>

                {/* Error Display */}
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<SaveIcon />}
                    onClick={handleBilling}
                    disabled={cart.length === 0 || !selectedRetailer || isProcessing}
                  >
                    {isProcessing ? <CircularProgress size={20} /> : 'Create Bill'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>


          {/* Retailer History Dialog */}
          <Dialog 
            open={showCompanyHistory} 
            onClose={() => setShowCompanyHistory(false)} 
            maxWidth="lg" 
            fullWidth
          >
            <DialogTitle>
              <Box>
                <Typography variant="h6" component="div">
                  Retailer Transaction History
                </Typography>
                {companyHistory?.company && (
                  <Typography variant="subtitle2" color="textSecondary" component="div">
                    {companyHistory.company.name}
                  </Typography>
                )}
              </Box>
            </DialogTitle>
            <DialogContent>
              {companyHistoryError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {companyHistoryError}
                </Alert>
              )}
              
              {companyHistoryLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : companyHistory ? (
                <Box>
                  {/* Summary Statistics */}
                  <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Summary</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Total Sales</Typography>
                        <Typography variant="h6">{companyHistory.summary.totalSales}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Total Amount</Typography>
                        <Typography variant="h6">${companyHistory.summary.totalAmount.toFixed(2)}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Payment Methods</Typography>
                        <Typography variant="body2">
                          {companyHistory.summary.paymentMethods.join(', ')}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Payment Status</Typography>
                        <Typography variant="body2">
                          {companyHistory.summary.paymentStatuses.join(', ')}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Transaction History */}
                  <Typography variant="h6" sx={{ mb: 2 }}>Transaction History</Typography>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Invoice #</TableCell>
                          <TableCell>Items</TableCell>
                          <TableCell>Payment Method</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {companyHistory.sales && companyHistory.sales.length > 0 ? (
                          companyHistory.sales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell>
                                {new Date(sale.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>{sale.invoice_number}</TableCell>
                              <TableCell>
                                <Box>
                                  {sale.items?.map((item, index) => (
                                    <Typography key={index} variant="body2">
                                      {item.itemName} (Qty: {item.quantity})
                                    </Typography>
                                  ))}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={sale.payment_method} 
                                  size="small"
                                  color={sale.payment_method === 'CASH' ? 'success' : 
                                         sale.payment_method === 'CREDIT' ? 'warning' : 'info'}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={sale.payment_status} 
                                  size="small"
                                  color={sale.payment_status === 'COMPLETED' ? 'success' : 'warning'}
                                />
                              </TableCell>
                              <TableCell>${parseFloat(sale.total).toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              No transaction history found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <Typography>No retailer selected</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowCompanyHistory(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Print Dialog */}
          {showPrintDialog && printData && (
            <PrintDialog
              open={showPrintDialog}
              onClose={() => setShowPrintDialog(false)}
              printData={printData}
              onPrintComplete={handlePrintComplete}
            />
          )}
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(WarehouseBillingPage)
