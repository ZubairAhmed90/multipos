    'use client'
    import React, { useState, useEffect, useCallback } from 'react'
    import { useDispatch, useSelector } from 'react-redux'
    import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Chip,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    CircularProgress,
    Tooltip,
    Divider,
    Card,
    CardContent,
    Autocomplete
    } from '@mui/material'
    import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Close as CloseIcon,
    Edit as EditIcon,
    Inventory as InventoryIcon
    } from '@mui/icons-material'
    import { updateSale } from '../../app/store/slices/salesSlice'
    import { fetchInventory } from '../../app/store/slices/inventorySlice'
    import api from '../../utils/axios'

    const EditableInvoiceForm = ({ 
    open, 
    onClose, 
    sale, 
    onSave 
    }) => {
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.auth)
    const { data: inventoryItems } = useSelector((state) => state.inventory)
    
    // Form state
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        paymentMethod: 'CASH',
        paymentStatus: 'COMPLETED',
        notes: '',
        items: [],
        tax: 0,
        hasTax: false
    })
    
    // UI state
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    
    // Inventory tracking
    const [inventoryChanges, setInventoryChanges] = useState({
        added: [], // Items added to sale
        removed: [], // Items removed from sale
        modified: [] // Items with quantity changes
    })
    
    // Available inventory items for adding
    const [availableItems, setAvailableItems] = useState([])

  // Initialize form data when sale changes
  useEffect(() => {
    if (sale) {
      console.log('[EditableInvoiceForm] Sale data received:', {
        id: sale.id,
        payment_method: sale.paymentMethod,
        payment_status: sale.paymentStatus,
        credit_amount: sale.creditAmount,
        credit_status: sale.creditStatus
      });
      
      const originalTax = parseFloat(sale.tax) || 0
      const hasTax = originalTax > 0
      
      // Handle payment method with case sensitivity and fallback logic
      let paymentMethod = sale.paymentMethod;
      if (!paymentMethod && sale.creditAmount > 0) {
        paymentMethod = 'FULLY_CREDIT';
      } else if (!paymentMethod) {
        paymentMethod = 'CASH';
      }
      
      // Handle case sensitivity - normalize to uppercase
      if (paymentMethod && typeof paymentMethod === 'string') {
        paymentMethod = paymentMethod.toUpperCase();
      }
      
      const formData = {
        customerName: sale.customerInfo?.name || sale.customerName || 'Walk-in Customer',
        customerPhone: sale.customerInfo?.phone || sale.customerPhone || '',
        paymentMethod: paymentMethod,
        paymentStatus: sale.paymentStatus || (sale.creditAmount > 0 ? 'PARTIAL' : 'COMPLETED'),
        notes: sale.notes || '',
        items: sale.items || [],
        tax: originalTax,
        hasTax: hasTax
      };
      
      console.log('[EditableInvoiceForm] Form data being set:', formData);
      setFormData(formData);
        
        // Initialize inventory changes tracking
        setInventoryChanges({
            added: [],
            removed: [],
            modified: []
        })
        }
    }, [sale])

    // Load available inventory items
    useEffect(() => {
        if (open && inventoryItems) {
        // Filter inventory items based on user scope
        let filteredItems = inventoryItems
        
        if (user?.role === 'CASHIER' && user?.branchId) {
            // Get branch name for comparison
            const branchName = user.branchName || `Branch ${user.branchId}`
            filteredItems = inventoryItems.filter(item => 
            item.scopeType === 'BRANCH' && item.scopeId === branchName
            )
        } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
            // Get warehouse name for comparison
            const warehouseName = user.warehouseName || `Warehouse ${user.warehouseId}`
            filteredItems = inventoryItems.filter(item => 
            item.scopeType === 'WAREHOUSE' && item.scopeId === warehouseName
            )
        }
        
        setAvailableItems(filteredItems)
        }
    }, [open, inventoryItems, user])

    // Calculate totals
    const calculateTotals = useCallback(() => {
        const subtotal = formData.items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice))
        }, 0)
        
        const totalDiscount = formData.items.reduce((sum, item) => {
        return sum + (parseFloat(item.discount) || 0)
        }, 0)
        
        // Include tax if the original invoice had tax
        const tax = formData.hasTax ? parseFloat(formData.tax) : 0
        const total = subtotal + tax - totalDiscount
        
        return { subtotal, tax, totalDiscount, total }
    }, [formData.items, formData.tax, formData.hasTax])

    const totals = calculateTotals()

    // Handle form field changes
    const handleFieldChange = (field, value) => {
        setFormData(prev => ({
        ...prev,
        [field]: value
        }))
    }

    // Handle item quantity change
    const handleItemQuantityChange = (itemId, newQuantity) => {
        const quantity = Math.round(parseFloat(newQuantity) || 1) // Ensure whole numbers, minimum 1
        
        setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => 
            item.id === itemId 
            ? { ...item, quantity, total: quantity * parseFloat(item.unitPrice) }
            : item
        )
        }))
        
        // Track inventory change
        const item = formData.items.find(i => i.id === itemId)
        if (item) {
        const quantityChange = quantity - Math.round(parseFloat(item.quantity) || 1)
        if (quantityChange !== 0) {
            trackInventoryChange(item, quantityChange, 'MODIFY')
        }
        }
    }

    // Handle item name change (for empty rows)
    const handleItemNameChange = (itemId, newName) => {
        setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => 
            item.id === itemId 
            ? { 
                ...item, 
                itemName: newName,
                sku: newName ? `MANUAL-${Date.now()}` : '',
                category: newName ? 'Manual Entry' : ''
                }
            : item
        )
        }))
    }

    // Handle item selection from autocomplete
    const handleItemSelection = (itemId, selectedItem) => {
        if (selectedItem) {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item => 
            item.id === itemId 
                ? { 
                    ...item, 
                    inventoryItemId: selectedItem.id,
                    itemName: selectedItem.name,
                    sku: selectedItem.sku,
                    category: selectedItem.category,
                    unitPrice: parseFloat(selectedItem.sellingPrice) || 0,
                    quantity: 1, // Default quantity
                    total: parseFloat(selectedItem.sellingPrice) || 0
                }
                : item
            )
        }))
        
        // Track inventory change
        trackInventoryChange({
            inventoryItemId: selectedItem.id,
            itemName: selectedItem.name,
            quantity: 1
        }, 1, 'ADD')
        }
    }

    // Handle item price change
    const handleItemPriceChange = (itemId, newPrice) => {
        const price = parseFloat(newPrice) || 0
        
        setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => 
            item.id === itemId 
            ? { ...item, unitPrice: price, total: parseFloat(item.quantity) * price }
            : item
        )
        }))
    }

    // Handle item discount change
    const handleItemDiscountChange = (itemId, newDiscount) => {
        const discount = parseFloat(newDiscount) || 0
        
        setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => 
            item.id === itemId 
            ? { ...item, discount }
            : item
        )
        }))
    }

    // Remove item from sale
    const handleRemoveItem = (itemId) => {
        const item = formData.items.find(i => i.id === itemId)
        
        setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== itemId)
        }))
        
        // Track inventory change (restore stock)
        if (item) {
        trackInventoryChange(item, parseFloat(item.quantity), 'REMOVE')
        }
    }

    // Add empty row to table
    const handleAddEmptyRow = () => {
        console.log('Add Row button clicked - adding empty row to table')
        
        const emptyItem = {
        id: `temp_${Date.now()}`,
        inventoryItemId: null,
        itemName: '',
        sku: '',
        quantity: 1, // Default to 1 whole number
        unitPrice: 0,
        discount: 0,
        total: 0,
        category: '',
        isNew: true // Flag to indicate this is a new empty row
        }
        
        setFormData(prev => ({
        ...prev,
        items: [...prev.items, emptyItem]
        }))
        
        setSuccess('Empty row added - you can now search and select an item')
        setTimeout(() => setSuccess(null), 2000)
    }

    // Track inventory changes
    const trackInventoryChange = (item, quantityChange, type) => {
        // Don't track inventory changes for manual items (they don't have inventoryItemId)
        if (!item.inventoryItemId) {
        return
        }
        
        setInventoryChanges(prev => {
        const change = {
            inventoryItemId: item.inventoryItemId,
            itemName: item.itemName,
            quantityChange,
            type
        }
        
        switch (type) {
            case 'ADD':
            return {
                ...prev,
                added: [...prev.added.filter(c => c.inventoryItemId !== item.inventoryItemId), change]
            }
            case 'REMOVE':
            return {
                ...prev,
                removed: [...prev.removed.filter(c => c.inventoryItemId !== item.inventoryItemId), change]
            }
            case 'MODIFY':
            return {
                ...prev,
                modified: [...prev.modified.filter(c => c.inventoryItemId !== item.inventoryItemId), change]
            }
            default:
            return prev
        }
        })
    }

    // Save changes
    const handleSave = async () => {
        setSaving(true)
        setError(null)
        
        try {
        // Prepare update data
        const updateData = {
            ...formData,
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: totals.totalDiscount,
            total: totals.total,
            inventoryChanges
        }
        
        console.log('[EditableInvoiceForm] Sending update data:', updateData)
        console.log('[EditableInvoiceForm] Inventory changes:', inventoryChanges)
        
        // Call backend API to update sale
        const response = await api.put(`/sales/${sale.id}`, updateData)
        
        if (response.data.success) {
            setSuccess('Sale updated successfully!')
            
            // Refresh inventory data
            dispatch(fetchInventory())
            
            // Call parent callback
            if (onSave) {
            onSave(response.data.data)
            }
            
            // Close dialog after a short delay
            setTimeout(() => {
            onClose()
            }, 1500)
        } else {
            setError(response.data.message || 'Failed to update sale')
        }
        } catch (err) {
        console.error('Error updating sale:', err)
        console.error('Error response:', err.response?.data)
        console.error('Error status:', err.response?.status)
        
        if (err.response?.data?.errors) {
            // Handle validation errors
            const validationErrors = err.response.data.errors.map(error => error.msg).join(', ')
            setError(`Validation errors: ${validationErrors}`)
        } else {
            setError(err.response?.data?.message || err.message || 'Failed to update sale')
        }
        } finally {
        setSaving(false)
        }
    }

    // Get inventory change summary
    const getInventoryChangeSummary = () => {
        const totalAdded = inventoryChanges.added.reduce((sum, change) => sum + Math.abs(change.quantityChange), 0)
        const totalRemoved = inventoryChanges.removed.reduce((sum, change) => sum + change.quantityChange, 0)
        const totalModified = inventoryChanges.modified.reduce((sum, change) => sum + Math.abs(change.quantityChange), 0)
        
        return { totalAdded, totalRemoved, totalModified }
    }

    const changeSummary = getInventoryChangeSummary()

    if (!sale) return null

    return (
        <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
            sx: { minHeight: '70vh', maxHeight: '90vh' }
        }}
        >
        <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
                <Typography variant="h5" fontWeight="bold" color="primary">
                Invoice #{sale.invoice_no || sale.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                Edit Invoice Details
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

            {/* Sale Details & Add Item - Combined */}
            <Card sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 2 }}>
                <Typography variant="h6" gutterBottom>
                Invoice Details
                </Typography>
                
                {/* Customer & Payment Info */}
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}>
                    <TextField
                    fullWidth
                    size="small"
                    label="Customer Name"
                    value={formData.customerName}
                    onChange={(e) => handleFieldChange('customerName', e.target.value)}
                    />
                </Grid>
                <Grid item xs={12} sm={3}>
                    <TextField
                    fullWidth
                    size="small"
                    label="Customer Phone"
                    value={formData.customerPhone}
                    onChange={(e) => handleFieldChange('customerPhone', e.target.value)}
                    />
                </Grid>
                <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                        value={formData.paymentMethod}
                        onChange={(e) => {
                          console.log('[EditableInvoiceForm] Payment method changed to:', e.target.value);
                          handleFieldChange('paymentMethod', e.target.value);
                        }}
                    >
                        <MenuItem value="CASH">Cash</MenuItem>
                        <MenuItem value="CARD">Card</MenuItem>
                        <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                        <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
                        <MenuItem value="FULLY_CREDIT">Fully Credit</MenuItem>
                        <MenuItem value="PARTIAL_PAYMENT">Partial Payment</MenuItem>
                    </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                    <InputLabel>Payment Status</InputLabel>
                    <Select
                        value={formData.paymentStatus}
                        onChange={(e) => handleFieldChange('paymentStatus', e.target.value)}
                    >
                        <MenuItem value="PENDING">Pending</MenuItem>
                        <MenuItem value="COMPLETED">Completed</MenuItem>
                        <MenuItem value="PARTIAL">Partial Payment</MenuItem>
                        <MenuItem value="FAILED">Failed</MenuItem>
                        <MenuItem value="REFUNDED">Refunded</MenuItem>
                    </Select>
                    </FormControl>
                </Grid>
                {formData.hasTax && (
                    <Grid item xs={12} sm={2}>
                    <TextField
                        fullWidth
                        size="small"
                        label="Tax Amount"
                        type="number"
                        value={parseFloat(formData.tax || 0).toFixed(2).replace(/\.00$/, '')}
                        onChange={(e) => handleFieldChange('tax', parseFloat(e.target.value) || 0)}
                        inputProps={{ 
                        min: 0, 
                        step: 0.01,
                        inputMode: 'decimal'
                        }}
                        sx={{
                        '& input[type=number]': {
                            MozAppearance: 'textfield'
                        },
                        '& input[type=number]::-webkit-outer-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0
                        },
                        '& input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0
                        }
                        }}
                    />
                    </Grid>
                )}
                </Grid>

            </CardContent>
            </Card>

            {/* Items Table */}
            <Card sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 2 }}>
                <Typography variant="h6" gutterBottom>
                Invoice Items ({formData.items.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                    <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>Item</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 100 }} align="right">Price</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 80 }} align="center">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 80 }} align="right">Disc.</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 100 }} align="right">Total</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 60 }} align="center">Action</TableCell>
                    </TableRow>
                    </TableHead>
                    <TableBody>
                    {formData.items.map((item) => (
                        <TableRow key={item.id} hover>
                        <TableCell sx={{ py: 1 }}>
                            {item.isNew ? (
                            <Autocomplete
                                size="small"
                                options={availableItems}
                                getOptionLabel={(option) => option.name || ''}
                                value={availableItems.find(option => option.name === item.itemName) || null}
                                onChange={(event, newValue) => {
                                if (newValue) {
                                    handleItemSelection(item.id, newValue)
                                } else {
                                    handleItemNameChange(item.id, '')
                                }
                                }}
                                onInputChange={(event, newInputValue) => {
                                handleItemNameChange(item.id, newInputValue)
                                }}
                                renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Search items..."
                                    sx={{
                                    '& .MuiInputBase-input': {
                                        py: 0.5,
                                        fontSize: '0.875rem'
                                    }
                                    }}
                                />
                                )}
                                renderOption={(props, option) => (
                                <Box component="li" {...props}>
                                    <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                        {option.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {option.sku} • {option.category} • Stock: {option.currentStock} • Price: ${parseFloat(option.sellingPrice || 0).toFixed(2)}
                                    </Typography>
                                    </Box>
                                </Box>
                                )}
                                filterOptions={(options, { inputValue }) => {
                                return options.filter(option =>
                                    option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                                    option.sku.toLowerCase().includes(inputValue.toLowerCase()) ||
                                    option.category.toLowerCase().includes(inputValue.toLowerCase())
                                )
                                }}
                                noOptionsText="No items found"
                                clearOnEscape
                                selectOnFocus
                                handleHomeEndKeys
                                fullWidth
                            />
                            ) : (
                            <>
                                <Typography variant="body2" fontWeight="medium" sx={{ lineHeight: 1.2 }}>
                                {item.itemName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                {item.sku} • {item.category}
                                </Typography>
                            </>
                            )}
                        </TableCell>
                        <TableCell align="right">
                            <TextField
                            size="small"
                            type="number"
                            value={parseFloat(item.unitPrice || 0).toFixed(2).replace(/\.00$/, '')}
                            onChange={(e) => handleItemPriceChange(item.id, e.target.value || '0')}
                            inputProps={{ 
                                min: 0, 
                                step: 0.01,
                                inputMode: 'decimal',
                                style: { textAlign: 'right' }
                            }}
                            sx={{ 
                                width: 90,
                                '& .MuiInputBase-input': { 
                                textAlign: 'right',
                                py: 0.5
                                },
                                '& input[type=number]': {
                                MozAppearance: 'textfield'
                                },
                                '& input[type=number]::-webkit-outer-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0
                                },
                                '& input[type=number]::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0
                                }
                            }}
                            />
                        </TableCell>
                        <TableCell align="center">
                            <TextField
                            size="small"
                            type="number"
                            value={Math.round(parseFloat(item.quantity || 0))}
                            onChange={(e) => handleItemQuantityChange(item.id, e.target.value || '0')}
                            inputProps={{ 
                                min: 1, 
                                step: 1,
                                inputMode: 'numeric',
                                style: { textAlign: 'center' }
                            }}
                            sx={{ 
                                width: 70,
                                '& .MuiInputBase-input': { 
                                textAlign: 'center',
                                py: 0.5
                                },
                                '& input[type=number]': {
                                MozAppearance: 'textfield'
                                },
                                '& input[type=number]::-webkit-outer-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0
                                },
                                '& input[type=number]::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0
                                }
                            }}
                            />
                        </TableCell>
                        <TableCell align="right">
                            <TextField
                            size="small"
                            type="number"
                            value={parseFloat(item.discount || 0).toFixed(2).replace(/\.00$/, '')}
                            onChange={(e) => handleItemDiscountChange(item.id, e.target.value || '0')}
                            inputProps={{ 
                                min: 0, 
                                step: 0.01,
                                inputMode: 'decimal',
                                style: { textAlign: 'right' }
                            }}
                            sx={{ 
                                width: 70,
                                '& .MuiInputBase-input': { 
                                textAlign: 'right',
                                py: 0.5
                                },
                                '& input[type=number]': {
                                MozAppearance: 'textfield'
                                },
                                '& input[type=number]::-webkit-outer-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0
                                },
                                '& input[type=number]::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0
                                }
                            }}
                            />
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1 }}>
                            <Typography variant="body2" fontWeight="medium" sx={{ lineHeight: 1.2 }}>
                            {((parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)) - (parseFloat(item.discount) || 0)).toFixed(2).replace(/\.00$/, '')}
                            </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1 }}>
                            <Tooltip title="Remove Item">
                            <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveItem(item.id)}
                                sx={{ py: 0.5 }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                            </Tooltip>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </TableContainer>
                
                {/* Add Item Button */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddEmptyRow}
                    sx={{ 
                    minWidth: '100px',
                    borderRadius: '20px',
                    textTransform: 'none',
                    fontSize: '0.875rem'
                    }}
                >
                    + Add Item
                </Button>
                </Box>
            </CardContent>
            </Card>

            {/* Inventory Changes & Totals - Combined */}
            <Card>
            <CardContent sx={{ pb: 2 }}>
                <Grid container spacing={2}>
                {/* Inventory Changes */}
                {(changeSummary.totalAdded > 0 || changeSummary.totalRemoved > 0 || changeSummary.totalModified > 0) && (
                    <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom color="primary">
                        <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                        Inventory Changes
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {changeSummary.totalAdded > 0 && (
                        <Chip
                            label={`${changeSummary.totalAdded} added`}
                            color="success"
                            size="small"
                            variant="outlined"
                        />
                        )}
                        {changeSummary.totalRemoved > 0 && (
                        <Chip
                            label={`${changeSummary.totalRemoved} removed`}
                            color="error"
                            size="small"
                            variant="outlined"
                        />
                        )}
                        {changeSummary.totalModified > 0 && (
                        <Chip
                            label={`${changeSummary.totalModified} modified`}
                            color="warning"
                            size="small"
                            variant="outlined"
                        />
                        )}
                    </Box>
                    </Grid>
                )}
                
                {/* Totals */}
                <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                    Invoice Totals
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Subtotal:</Typography>
                    <Typography variant="body2">{totals.subtotal.toFixed(2).replace(/\.00$/, '')}</Typography>
                    </Box>
                    {totals.tax > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Tax:</Typography>
                        <Typography variant="body2">{totals.tax.toFixed(2).replace(/\.00$/, '')}</Typography>
                    </Box>
                    )}
                    {totals.totalDiscount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Discount:</Typography>
                        <Typography variant="body2" color="error">-{totals.totalDiscount.toFixed(2).replace(/\.00$/, '')}</Typography>
                    </Box>
                    )}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" fontWeight="bold">Total:</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                        {totals.total.toFixed(2).replace(/\.00$/, '')}
                    </Typography>
                    </Box>
                </Grid>
                </Grid>
            </CardContent>
            </Card>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
            <Button onClick={onClose} disabled={saving}>
            Cancel
            </Button>
            <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || formData.items.length === 0}
            >
            {saving ? 'Saving...' : 'Save Changes'}
            </Button>
        </DialogActions>
        </Dialog>
    )
    }

    export default EditableInvoiceForm
