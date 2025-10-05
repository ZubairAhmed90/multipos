'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../../utils/axios'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Fade,
  Slide,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material'
import {
  QrCodeScanner as ScannerIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Search as SearchIcon,
  Keyboard as KeyboardIcon,
  Close as CloseIcon,
  AddBox as NewTabIcon,
  Tab as TabIcon,
  ShoppingCart as CartIcon,
  Print as PrintIcon,
  Settings as SettingsIcon,
  FilterList as FilterIcon,
  Category as CategoryIcon,
  LocalOffer as OfferIcon,
  TrendingUp as TrendingIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  AccountBalance as OutstandingIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon
} from '@mui/icons-material'
import PrintDialog from '../../../../components/print/PrintDialog'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import PhysicalScanner from '../../../../components/pos/PhysicalScanner'
import { fetchInventory } from '../../../../app/store/slices/inventorySlice'
import { createSale, fetchSales } from '../../../../app/store/slices/salesSlice'

// Tab management utilities
const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
const generateTabName = (tabNumber) => `Sale ${tabNumber}`

function POSTerminal() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: inventoryItems, loading: inventoryLoading, error: inventoryError } = useSelector((state) => state.inventory)
  const salesData = useSelector((state) => state.sales.data) || []
  
  // Tab management state
  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [tabCounter, setTabCounter] = useState(1)
  
  // Current tab state
  const [barcodeInput, setBarcodeInput] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [isPartialPayment, setIsPartialPayment] = useState(false)
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showPhysicalScanner, setShowPhysicalScanner] = useState(false)
  const [taxRate, setTaxRate] = useState(0) // Tax rate as percentage (0-100)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showPrinterDialog, setShowPrinterDialog] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [scannerStatus, setScannerStatus] = useState({
    connected: false,
    lastScan: null,
    scanCount: 0,
    errors: []
  })
  
  // Outstanding payments state
  const [outstandingPayments, setOutstandingPayments] = useState([])
  const [selectedOutstandingPayments, setSelectedOutstandingPayments] = useState([])
  const [isSearchingOutstanding, setIsSearchingOutstanding] = useState(false)
  
  const barcodeInputRef = useRef(null)
  const manualInputRef = useRef(null)
  const lastScanTimeRef = useRef(0)

  // Enhanced barcode input handling for physical scanner
  useEffect(() => {
    const handlePhysicalScanner = (event) => {
      // Check if it's rapid keystrokes (typical of scanner)
      const now = Date.now()
      const timeDiff = now - (lastScanTimeRef.current || 0)
      
      // Update scanner status
      setScannerStatus(prev => ({
        ...prev,
        connected: true,
        lastScan: now
      }))
      
      if (timeDiff < 50 && event.key !== 'Enter') {
        // Rapid keystrokes - likely scanner input
        lastScanTimeRef.current = now
        return
      }
      
      // Handle Enter key from scanner
      if (event.key === 'Enter' && barcodeInput.trim().length > 0) {
        event.preventDefault()
        
        // Update scanner status
        setScannerStatus(prev => ({
          ...prev,
          scanCount: prev.scanCount + 1,
          lastScan: now
        }))
        
        handleBarcodeScan(barcodeInput.trim())
        setBarcodeInput('')
        return
      }
    }

    // Add event listener for physical scanner
    document.addEventListener('keydown', handlePhysicalScanner)
    
    return () => {
      document.removeEventListener('keydown', handlePhysicalScanner)
    }
  }, [barcodeInput])

  // Get current tab data
  const currentTab = tabs.find(tab => tab.id === activeTabId)
  const currentCart = currentTab?.cart || []

  // Create new tab
  const createNewTab = useCallback(() => {
    const newTab = {
      id: generateTabId(),
      name: generateTabName(tabCounter),
      cart: [],
      customerName: '',
      customerPhone: '',
      createdAt: new Date(),
      modifiedAt: new Date()
    }
    
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
    setTabCounter(prev => prev + 1)
    
    // Clear outstanding payments when creating new tab
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
  }, [tabCounter])

  // Load available printers
  const loadAvailablePrinters = async () => {
    try {
      // Use Web API to get available printers
      if (navigator.serial) {
        // For serial printers (thermal printers)
        const ports = await navigator.serial.getPorts()
        setAvailablePrinters(ports.map(port => ({
          id: port.getInfo().usbVendorId,
          name: `Thermal Printer ${port.getInfo().usbVendorId}`,
          type: 'thermal'
        })))
      }
      
      // Add default printer options
      setAvailablePrinters(prev => [
        ...prev,
        { id: 'default', name: 'Default Printer', type: 'default' },
        { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' },
        { id: 'thermal-58mm', name: 'Thermal 58mm', type: 'thermal' }
      ])
    } catch (error) {
      // Fallback to default printers
      setAvailablePrinters([
        { id: 'default', name: 'Default Printer', type: 'default' },
        { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' },
        { id: 'thermal-58mm', name: 'Thermal 58mm', type: 'thermal' }
      ])
    }
  }

  // Initialize with first tab and load inventory
  useEffect(() => {
    if (tabs.length === 0) {
      createNewTab()
    }
    
    // Load inventory based on user's scope
    if (user) {
      const params = {}
      
      if (user.role === 'CASHIER') {
        // Cashiers can see ALL branch inventory (not just their own branch)
        params.scopeType = 'BRANCH'
        // Don't set scopeId to allow all branches
      } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
        params.scopeType = 'WAREHOUSE'
        params.scopeId = user.warehouseId
      }
      // Admin can see all inventory (no scope restrictions)
      
      dispatch(fetchInventory(params))
    }
    
    // Load sales data for customer search
    dispatch(fetchSales())
    
    // Load available printers
    loadAvailablePrinters()
  }, [dispatch, user, tabs.length, createNewTab])

  // Search for outstanding payments when phone number changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (customerPhone && customerPhone.trim().length >= 3) {
        searchOutstandingPayments(customerPhone.trim())
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    }, 500) // Debounce search by 500ms

    return () => clearTimeout(timeoutId)
  }, [customerPhone])

  // Focus on barcode input when tab changes
  useEffect(() => {
    if (barcodeInputRef.current && activeTabId) {
      barcodeInputRef.current.focus()
    }
  }, [activeTabId])

  // Close tab
  const closeTab = (tabId) => {
    if (tabs.length <= 1) {
      // Don't allow closing the last tab
      return
    }
    
    const tabIndex = tabs.findIndex(tab => tab.id === tabId)
    const newTabs = tabs.filter(tab => tab.id !== tabId)
    
    setTabs(newTabs)
    
    // If closing active tab, switch to another tab
    if (tabId === activeTabId) {
      const newActiveIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex
      setActiveTabId(newTabs[newActiveIndex]?.id)
    }
  }

  // Switch to tab
  const switchToTab = (tabId) => {
    setActiveTabId(tabId)
    setBarcodeInput('')
    setManualInput('')
    setShowSearchResults(false)
  }

  // Update current tab data
  const updateCurrentTab = (updates) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, ...updates, modifiedAt: new Date() }
        : tab
    ))
  }

  // Handle barcode scanning
  const handleBarcodeScan = (barcode) => {
    // Search in real inventory data with multiple field matching
    const product = inventoryItems.find(p => {
      // Check multiple fields for barcode match
      const skuMatch = p.sku && p.sku.toString().toLowerCase() === barcode.toLowerCase()
      const barcodeMatch = p.barcode && p.barcode.toString().toLowerCase() === barcode.toLowerCase()
      const nameMatch = p.name && p.name.toLowerCase().includes(barcode.toLowerCase())
      
      return skuMatch || barcodeMatch || nameMatch
    })
    
    if (product) {
      // Transform inventory item to cart format
      const cartProduct = {
        id: product.id,
        name: product.name,
        price: product.sellingPrice,
        stock: product.currentStock,
        category: product.category,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit
      }
      addToCart(cartProduct)
      setBarcodeInput('')
      setShowSearchResults(false)
    } else {
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
  }

  // Enhanced search functionality
  const handleSearch = (query) => {
    setSearchQuery(query)
    if (query.length >= 2) {
      let matches = inventoryItems.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku?.toLowerCase().includes(query.toLowerCase()) ||
        p.category?.toLowerCase().includes(query.toLowerCase()) ||
        p.description?.toLowerCase().includes(query.toLowerCase())
      )
      
      // Filter by category if selected
      if (selectedCategory !== 'all') {
        matches = matches.filter(p => p.category === selectedCategory)
      }
      
      const searchResults = matches.map(item => ({
        id: item.id,
        name: item.name,
        price: item.sellingPrice,
        stock: item.currentStock,
        category: item.category,
        sku: item.sku,
        unit: item.unit,
        description: item.description
      }))
      setSearchResults(searchResults)
      setShowSearchResults(true)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }

  // Handle manual product search
  const handleManualSearch = (query) => {
    handleSearch(query)
  }

  // Customer search functionality
  const searchCustomers = (query, salesData) => {
    if (!query || query.length < 2) {
      setCustomerSearchResults([])
      setShowCustomerSearch(false)
      return
    }

    // Filter sales by customer name or phone
    const customerMatches = salesData.filter(sale => {
      const nameMatch = sale.customer_name?.toLowerCase().includes(query.toLowerCase())
      const phoneMatch = sale.customer_phone?.includes(query)
      return nameMatch || phoneMatch
    })

    // Create unique customer list
    const uniqueCustomers = []
    const seenCustomers = new Set()
    
    customerMatches.forEach(sale => {
      const customerKey = `${sale.customer_name || ''}-${sale.customer_phone || ''}`
      if (!seenCustomers.has(customerKey) && (sale.customer_name || sale.customer_phone)) {
        seenCustomers.add(customerKey)
        uniqueCustomers.push({
          name: sale.customer_name || 'Walk-in Customer',
          phone: sale.customer_phone || '',
          lastSale: sale.created_at,
          totalSales: salesData.filter(s => 
            s.customer_name === sale.customer_name && s.customer_phone === sale.customer_phone
          ).length
        })
      }
    })

    setCustomerSearchResults(uniqueCustomers)
    setShowCustomerSearch(uniqueCustomers.length > 0)
  }

  // Select customer from search results
  const selectCustomer = (customer) => {
    setCustomerName(customer.name)
    setCustomerPhone(customer.phone)
    setShowCustomerSearch(false)
    setCustomerSearchResults([])
  }

  // Get unique categories for filter
  const getCategories = () => {
    const categories = [...new Set(inventoryItems.map(item => item.category).filter(Boolean))]
    return categories.sort()
  }

  // Print bill function
  const printBill = async (billData) => {
    try {
      const printer = availablePrinters.find(p => p.id === selectedPrinter) || availablePrinters[0]
      
      if (printer.type === 'thermal') {
        await printThermalBill(billData, printer)
      } else {
        await printDefaultBill(billData)
      }
    } catch (error) {
      alert('Failed to print bill. Please try again.')
    }
  }

  // Print thermal bill
  const printThermalBill = async (billData, printer) => {
    const printContent = generateThermalPrintContent(billData)
    
    if (navigator.serial) {
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })
      const writer = port.writable.getWriter()
      
      // ESC/POS commands for thermal printer
      const encoder = new TextEncoder()
      const data = encoder.encode(printContent)
      await writer.write(data)
      
      writer.releaseLock()
      await port.close()
    } else {
      // Fallback to window.print for thermal format
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              @media print {
                body { font-family: monospace; font-size: 12px; }
                .receipt { width: 80mm; margin: 0 auto; }
                .center { text-align: center; }
                .right { text-align: right; }
                .line { border-bottom: 1px dashed #000; margin: 5px 0; }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              ${printContent.replace(/\n/g, '<br>')}
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
      printWindow.close()
    }
  }

  // Print default bill
  const printDefaultBill = async (billData) => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(generatePrintContent(billData))
    printWindow.document.close()
    printWindow.print()
    printWindow.close()
  }

  // Generate thermal print content
  const generateThermalPrintContent = (billData) => {
    const { cart, customerName, customerPhone, total, tax, subtotal, paymentMethod, paymentAmount, creditAmount, paymentStatus, change, notes } = billData
    const date = new Date().toLocaleString()
    
    let content = `
================================
        RECEIPT
================================
Date: ${date}
Customer: ${customerName || 'Walk-in'}
Phone: ${customerPhone || 'N/A'}
--------------------------------
`
    
    cart.forEach(item => {
      content += `${item.name}\n`
      content += `${item.quantity} x $${item.price} = $${(item.quantity * item.price).toFixed(2)}\n`
    })
    
    content += `
--------------------------------
Subtotal: $${subtotal.toFixed(2)}
Tax: $${tax.toFixed(2)}
--------------------------------
TOTAL: $${total.toFixed(2)}
--------------------------------
Payment Method: ${paymentMethod || 'Cash'}
Amount Paid: $${(paymentAmount || total).toFixed(2)}
`
    
    if (paymentStatus === 'PARTIAL') {
      content += `Credit Amount: $${(creditAmount || 0).toFixed(2)}
Payment Status: PARTIAL PAYMENT
`
    } else {
      content += `Change: $${(change || 0).toFixed(2)}
`
    }
    
    if (notes) {
      content += `Notes: ${notes}
`
    }
    
    content += `--------------------------------
Thank you for your business!
================================
`
    
    return content
  }

  // Generate print content
  const generatePrintContent = (billData) => {
    const { cart, customerName, customerPhone, total, tax, subtotal, paymentMethod, paymentAmount, creditAmount, paymentStatus, change, notes } = billData
    const date = new Date().toLocaleString()
    
    return `
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
            .payment-info { background-color: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .line { border-bottom: 1px solid #000; margin: 10px 0; }
            .partial-payment { color: #ff6b35; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>RECEIPT</h2>
            <p>Date: ${date}</p>
            <p>Customer: ${customerName || 'Walk-in'}</p>
            <p>Phone: ${customerPhone || 'N/A'}</p>
          </div>
          <div class="line"></div>
          ${cart.map(item => `
            <div class="item">
              <span>${item.name} (${item.quantity}x)</span>
              <span>$${(item.quantity * item.price).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="line"></div>
          <div class="item">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="item">
            <span>Tax:</span>
            <span>$${tax.toFixed(2)}</span>
          </div>
          <div class="item total">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
          <div class="line"></div>
          <div class="payment-info">
            <div class="item">
              <span>Payment Method:</span>
              <span>${paymentMethod || 'Cash'}</span>
            </div>
            <div class="item">
              <span>Amount Paid:</span>
              <span>$${(paymentAmount || total).toFixed(2)}</span>
            </div>
            ${paymentStatus === 'PARTIAL' ? `
              <div class="item partial-payment">
                <span>Credit Amount:</span>
                <span>$${(creditAmount || 0).toFixed(2)}</span>
              </div>
              <div class="item partial-payment">
                <span>Payment Status:</span>
                <span>PARTIAL PAYMENT</span>
              </div>
            ` : `
              <div class="item">
                <span>Change:</span>
                <span>$${(change || 0).toFixed(2)}</span>
              </div>
            `}
            ${notes ? `<div class="item"><span>Notes:</span><span>${notes}</span></div>` : ''}
          </div>
          <div class="line"></div>
          <p style="text-align: center; margin-top: 30px;">Thank you for your business!</p>
        </body>
      </html>
    `
  }

  // Add product to cart
  const addToCart = (product) => {
    const existingItem = currentCart.find(item => item.id === product.id)
    let newCart
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + 1
      if (newQuantity > product.stock) {
        alert(`Insufficient stock! Only ${product.stock} ${product.unit || 'units'} available.`)
        return
      }
      newCart = currentCart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: newQuantity }
          : item
      )
    } else {
      if (product.stock <= 0) {
        alert(`Product out of stock!`)
        return
      }
      newCart = [...currentCart, { ...product, quantity: 1 }]
    }
    
    updateCurrentTab({ cart: newCart })
  }

  // Remove product from cart
  const removeFromCart = (productId) => {
    const newCart = currentCart.filter(item => item.id !== productId)
    updateCurrentTab({ cart: newCart })
  }

  // Update quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
    } else {
      const item = currentCart.find(item => item.id === productId)
      if (item && newQuantity > item.stock) {
        alert(`Insufficient stock! Only ${item.stock} ${item.unit || 'units'} available.`)
        return
      }
      const newCart = currentCart.map(item => 
        item.id === productId 
          ? { ...item, quantity: newQuantity }
          : item
      )
      updateCurrentTab({ cart: newCart })
    }
  }

  // Search for outstanding payments by phone number
  const searchOutstandingPayments = async (phoneNumber) => {
    if (!phoneNumber || phoneNumber.trim().length < 3) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
      return
    }

    setIsSearchingOutstanding(true)
    try {
      // Use backend filtering for better performance
      const response = await api.get(`/sales?customerPhone=${encodeURIComponent(phoneNumber.trim())}&creditStatus=PENDING`)

      if (response.data.success) {
        // Filter for sales with outstanding amounts (credit_amount > 0)
        const outstanding = response.data.data.filter(sale => 
          sale.credit_amount > 0
        )
        setOutstandingPayments(outstanding)
        setSelectedOutstandingPayments([]) // Reset selections
      } else {
        setOutstandingPayments([])
      }
    } catch (error) {
      setOutstandingPayments([])
    } finally {
      setIsSearchingOutstanding(false)
    }
  }

  // Handle outstanding payment selection
  const handleOutstandingPaymentToggle = (paymentId) => {
    setSelectedOutstandingPayments(prev => {
      if (prev.includes(paymentId)) {
        return prev.filter(id => id !== paymentId)
      } else {
        return [...prev, paymentId]
      }
    })
  }

  // Calculate totals
  const subtotal = currentCart.reduce((sum, item) => sum + (parseFloat(item.price || 0) * item.quantity), 0)
  const tax = subtotal * (taxRate / 100) // Tax based on editable rate
  
  // Calculate outstanding payments total
  const outstandingTotal = selectedOutstandingPayments.reduce((sum, paymentId) => {
    const payment = outstandingPayments.find(p => p.id === paymentId)
    return sum + (payment ? parseFloat(payment.credit_amount || 0) : 0)
  }, 0)
  
  const total = subtotal + tax + outstandingTotal

  // Handle payment
  const handlePayment = async () => {
    try {
      // Validate required data before processing
      if (!user) {
        alert('❌ User not authenticated. Please login again.')
        return
      }
      
      if (!currentCart || currentCart.length === 0) {
        alert('❌ Cart is empty. Please add items before processing payment.')
        return
      }
      
      if (total <= 0) {
        alert('❌ Total amount must be greater than 0.')
        return
      }
      
      if (!currentTab) {
        alert('❌ No active tab found. Please refresh the page.')
        return
      }

      // Show processing state

      // Calculate payment amounts
      const finalPaymentAmount = isPartialPayment ? parseFloat(paymentAmount) || 0 : total
      const finalCreditAmount = isPartialPayment ? (total - (parseFloat(paymentAmount) || 0)) : 0
      const finalPaymentStatus = isPartialPayment ? 'PARTIAL' : 'COMPLETED'
      
      
      // Validate partial payment amounts
      if (isPartialPayment) {
        if (finalPaymentAmount <= 0) {
          alert('Payment amount must be greater than 0 for partial payments')
          return
        }
        if (finalPaymentAmount >= total) {
          alert('Payment amount cannot be equal to or greater than total for partial payments')
          return
        }
        if (finalCreditAmount <= 0) {
          alert('Credit amount must be greater than 0 for partial payments')
          return
        }
      }
      
      // Prepare sale data
      const saleData = {
        scopeType: user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE',
        scopeId: user.role === 'CASHIER' ? user.branchId : user.warehouseId,
        subtotal: subtotal,
        tax: tax,
        discount: 0,
        total: total,
        paymentMethod: paymentMethod.toUpperCase(),
        paymentStatus: finalPaymentStatus,
        status: 'COMPLETED',
        customerInfo: {
          name: customerName || '',
          email: '',
          phone: customerPhone || '',
          address: ''
        },
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        creditStatus: finalCreditAmount > 0 ? 'PENDING' : 'NONE',
        notes: `POS Terminal - Tab: ${currentTab?.name || 'Unknown'}${isPartialPayment ? ` (Credit: ${finalCreditAmount.toFixed(2)})` : ''}${outstandingTotal > 0 ? ` (Outstanding Payments: ${outstandingTotal.toFixed(2)})` : ''}`,
        items: currentCart.map(item => ({
          inventoryItemId: item.id,
          sku: item.sku || '',
          name: item.name || '',
          quantity: item.quantity,
          unitPrice: parseFloat(item.price || 0),
          discount: 0,
          total: parseFloat(item.price || 0) * item.quantity
        }))
      }
      
      
      // Create the sale
      const result = await dispatch(createSale(saleData))
      
      
      if (createSale.fulfilled.match(result)) {
        const sale = result.payload
        
        let printerError = null
        
        // Attempt to print receipt (with error handling)
        try {
          await printReceipt(sale)
        } catch (error) {
          printerError = error
          // Don't fail the transaction for printer errors
        }
        
        // Show success message regardless of printer status
        const paymentMessage = isPartialPayment 
          ? `✅ Payment successful!\n\nInvoice: ${sale.invoice_no}\nTotal: $${total.toFixed(2)}\nPaid: $${finalPaymentAmount.toFixed(2)}\nCredit: $${finalCreditAmount.toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}\nCustomer: ${customerName}\nPhone: ${customerPhone}\n\n${printerError ? 'Note: Receipt printing failed, but payment was processed successfully.' : 'Receipt printed successfully.'}`
          : `✅ Payment successful!\n\nInvoice: ${sale.invoice_no}\nTotal: $${total.toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}\nCustomer: ${customerName}\nPhone: ${customerPhone}\n\n${printerError ? 'Note: Receipt printing failed, but payment was processed successfully.' : 'Receipt printed successfully.'}`;
        
        alert(paymentMessage);
        
        // Clear cart and reset
        updateCurrentTab({ cart: [], customerName: '', customerPhone: '' })
        setCustomerName('')
        setCustomerPhone('')
        setPaymentAmount('')
        setCreditAmount('')
        setIsPartialPayment(false)
        
        // Focus back on barcode input
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus()
        }
      } else if (createSale.rejected.match(result)) {
        // Handle sale creation failure
        const error = result.payload || result.error
        
        let errorMessage = 'Payment failed. Please try again.'
        if (error && typeof error === 'string') {
          errorMessage = error
        } else if (error && error.message) {
          errorMessage = error.message
        } else if (error && error.response && error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message
        }
        
        
        alert(`❌ Payment failed!\n\nError: ${errorMessage}\n\nPlease check your connection and try again.`)
      } else {
        // Handle unexpected result
        alert('❌ Payment failed!\n\nUnexpected error occurred. Please try again.')
      }
    } catch (error) {
      alert(`❌ Payment processing error: ${error.message}`)
    }
  }

  // Print receipt function - now creates sale first, then prints
  const printReceipt = async () => {
    try {
      // First validate required data
      if (!user) {
        alert('❌ User not authenticated. Please login again.')
        return
      }
      
      if (!currentCart || currentCart.length === 0) {
        alert('❌ Cart is empty. Please add items before printing receipt.')
        return
      }
      
      if (total <= 0) {
        alert('❌ Total amount must be greater than 0.')
        return
      }
      
      // Calculate payment amounts
      const finalPaymentAmount = isPartialPayment ? parseFloat(paymentAmount) || 0 : total
      const finalCreditAmount = isPartialPayment ? (total - (parseFloat(paymentAmount) || 0)) : 0
      const finalPaymentStatus = isPartialPayment ? 'PARTIAL' : 'COMPLETED'
      
      // Prepare sale data
      const saleData = {
        scopeType: user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE',
        scopeId: user.role === 'CASHIER' ? user.branchId : user.warehouseId,
        subtotal: subtotal,
        tax: tax,
        discount: 0,
        total: total,
        paymentMethod: paymentMethod.toUpperCase(),
        paymentStatus: finalPaymentStatus,
        status: 'COMPLETED',
        customerInfo: {
          name: customerName || '',
          email: '',
          phone: customerPhone || '',
          address: ''
        },
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        creditStatus: finalCreditAmount > 0 ? 'PENDING' : 'NONE',
        notes: `POS Terminal Print Receipt - Tab: ${currentTab?.name || 'Unknown'}${isPartialPayment ? ` (Credit: ${finalCreditAmount.toFixed(2)})` : ''}${outstandingTotal > 0 ? ` (Outstanding Payments: ${outstandingTotal.toFixed(2)})` : ''}`,
        items: currentCart.map(item => ({
          inventoryItemId: item.id,
          sku: item.sku || '',
          name: item.name || '',
          quantity: item.quantity,
          unitPrice: parseFloat(item.price || 0),
          discount: 0,
          total: parseFloat(item.price || 0) * item.quantity
        }))
      }
      
      
      // Create the sale first
      const result = await dispatch(createSale(saleData))
      
      
      if (createSale.fulfilled.match(result)) {
        const sale = result.payload.data || result.payload
        
        // Now prepare print data with the actual sale information
        const printData = {
          type: 'receipt',
          title: 'SALES RECEIPT',
          companyName: 'PetZone',
          companyAddress: '456 Pet Paradise Ave, Pet City, PC 12345',
          companyPhone: '(555) PET-ZONE',
          companyEmail: 'info@petzone.com',
          receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
          cashierName: user?.name || 'Cashier',
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || '',
          items: currentCart.map(item => ({
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price
          })),
          subtotal: subtotal,
          tax: tax,
          total: total,
          paymentMethod: paymentMethod,
          paymentAmount: finalPaymentAmount,
          creditAmount: finalCreditAmount,
          paymentStatus: finalPaymentStatus,
          change: isPartialPayment ? 0 : (parseFloat(paymentAmount) || total) - total,
          notes: isPartialPayment ? `Partial Payment - Credit Amount: $${finalCreditAmount.toFixed(2)}` : '',
          footerMessage: 'Thank you for choosing PetZone!'
        }

        
        // Open print dialog
        setPrintData(printData)
        setShowPrintDialog(true)
        
        // Clear cart and reset after successful sale
        updateCurrentTab({ cart: [], customerName: '', customerPhone: '' })
        setCustomerName('')
        setCustomerPhone('')
        setPaymentAmount('')
        setCreditAmount('')
        setIsPartialPayment(false)
        
        
      } else if (createSale.rejected.match(result)) {
        const error = result.payload || result.error
        let errorMessage = 'Sale creation failed. Please try again.'
        
        if (typeof error === 'string') {
          errorMessage = error
        } else if (error?.message) {
          errorMessage = error.message
        }
        
        alert(`❌ Print receipt failed!\n\nError: ${errorMessage}\n\nPlease check your connection and try again.`)
      } else {
        alert('❌ Print receipt failed!\n\nUnexpected error occurred. Please try again.')
      }
      
    } catch (error) {
      alert(`❌ Print receipt error: ${error.message}`)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (e.target === barcodeInputRef.current && barcodeInput.trim()) {
        handleBarcodeScan(barcodeInput.trim())
      } else if (e.target === manualInputRef.current && manualInput.trim()) {
        handleManualSearch(manualInput.trim())
      }
    }
    
    // Ctrl+T for new tab
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault()
      createNewTab()
    }
    
    // Ctrl+W for close tab
    if (e.ctrlKey && e.key === 'w') {
      e.preventDefault()
      if (activeTabId) {
        closeTab(activeTabId)
      }
    }
  }

  // Tab component
  const TabComponent = ({ tab, isActive, onClose, onClick }) => {
    const itemCount = tab.cart.reduce((sum, item) => sum + item.quantity, 0)
    const hasItems = itemCount > 0

  return (
      <Paper
        sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 150,
          maxWidth: 200,
          cursor: 'pointer',
          bgcolor: isActive ? theme.palette.primary.main : theme.palette.background.paper,
          color: isActive ? theme.palette.primary.contrastText : theme.palette.text.primary,
          border: `1px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
          borderBottom: isActive ? 'none' : `1px solid ${theme.palette.divider}`,
          borderRadius: '8px 8px 0 0',
          position: 'relative',
          zIndex: isActive ? 2 : 1,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            bgcolor: isActive ? theme.palette.primary.dark : alpha(theme.palette.primary.main, 0.1)
          }
        }}
        onClick={onClick}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, p: 1 }}>
          <TabIcon sx={{ mr: 1, fontSize: 16 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tab.name}
              </Typography>
          {hasItems && (
            <Badge 
              badgeContent={itemCount} 
              color="secondary" 
              sx={{ mr: 1 }}
            >
              <CartIcon sx={{ fontSize: 16 }} />
            </Badge>
          )}
              </Box>
        
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          sx={{
            color: isActive ? theme.palette.primary.contrastText : theme.palette.text.secondary,
            '&:hover': {
              bgcolor: alpha(theme.palette.error.main, 0.2),
              color: theme.palette.error.main
            }
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
          </Paper>
    )
  }

  return (
    <RouteGuard allowedRoles={['CASHIER', 'ADMIN', 'MANAGER']}>
      <DashboardLayout>
        <Box sx={{ 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: 'grey.50',
          overflow: 'auto'
        }}>

          {/* Search Bar */}
          <Paper sx={{ mb: 2, p: 2, bgcolor: theme.palette.background.default, position: 'relative' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <Box sx={{ flex: 1, position: 'relative' }}>
                <TextField
                  fullWidth
                  label="Search products by name, SKU, or category"
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value)
                    handleManualSearch(e.target.value)
                  }}
                  onKeyPress={handleKeyPress}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'primary.main' }} />,
                    sx: { fontFamily: 'monospace', fontSize: '1.1rem' }
                  }}
                  placeholder="Type to search..."
                />
                
                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <Paper
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      maxHeight: 300,
                      overflowY: 'auto',
                      mt: 1,
                      boxShadow: 3,
                      border: `1px solid ${theme.palette.divider}`
                    }}
                  >
                    {searchResults.map((product) => (
                      <Box
                        key={product.id}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          borderBottom: `1px solid ${theme.palette.divider}`,
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                          '&:last-child': { borderBottom: 'none' }
                        }}
                        onClick={() => {
                          addToCart(product)
                          setShowSearchResults(false)
                          setManualInput('')
                          setSearchQuery('')
                        }}
                      >
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {product.name} - ${product.price}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          SKU: {product.sku} | Stock: {product.stock} {product.unit || 'units'}
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                )}
                
                {/* No Results Dropdown */}
                {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <Paper
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      mt: 1,
                      boxShadow: 3,
                      border: `1px solid ${theme.palette.divider}`,
                      p: 2,
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No products found for &quot;{searchQuery}&quot;
                    </Typography>
                  </Paper>
                )}
              </Box>
              
              <TextField
                select
                label="Category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                SelectProps={{
                  startAdornment: <CategoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                }}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {getCategories().map(category => (
                  <MenuItem key={category} value={category}>{category}</MenuItem>
                ))}
              </TextField>
            </Box>
            
            {/* Barcode Scanner Section */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  ref={barcodeInputRef}
                  fullWidth
                  label="Scan Barcode or Enter Code"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  InputProps={{
                    startAdornment: <ScannerIcon sx={{ mr: 1, color: 'primary.main' }} />,
                  sx: { fontFamily: 'monospace', fontSize: '1.1rem' }
                  }}
                placeholder="Scan or type barcode..."
                sx={{ flex: 1 }}
                autoFocus
                />
                
                {/* Scanner Status Indicator */}
                <Tooltip title={`Scanner Status: ${scannerStatus.connected ? 'Connected' : 'Not Detected'} | Scans: ${scannerStatus.scanCount}`}>
                  <Chip
                    icon={scannerStatus.connected ? <CheckIcon /> : <ErrorIcon />}
                    label={scannerStatus.connected ? 'Scanner OK' : 'No Scanner'}
                    color={scannerStatus.connected ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
                  <Button
                    variant="contained"
                    onClick={() => handleBarcodeScan(barcodeInput)}
                    disabled={!barcodeInput.trim()}
                sx={{ 
                  fontFamily: 'monospace',
                  minWidth: 120,
                  height: 56
                }}
                  >
                    ADD PRODUCT
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowPhysicalScanner(true)}
                sx={{ 
                  fontFamily: 'monospace', 
                  minWidth: 120,
                  height: 56
                }}
              >
                <ScannerIcon sx={{ mr: 1 }} />
                SCAN
              </Button>
                </Box>
          </Paper>

          {/* Chrome-style Tab Bar */}
          <Paper sx={{ mb: 2, p: 1, bgcolor: theme.palette.background.default, position: 'relative', zIndex: 10 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 50 }}>
              {/* Tab List */}
              <Box sx={{ 
                display: 'flex', 
                gap: 0.5, 
                flex: 1, 
                overflowX: 'auto',
                overflowY: 'hidden',
                '&::-webkit-scrollbar': {
                  height: 4
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent'
                },
                '&::-webkit-scrollbar-thumb': {
                  background: theme.palette.divider,
                  borderRadius: 2
                }
              }}>
                {tabs.map((tab) => (
                  <TabComponent
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    onClick={() => switchToTab(tab.id)}
                    onClose={() => closeTab(tab.id)}
                  />
                ))}
              </Box>

              {/* New Tab Button */}
              <Tooltip title="New Tab (Ctrl+T)">
                <IconButton
                  onClick={createNewTab}
                  sx={{
                    bgcolor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    minWidth: 40,
                    minHeight: 40,
                    '&:hover': {
                      bgcolor: theme.palette.primary.dark
                    }
                  }}
                >
                  <NewTabIcon />
                </IconButton>
              </Tooltip>
              </Box>
          </Paper>


          <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: '600px', position: 'relative', zIndex: 1 }}>
          {/* Left Panel - Product Input */}
          <Paper sx={{ p: 2, width: '35%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minHeight: '600px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontFamily: 'monospace' }}>
                PRODUCT SEARCH
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Settings">
                  <IconButton onClick={() => setShowSettings(true)} size="small">
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Refresh Inventory">
                  <IconButton onClick={() => dispatch(fetchInventory())} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
              
              {/* Customer Name Field */}
              <TextField
                fullWidth
                label="Customer Name (Optional)"
                value={customerName}
                onChange={(e) => {
                  const value = e.target.value
                  setCustomerName(value)
                  searchCustomers(value, salesData)
                }}
              />

              {/* Customer Search Results */}
              {showCustomerSearch && customerSearchResults.length > 0 && (
                <Paper sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                  <Typography variant="subtitle2" sx={{ p: 1, fontFamily: 'monospace', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    Found Customers:
                  </Typography>
                  {customerSearchResults.map((customer, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => selectCustomer(customer)}
                    >
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {customer.name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        Phone: {customer.phone || 'N/A'} | Sales: {customer.totalSales} | Last: {new Date(customer.lastSale).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}

              {/* Customer Phone Field */}
              <TextField
                fullWidth
                label="Customer Phone (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                sx={{ mb: 2, fontFamily: 'monospace' }}
                placeholder="Enter customer phone number..."
                type="tel"
              />

              {/* Outstanding Payments Display */}
              {customerPhone && customerPhone.trim().length >= 3 && (
                <Card sx={{ mb: 2, border: '1px solid', borderColor: 'warning.main' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <OutstandingIcon sx={{ mr: 1, color: 'warning.main' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                        Outstanding Payments
                      </Typography>
                      {isSearchingOutstanding && (
                        <CircularProgress size={16} sx={{ ml: 1 }} />
                      )}
                    </Box>
                    
                    {outstandingPayments.length > 0 ? (
                      <List dense>
                        {outstandingPayments.map((payment) => (
                          <ListItem key={payment.id} sx={{ px: 0 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={selectedOutstandingPayments.includes(payment.id)}
                                  onChange={() => handleOutstandingPaymentToggle(payment.id)}
                                  size="small"
                                />
                              }
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2">
                                    Invoice: {payment.invoice_no}
                                  </Typography>
                                  <Chip 
                                    label={`$${parseFloat(payment.credit_amount).toFixed(2)}`}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(payment.created_at).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : !isSearchingOutstanding ? (
                      <Typography variant="body2" color="text.secondary">
                        No outstanding payments found for this phone number.
                      </Typography>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {/* Payment Method Selector */}
              <TextField
                fullWidth
                select
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                sx={{ mb: 2, fontFamily: 'monospace' }}
              >
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="CARD">Card</MenuItem>
                <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
              </TextField>

              {/* Partial Payment Option */}
              <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>
                  Payment Type Selection
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant={!isPartialPayment ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      setIsPartialPayment(false)
                      setPaymentAmount('')
                      setCreditAmount('')
                    }}
                    sx={{ fontFamily: 'monospace', flex: 1 }}
                  >
                    Full Payment
                  </Button>
                  <Button
                    variant={isPartialPayment ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      setIsPartialPayment(true)
                    }}
                    sx={{ fontFamily: 'monospace', flex: 1 }}
                  >
                    Partial Payment
                  </Button>
                </Box>
              </Box>

              {/* Partial Payment Fields */}
              <Box sx={{ mb: 2, p: 3, bgcolor: alpha(theme.palette.warning.main, 0.15), borderRadius: 2, border: '2px solid', borderColor: 'warning.main' }}>
             
                
                {isPartialPayment ? (
                  <>
                    <TextField
                      fullWidth
                      label="Payment Amount (Paid Now)"
                      value={paymentAmount}
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0
                        setPaymentAmount(e.target.value)
                        setCreditAmount((total - amount).toFixed(2))
                      }}
                      sx={{ mb: 2, fontFamily: 'monospace' }}
                      placeholder="Enter amount paid now"
                      type="number"
                      inputProps={{ min: 0, max: total, step: 0.01 }}
                      color="warning"
                    />
                    
                    <TextField
                      fullWidth
                      label="Credit Amount (Remaining)"
                      value={creditAmount}
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0
                        setCreditAmount(e.target.value)
                        setPaymentAmount((total - amount).toFixed(2))
                      }}
                      sx={{ mb: 2, fontFamily: 'monospace' }}
                      placeholder="Amount to be paid later"
                      type="number"
                      inputProps={{ min: 0, max: total, step: 0.01 }}
                      color="warning"
                    />
                    
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'info.main', fontWeight: 'bold' }}>
                        💰 Total: ${total.toFixed(2)} | 💵 Paid: ${(parseFloat(paymentAmount) || 0).toFixed(2)} | 📝 Credit: ${(parseFloat(creditAmount) || 0).toFixed(2)}
                      </Typography>
                    </Box>
                  </>
                ) : null}
              </Box>

              {/* Current Tab Info */}
              {currentTab && (
                <Box sx={{ mb: 2, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    Active Tab: {currentTab.name} | Items: {currentCart.length} | Total: ${total.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    Inventory: {inventoryItems.length} products available
                  </Typography>
                </Box>
              )}
              



              {/* Quick Add Buttons */}
              <Box sx={{ mt: 'auto' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Quick Add:
                </Typography>
                {inventoryLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : inventoryError ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Error loading inventory: {inventoryError}
                  </Alert>
                ) : (
                <Grid container spacing={1}>
                    {inventoryItems.slice(0, 4).map((product) => (
                      <Grid size={6} key={product.id}>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                          onClick={() => addToCart({
                            id: product.id,
                            name: product.name,
                            price: product.sellingPrice,
                            stock: product.currentStock,
                            category: product.category,
                            sku: product.sku,
                            unit: product.unit
                          })}
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      >
                        {product.name.split(' ')[0]}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
                )}
              </Box>
            </Paper>

            {/* Right Panel - Cart and Totals */}
            <Paper sx={{ p: 2, width: '65%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minHeight: '600px' }}>
              <Typography variant="h6" gutterBottom sx={{ fontFamily: 'monospace' }}>
                SHOPPING CART - {currentTab?.name || 'No Tab'}
              </Typography>
              
              {/* Cart Items */}
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 200, width: '40%' }}>Item</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 80, width: '15%' }}>Price</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 100, width: '20%' }}>Qty</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 80, width: '15%' }}>Total</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 80, width: '10%' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentCart.map((item) => (
                      <TableRow key={item.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>
                        <TableCell sx={{ fontFamily: 'monospace', minWidth: 200, width: '40%' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'medium', wordBreak: 'break-word' }}>
                          {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              SKU: {item.sku || 'N/A'} | Stock: {item.stock} {item.unit || 'units'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', minWidth: 80, width: '15%', textAlign: 'right' }}>
                          ${typeof item.price === 'number' ? item.price.toFixed(2) : parseFloat(item.price || 0).toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ minWidth: 100, width: '20%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              sx={{ 
                                bgcolor: theme.palette.error.light,
                                color: 'white',
                                '&:hover': { bgcolor: theme.palette.error.main }
                              }}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ 
                              fontFamily: 'monospace', 
                              minWidth: 30, 
                              textAlign: 'center',
                              fontWeight: 'bold',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              px: 1,
                              py: 0.5,
                              borderRadius: 1
                            }}>
                              {item.quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              sx={{ 
                                bgcolor: theme.palette.success.light,
                                color: 'white',
                                '&:hover': { bgcolor: theme.palette.success.main }
                              }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', minWidth: 80, width: '15%', textAlign: 'right', fontWeight: 'bold' }}>
                          ${(parseFloat(item.price || 0) * item.quantity).toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ minWidth: 80, width: '10%', textAlign: 'center' }}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeFromCart(item.id)}
                            sx={{ 
                              bgcolor: alpha(theme.palette.error.main, 0.1),
                              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totals */}
              <Box sx={{ mt: 1, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Subtotal:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>${subtotal.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Tax:</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      inputProps={{ 
                        min: 0, 
                        max: 100, 
                        step: 0.1,
                        style: { fontFamily: 'monospace', width: '40px', textAlign: 'center', fontSize: '0.8rem' }
                      }}
                      sx={{ width: '60px', '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 } }}
                    />
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>%</Typography>
                </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>${tax.toFixed(2)}</Typography>
                </Box>
                {outstandingTotal > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
                      Outstanding Payments:
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
                      ${outstandingTotal.toFixed(2)}
                    </Typography>
                  </Box>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    TOTAL:
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    ${total.toFixed(2)}
                  </Typography>
                </Box>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<PrintIcon />}
                  onClick={printReceipt}
                  disabled={currentCart.length === 0 || total <= 0}
                  sx={{ fontFamily: 'monospace', py: 1.5, flex: 1 }}
                >
                  SALE & PRINT
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => setShowPrinterDialog(true)}
                  disabled={currentCart.length === 0}
                  sx={{ fontFamily: 'monospace', py: 1.5, minWidth: 100 }}
                >
                  PRINT
                </Button>
              </Box>
            </Paper>
          </Box>


          {/* Physical Scanner Modal */}
          <PhysicalScanner
            open={showPhysicalScanner}
            onScan={(barcode) => {
              handleBarcodeScan(barcode)
              setShowPhysicalScanner(false)
            }}
            onClose={() => setShowPhysicalScanner(false)}
            inventoryItems={inventoryItems}
          />

          {/* Printer Selection Dialog */}
          <Dialog open={showPrinterDialog} onClose={() => setShowPrinterDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon />
                <Typography variant="h6">Select Printer</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose a printer for your receipt:
                </Typography>
                {availablePrinters.map((printer) => (
                  <Box
                    key={printer.id}
                    sx={{
                      p: 2,
                      border: selectedPrinter === printer.id ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
                      borderRadius: 1,
                      mb: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                    onClick={() => setSelectedPrinter(printer.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <PrintIcon color={printer.type === 'thermal' ? 'primary' : 'action'} />
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {printer.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {printer.type === 'thermal' ? 'Thermal Printer' : 'Default Printer'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowPrinterDialog(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={async () => {
                  const billData = {
                    cart: currentCart,
                    customerName: currentTab?.customerName || '',
                    customerPhone: currentTab?.customerPhone || '',
                    subtotal: subtotal,
                    tax: tax,
                    total: total,
                    paymentMethod: paymentMethod,
                    paymentAmount: isPartialPayment ? parseFloat(paymentAmount) || 0 : total,
                    creditAmount: isPartialPayment ? parseFloat(creditAmount) || 0 : 0,
                    paymentStatus: isPartialPayment ? 'PARTIAL' : 'COMPLETED',
                    change: isPartialPayment ? 0 : (parseFloat(paymentAmount) || total) - total,
                    notes: isPartialPayment ? `Partial Payment - Credit Amount: $${(parseFloat(creditAmount) || 0).toFixed(2)}` : ''
                  }
                  await printBill(billData)
                  setShowPrinterDialog(false)
                }}
                disabled={!selectedPrinter}
              >
                Print Receipt
              </Button>
            </DialogActions>
          </Dialog>

          {/* Settings Dialog */}
          <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon />
                <Typography variant="h6">POS Settings</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>Default Printer</Typography>
                <TextField
                  select
                  fullWidth
                  label="Select Default Printer"
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  sx={{ mb: 3 }}
                >
                  {availablePrinters.map((printer) => (
                    <MenuItem key={printer.id} value={printer.id}>
                      {printer.name} ({printer.type})
                    </MenuItem>
                  ))}
                </TextField>

                <Typography variant="h6" gutterBottom>Tax Settings</Typography>
                <TextField
                  fullWidth
                  label="Default Tax Rate (%)"
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                  sx={{ mb: 3 }}
                />

                <Typography variant="h6" gutterBottom>Search Settings</Typography>
                <TextField
                  fullWidth
                  label="Default Category Filter"
                  select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {getCategories().map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowSettings(false)}>Close</Button>
              <Button variant="contained" onClick={() => setShowSettings(false)}>
                Save Settings
              </Button>
            </DialogActions>
          </Dialog>

          {/* Print Dialog */}
          <PrintDialog
            open={showPrintDialog}
            onClose={() => setShowPrintDialog(false)}
            printData={printData}
            title="Print Sales Receipt"
            onPrintComplete={() => {
              // Clear the terminal after successful print
              setShowPrintDialog(false)
              setPrintData(null)
              setCustomerName('')
              setCustomerPhone('')
              
              // Clear current tab cart
              if (currentTab) {
                updateCurrentTab({
                  ...currentTab,
                  cart: []
                })
              }
              
              // Clear search results
              setSearchResults([])
              setShowSearchResults(false)
              setManualInput('')
              setSearchQuery('')
            }}
          />
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default POSTerminal
