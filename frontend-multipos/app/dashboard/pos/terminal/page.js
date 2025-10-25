'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../../utils/axios'
import { useRouter } from 'next/navigation'
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
  FormControl,
  FormGroup,
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
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material'
import PrintDialog from '../../../../components/print/PrintDialog'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import PhysicalScanner from '../../../../components/pos/PhysicalScanner'
import { fetchInventory } from '../../../store/slices/inventorySlice'
import { createSale, fetchSales } from '../../../store/slices/salesSlice'

// Tab management utilities
const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
const generateTabName = (tabNumber) => `Sale ${tabNumber}`

function POSTerminal() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const router = useRouter()
  
  const { user: originalUser } = useSelector((state) => state.auth)
  
  // URL-based role switching (same as other pages)
  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)
  
  // Parse URL parameters for role simulation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const role = params.get('role')
      const scope = params.get('scope')
      const id = params.get('id')
      
      if (role && scope && id && originalUser?.role === 'ADMIN') {
        setUrlParams({ role, scope, id })
        setIsAdminMode(true)
      } else {
        setUrlParams({})
        setIsAdminMode(false)
      }
    }
  }, [originalUser])
  
  // Get effective user based on URL parameters
  const getEffectiveUser = useCallback((originalUser) => {
    if (!isAdminMode || !urlParams.role) {
      return originalUser
    }
    
    return {
      ...originalUser,
      role: urlParams.role.toUpperCase(),
      branchId: urlParams.scope === 'branch' ? parseInt(urlParams.id) : null,
      warehouseId: urlParams.scope === 'warehouse' ? parseInt(urlParams.id) : null,
      branchName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : null,
      warehouseName: urlParams.scope === 'warehouse' ? `Warehouse ${urlParams.id}` : null,
      isAdminMode: true,
      originalRole: originalUser.role,
      originalUser: originalUser
    }
  }, [isAdminMode, urlParams])
  
  // Get scope info
  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.role) {
      return null
    }
    
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`
    }
  }, [isAdminMode, urlParams])
  
  const user = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])
  
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
  const [isFullyCredit, setIsFullyCredit] = useState(false)
  const [selectedSalesperson, setSelectedSalesperson] = useState(null)
  const [salespeople, setSalespeople] = useState([])
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showPhysicalScanner, setShowPhysicalScanner] = useState(false)
  const [taxRate, setTaxRate] = useState(0) // Tax rate as percentage (0-100)
  const [totalDiscount, setTotalDiscount] = useState(0) // Total discount amount
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [showPrinterDialog, setShowPrinterDialog] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  
  // Loading states for preventing duplicate submissions
  const [isProcessingSale, setIsProcessingSale] = useState(false)
  const [isProcessingSaleOnly, setIsProcessingSaleOnly] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [selectedLayout, setSelectedLayout] = useState('thermal')
  const [availablePrinters, setAvailablePrinters] = useState([])
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
  
  // Company/Branch info state
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  })
  
  const barcodeInputRef = useRef(null)
  const manualInputRef = useRef(null)
  const lastScanTimeRef = useRef(0)

  // Get current tab data - memoized to prevent initialization issues
  const currentTab = useMemo(() => {
    return tabs.find(tab => tab.id === activeTabId) || null
  }, [tabs, activeTabId])  
  const currentCart = useMemo(() => {
    return currentTab?.cart || []
  }, [currentTab])
  // Update current tab data - memoized to prevent recreation
  const updateCurrentTab = useCallback((updates) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, ...updates, modifiedAt: new Date() }
        : tab
    ))
  }, [activeTabId])
  // Add product to cart - defined after dependencies
  const addToCart = useCallback((product) => {
    const existingItem = currentCart.find(item => item.id === product.id)
    let newCart
    if (existingItem) {
      const newQuantity = existingItem.quantity + 1
      // Allow negative quantities without warnings
      newCart = currentCart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: newQuantity }
          : item
      )
    } else {
      // Allow adding products with zero or negative stock without warnings
      newCart = [...currentCart, { ...product, quantity: 1, discount: 0, customPrice: product.sellingPrice }]
    }
    updateCurrentTab({ cart: newCart })
  }, [currentCart, updateCurrentTab])
  // Handle barcode scanning - defined early to avoid temporal dead zone
  const handleBarcodeScan = useCallback((barcode) => {
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

  }, [inventoryItems, addToCart])



  // Enhanced barcode input handling for physical scanner

  useEffect(() => {

    const handlePhysicalScanner = (event) => {

      // Handle physical scanner key events

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

        // Process barcode from physical scanner

        
        
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

  }, [barcodeInput, handleBarcodeScan])



  // Create new tab

  const createNewTab = useCallback(() => {

    console.log('[POS] createNewTab')

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



  // Load available printers - memoized to prevent recreation

  const loadAvailablePrinters = useCallback(async () => {

    try {

      // Use Web API to get available printers

      if (navigator.serial) {

        // For serial printers (thermal printers)

        const ports = await navigator.serial.getPorts()

        // Serial ports loaded

        setAvailablePrinters(ports.map(port => {

          const info = port.getInfo()

          return {

            id: info.usbVendorId || info.usbProductId || 'unknown',

            name: `Serial Printer (${info.usbVendorId ? `Vendor: ${info.usbVendorId}` : 'Unknown'})`,

            type: 'thermal',

            port: port,

            info: info

          }

        }))

      }

      

      // Add default printer options

      setAvailablePrinters(prev => [

        ...prev,

        { id: 'default', name: 'Default Printer', type: 'default' },

        { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' },

        { id: 'thermal-58mm', name: 'Thermal 58mm', type: 'thermal' },

        { id: 'browser-print', name: 'Browser Print Dialog', type: 'browser' }

      ])

    } catch (error) {

      // Fallback to default printers

      setAvailablePrinters([

        { id: 'default', name: 'Default Printer', type: 'default' },

        { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' },

        { id: 'thermal-58mm', name: 'Thermal 58mm', type: 'thermal' },

        { id: 'browser-print', name: 'Browser Print Dialog', type: 'browser' }

      ])

    }

  }, [])



  // Initialize with first tab

  useEffect(() => {

    if (tabs.length === 0) {

      createNewTab()

    }

  }, [tabs.length, createNewTab])



  // Load inventory and other data

  useEffect(() => {

    // Load inventory based on user's scope

    if (user) {

      const params = {}

      
      
      if (user.role === 'CASHIER') {
        // Cashiers can see inventory for their specific branch
        params.scopeType = 'BRANCH'
        if (user.branchId) {
          params.scopeId = user.branchId
        }
      } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
        // Warehouse keepers can see inventory for their specific warehouse
        params.scopeType = 'WAREHOUSE'
        params.scopeId = user.warehouseId
      } else if (user.role === 'ADMIN' && !isAdminMode) {
        // Admin without role simulation can see all inventory
        // No scope restrictions
      }

      
      
      dispatch(fetchInventory(params))

    }

    
    
    // Load sales data for customer search

    dispatch(fetchSales())

    
    
    // Load available printers

    loadAvailablePrinters()

  }, [dispatch, user, loadAvailablePrinters, isAdminMode])



  // Search for outstanding payments by phone number or customer name

  const searchOutstandingPayments = useCallback(async (phoneNumber, customerName) => {
    console.log('[POS] searchOutstandingPayments called', { phoneNumber, customerName })

    if ((!phoneNumber || phoneNumber.trim().length < 3) && (!customerName || customerName.trim().length < 3)) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
      return
    }

    setIsSearchingOutstanding(true)

    try {
      // Use the new API endpoint for aggregated outstanding payments
      const params = new URLSearchParams()
      if (phoneNumber && phoneNumber.trim().length >= 3) {
        params.append('phone', phoneNumber.trim())
      }
      if (customerName && customerName.trim().length >= 3) {
        params.append('customerName', customerName.trim())
      }

      const response = await api.get(`/sales/outstanding?${params.toString()}`)
      console.log('[POS] searchOutstandingPayments response', { data: response?.data })
      console.log('[POS] API URL called:', `/sales/outstanding?${params.toString()}`)
      console.log('[POS] Response status:', response?.status)

      if (response.data.success) {
        // Transform the aggregated data to match the expected format
        const outstandingPayments = response.data.data.map(customer => ({
          id: `customer_${customer.customerName}_${customer.phone}`,
          invoice_no: `OUTSTANDING_${customer.customerName}`,
          customer_name: customer.customerName,
          customer_phone: customer.phone,
          total: customer.totalOutstanding,
          outstandingAmount: customer.totalOutstanding,
          paymentStatus: 'PENDING',
          paymentMethod: 'OUTSTANDING',
          creditStatus: 'PENDING',
          creditAmount: customer.totalOutstanding,
          paymentAmount: 0,
          pendingSalesCount: customer.pendingSalesCount,
          created_at: new Date().toISOString()
        }))

        // Outstanding payments loaded
        setOutstandingPayments(outstandingPayments)
        
        // Auto-select all outstanding payments by default
        const autoSelectedIds = outstandingPayments.map(payment => payment.id)
        setSelectedOutstandingPayments(autoSelectedIds)
        console.log('[POS] Auto-selected outstanding payments:', autoSelectedIds)
      } else {
        console.log('[POS] No outstanding payments found')
        setOutstandingPayments([])
        setSelectedOutstandingPayments([]) // Clear selection when no outstanding payments
      }

    } catch (error) {
      console.error('[POS] Error searching outstanding payments:', error)
      console.error('[POS] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      })
      setOutstandingPayments([])
      setSelectedOutstandingPayments([]) // Clear selection on error
    } finally {
      setIsSearchingOutstanding(false)
    }
  }, [])



  // Search for outstanding payments when phone number or customer name changes

  useEffect(() => {

    const timeoutId = setTimeout(() => {

      if ((customerPhone && customerPhone.trim().length >= 3) || (customerName && customerName.trim().length >= 3)) {

        console.log('[POS] customer info change debounced -> calling searchOutstandingPayments', { customerPhone, customerName })

        searchOutstandingPayments(customerPhone?.trim(), customerName?.trim())

      } else {

        setOutstandingPayments([])

        setSelectedOutstandingPayments([])

      }

    }, 500) // Debounce search by 500ms



    return () => clearTimeout(timeoutId)

  }, [customerPhone, customerName, searchOutstandingPayments])



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

      // Use thermal printer directly
      await printThermalBill(billData, { type: 'thermal', name: 'Thermal Printer' })

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

      content += `${item.quantity} x ${item.price} = ${(item.quantity * item.price).toFixed(2)}\n`

    })

    
    
    content += `

--------------------------------

Subtotal: ${subtotal.toFixed(2)}

Tax: ${tax.toFixed(2)}

--------------------------------

TOTAL: ${total.toFixed(2)}

--------------------------------

Payment Method: ${paymentMethod || 'Cash'}

Amount Paid: ${(paymentAmount || total).toFixed(2)}

`

    
    
    if (paymentStatus === 'PARTIAL') {

      content += `Credit Amount: ${(creditAmount || 0).toFixed(2)}

Payment Status: PARTIAL PAYMENT

`

    } else {

      content += `Change: ${(change || 0).toFixed(2)}

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

              <span>${(item.quantity * item.price).toFixed(2)}</span>

            </div>

          `).join('')}

          <div class="line"></div>

          <div class="item">

            <span>Subtotal:</span>

            <span>${subtotal.toFixed(2)}</span>

          </div>

          <div class="item">

            <span>Tax:</span>

            <span>${tax.toFixed(2)}</span>

          </div>

          <div class="item total">

            <span>TOTAL:</span>

            <span>${total.toFixed(2)}</span>

          </div>

          <div class="line"></div>

          <div class="payment-info">

            <div class="item">

              <span>Payment Method:</span>

              <span>${paymentMethod || 'Cash'}</span>

            </div>

            <div class="item">

              <span>Amount Paid:</span>

              <span>${(paymentAmount || total).toFixed(2)}</span>

            </div>

            ${paymentStatus === 'PARTIAL' ? `

              <div class="item partial-payment">

                <span>Credit Amount:</span>

                <span>${(creditAmount || 0).toFixed(2)}</span>

              </div>

              <div class="item partial-payment">

                <span>Payment Status:</span>

                <span>PARTIAL PAYMENT</span>

              </div>

            ` : `

              <div class="item">

                <span>Change:</span>

                <span>${(change || 0).toFixed(2)}</span>

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

      // Allow quantities exceeding stock without warnings

      const newCart = currentCart.map(item => 

        item.id === productId 

          ? { ...item, quantity: newQuantity }

          : item

      )

      updateCurrentTab({ cart: newCart })

    }

  }

  // Update item discount
  const updateItemDiscount = (productId, discount) => {
    const newCart = currentCart.map(item => 
      item.id === productId 
        ? { ...item, discount: parseFloat(discount) || 0 }
        : item
    )
    updateCurrentTab({ cart: newCart })
  }

  // Update item price
  const updateItemPrice = (productId, price) => {
    console.log(`[POS] updateItemPrice called with productId: ${productId}, price: "${price}"`)
    
    const newCart = currentCart.map(item => {
      if (item.id === productId) {
        let newCustomPrice
        if (price === '' || price === null || price === undefined) {
          newCustomPrice = 0
        } else {
          const parsedPrice = parseFloat(price)
          newCustomPrice = isNaN(parsedPrice) ? 0 : parsedPrice
        }
        
        console.log(`[POS] Setting customPrice to: ${newCustomPrice} for item: ${item.name}`)
        return { ...item, customPrice: newCustomPrice }
      }
      return item
    })
    
    updateCurrentTab({ cart: newCart })
  }

  // Reset item price to original
  const resetItemPrice = (productId) => {
    const newCart = currentCart.map(item => 
      item.id === productId 
        ? { ...item, customPrice: null }
        : item
    )
    updateCurrentTab({ cart: newCart })
  }



  // Handle outstanding payment selection

  const handleOutstandingPaymentToggle = (paymentId) => {
    console.log('[POS] handleOutstandingPaymentToggle called (manual toggle)', { paymentId, currentSelection: selectedOutstandingPayments })

    setSelectedOutstandingPayments(prev => {
      const newSelection = prev.includes(paymentId) 
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
      
      console.log('[POS] Outstanding payment selection updated (manual)', { 
        paymentId, 
        wasSelected: prev.includes(paymentId),
        newSelection 
      })
      
      return newSelection
    })
  }



  // Calculate totals - memoized to prevent unnecessary recalculations

  const subtotal = useMemo(() => {

    return currentCart.reduce((sum, item) => {

      const itemPrice = parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0)

      const itemDiscount = parseFloat(item.discount || 0)

      const itemTotal = (itemPrice * item.quantity) - itemDiscount

      return sum + Math.max(0, itemTotal) // Ensure no negative totals

    }, 0)

  }, [currentCart])

  
  
  const tax = useMemo(() => {

    return subtotal * (taxRate / 100) // Tax based on editable rate

  }, [subtotal, taxRate])

  
  
  // Calculate outstanding payments total

  const outstandingTotal = useMemo(() => {

    return selectedOutstandingPayments.reduce((sum, paymentId) => {

      const payment = outstandingPayments.find(p => p.id === paymentId)

      // Use the calculated outstanding amount
      const outstandingAmount = payment ? parseFloat(payment.outstandingAmount || 0) : 0
      
      console.log('[POS] Outstanding payment calculation:', {
        paymentId,
        invoice: payment?.invoice_no,
        outstandingAmount: payment?.outstandingAmount,
        creditAmount: payment?.creditAmount,
        finalAmount: outstandingAmount
      })

      return sum + outstandingAmount

    }, 0)

  }, [selectedOutstandingPayments, outstandingPayments])

  
  
  const total = useMemo(() => {
    // Calculate cart total
    const cartTotal = subtotal + tax - totalDiscount
    
    // For outstanding-only settlements (no items in cart), use outstanding total
    // For regular sales with items, add outstanding total to cart total
    const finalTotal = currentCart.length > 0 ? cartTotal + outstandingTotal : outstandingTotal
    
    // Calculate final total
    
    return finalTotal
  }, [subtotal, tax, outstandingTotal, totalDiscount, currentCart.length])

  // Handle payment method changes
  useEffect(() => {
    console.log('[POS] Payment method useEffect triggered:', { paymentMethod, isPartialPayment, paymentAmount, total })
    
    if (paymentMethod === 'FULLY_CREDIT') {
      console.log('[POS] Setting FULLY_CREDIT mode')
      setPaymentAmount('0')
      setCreditAmount(total.toFixed(2))
      setIsPartialPayment(false)
    } else if (paymentMethod !== 'FULLY_CREDIT' && paymentAmount === '0' && !isPartialPayment) {
      // Only reset if not in partial payment mode and not switching to partial payment
      console.log('[POS] Resetting payment amounts (not in partial payment mode)')
      setPaymentAmount('')
      setCreditAmount('')
    } else {
      console.log('[POS] No action taken in payment method useEffect')
    }
    // Don't reset payment method when in partial payment mode
  }, [paymentMethod, total, isPartialPayment, paymentAmount]) // Added missing dependencies

  // Handle partial payment mode changes
  useEffect(() => {
    if (!isPartialPayment && paymentMethod === 'FULLY_CREDIT') {
      // If switching from partial to full payment and method is FULLY_CREDIT, reset amounts
      setPaymentAmount('0')
      setCreditAmount(total.toFixed(2))
    } else if (!isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
      // If switching from partial to full payment with other methods, clear amounts
      setPaymentAmount('')
      setCreditAmount('')
    }
  }, [isPartialPayment, total, paymentMethod, paymentAmount])

  // Load salespeople for warehouse keepers
  useEffect(() => {
    const loadSalespeople = async () => {
      if (user?.role === 'WAREHOUSE_KEEPER') {
        try {
          const response = await api.get('/salespeople/warehouse-billing')
          if (response.data.success) {
            setSalespeople(response.data.data)
          }
        } catch (error) {
          console.error('Error loading salespeople:', error)
        }
      }
    }
    
    loadSalespeople()
  }, [user])

  // Load company/branch information
  useEffect(() => {
    const loadCompanyInfo = async () => {
      console.log('[POS] Loading company info for user:', user?.role, user?.branchId, user?.warehouseId)
      try {
        if (user?.role === 'CASHIER' && user?.branchId) {
          // Load branch-specific information
          const response = await api.get(`/branches/${user.branchId}`)
          if (response.data.success) {
            const branch = response.data.data
            console.log('[POS] Loaded branch info:', branch)
            setCompanyInfo({
              name: branch.name || '',
              address: branch.location || '', // branch.location is the address field
              phone: branch.managerPhone || '', // Use managerPhone as phone
              email: branch.managerEmail || '' // Use managerEmail as email
            })
          }
        } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
          // Load warehouse-specific information
          const response = await api.get(`/warehouses/${user.warehouseId}`)
          if (response.data.success) {
            const warehouse = response.data.data
            console.log('[POS] Loaded warehouse info:', warehouse)
            setCompanyInfo({
              name: warehouse.name || '',
              address: warehouse.location || '', // warehouse.location is the address field
              phone: warehouse.manager || '', // Use manager as phone since warehouse has no phone field
              email: '' // warehouse has no email field
            })
          }
        } else if (user?.role === 'ADMIN') {
          // For admin, use default company info
          console.log('[POS] Admin user - using default company info')
          setCompanyInfo({
            name: 'Company Name',
            address: 'Company Address', 
            phone: 'Company Phone',
            email: 'company@email.com'
          })
        }
      } catch (error) {
        console.error('Error loading company info:', error)
        // Set fallback values if loading fails
        setCompanyInfo({
          name: 'Company Name',
          address: 'Company Address',
          phone: 'Company Phone',
          email: 'company@email.com'
        })
      }
    }
    
    loadCompanyInfo()
  }, [user])

  // Comprehensive function to clear all POS terminal state
  const clearAllPOSState = () => {
    console.log('[POS] Clearing all POS terminal state...')
    
    // Clear customer information
    setCustomerName('')
    setCustomerPhone('')
    
    // Clear payment information
    setPaymentAmount('')
    setCreditAmount('')
    setIsPartialPayment(false)
    setIsFullyCredit(false)
    setPaymentMethod('CASH')
    
    // Clear outstanding payments
    setSelectedOutstandingPayments([])
    setOutstandingPayments([])
    
    // Clear current tab
    if (currentTab) {
      updateCurrentTab({
        ...currentTab,
        cart: [],
        total: 0,
        customerName: '',
        customerPhone: ''
      })
    }
    
    // Clear search results
    setCustomerSearchResults([])
    setShowCustomerSearch(false)
    setSearchResults([])
    setShowSearchResults(false)
    
    // Clear manual input
    setManualInput('')
    setBarcodeInput('')
    
    // Reset tax and discount
    setTaxRate(0)
    setTotalDiscount(0)
    
    // Clear search query
    setSearchQuery('')
    setSelectedCategory('all')
    
    // Clear notes
    setNotes('')
    
    console.log('[POS] All POS terminal state cleared successfully')
  }

  // Function to refresh outstanding payments data
  const refreshOutstandingPayments = () => {
    console.log('[POS] Refreshing outstanding payments data...')
    
    // Clear current outstanding payments completely
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
    
    // Don't re-search automatically - let user search again if needed
    console.log('[POS] Outstanding payments cleared. User can search again if needed.')
  }

  // Handle payment

  const handlePayment = async () => {

    console.log('[POS] handlePayment start', { currentCartLength: currentCart.length, total, customerPhone })

    try {

      // Validate required data before processing

      if (!user) {

        alert('❌ User not authenticated. Please login again.')

        return

      }

      
      
      // Allow empty cart only if there are outstanding payments to settle
      if (!currentCart || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)) {

        alert('❌ Cart is empty and no outstanding payments selected. Please add items or select outstanding payments.')

        return

      }

      
      
      if (total <= 0) {

        alert('❌ Total amount must be greater than 0.')

        return

      }

      
      
      // Validate outstanding payments selection
      if (selectedOutstandingPayments.length > 0) {
        console.log('[POS] Outstanding payments validation:', {
          selectedCount: selectedOutstandingPayments.length,
          cartLength: currentCart.length,
          outstandingTotal: outstandingTotal
        })
        
        const confirmOutstanding = confirm(
          `⚠️ You have selected ${selectedOutstandingPayments.length} outstanding payment(s) totaling ${outstandingTotal.toFixed(2)} to settle.\n\n` +
          `This will mark the selected outstanding payments as COMPLETED.\n\n` +
          `Do you want to proceed with settling these outstanding payments?`
        )
        
        if (!confirmOutstanding) {
          console.log('[POS] User cancelled outstanding payment processing')
          return
        }
        
        console.log('[POS] User confirmed outstanding payment processing')
      } else {
        console.log('[POS] No outstanding payments to process:', {
          selectedCount: selectedOutstandingPayments.length,
          cartLength: currentCart.length
        })
      }

      
      
      if (!currentTab) {

        alert('❌ No active tab found. Please refresh the page.')

        return

      }



      // Show processing state



      // Calculate payment amounts

      console.log('[POS] Payment method selected:', paymentMethod);
      console.log('[POS] Total amount:', total);
      console.log('[POS] Is partial payment:', isPartialPayment);

      const finalPaymentAmount = isFullyCredit ? 0 : (isPartialPayment ? parseFloat(paymentAmount) || 0 : total)

      const finalCreditAmount = isFullyCredit ? total : (isPartialPayment ? (total - (parseFloat(paymentAmount) || 0)) : 0)

      const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

      console.log('[POS] Final payment amount:', finalPaymentAmount);
      console.log('[POS] Final credit amount:', finalCreditAmount);
      console.log('[POS] Final payment status:', finalPaymentStatus);
      
      

      

      // Enhanced partial payment validation
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        // Validate payment amount
        if (finalPaymentAmount <= 0) {
          alert('❌ Payment amount must be greater than 0 for partial payments')
          return
        }

        // Validate payment amount is less than total
        if (finalPaymentAmount >= total) {
          alert('❌ Payment amount must be less than total for partial payments')
          return
        }

        // Validate credit amount
        if (finalCreditAmount <= 0) {
          alert('❌ Credit amount must be greater than 0 for partial payments')
          return
        }

        // Validate amounts add up to total (with small tolerance for rounding)
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - total) > 0.01) {
          alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${total.toFixed(2)}\nSum: ${sum.toFixed(2)}`)
          return
        }
      }

      
    
      // Prepare sale data      
      // Handle admin not in simulation mode
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      
      // Validate customer info for partial payment or fully credit
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }
      
      // Validate customer info for partial payment or fully credit
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }
      
      console.log('[POS] Sale data scope info:', {
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        userRole: user.role,
        userBranchId: user.branchId,
        userWarehouseId: user.warehouseId,
        scopeInfo: scopeInfo
      })
      
      const saleData = {
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        subtotal: subtotal,
        tax: tax,
        discount: totalDiscount,
        total: total,
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod.toUpperCase(), // Keep actual payment method (CASH, BANK_TRANSFER, etc.)
        paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'), // Add payment type
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,

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

          inventoryItemId: parseInt(item.id),

          sku: item.sku || '',

          name: item.name || '',

          quantity: item.quantity,

          unitPrice: parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0),

          discount: parseFloat(item.discount || 0),

          total: (parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0) * item.quantity) - parseFloat(item.discount || 0)

        }))

      }

      console.log('[POS] Sale data being sent:', saleData);

      

      
      
      // Create the sale

      const result = await dispatch(createSale(saleData))

  console.log('[POS] createSale result', { result })

      

      
      
      if (createSale.fulfilled.match(result)) {

        const sale = result.payload

        
        
        let printerError = null

        
        
        // Process outstanding payments if any are selected
        if (selectedOutstandingPayments.length > 0) {
          console.log('[POS] Starting outstanding payment processing...', {
            selectedPayments: selectedOutstandingPayments,
            outstandingPayments: outstandingPayments
          })
          
          try {
            console.log('[POS] Processing outstanding payments:', selectedOutstandingPayments)
            
            // Use the new clear-outstanding API for each selected customer
            for (const paymentId of selectedOutstandingPayments) {
              const payment = outstandingPayments.find(p => p.id === paymentId)
              if (payment) {
                console.log('[POS] Clearing outstanding payment for customer:', payment.customer_name, payment.customer_phone)
                console.log('[POS] Payment details:', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  outstandingAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                const clearResponse = await api.post('/sales/clear-outstanding', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  paymentAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                if (clearResponse.data.success) {
                  console.log('[POS] Successfully cleared outstanding payment:', clearResponse.data.data)
                  console.log('[POS] Updated sales:', clearResponse.data.data.processedSales)
                  console.log('[POS] Remaining outstanding:', clearResponse.data.data.remainingOutstanding)
                } else {
                  console.error('[POS] Failed to clear outstanding payment:', clearResponse.data.message)
                  alert(`❌ Failed to clear outstanding payment for ${payment.customer_name}. Please check manually.`)
                }
              }
            }
          } catch (error) {
            console.error('[POS] Error processing outstanding payments:', error)
            console.error('[POS] Error details:', {
              message: error.message,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              url: error.config?.url
            })
            alert(`❌ Error processing outstanding payments: ${error.message}`)
            // Don't fail the main transaction for outstanding payment processing errors
          }
        } else {
          console.log('[POS] No outstanding payments selected for processing')
        }

        
        
        // Attempt to print receipt (with error handling)

        try {

          await printReceipt(sale)

        } catch (error) {

          printerError = error

        }

        
        
        // Show success message regardless of printer status

        const outstandingMessage = selectedOutstandingPayments.length > 0 
          ? `\n\nOutstanding Payments Settled: ${selectedOutstandingPayments.length} (${outstandingTotal.toFixed(2)})`
          : ''

        const paymentMessage = isPartialPayment 

          ? `✅ Payment successful!\n\nInvoice: ${sale.invoice_no}\nTotal: ${total.toFixed(2)}\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}\nCustomer: ${customerName}\nPhone: ${customerPhone}${outstandingMessage}\n\n${printerError ? 'Note: Receipt printing failed, but payment was processed successfully.' : 'Receipt printed successfully.'}`

          : `✅ Payment successful!\n\nInvoice: ${sale.invoice_no}\nTotal: ${total.toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}\nCustomer: ${customerName}\nPhone: ${customerPhone}${outstandingMessage}\n\n${printerError ? 'Note: Receipt printing failed, but payment was processed successfully.' : 'Receipt printed successfully.'}`;
        
        

        alert(paymentMessage);

        
        
        // Clear all POS terminal state after successful payment
        clearAllPOSState()
        
        // Refresh outstanding payments data to ensure clean state
          setTimeout(() => {
          refreshOutstandingPayments()
        }, 2000)

        
        
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



  // Sale only function - creates sale without printing
  const handleSaleOnly = async () => {
    // Prevent duplicate submissions
    if (isProcessingSaleOnly) {
      console.log('[POS] Sale only already in progress, ignoring duplicate click')
      return
    }
    
    setIsProcessingSaleOnly(true)
    console.log('[POS] handleSaleOnly start', { currentCartLength: currentCart.length, total })

    try {
      // Handle admin not in simulation mode
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      
      // Validate customer info for partial payment or fully credit
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }
      
      // First validate required data
      if (!user) {
        alert('❌ User not authenticated. Please login again.')
        return
      }
      
      if (!currentCart || currentCart.length === 0) {
        // Check if customer is here only to clear outstanding payments
        if (selectedOutstandingPayments.length > 0) {
          console.log('[POS] Customer clearing outstanding payments only - no items in cart')
          
          const confirmOutstandingOnly = confirm(
            `💰 Outstanding Payment Settlement\n\n` +
            `Customer: ${customerName || 'Unknown'}\n` +
            `Phone: ${customerPhone || 'N/A'}\n` +
            `Outstanding Amount: ${outstandingTotal.toFixed(2)}\n\n` +
            `This will create a settlement transaction and mark all selected outstanding payments as COMPLETED.\n\n` +
            `Do you want to proceed with the settlement?`
          )
          
          if (!confirmOutstandingOnly) {
            console.log('[POS] User cancelled outstanding-only settlement')
            return
          }
          
          console.log('[POS] Proceeding with outstanding-only settlement')
          
          // Process outstanding payments directly without creating a sale
          try {
            console.log('[POS] Processing outstanding payments only:', selectedOutstandingPayments)
            
            // Use the clear-outstanding API for each selected customer
            for (const paymentId of selectedOutstandingPayments) {
              const payment = outstandingPayments.find(p => p.id === paymentId)
              if (payment) {
                console.log('[POS] Clearing outstanding payment for customer:', payment.customer_name, payment.customer_phone)
                console.log('[POS] Payment details:', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  outstandingAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                const clearResponse = await api.post('/sales/clear-outstanding', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  paymentAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                if (clearResponse.data.success) {
                  console.log('[POS] Successfully cleared outstanding payment:', clearResponse.data.data)
                  console.log('[POS] Updated sales:', clearResponse.data.data.processedSales)
                  console.log('[POS] Remaining outstanding:', clearResponse.data.data.remainingOutstanding)
                } else {
                  console.error('[POS] Failed to clear outstanding payment:', clearResponse.data.message)
                  alert(`❌ Failed to clear outstanding payment for ${payment.customer_name}. Please check manually.`)
                  return
                }
              }
            }
            
            // Show success message
            alert(`✅ Outstanding Payments Settled Successfully!\n\n` +
                  `Customer: ${customerName || 'Unknown'}\n` +
                  `Settled Amount: ${outstandingTotal.toFixed(2)}\n` +
                  `Payment Method: ${paymentMethod}\n\n` +
                  `All selected outstanding payments have been marked as COMPLETED.`)
            
            // Clear all POS terminal state after successful settlement
            clearAllPOSState()
            
            // Refresh outstanding payments data to ensure clean state
            setTimeout(() => {
              refreshOutstandingPayments()
            }, 2000)
            
            return // Exit early since we handled outstanding-only settlement
            
          } catch (error) {
            console.error('[POS] Error processing outstanding-only settlement:', error)
            console.error('[POS] Error details:', {
              message: error.message,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              url: error.config?.url
            })
            alert(`❌ Error processing outstanding payment settlement: ${error.message}`)
            return
          }
        } else {
        alert('❌ Cart is empty. Please add items before processing sale.')
        return
        }
      }

      if (total <= 0) {
        alert('❌ Total amount must be greater than 0.')
        return
      }

      // Handle admin not in simulation mode
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      
      // Validate customer info for partial payment or fully credit
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }

      // Validate outstanding payments selection
      if (selectedOutstandingPayments.length > 0) {
        console.log('[POS] Outstanding payments validation:', {
          selectedCount: selectedOutstandingPayments.length,
          cartLength: currentCart.length,
          outstandingTotal: outstandingTotal
        })
        
        const confirmOutstanding = confirm(
          `⚠️ You have selected ${selectedOutstandingPayments.length} outstanding payment(s) totaling ${outstandingTotal.toFixed(2)} to settle.\n\n` +
          `This will mark the selected outstanding payments as COMPLETED.\n\n` +
          `Do you want to proceed with settling these outstanding payments?`
        )
        
        if (!confirmOutstanding) {
          console.log('[POS] User cancelled outstanding payment processing')
          return
        }
        
        console.log('[POS] User confirmed outstanding payment processing')
      } else {
        console.log('[POS] No outstanding payments to process:', {
          selectedCount: selectedOutstandingPayments.length,
          cartLength: currentCart.length
        })
      }

      // Calculate payment amounts
      console.log('[POS] Payment method selected:', paymentMethod);
      console.log('[POS] Total amount:', total);
      console.log('[POS] Is partial payment:', isPartialPayment);

      const finalPaymentAmount = isFullyCredit ? 0 : (isPartialPayment ? parseFloat(paymentAmount) || 0 : total)
      const finalCreditAmount = isFullyCredit ? total : (isPartialPayment ? (total - (parseFloat(paymentAmount) || 0)) : 0)
      const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

      console.log('[POS] Final payment amount:', finalPaymentAmount);
      console.log('[POS] Final credit amount:', finalCreditAmount);
      console.log('[POS] Final payment status:', finalPaymentStatus);

      // Enhanced partial payment validation
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        // Validate payment amount
        if (finalPaymentAmount <= 0) {
          alert('❌ Payment amount must be greater than 0 for partial payments')
          return
        }

        // Validate payment amount is less than total
        if (finalPaymentAmount >= total) {
          alert('❌ Payment amount must be less than total for partial payments')
          return
        }

        // Validate credit amount
        if (finalCreditAmount <= 0) {
          alert('❌ Credit amount must be greater than 0 for partial payments')
          return
        }

        // Validate amounts add up to total (with small tolerance for rounding)
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - total) > 0.01) {
          alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${total.toFixed(2)}\nSum: ${sum.toFixed(2)}`)
          return
        }
      }

      console.log('[POS] Sale data scope info (handleSaleOnly):', {
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        userRole: user.role,
        userBranchId: user.branchId,
        userWarehouseId: user.warehouseId,
        scopeInfo: scopeInfo
      })
      
      // Create sale without printing
      const saleData = {
        items: currentCart.map(item => ({
          inventoryItemId: parseInt(item.id),
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0),          discount: parseFloat(item.discount || 0),
          total: (parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0) * parseFloat(item.quantity)) - parseFloat(item.discount || 0)
        })),
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        discount: parseFloat(totalDiscount),
        total: parseFloat(total),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'), // Keep actual payment method
        paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'), // Add payment type
        paymentStatus: finalPaymentStatus,
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        customerInfo: {
          name: customerName || 'Walk-in Customer',
          phone: customerPhone || ''
        },
        notes: notes || 'Sale completed without printing'
      }

      console.log('[POS] Creating sale with scope:', saleData.scopeType, saleData.scopeId)
      const result = await dispatch(createSale(saleData))
      
      if (createSale.fulfilled.match(result)) {
        const sale = result.payload.data || result.payload
        
        console.log('[POS] createSale result', { result })
        
        // Process outstanding payments if any are selected
        if (selectedOutstandingPayments.length > 0) {
          console.log('[POS] Starting outstanding payment processing...', {
            selectedPayments: selectedOutstandingPayments,
            outstandingPayments: outstandingPayments
          })
          
          try {
            console.log('[POS] Processing outstanding payments:', selectedOutstandingPayments)
            
            // Use the new clear-outstanding API for each selected customer
            for (const paymentId of selectedOutstandingPayments) {
              const payment = outstandingPayments.find(p => p.id === paymentId)
              if (payment) {
                console.log('[POS] Clearing outstanding payment for customer:', payment.customer_name, payment.customer_phone)
                console.log('[POS] Payment details:', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  outstandingAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                const clearResponse = await api.post('/sales/clear-outstanding', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  paymentAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                if (clearResponse.data.success) {
                  console.log('[POS] Successfully cleared outstanding payment:', clearResponse.data.data)
                  console.log('[POS] Updated sales:', clearResponse.data.data.processedSales)
                  console.log('[POS] Remaining outstanding:', clearResponse.data.data.remainingOutstanding)
                } else {
                  console.error('[POS] Failed to clear outstanding payment:', clearResponse.data.message)
                  alert(`❌ Failed to clear outstanding payment for ${payment.customer_name}. Please check manually.`)
                }
              }
            }
          } catch (error) {
            console.error('[POS] Error processing outstanding payments:', error)
            console.error('[POS] Error details:', {
              message: error.message,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              url: error.config?.url
            })
            alert(`❌ Error processing outstanding payments: ${error.message}`)
            // Don't fail the main transaction for outstanding payment processing errors
          }
        } else {
          console.log('[POS] No outstanding payments selected for processing')
        }
        
        // Print receipt directly to thermal printer
        try {
          const printData = {
            items: currentCart,
            subtotal: subtotal,
            tax: tax,
            discount: totalDiscount,
            total: total,
            customerName: customerName || 'Walk-in Customer',
            customerPhone: customerPhone || '',
            date: new Date().toLocaleString(),
            title: 'SALES RECEIPT',
            receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
            branchName: user?.branchName || 'Main Branch',
            cashierName: user?.name || user?.username || 'Cashier',
            paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'), // Keep actual payment method
            paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'), // Add payment type
            printerType: 'thermal' // Force thermal printer
          }

          // Print directly to thermal printer
          let printResult = null
          
          if (window.electronAPI?.printReceipt) {
            // Electron environment - use native printer
            printResult = await window.electronAPI.printReceipt(printData)
          } else {
            // Browser environment - use Web Serial API for thermal printers
            try {
              printResult = await printToThermalPrinter(printData)
            } catch (serialError) {
              console.warn('[POS] Serial printer not available, falling back to browser print')
              // Fallback to browser print dialog
              printResult = await printToBrowser(printData)
            }
          }
          
          if (printResult?.success) {
            // Clear the terminal after successful sale and print
            setCustomerName('')
            setCustomerPhone('')
            
            // Clear current tab cart
            if (currentTab) {
              updateCurrentTab({
                ...currentTab,
                cart: [],
                total: 0,
                customerName: '',
                customerPhone: ''
              })
            }
            
            alert(`✅ Sale completed & receipt printed!\n\nInvoice: ${sale.invoice_no}\nTotal: ${total.toFixed(2)}`)
          } else {
            // Sale succeeded but print failed
            alert(`✅ Sale completed!\n❌ Print failed - please check printer\n\nInvoice: ${sale.invoice_no}\nTotal: ${total.toFixed(2)}`)
          }
        } catch (printError) {
          console.error('[POS] Print error after sale:', printError)
          alert(`✅ Sale completed!\n❌ Print failed - please check printer\n\nInvoice: ${sale.invoice_no}\nTotal: ${total.toFixed(2)}`)
        }
        
        // Clear all POS terminal state after successful sale
        clearAllPOSState()
        
        // Refresh outstanding payments data to ensure clean state
        setTimeout(() => {
          refreshOutstandingPayments()
        }, 2000)
      } else if (createSale.rejected.match(result)) {
        const error = result.payload || result.error
        alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[POS] handleSaleOnly error:', error)
      alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
    }
  }

  // Sale without print function - creates sale but skips printing
  const handleSaleWithoutPrint = async () => {
    // Prevent duplicate submissions
    if (isProcessingSale) {
      console.log('[POS] Sale without print already in progress, ignoring duplicate click')
      return
    }
    
    setIsProcessingSale(true)
    console.log('[POS] handleSaleWithoutPrint start', { currentCartLength: currentCart.length, total })

    try {
      // Handle admin not in simulation mode
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      
      // Validate customer info for partial payment or fully credit
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }
      
      // First validate required data
      if (!user) {
        alert('❌ User not authenticated. Please login again.')
        return
      }
      
      if (!currentCart || currentCart.length === 0) {
        // Check if customer is here only to clear outstanding payments
        if (selectedOutstandingPayments.length > 0) {
          console.log('[POS] Customer clearing outstanding payments only - no items in cart')
          
          const confirmOutstandingOnly = confirm(
            `💰 Outstanding Payment Settlement (No Print)\n\n` +
            `Customer: ${customerName || 'Unknown'}\n` +
            `Phone: ${customerPhone || 'N/A'}\n` +
            `Outstanding Amount: ${outstandingTotal.toFixed(2)}\n\n` +
            `This will create a settlement transaction and mark all selected outstanding payments as COMPLETED.\n\n` +
            `Do you want to proceed with the settlement?`
          )
          
          if (!confirmOutstandingOnly) {
            console.log('[POS] User cancelled outstanding-only settlement')
            return
          }
          
          console.log('[POS] Proceeding with outstanding-only settlement (no print)')
          
          // Process outstanding payments directly without creating a sale
          try {
            console.log('[POS] Processing outstanding payments only:', selectedOutstandingPayments)
            
            // Use the clear-outstanding API for each selected customer
            for (const paymentId of selectedOutstandingPayments) {
              const payment = outstandingPayments.find(p => p.id === paymentId)
              if (payment) {
                console.log('[POS] Clearing outstanding payment for customer:', payment.customer_name, payment.customer_phone)
                
                const clearResponse = await api.post('/sales/clear-outstanding', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  paymentAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                if (clearResponse.data.success) {
                  console.log('[POS] Successfully cleared outstanding payment:', clearResponse.data.data)
                } else {
                  console.error('[POS] Failed to clear outstanding payment:', clearResponse.data.message)
                  alert(`❌ Failed to clear outstanding payment for ${payment.customer_name}. Please check manually.`)
                  return
                }
              }
            }
            
            // Show success message
            alert(`✅ Outstanding Payments Settled Successfully!\n\n` +
                  `Customer: ${customerName || 'Unknown'}\n` +
                  `Settled Amount: ${outstandingTotal.toFixed(2)}\n` +
                  `Payment Method: ${paymentMethod}\n\n` +
                  `All selected outstanding payments have been marked as COMPLETED.`)
            
            // Clear all POS terminal state after successful settlement
            clearAllPOSState()
            
            // Refresh outstanding payments data to ensure clean state
            setTimeout(() => {
              refreshOutstandingPayments()
            }, 2000)
            
            return // Exit early since we handled outstanding-only settlement
            
          } catch (error) {
            console.error('[POS] Error processing outstanding-only settlement:', error)
            alert(`❌ Error processing outstanding payment settlement: ${error.message}`)
            return
          }
        } else {
          alert('❌ Cart is empty. Please add items before processing sale.')
          return
        }
      }

      if (total <= 0) {
        alert('❌ Total amount must be greater than 0.')
        return
      }

      // Validate outstanding payments selection
      if (selectedOutstandingPayments.length > 0) {
        const confirmOutstanding = confirm(
          `⚠️ You have selected ${selectedOutstandingPayments.length} outstanding payment(s) totaling ${outstandingTotal.toFixed(2)} to settle.\n\n` +
          `This will mark the selected outstanding payments as COMPLETED.\n\n` +
          `Do you want to proceed with settling these outstanding payments?`
        )
        
        if (!confirmOutstanding) {
          console.log('[POS] User cancelled outstanding payment processing')
          return
        }
      }

      // Calculate payment amounts
      const finalPaymentAmount = isFullyCredit ? 0 : (isPartialPayment ? parseFloat(paymentAmount) || 0 : total)
      const finalCreditAmount = isFullyCredit ? total : (isPartialPayment ? (total - (parseFloat(paymentAmount) || 0)) : 0)
      const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

      // Enhanced partial payment validation
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) {
          alert('❌ Payment amount must be greater than 0 for partial payments.')
          return
        }
        if (finalPaymentAmount >= total) {
          alert('❌ Payment amount must be less than total for partial payments.')
          return
        }
      }

      // Create sale data
      const saleData = {
        items: currentCart.map(item => ({
          inventoryItemId: item.id,
          name: item.name,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0),
          discount: parseFloat(item.discount || 0),
          total: (parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0) * parseFloat(item.quantity)) - parseFloat(item.discount || 0)
        })),
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        discount: parseFloat(totalDiscount),
        total: parseFloat(total),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
        paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'),
        paymentStatus: finalPaymentStatus,
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        customerInfo: {
          name: customerName || 'Walk-in Customer',
          phone: customerPhone || ''
        },
        notes: notes || 'Sale completed without printing'
      }

      console.log('[POS] handleSaleWithoutPrint saleData:', saleData)
      const result = await dispatch(createSale(saleData))
      
      if (createSale.fulfilled.match(result)) {
        const sale = result.payload.data || result.payload
        
        // Process outstanding payments if any are selected
        if (selectedOutstandingPayments.length > 0) {
          try {
            for (const paymentId of selectedOutstandingPayments) {
              const payment = outstandingPayments.find(p => p.id === paymentId)
              if (payment) {
                const clearResponse = await api.post('/sales/clear-outstanding', {
                  customerName: payment.customer_name,
                  phone: payment.customer_phone,
                  paymentAmount: payment.outstandingAmount,
                  paymentMethod: paymentMethod.toUpperCase()
                })
                
                if (!clearResponse.data.success) {
                  console.error('[POS] Failed to clear outstanding payment:', clearResponse.data.message)
                  alert(`❌ Failed to clear outstanding payment for ${payment.customer_name}. Please check manually.`)
                  return
                }
              }
            }
          } catch (error) {
            console.error('[POS] Error processing outstanding payments:', error)
            alert(`❌ Error processing outstanding payments: ${error.message}`)
            return
          }
        }
        
        // Show success message (no printing)
        alert(`✅ Sale completed successfully!\n\n` +
              `Invoice: ${sale.invoice_no}\n` +
              `Total: ${total.toFixed(2)}\n` +
              `Payment: ${paymentMethod.toUpperCase()}\n` +
              `Customer: ${customerName || 'Walk-in Customer'}\n` +
              `Phone: ${customerPhone || 'N/A'}\n\n` +
              `Receipt was NOT printed.`)
        
        // Clear all POS terminal state after successful sale
        clearAllPOSState()
        
        // Refresh outstanding payments data to ensure clean state
        setTimeout(() => {
          refreshOutstandingPayments()
        }, 2000)
      } else if (createSale.rejected.match(result)) {
        const error = result.payload || result.error
        alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[POS] handleSaleWithoutPrint error:', error)
      alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
    } finally {
      // Always reset loading state
      setIsProcessingSale(false)
    }
  }

  // Direct print function - prints current cart without creating sale
  const handleDirectPrint = async () => {
    console.log('[POS] handleDirectPrint start', { currentCartLength: currentCart.length })

    try {
      if (!currentCart || currentCart.length === 0) {
        alert('❌ Cart is empty. Please add items before printing.')
        return
      }

      // Prepare print data with current cart
      const printData = {
        type: 'receipt',
        title: 'DRAFT RECEIPT',
        companyName: companyInfo.name || 'Company Name',
        companyAddress: companyInfo.address || 'Company Address',
        companyPhone: companyInfo.phone || 'Company Phone',
        companyEmail: companyInfo.email || 'company@email.com',
        receiptNumber: `DRAFT-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashierName: user?.name || user?.username || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        items: currentCart.map(item => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          discount: item.discount || 0
        })),
        subtotal: subtotal,
        tax: tax,
        total: total,
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
        notes: 'DRAFT - Not a completed sale',
        footerMessage: 'Thank you for your business!'
      }

      // Try different print methods
      let printResult = null
      
      if (window.electronAPI?.printReceipt) {
        // Electron environment - use native printer
        printResult = await window.electronAPI.printReceipt(printData)
      } else {
        // Browser environment - use Web Serial API for thermal printers
        try {
          printResult = await printToThermalPrinter(printData)
        } catch (serialError) {
          console.warn('[POS] Serial printer not available, falling back to browser print')
          // Fallback to browser print dialog
          printResult = await printToBrowser(printData)
        }
      }
      
      if (printResult?.success) {
        alert('✅ Receipt printed successfully!')
      } else {
        // Get printer status for troubleshooting
        const printerStatus = await checkPrinterStatus()
        
        let errorMessage = '❌ Print failed. Please check printer connection.\n\n'
        errorMessage += `Printer Status: ${printerStatus.message}\n\n`
        errorMessage += 'Troubleshooting Steps:\n'
        errorMessage += '1. Check if printer is powered on\n'
        errorMessage += '2. Verify USB cable connection\n'
        errorMessage += '3. Check Windows Device Manager for printer\n'
        errorMessage += '4. Try printing from another application\n'
        errorMessage += '5. Restart the printer\n'
        errorMessage += '6. Check printer drivers\n\n'
        errorMessage += 'If using browser print dialog:\n'
        errorMessage += '- Select correct printer\n'
        errorMessage += '- Check printer settings\n'
        errorMessage += '- Try different browser'
        
        alert(errorMessage)
      }
    } catch (error) {
      console.error('[POS] handleDirectPrint error:', error)
      alert(`❌ Print failed: ${error.message || 'Unknown error'}`)
    }
  }

  // Print receipt function - now creates sale first, then prints

  // Print to thermal printer using Web Serial API
  const printToThermalPrinter = async (printData) => {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported')
    }

    try {
      // Request access to serial port
      console.log('[POS] Requesting serial port access...')
      const port = await navigator.serial.requestPort()
      
      if (!port) {
        throw new Error('No port selected by user')
      }
      
      console.log('[POS] Port selected:', port.getInfo())
      
      // Try different baud rates for compatibility
      const baudRates = [9600, 19200, 38400, 57600, 115200]
      let connected = false
      
      for (const baudRate of baudRates) {
        try {
          console.log(`[POS] Trying baud rate: ${baudRate}`)
          await port.open({ baudRate })
          connected = true
          console.log(`[POS] Connected successfully at ${baudRate} baud`)
          break
        } catch (error) {
          console.log(`[POS] Failed at ${baudRate} baud:`, error.message)
          if (port.readable) {
            await port.close()
          }
        }
      }
      
      if (!connected) {
        throw new Error('Could not connect to printer at any baud rate')
      }

      const writer = port.writable.getWriter()
      
      // ESC/POS commands for thermal printer - matching exact layout structure
      const commands = [
        0x1B, 0x40, // Initialize printer
        
        // HEADER SECTION - Company Logo/Name
        0x1B, 0x61, 0x01, // Center align
        0x1B, 0x21, 0x30, // Double height and width
        ...new TextEncoder().encode(printData.companyName || 'COMPANY NAME'),
        0x0A, // Line feed
        
        // Company Info
        0x1B, 0x21, 0x00, // Normal size
        ...new TextEncoder().encode((printData.companyAddress || 'Company Address').substring(0, 32)),
        0x0A,
        ...new TextEncoder().encode(`Tel: ${printData.companyPhone || 'Company Phone'}`),
        0x0A,
        ...new TextEncoder().encode(`Email: ${printData.companyEmail || 'company@email.com'}`),
        0x0A,
        
        // RECEIPT TITLE SECTION
        0x1B, 0x61, 0x00, // Left align
        ...new TextEncoder().encode('================================'),
        0x0A,
        0x1B, 0x61, 0x01, // Center align
        0x1B, 0x21, 0x20, // Double height
        ...new TextEncoder().encode('SALES RECEIPT'),
        0x0A,
        0x1B, 0x21, 0x00, // Normal size
        0x1B, 0x61, 0x00, // Left align
        ...new TextEncoder().encode('================================'),
        0x0A,
        
        // RECEIPT INFO SECTION
        ...new TextEncoder().encode(`Receipt #: ${(printData.receiptNumber || 'N/A').substring(0, 20)}`),
        0x0A,
        ...new TextEncoder().encode(`Date: ${printData.date}`),
        0x0A,
        ...new TextEncoder().encode(`Time: ${printData.time || ''}`),
        0x0A,
        ...new TextEncoder().encode(`Cashier: ${printData.cashierName}`),
        0x0A,
        ...new TextEncoder().encode(`Customer: ${printData.customerName || 'Walk-in Customer'}`),
        0x0A,
        ...new TextEncoder().encode('================================'),
        0x0A,
      ]

      // ITEMS SECTION - Header and Items
      commands.push(
        // Items Header
        ...new TextEncoder().encode('Item            Qty Price Total'),
        0x0A,
        ...new TextEncoder().encode('------------------------------'),
        0x0A
      )

      // Add items with proper formatting
      printData.items.forEach(item => {
        const itemName = item.name || 'Unknown Item'
        const quantity = item.quantity || 0
        const unitPrice = item.unitPrice || 0
        const total = item.total || 0
        
        // Format item name (max 15 chars for thermal printer, pad with spaces)
        const formattedName = itemName.substring(0, 15).padEnd(15, ' ')
        const formattedQty = quantity.toString().padStart(3, ' ')
        const formattedPrice = unitPrice.toFixed(2).padStart(7, ' ')
        const formattedTotal = total.toFixed(2).padStart(7, ' ')
        
        commands.push(
          ...new TextEncoder().encode(`${formattedName}${formattedQty}${formattedPrice}${formattedTotal}`),
          0x0A
        )
      })

      // TOTALS SECTION - Scenario-wise handling
      commands.push(
        ...new TextEncoder().encode('================================'),
        0x0A,
        ...new TextEncoder().encode(`Subtotal:                    ${(printData.subtotal || 0).toFixed(2)}`),
        0x0A,
        ...new TextEncoder().encode(`Tax:                         ${(printData.tax || 0).toFixed(2)}`),
        0x0A,
        ...new TextEncoder().encode(`Total:                       ${(printData.total || 0).toFixed(2)}`),
        0x0A,
        ...new TextEncoder().encode(`Payment Method:      ${(printData.paymentMethod || 'CASH').substring(0, 12)}`),
        0x0A
      )

      // SCENARIO-WISE PAYMENT DISPLAY
      // Scenario 1: Full Payment - Show payment amount only
      if (printData.paymentMethod === 'CASH' && (!printData.creditAmount || printData.creditAmount === 0)) {
        commands.push(
          ...new TextEncoder().encode(`Payment Amount:      ${(printData.paymentAmount || printData.total || 0).toFixed(2)}`),
          0x0A
        )
      }
      
      // Scenario 2: Partial Payment - Show payment + credit amount
      else if (printData.paymentMethod === 'PARTIAL_PAYMENT' || (printData.creditAmount && printData.creditAmount > 0)) {
        commands.push(
          ...new TextEncoder().encode(`Payment Amount:      ${(printData.paymentAmount || 0).toFixed(2)}`),
        0x0A,
          ...new TextEncoder().encode(`Credit Amount:       ${(printData.creditAmount || 0).toFixed(2)}`),
          0x0A
        )
      }
      
      // Scenario 3: Fully Credit - Show credit amount only
      else if (printData.paymentMethod === 'FULLY_CREDIT') {
        commands.push(
          ...new TextEncoder().encode(`Payment Amount:           0.00`),
          0x0A,
          ...new TextEncoder().encode(`Credit Amount:       ${(printData.creditAmount || printData.total || 0).toFixed(2)}`),
          0x0A
        )
      }
      
      // Scenario 4: Outstanding Cleared - Show payment + outstanding cleared
      if (printData.outstandingCleared && printData.outstandingCleared > 0) {
        commands.push(
          ...new TextEncoder().encode(`Outstanding Cleared:  ${printData.outstandingCleared.toFixed(2)}`),
          0x0A
        )
      }

      // FOOTER SECTION
      commands.push(
        ...new TextEncoder().encode('================================'),
        0x0A,
        0x1B, 0x61, 0x01, // Center align
        ...new TextEncoder().encode(printData.footerMessage || 'Thank you for your business!'),
        0x0A,
        0x0A,
        ...new TextEncoder().encode('Return within 3 days'),
        0x0A,
        ...new TextEncoder().encode('================================'),
        0x0A,
        ...new TextEncoder().encode('Powered by Tychora'),
        0x0A,
        ...new TextEncoder().encode('www.tychora.com'),
        0x0A,
        0x0A,
        0x0A,
        0x1D, 0x56, 0x00 // Cut paper
      )

      await writer.write(new Uint8Array(commands))
      writer.releaseLock()
      await port.close()

      return { success: true, message: 'Printed to thermal printer' }
    } catch (error) {
      console.error('[POS] Thermal printer error:', error)
      throw error
    }
  }


  // Check printer status and provide troubleshooting
  const checkPrinterStatus = async () => {
    try {
      // Check if printer is available
      if (navigator.serial) {
        const ports = await navigator.serial.getPorts()
        console.log('[POS] Available serial ports:', ports.length)
        
        if (ports.length > 0) {
          return {
            hasSerialPorts: true,
            portCount: ports.length,
            message: `Found ${ports.length} serial port(s) - printer may be connected`
          }
        }
      }
      
      return {
        hasSerialPorts: false,
        portCount: 0,
        message: 'No serial ports detected - check printer connection'
      }
    } catch (error) {
      console.error('[POS] Printer status check error:', error)
      return {
        hasSerialPorts: false,
        portCount: 0,
        message: 'Error checking printer status'
      }
    }
  }

  // Print to browser print dialog
  const printToBrowser = async (printData) => {
    try {
      // Create a printable HTML content - matching exact thermal printer layout structure
      const printContent = `
        <div style="font-family: monospace; max-width: 280px; margin: 0 auto; padding: 4px 0 4px 16px; font-size: 11px; line-height: 1.1; color: #000; background-color: #fff;">
          <!-- HEADER SECTION -->
          <div style="text-align: center; margin-bottom: 8px;">
            <div style="margin-bottom: 4px;">
              <img src="/petzonelogo.png" alt="PetZone" style="max-width: 100px; width: 100px; height: auto; filter: grayscale(100%); display: block; margin: 0 auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              <div style="font-size: 14px; font-weight: bold; display: none; text-align: center; border: 1px solid #000; padding: 4px; min-height: 50px; display: flex; align-items: center; justify-content: center;">
                ${printData.companyName || 'COMPANY NAME'}
          </div>
          </div>
            <div style="font-size: 9px; margin-bottom: 3px; line-height: 1.2;">
              ${(printData.companyAddress || 'Company Address').substring(0, 32)}
          </div>
            <div style="font-size: 9px; margin-bottom: 3px; line-height: 1.2;">
              Tel: ${printData.companyPhone || 'Company Phone'}
          </div>
            <div style="font-size: 9px; margin-bottom: 8px; line-height: 1.2;">
              Email: ${printData.companyEmail || 'company@email.com'}
            </div>
            <div style="border-top: 2px solid #000; margin: 4px 0;"></div>
            <div style="font-weight: bold; text-transform: uppercase; font-size: 12px; color: #000; text-align: center; margin-bottom: 4px;">
              SALES RECEIPT
            </div>
            <div style="border-top: 2px solid #000; margin: 4px 0;"></div>
          </div>
          
          <!-- RECEIPT INFO SECTION -->
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="font-size: 10px; font-weight: bold;">Receipt #:</span>
              <span style="font-weight: bold; font-size: 10px;">${(printData.receiptNumber || 'N/A').substring(0, 20)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="font-size: 10px; font-weight: bold;">Date:</span>
              <span style="font-size: 10px;">${printData.date}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="font-size: 10px; font-weight: bold;">Time:</span>
              <span style="font-size: 10px;">${printData.time || ''}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="font-size: 10px; font-weight: bold;">Cashier:</span>
              <span style="font-size: 10px;">${printData.cashierName || 'N/A'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="font-size: 10px; font-weight: bold;">Customer:</span>
              <span style="font-size: 10px;">${printData.customerName || 'Walk-in Customer'}</span>
            </div>
          </div>
          
          <div style="border-top: 2px solid #000; margin: 4px 0;"></div>
          
          <!-- ITEMS SECTION -->
          <div style="margin-bottom: 8px;">
            <div style="display: flex; margin-bottom: 6px; font-weight: bold;">
              <div style="flex: 2; font-size: 10px;">Item</div>
              <div style="width: 30px; text-align: center; font-size: 10px;">Qty</div>
              <div style="width: 50px; text-align: right; font-size: 10px;">Price</div>
              <div style="width: 50px; text-align: right; font-size: 10px;">Total</div>
            </div>
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
            
            ${printData.items.map(item => `
              <div style="margin-bottom: 6px;">
                <div style="font-weight: bold; margin-bottom: 2px; font-size: 10px;">
                  ${item.name || 'Unknown Item'}
                </div>
                <div style="display: flex; margin-top: 2px;">
                  <div style="flex: 2; font-size: 10px;"></div>
                  <div style="width: 30px; text-align: center; font-size: 10px; font-weight: bold;">
                    ${item.quantity || 0}
                  </div>
                  <div style="width: 50px; text-align: right; font-size: 10px; font-weight: bold;">
                    ${(item.unitPrice || 0).toFixed(2)}
                  </div>
                  <div style="width: 50px; text-align: right; font-weight: bold; font-size: 10px;">
                    ${((item.unitPrice || 0) * (item.quantity || 0)).toFixed(2)}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div style="border-top: 2px solid #000; margin: 4px 0;"></div>
          
          <!-- TOTALS SECTION -->
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: bold;">Subtotal:</span>
              <span style="font-size: 10px;">${(printData.subtotal || 0).toFixed(2)}</span>
          </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: bold;">Tax:</span>
              <span style="font-size: 10px;">${(printData.tax || 0).toFixed(2)}</span>
            </div>
            <div style="border-top: 2px solid #000; margin: 8px 0;"></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: bold; font-size: 12px;">TOTAL:</span>
              <span style="font-weight: bold; font-size: 12px;">${(printData.total || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: bold;">Payment Method:</span>
              <span style="font-size: 10px;">${printData.paymentMethod || 'CASH'}</span>
            </div>
            
            <!-- SCENARIO-WISE PAYMENT DISPLAY -->
            ${printData.paymentMethod === 'CASH' && (!printData.creditAmount || printData.creditAmount === 0) ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: bold;">Payment Amount:</span>
                <span style="font-size: 10px;">${(printData.paymentAmount || printData.total || 0).toFixed(2)}</span>
              </div>
            ` : ''}
            
            ${printData.paymentMethod === 'PARTIAL_PAYMENT' || (printData.creditAmount && printData.creditAmount > 0) ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: bold;">Payment Amount:</span>
                <span style="font-size: 10px;">${(printData.paymentAmount || 0).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: bold; color: #d32f2f;">Credit Amount:</span>
                <span style="font-size: 10px; color: #d32f2f;">${(printData.creditAmount || 0).toFixed(2)}</span>
              </div>
            ` : ''}
            
            ${printData.paymentMethod === 'FULLY_CREDIT' ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: bold;">Payment Amount:</span>
                <span style="font-size: 10px;">0.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: bold; color: #d32f2f;">Credit Amount:</span>
                <span style="font-size: 10px; color: #d32f2f;">${(printData.creditAmount || printData.total || 0).toFixed(2)}</span>
              </div>
            ` : ''}
            
            ${printData.outstandingCleared && printData.outstandingCleared > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: bold; color: #2E7D32;">Outstanding Cleared:</span>
                <span style="font-size: 10px; color: #2E7D32;">${printData.outstandingCleared.toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
          
          <!-- FOOTER SECTION -->
          <div style="text-align: center; margin-top: 8px;">
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
            <div style="font-size: 9px; margin-bottom: 4px;">
              ${printData.footerMessage || 'Thank you for your business!'}
            </div>
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
                  <div style="font-size: 9px; margin-bottom: 4px;">
                    Return within 3 days
                  </div>
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
            <div style="font-size: 10px; margin-bottom: 2px;">
              Powered by Tychora
            </div>
            <div style="font-size: 9px;">
              www.tychora.com
            </div>
          </div>
        </div>
      `

      // Create a new window for printing
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${printData.receiptNumber}</title>
            <style>
              @media print {
                body { margin: 0; }
                @page { margin: 0; size: 80mm auto; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `)
      printWindow.document.close()
      
      // Wait for content to load, then print
      printWindow.onload = () => {
        try {
          printWindow.print()
          
          // Handle print completion
          printWindow.addEventListener('afterprint', () => {
            printWindow.close()
          })
          
          // Fallback timeout
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close()
            }
          }, 5000)
        } catch (printError) {
          console.error('[POS] Print window error:', printError)
          printWindow.close()
          throw new Error('Failed to open print dialog')
        }
      }

      return { success: true, message: 'Opened browser print dialog' }
    } catch (error) {
      console.error('[POS] Browser print error:', error)
      return { success: false, message: 'Failed to open print dialog' }
    } finally {
      // Always reset loading state
      setIsProcessingSaleOnly(false)
    }
  }

  const printReceipt = async () => {
    // Prevent duplicate submissions
    if (isProcessingSale) {
      console.log('[POS] Sale already in progress, ignoring duplicate click')
      return
    }
    
    setIsProcessingSale(true)
    console.log('[POS] printReceipt start', { currentCartLength: currentCart.length, total })

    try {

      // Handle admin not in simulation mode
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      
      // Validate customer info for partial payment or fully credit
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }

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

      const finalPaymentAmount = isFullyCredit ? 0 : (isPartialPayment ? parseFloat(paymentAmount) || 0 : total)

      const finalCreditAmount = isFullyCredit ? total : (isPartialPayment ? (total - (parseFloat(paymentAmount) || 0)) : 0)

      const finalPaymentStatus = isPartialPayment ? 'PENDING' : 'COMPLETED'

      
      
      // Prepare sale data

      const saleData = {

        scopeType: user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE',

        scopeId: user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId),

        subtotal: subtotal,

        tax: tax,

        discount: totalDiscount,

        total: total,

        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod.toUpperCase(), // Keep actual payment method (CASH, BANK_TRANSFER, etc.)
        paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'), // Add payment type
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,

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

        notes: notes || `POS Terminal Print Receipt - Tab: ${currentTab?.name || 'Unknown'}${isPartialPayment ? ` (Credit: ${finalCreditAmount.toFixed(2)})` : ''}${outstandingTotal > 0 ? ` (Outstanding Payments: ${outstandingTotal.toFixed(2)})` : ''}`,

        items: currentCart.map(item => ({

          inventoryItemId: parseInt(item.id),

          sku: item.sku || '',

          name: item.name || '',

          quantity: item.quantity,

          unitPrice: parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0),

          discount: parseFloat(item.discount || 0),

          total: (parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0) * item.quantity) - parseFloat(item.discount || 0)

        }))

      }

      

      
      
      // Create the sale first

      const result = await dispatch(createSale(saleData))

  console.log('[POS] printReceipt createSale result', { result })

      

      
      
      if (createSale.fulfilled.match(result)) {

        const sale = result.payload.data || result.payload

        
        
        // Now prepare print data with the actual sale information

        const printData = {

          type: 'receipt',

          title: 'SALES RECEIPT',

          companyName: 'PetZone',

          companyAddress: 'Shop no 42 unit no 2 latifabad near musarrat banquet Hyderabad',

          companyPhone: '(555) PET-ZONE',

          companyEmail: 'info@petzone.com',

          receiptNumber: sale.invoice_no || `POS-${Date.now()}`,

          date: new Date().toLocaleDateString(),

          time: new Date().toLocaleTimeString(),

          cashierName: user?.name || user?.username || 'Cashier',

          customerName: customerName || 'Walk-in Customer',

          customerPhone: customerPhone || '',

          items: currentCart.map(item => ({

            name: item.name,

            sku: item.sku,

            quantity: item.quantity,

            unitPrice: parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0),

            total: (parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0) * item.quantity) - parseFloat(item.discount || 0)

          })),

          subtotal: subtotal,

          tax: tax,

          total: total,

          paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,

          paymentAmount: finalPaymentAmount,

          creditAmount: finalCreditAmount,

          paymentStatus: finalPaymentStatus,

          outstandingCleared: outstandingTotal > 0 ? outstandingTotal : null,

          change: isPartialPayment ? 0 : (parseFloat(paymentAmount) || total) - total,

          notes: isPartialPayment ? `Partial Payment - Credit Amount: ${finalCreditAmount.toFixed(2)}` : '',

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

    } finally {
      // Always reset loading state
      setIsProcessingSale(false)
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

          <TabIcon sx={{ mr: 1, fontSize: 14 }} />

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
        {/* Admin Mode Indicator */}
        {isAdminMode && scopeInfo && (
          <Box sx={{ 
            bgcolor: 'warning.light', 
            color: 'warning.contrastText', 
            p: 1, 
            textAlign: 'center',
            borderBottom: 1,
            borderColor: 'warning.main'
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
            </Typography>
          </Box>
        )}

        <Box sx={{ 

          minHeight: '100vh', 

          display: 'flex', 

          flexDirection: 'column',

          bgcolor: 'grey.50',

          overflow: 'auto'

        }}>



          {/* Search Bar */}

          <Paper sx={{ mb: 1, p: 1, bgcolor: theme.palette.background.default, position: 'relative' }}>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>

              <Box sx={{ flex: 1, position: 'relative' }}>

                <TextField

                  fullWidth
                  size="small"

                  label="Search products by name or category"

                  value={manualInput}

                  onChange={(e) => {

                    setManualInput(e.target.value)

                    handleManualSearch(e.target.value)

                  }}

                  onKeyPress={handleKeyPress}

                  InputProps={{

                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} />,

                    sx: { fontFamily: 'monospace', fontSize: '0.9rem' }

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

                          {product.name} - {product.price}

                        </Typography>

                        <Typography variant="caption" color="text.secondary">

                          Stock: {product.stock} {product.unit || 'units'}

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
                size="small"

                label="Category"

                value={selectedCategory}

                onChange={(e) => setSelectedCategory(e.target.value)}

                SelectProps={{

                  startAdornment: <CategoryIcon sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} />

                }}

                sx={{ minWidth: 120 }}

              >

                <MenuItem value="all">All Categories</MenuItem>

                {getCategories().map(category => (

                  <MenuItem key={category} value={category}>{category}</MenuItem>

                ))}

              </TextField>

            </Box>

            
            
            {/* Barcode Scanner Section */}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>

                <TextField

                  ref={barcodeInputRef}

                  fullWidth
                  size="small"

                  label="Scan Barcode or Enter Code"

                  value={barcodeInput}

                  onChange={(e) => setBarcodeInput(e.target.value)}

                  onKeyPress={handleKeyPress}

                  InputProps={{

                    startAdornment: <ScannerIcon sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} />,

                  sx: { fontFamily: 'monospace', fontSize: '0.9rem' }

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
                    size="small"

                    onClick={() => handleBarcodeScan(barcodeInput)}

                    disabled={!barcodeInput.trim()}

                sx={{ 

                  fontFamily: 'monospace',

                  minWidth: 100,

                  height: 40

                }}

                  >

                    ADD PRODUCT

                  </Button>

                  <Button

                    variant="outlined"
                    size="small"

                    onClick={() => router.push('/dashboard/inventory')}

                sx={{ 

                  fontFamily: 'monospace', 

                  minWidth: 100,

                  height: 40

                }}

              >

                <InventoryIcon sx={{ mr: 1, fontSize: 18 }} />

                INVENTORY

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

          minWidth: 32,

          minHeight: 32,

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





          <Box sx={{ display: 'flex', gap: 1, flex: 1, minHeight: '500px', position: 'relative', zIndex: 1 }}>

          {/* Left Panel - Product Input */}

          <Paper sx={{ p: 1, width: '30%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minHeight: '500px' }}>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>

              <Typography variant="subtitle1" gutterBottom sx={{ fontFamily: 'monospace' }}>

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
                size="small"

                label="Customer Name (Optional)"

                value={customerName}

                onChange={(e) => {

                  const value = e.target.value

                  setCustomerName(value)

                  searchCustomers(value, salesData)

                }}

                sx={{ mb: 1 }}

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
                size="small"

                label="Customer Phone (Optional)"

                value={customerPhone}

                onChange={(e) => setCustomerPhone(e.target.value)}

                sx={{ mb: 1, fontFamily: 'monospace' }}

                placeholder="Enter customer phone number..."

                type="tel"

              />



              {/* Outstanding Payments Display */}

              {customerPhone && customerPhone.trim().length >= 3 && (

                <Card sx={{ mb: 2, border: '1px solid', borderColor: 'warning.main' }}>

                  <CardContent sx={{ p: 2 }}>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>

                      <Box sx={{ display: 'flex', alignItems: 'center' }}>

                        <OutstandingIcon sx={{ mr: 1, color: 'warning.main' }} />

                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>

                          Outstanding Payments

                        </Typography>

                        {isSearchingOutstanding && (

                          <CircularProgress size={16} sx={{ ml: 1 }} />

                        )}

                      </Box>

                      

                      <IconButton

                        size="small"

                        onClick={() => {

                          console.log('[POS] Manual refresh of outstanding payments...')

                          if (customerPhone && customerPhone.trim().length >= 3) {

                            searchOutstandingPayments(customerPhone.trim(), customerName?.trim())

                          }

                        }}

                        disabled={isSearchingOutstanding}

                        sx={{ color: 'warning.main' }}

                      >

                        <RefreshIcon fontSize="small" />

                      </IconButton>

                    </Box>

                    
                    
                    {outstandingPayments.length > 0 ? (
                      <>
                        {selectedOutstandingPayments.length > 0 && (
                          <Box sx={{ 
                            mb: 2, 
                            p: 1, 
                            bgcolor: 'success.light', 
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'success.main'
                          }}>
                            <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 'bold' }}>
                              ✓ {selectedOutstandingPayments.length} Outstanding Payment{selectedOutstandingPayments.length > 1 ? 's' : ''} Auto-Selected
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'success.dark' }}>
                              Total: {outstandingTotal.toFixed(2)} - Will be settled with this transaction
                            </Typography>
                            {currentCart.length === 0 && (
                              <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mt: 0.5 }}>
                                💡 No items in cart - Click &quot;SETTLE&quot; to process outstanding payments only
                              </Typography>
                            )}
                            {currentCart.length > 0 && (
                              <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mt: 0.5 }}>
                                💡 Outstanding payments are automatically selected - Click &quot;PRINT&quot; to process
                              </Typography>
                            )}
                          </Box>
                        )}
                        
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

                                    label={`${parseFloat(payment.outstandingAmount || 0).toFixed(2)}`}

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
                      </>
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
                size="small"

                select

                label="Payment Method"

                value={paymentMethod}

                disabled={isFullyCredit}

                onChange={(e) => {
                  const selectedMethod = e.target.value
                  setPaymentMethod(selectedMethod)
                  console.log('[POS] Payment method changed to:', selectedMethod)
                }}

                sx={{ mb: 1, fontFamily: 'monospace' }}

              >

                <MenuItem value="CASH">Cash</MenuItem>

                <MenuItem value="CARD">Card</MenuItem>

                <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>

                <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>

                <MenuItem value="CHEQUE">Cheque</MenuItem>

                <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>

                <MenuItem value="FULLY_CREDIT">Fully Credit</MenuItem>

              </TextField>


              {/* Salesperson Selection (for warehouse keepers) */}
              {user?.role === 'WAREHOUSE_KEEPER' && salespeople.length > 0 && (
                <TextField
                  fullWidth
                  size="small"
                  select
                  label="Salesperson (Who brought this sale)"
                  value={selectedSalesperson?.id || ''}
                  onChange={(e) => {
                    const salesperson = salespeople.find(sp => sp.id === parseInt(e.target.value))
                    setSelectedSalesperson(salesperson)
                  }}
                  sx={{ mb: 1, fontFamily: 'monospace' }}
                >
                  <MenuItem value="">
                    <em>Select Salesperson</em>
                  </MenuItem>
                  {salespeople.map((salesperson) => (
                    <MenuItem key={salesperson.id} value={salesperson.id}>
                      {salesperson.name} ({salesperson.phone})
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {/* Payment Type Selection */}

              <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2 }}>

                <Typography variant="subtitle2" sx={{ mb: 2, fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>

                  Payment Type Selection

                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>

                  <Button

                    variant={!isPartialPayment && !isFullyCredit ? 'contained' : 'outlined'}

                    size="small"

                    onClick={() => {
                      setIsPartialPayment(false)
                      setIsFullyCredit(false)
                      setPaymentAmount('')
                      setCreditAmount('')
                      // Reset payment method to default (CASH)
                      setPaymentMethod('CASH')
                      console.log('[POS] Full payment selected, payment method reset to CASH')
                    }}

                    sx={{ fontFamily: 'monospace', flex: 1 }}

                  >

                    Full Payment

                  </Button>

                  <Button

                    variant={isPartialPayment ? 'contained' : 'outlined'}

                    size="small"

                    onClick={() => {
                      console.log('[POS] Partial payment button clicked, current payment method:', paymentMethod)
                      console.log('[POS] Current total:', total)
                      console.log('[POS] Current payment amount:', paymentAmount)
                      console.log('[POS] Current credit amount:', creditAmount)
                      
                      setIsPartialPayment(true)
                      setIsFullyCredit(false)
                      
                      // Initialize partial payment amounts
                      if (!paymentAmount || paymentAmount === '') {
                        setPaymentAmount('')
                        console.log('[POS] Set payment amount to empty string')
                      }
                      if (!creditAmount || creditAmount === '') {
                        setCreditAmount(total.toFixed(2))
                        console.log('[POS] Set credit amount to total:', total.toFixed(2))
                      }
                      
                      // Explicitly preserve the current payment method
                      // Don't call setPaymentMethod here - let it keep its current value
                      console.log('[POS] Partial payment selected, payment method should remain:', paymentMethod)
                      console.log('[POS] Partial payment mode activated')
                    }}

                    sx={{ fontFamily: 'monospace', flex: 1 }}

                  >

                    Partial Payment

                  </Button>

                  <Button

                    variant={isFullyCredit ? 'contained' : 'outlined'}

                    size="small"

                    onClick={() => {
                      setIsPartialPayment(false)
                      setIsFullyCredit(true)
                      // Set full amount as credit
                      setPaymentAmount('')
                      setCreditAmount(total.toString())
                      // Keep the current payment method (CASH, CARD, etc.) - don't change it to FULLY_CREDIT
                      console.log('[POS] Fully credit selected, keeping current payment method:', paymentMethod)
                    }}

                    sx={{ fontFamily: 'monospace', flex: 1 }}

                  >

                    Fully Credit

                  </Button>

                </Box>

              </Box>



              {/* Payment Fields */}
              {(isPartialPayment || isFullyCredit) && (
                <Box sx={{ mb: 2, p: 3, bgcolor: alpha(theme.palette.warning.main, 0.15), borderRadius: 2, border: '2px solid', borderColor: 'warning.main' }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'warning.main', fontWeight: 'bold' }}>
                    {isFullyCredit ? '💳 Fully Credit Details' : '💰 Partial Payment Details'}
                  </Typography>

                  <>

                    <TextField
                      fullWidth
                      size="small"
                      label={isFullyCredit ? "Payment Amount (Not Applicable)" : "Payment Amount (Paid Now)"}
                      value={isFullyCredit ? "0.00" : (paymentAmount || '')}
                      placeholder="0"
                      type="number"
                      color="warning"
                      disabled={isFullyCredit}
                      inputProps={{ min: 0, max: total, step: 0.01 }}
                      onFocus={(e) => {
                        // Prevent any automatic value changes on focus
                        e.preventDefault()
                      }}
                      onChange={(e) => {
                        if (isFullyCredit) return; // Don't allow changes in fully credit mode
                        const inputValue = e.target.value
                        
                        // Allow empty string for clearing
                        if (inputValue === '') {
                          setPaymentAmount('')
                          setCreditAmount(total.toString())
                          return
                        }

                        const amount = Math.floor(parseFloat(inputValue) || 0)
                        const newCreditAmount = Math.floor(total - amount)

                        console.log('[POS] Payment amount changed:', { 
                          inputValue, 
                          parsedAmount: amount, 
                          total, 
                          newCreditAmount 
                        })

                        setPaymentAmount(amount.toString())
                        setCreditAmount(newCreditAmount.toString())
                      }}
                      onWheel={(e) => {
                        // Completely prevent scroll from changing the value
                        e.preventDefault()
                        e.stopPropagation()
                        e.nativeEvent.stopImmediatePropagation()
                        return false
                      }}
                      onKeyDown={(e) => {
                        // Prevent arrow keys from changing values
                        if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                          e.preventDefault()
                          e.stopPropagation()
                        }
                      }}
                      sx={{ 
                        mb: 1, 
                        fontFamily: 'monospace',
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                          WebkitAppearance: 'none',
                          appearance: 'none'
                        },
                        '& input[type=number]::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                          display: 'none'
                        },
                        '& input[type=number]::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                          display: 'none'
                        },
                        '& input[type=number]::-ms-clear': {
                          display: 'none'
                        }
                      }}
                    />

                    
                    
                    <TextField

                      fullWidth
                      size="small"

                      label={isFullyCredit ? "Credit Amount (Full Amount)" : "Credit Amount (Remaining)"}

                      value={creditAmount || ''}

                      disabled={isFullyCredit}

                      onChange={(e) => {
                        if (isFullyCredit) return; // Don't allow changes in fully credit mode

                        const amount = parseFloat(e.target.value) || 0
                        const newPaymentAmount = total - amount

                        console.log('[POS] Credit amount changed:', { 
                          inputValue: e.target.value, 
                          parsedAmount: amount, 
                          total, 
                          newPaymentAmount 
                        })

                        setCreditAmount(amount.toString())
                        setPaymentAmount(newPaymentAmount.toString())

                      }}

                      onWheel={(e) => {
                        // Completely prevent scroll from changing the value
                        e.preventDefault()
                        e.stopPropagation()
                        e.nativeEvent.stopImmediatePropagation()
                        return false
                      }}

                      onKeyDown={(e) => {
                        // Prevent arrow keys from changing values
                        if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                          e.preventDefault()
                          e.stopPropagation()
                        }
                      }}

                      sx={{ 
                        mb: 1, 
                        fontFamily: 'monospace',
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                          WebkitAppearance: 'none',
                          appearance: 'none'
                        },
                        '& input[type=number]::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                          display: 'none'
                        },
                        '& input[type=number]::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                          display: 'none'
                        },
                        '& input[type=number]::-ms-clear': {
                          display: 'none'
                        }
                      }}

                      placeholder="Amount to be paid later"

                      type="number"

                      inputProps={{ min: 0, max: total, step: 0.01 }}

                      color="warning"

                    />

                    
                    
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>

                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'info.main', fontWeight: 'bold' }}>

                        💰 Total: {total.toFixed(2)} | 💵 Paid: {(parseFloat(paymentAmount) || 0).toFixed(2)} | 📝 Credit: {(parseFloat(creditAmount) || 0).toFixed(2)}

                      </Typography>

                    </Box>

                  </>

                </Box>
              )}



              {/* Current Tab Info */}

              {currentTab && (

                <Box sx={{ mb: 2, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 1 }}>

                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>

                    Active Tab: {currentTab.name} | Items: {currentCart.length} | Total: {total.toFixed(2).replace(/\.00$/, '')}

                  </Typography>

                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>

                    Inventory: {inventoryItems.length} products available

                  </Typography>

                </Box>

              )}
              
              







              {/* Notes Section */}

              <Box sx={{ mt: 'auto' }}>

                <Typography variant="subtitle2" gutterBottom>

                  Notes:

                </Typography>

                <TextField

                  fullWidth

                  multiline

                  rows={3}

                  placeholder="Add notes for this sale (max 500 characters)..."

                  value={notes}

                  onChange={(e) => {

                    const value = e.target.value;

                    if (value.length <= 500) {

                      setNotes(value);

                    }

                  }}

                  sx={{ 

                    fontFamily: 'monospace',

                    '& .MuiInputBase-input': {

                      fontSize: '0.8rem',

                      lineHeight: 1.2

                    }

                  }}

                  helperText={`${notes.length}/500 characters`}

                  inputProps={{ maxLength: 500 }}

                />

              </Box>

            </Paper>



            {/* Right Panel - Cart and Totals */}

            <Paper sx={{ p: 1, width: '70%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minHeight: '500px' }}>

              <Typography variant="subtitle1" gutterBottom sx={{ fontFamily: 'monospace' }}>

                SHOPPING CART - {currentTab?.name || 'No Tab'}

              </Typography>

              
              
              {/* Cart Items */}

              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>

                <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.8rem', py: 0.5 } }}>

                  <TableHead>

                    <TableRow>

                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 120, width: '30%' }}>Item</TableCell>

                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 60, width: '15%' }}>Price</TableCell>

                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 50, width: '10%' }}>Qty</TableCell>

                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 50, width: '10%' }}>Disc</TableCell>

                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 60, width: '15%' }}>Total</TableCell>

                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 50, width: '10%' }}>Act</TableCell>

                    </TableRow>

                  </TableHead>

                  <TableBody>

                    {currentCart.map((item) => (

                      <TableRow key={item.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>

                        <TableCell sx={{ fontFamily: 'monospace', minWidth: 120, width: '30%' }}>

                          <Box>

                            <Typography variant="body2" sx={{ fontWeight: 'medium', wordBreak: 'break-word' }}>

                          {item.name}

                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>

                              Stock: {item.stock} {item.unit || 'units'}

                            </Typography>

                          </Box>

                        </TableCell>

                        <TableCell sx={{ fontFamily: 'monospace', minWidth: 60, width: '15%', textAlign: 'right' }}>

                          <Tooltip title="Click to edit price" placement="top">

                            <TextField

                            size="small"

                            type="number"

                            label="Price"

                            value={parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0).toFixed(2).replace(/\.00$/, '')}

                            onChange={(e) => updateItemPrice(item.id, e.target.value)}

                            inputProps={{ 

                              min: 0, 

                              step: 0.01,

                              style: { fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'right' },
                              inputMode: 'decimal'

                            }}

                            sx={{ 
                              width: '90px', 
                              '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 },
                              '& .MuiInputLabel-root': { fontSize: '0.7rem', transform: 'translate(14px, -9px) scale(0.75)' },
                              '& .MuiOutlinedInput-root': { 
                                backgroundColor: item.customPrice && item.customPrice !== item.price ? '#fff3cd' : 'transparent',
                                border: item.customPrice && item.customPrice !== item.price ? '2px solid #ffc107' : '1px solid rgba(0,0,0,0.23)',
                                '&:hover': { borderColor: '#1976d2' },
                                '&.Mui-focused': { borderColor: '#1976d2' }
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

                          </Tooltip>

                          {item.customPrice && item.customPrice !== item.price && (

                            <IconButton

                              size="small"

                              onClick={() => resetItemPrice(item.id)}

                              sx={{ 

                                p: 0.5, 

                                fontSize: '0.7rem',

                                color: '#ffc107',

                                '&:hover': { backgroundColor: '#fff3cd' }

                              }}

                              title="Reset to original price"

                            >

                              ↶

                            </IconButton>

                          )}

                        </TableCell>

                        <TableCell sx={{ minWidth: 50, width: '10%' }}>

                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>

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
                              minWidth: 25, 
                              textAlign: 'center',
                              fontWeight: 'bold',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              px: 0.5,
                              py: 0.25,
                              borderRadius: 1,
                              fontSize: '0.8rem'
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
                        <TableCell sx={{ fontFamily: 'monospace', minWidth: 50, width: '10%', textAlign: 'right' }}>
                          <TextField
                            size="small"
                            type="number"
                            value={parseFloat(item.discount || 0).toFixed(2).replace(/\.00$/, '')}
                            onChange={(e) => updateItemDiscount(item.id, e.target.value || '0')}
                            inputProps={{ 
                              min: 0, 
                              step: 0.01,
                              style: { fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'right' },
                              inputMode: 'decimal'

                            }}

                            sx={{ 
                              width: '80px', 
                              '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 },
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
                        <TableCell sx={{ fontFamily: 'monospace', minWidth: 60, width: '15%', textAlign: 'right', fontWeight: 'bold' }}>
                          {((parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0) * item.quantity) - parseFloat(item.discount || 0)).toFixed(2).replace(/\.00$/, '')}
                        </TableCell>
                        <TableCell sx={{ minWidth: 50, width: '10%', textAlign: 'center' }}>
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
              <Box sx={{ mt: 1, p: 0.5, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Subtotal:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{subtotal.toFixed(2).replace(/\.00$/, '')}</Typography>
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
                      sx={{ width: '50px', '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 } }}
                    />
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>%</Typography>
                </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{tax.toFixed(2).replace(/\.00$/, '')}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Total Discount:</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={parseFloat(totalDiscount || 0).toFixed(2).replace(/\.00$/, '')}
                      onChange={(e) => setTotalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      inputProps={{ 
                        min: 0, 
                        step: 0.01,
                        style: { fontFamily: 'monospace', width: '60px', textAlign: 'center', fontSize: '0.8rem' },
                        inputMode: 'decimal'

                      }}

                      sx={{ 
                        width: '80px', 
                        '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 },
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
                </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'error.main' }}>-{totalDiscount.toFixed(2).replace(/\.00$/, '')}</Typography>
                </Box>
                {outstandingTotal > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
                      Outstanding Payments:
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
                      {outstandingTotal.toFixed(2).replace(/\.00$/, '')}
                    </Typography>
                  </Box>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    TOTAL:
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {total.toFixed(2).replace(/\.00$/, '')}
                  </Typography>
                </Box>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  startIcon={isProcessingSaleOnly ? <CircularProgress size={18} color="inherit" /> : <CartIcon sx={{ fontSize: 18 }} />}
                  onClick={handleSaleOnly}
                  disabled={
                    isProcessingSaleOnly ||
                    isProcessingSale ||
                    (currentCart.length === 0 && selectedOutstandingPayments.length === 0) || 
                    (currentCart.length > 0 && total <= 0)
                  }
                  sx={{ fontFamily: 'monospace', py: 1, flex: 1 }}
                >
                  {isProcessingSaleOnly ? 'PROCESSING...' : (currentCart.length === 0 && selectedOutstandingPayments.length > 0 
                    ? 'SETTLE' 
                    : 'PRINT'
                  )}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="primary"
                  startIcon={isProcessingSale ? <CircularProgress size={18} color="inherit" /> : <CartIcon sx={{ fontSize: 18 }} />}
                  onClick={handleSaleWithoutPrint}
                  disabled={
                    isProcessingSale ||
                    isProcessingSaleOnly ||
                    (currentCart.length === 0 && selectedOutstandingPayments.length === 0) || 
                    (currentCart.length > 0 && total <= 0)
                  }
                  sx={{ fontFamily: 'monospace', py: 1, minWidth: 100 }}
                >
                  SALE ONLY
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PrintIcon sx={{ fontSize: 18 }} />}
                  onClick={() => setShowPrinterDialog(true)}
                  disabled={currentCart.length === 0}
                  sx={{ fontFamily: 'monospace', py: 1, minWidth: 80 }}
                >
                  PRINTER
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
                <Typography variant="h6" gutterBottom>Printer Settings</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Thermal printer is used by default for all receipts.
                </Typography>
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

          {/* Printer Settings Dialog */}
          <Dialog open={showPrinterDialog} onClose={() => setShowPrinterDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon />
                <Typography variant="h6">Printer Settings & Layout</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>Choose Print Layout</Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>Thermal Printer (80mm)</Typography>
                    <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, color: 'white', cursor: 'pointer' }}
                         onClick={() => {
                           setShowPrinterDialog(false)
                           setSelectedLayout('thermal')
                           setPrintData({
                             type: 'receipt',
                             title: 'SALES RECEIPT',
          companyName: companyInfo.name || 'Company Name',
          companyAddress: companyInfo.address || 'Company Address',
          companyPhone: companyInfo.phone || 'Company Phone',
          companyEmail: companyInfo.email || 'company@email.com',
                             receiptNumber: `TEST-${Date.now()}`,
                             date: new Date().toLocaleDateString(),
                             time: new Date().toLocaleTimeString(),
                             cashierName: user?.name || user?.username || 'Cashier',
                             customerName: customerName || 'Walk-in Customer',
                             customerPhone: customerPhone || '',
                             items: currentCart.map(item => ({
                               name: item.name,
                               sku: item.sku,
                               quantity: item.quantity,
                               unitPrice: item.unitPrice,
                               total: item.total,
                               discount: item.discount || 0
                             })),
                             subtotal: subtotal,
                             tax: tax,
                             total: total,
                             paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
                             notes: '',
                             footerMessage: 'Thank you for your business!'
                           })
                           setShowPrintDialog(true)
                         }}>
                      <Typography variant="body1" fontWeight="bold">
                        📄 Thermal Printer Layout
                      </Typography>
                      <Typography variant="body2">
                        Monospace font, compact design for thermal printers
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>Color Printer (A4/Letter)</Typography>
                    <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, color: 'white', cursor: 'pointer' }}
                         onClick={() => {
                           setShowPrinterDialog(false)
                           setSelectedLayout('color')
                           setPrintData({
                             type: 'receipt',
                             title: 'SALES RECEIPT',
          companyName: companyInfo.name || 'Company Name',
          companyAddress: companyInfo.address || 'Company Address',
          companyPhone: companyInfo.phone || 'Company Phone',
          companyEmail: companyInfo.email || 'company@email.com',
                             receiptNumber: `TEST-${Date.now()}`,
                             date: new Date().toLocaleDateString(),
                             time: new Date().toLocaleTimeString(),
                             cashierName: user?.name || user?.username || 'Cashier',
                             customerName: customerName || 'Walk-in Customer',
                             customerPhone: customerPhone || '',
                             items: currentCart.map(item => ({
                               name: item.name,
                               sku: item.sku,
                               quantity: item.quantity,
                               unitPrice: item.unitPrice,
                               total: item.total,
                               discount: item.discount || 0
                             })),
                             subtotal: subtotal,
                             tax: tax,
                             total: total,
                             paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
                             notes: '',
                             footerMessage: 'Thank you for your business!'
                           })
                           setShowPrintDialog(true)
                         }}>
                      <Typography variant="body1" fontWeight="bold">
                        🖨️ Color Printer Layout
                      </Typography>
                      <Typography variant="body2">
                        Styled design with colors for A4/Letter printers
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>Test Print Options</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={handleDirectPrint}
                        disabled={currentCart.length === 0}
                        sx={{ flex: 1 }}
                      >
                        Test Print Current Cart
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={async () => {
                          const status = await checkPrinterStatus()
                          alert(`Printer Status Check:\n\n${status.message}\n\nSerial Ports: ${status.portCount}`)
                        }}
                        sx={{ flex: 1 }}
                      >
                        Check Printer Status
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setShowPrinterDialog(false)
                          alert('✅ Printer settings saved!')
                        }}
                        sx={{ flex: 1 }}
                      >
                        Save Settings
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Choose a layout above to preview and print with the PrintDialog
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowPrinterDialog(false)}>Cancel</Button>
            </DialogActions>
          </Dialog>
          {/* Print Dialog */}
          <PrintDialog
            open={showPrintDialog}
            onClose={() => setShowPrintDialog(false)}
            printData={printData}
            title="Print Sales Receipt"
            defaultLayout={selectedLayout}
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

