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
  Snackbar,
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

const DEFAULT_COMPANY_INFO = {
  name: 'PetZone',
  address: 'Shop no 42 unit no 2 latifabad near musarrat banquet Hyderabad',
  phone: '03111100355',
  email: 'info@petzone.com',
  logoUrl: '/petzonelogo.png'
}

let cachedSerialPort = null
let cachedSerialPortInfo = null

const resetCachedSerialPort = () => {
  cachedSerialPort = null
  cachedSerialPortInfo = null
}

const acquireSerialPort = async () => {
  if (typeof navigator === 'undefined' || !navigator.serial) {
    throw new Error('Web Serial API not supported')
  }

  if (cachedSerialPort) {
    return cachedSerialPort
  }

  const grantedPorts = await navigator.serial.getPorts?.()

  if (grantedPorts && grantedPorts.length > 0) {
    try {
      // Mark that the origin has printer permission so we can auto-acquire on next login
      try { sessionStorage.setItem('printerPermissionGranted', '1') } catch (e) { /* ignore */ }
    } catch (e) {}
    if (cachedSerialPortInfo) {
      const matchedPort = grantedPorts.find(port => {
        if (typeof port.getInfo !== 'function') {
          return false
        }
        const info = port.getInfo()
        return info &&
          info.usbVendorId === cachedSerialPortInfo.usbVendorId &&
          info.usbProductId === cachedSerialPortInfo.usbProductId
      })

      if (matchedPort) {
        cachedSerialPort = matchedPort
        return cachedSerialPort
      }
    }

    cachedSerialPort = grantedPorts[0]
    if (cachedSerialPort && typeof cachedSerialPort.getInfo === 'function') {
      cachedSerialPortInfo = cachedSerialPort.getInfo()
    }
    return cachedSerialPort
  }

  const requestedPort = await navigator.serial.requestPort()
  if (!requestedPort) {
    throw new Error('No port selected by user')
  }

  // Save permission flag (user explicitly selected a port)
  try { sessionStorage.setItem('printerPermissionGranted', '1') } catch (e) { /* ignore */ }

  cachedSerialPort = requestedPort
  if (typeof requestedPort.getInfo === 'function') {
    cachedSerialPortInfo = requestedPort.getInfo()
  }
  return cachedSerialPort
}

const createEmptyTabState = (overrides = {}) => ({
  cart: [],
  customerName: '',
  customerPhone: '',
  paymentMethod: 'CASH',
  paymentAmount: '',
  creditAmount: '',
  isPartialPayment: false,
  isFullyCredit: false,
  isBalancePayment: false,
  outstandingPayments: [],
  selectedOutstandingPayments: [],
  settlementPaymentAmount: '',
  settlementCreditAmount: '',
  isSettlementPartial: false,
  isSettlementFullyCredit: false,
  showSettlementOptions: false,
  taxRate: 0,
  totalDiscount: 0,
  notes: '',
  ...overrides
})

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

  // Auto-acquire previously granted serial port permission when user logs in
  useEffect(() => {
    if (typeof window === 'undefined') return

    const permissionFlag = (() => {
      try { return sessionStorage.getItem('printerPermissionGranted') } catch (e) { return null }
    })()

    if (user && permissionFlag === '1' && typeof navigator !== 'undefined' && navigator.serial) {
      // Try to populate cachedSerialPort from previously granted ports. This does not prompt the user.
      navigator.serial.getPorts?.()
        .then(ports => {
          if (ports && ports.length > 0) {
            cachedSerialPort = ports[0]
            try { cachedSerialPortInfo = cachedSerialPort.getInfo() } catch (e) { cachedSerialPortInfo = null }
            console.log('[POS] Auto-acquired previously granted serial port')
          }
        })
        .catch(err => {
          console.warn('[POS] Failed to auto-acquire serial ports on login:', err)
        })
    }

    if (!user) {
      // On logout/when no user, clear cache and permission so next session prompts again
      resetCachedSerialPort()
      try { sessionStorage.removeItem('printerPermissionGranted') } catch (e) { /* ignore */ }
    }
  }, [user])
  
  const { data: inventoryItems, loading: inventoryLoading, error: inventoryError } = useSelector((state) => state.inventory)
  const salesData = useSelector((state) => state.sales.data) || []
  
  // Toast state for permission/validation feedback
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity })
  }, [])
  const handleToastClose = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])
  
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
  const [isBalancePayment, setIsBalancePayment] = useState(false)
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
  // Confirmation-first flow state
  const [saleConfirmDialog, setSaleConfirmDialog] = useState(false)
  const [pendingSaleData, setPendingSaleData] = useState(null)      // validated saleData waiting for user confirm
  const [completedSaleData, setCompletedSaleData] = useState(null)  // sale created in backend, waiting for print choice
  const [postSaleDialog, setPostSaleDialog] = useState(false)       // print or skip dialog after sale created

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
  
  // Settlement-specific payment state (when only settling outstanding, no cart items)
  const [settlementPaymentAmount, setSettlementPaymentAmount] = useState('')
  const [settlementCreditAmount, setSettlementCreditAmount] = useState('')
  const [isSettlementPartial, setIsSettlementPartial] = useState(false)
  const [isSettlementFullyCredit, setIsSettlementFullyCredit] = useState(false)
  const [showSettlementOptions, setShowSettlementOptions] = useState(false)
  
  // Company/Branch info state
  const [companyInfo, setCompanyInfo] = useState(() => ({ ...DEFAULT_COMPANY_INFO }))
  
 const barcodeInputRef = useRef(null)
  const manualInputRef = useRef(null)
  const lastScanTimeRef = useRef(0)
  const hydratingTabIdRef = useRef(null)
  const isCompletingSaleRef = useRef(false) // prevents rapid double-click race condition

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

  useEffect(() => {
    if (!currentTab) {
      return
    }

    if (hydratingTabIdRef.current === currentTab.id) {
      hydratingTabIdRef.current = null
      return
    }

    const updates = {
      customerName,
      customerPhone,
      paymentMethod,
      paymentAmount,
      creditAmount,
      isPartialPayment,
      isFullyCredit,
      isBalancePayment,
      outstandingPayments,
      selectedOutstandingPayments,
      settlementPaymentAmount,
      settlementCreditAmount,
      isSettlementPartial,
      isSettlementFullyCredit,
      showSettlementOptions,
      taxRate,
      totalDiscount,
      notes
    }

    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = currentTab[key]

      if (Array.isArray(value) && Array.isArray(currentValue)) {
        if (currentValue === value) {
          return false
        }

        if (currentValue.length !== value.length) {
          return true
        }

        for (let i = 0; i < value.length; i += 1) {
          if (currentValue[i] !== value[i]) {
            return true
          }
        }

        return false
      }

      return currentValue !== value
    })

    if (hasChanges) {
      updateCurrentTab(updates)
    }
  }, [
    currentTab,
    customerName,
    customerPhone,
    paymentMethod,
    paymentAmount,
    creditAmount,
    isPartialPayment,
    isFullyCredit,
    isBalancePayment,
    outstandingPayments,
    selectedOutstandingPayments,
    settlementPaymentAmount,
    settlementCreditAmount,
    isSettlementPartial,
    isSettlementFullyCredit,
    showSettlementOptions,
    taxRate,
    totalDiscount,
    notes,
    updateCurrentTab
  ])

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

      createdAt: new Date(),

      modifiedAt: new Date(),

      ...createEmptyTabState()

    }

    
    
    hydratingTabIdRef.current = newTab.id

    setTabs(prev => [...prev, newTab])

    setActiveTabId(newTab.id)

    setTabCounter(prev => prev + 1)

    
    
    // Clear outstanding payments when creating new tab

    setOutstandingPayments([])

    setSelectedOutstandingPayments([])
    // Clear settlement state
    setSettlementPaymentAmount('')
    setSettlementCreditAmount('')
    setIsSettlementPartial(false)
    setIsSettlementFullyCredit(false)
    setShowSettlementOptions(false)

    setCustomerName(newTab.customerName)
    setCustomerPhone(newTab.customerPhone)
    setPaymentMethod(newTab.paymentMethod)
    setPaymentAmount(newTab.paymentAmount)
    setCreditAmount(newTab.creditAmount)
    setIsPartialPayment(newTab.isPartialPayment)
    setIsFullyCredit(newTab.isFullyCredit)
    setIsBalancePayment(newTab.isBalancePayment)
    setOutstandingPayments(newTab.outstandingPayments)
    setSelectedOutstandingPayments(newTab.selectedOutstandingPayments)
    setSettlementPaymentAmount(newTab.settlementPaymentAmount)
    setSettlementCreditAmount(newTab.settlementCreditAmount)
    setIsSettlementPartial(newTab.isSettlementPartial)
    setIsSettlementFullyCredit(newTab.isSettlementFullyCredit)
    setShowSettlementOptions(newTab.showSettlementOptions)
    setTaxRate(newTab.taxRate)
    setTotalDiscount(newTab.totalDiscount)
    setNotes(newTab.notes)

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

      
      // Fetch full inventory for POS search (backend supports limit=all)
      params.limit = 'all';
      
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
        // Include both positive (outstanding) and negative (credit) balances
       // ✅ FIXED: Correct frontend processing in searchOutstandingPayments function
const outstandingPayments = response.data.data.map(customer => {
  // Get the ACTUAL balance from the API response
  const actualBalance = customer.creditAmount || customer.finalAmount || customer.totalOutstanding;
  
  console.log('🔍 FRONTEND DEBUG - Customer data from API:', {
    customerName: customer.customerName,
    totalOutstanding: customer.totalOutstanding,
    creditAmount: customer.creditAmount,
    finalAmount: customer.finalAmount,
    actualBalance: actualBalance,
    isCredit: customer.isCredit
  });

  return {
    id: `customer_${customer.customerName}_${customer.phone}`,
    invoice_no: customer.isCredit ? `CREDIT_${customer.customerName}` : `OUTSTANDING_${customer.customerName}`,
    customer_name: customer.customerName,
    customer_phone: customer.phone,
    total: actualBalance, // ✅ Use ACTUAL balance (can be negative)
    outstandingAmount: Math.abs(actualBalance), // ✅ Display absolute value for UI
    paymentStatus: customer.isCredit ? 'CREDIT' : 'PENDING',
    paymentMethod: 'OUTSTANDING',
    creditStatus: customer.isCredit ? 'CREDIT' : 'PENDING',
    creditAmount: actualBalance, // ✅ Use ACTUAL balance (can be negative)
    paymentAmount: 0,
    pendingSalesCount: customer.pendingSalesCount,
    isCredit: customer.isCredit || false,
    created_at: new Date().toISOString(),
    // Debug info
    _debug: {
      apiTotalOutstanding: customer.totalOutstanding,
      apiCreditAmount: customer.creditAmount,
      apiFinalAmount: customer.finalAmount,
      calculatedActualBalance: actualBalance
    }
  };
});

        // Outstanding payments loaded (both positive and negative)
        setOutstandingPayments(outstandingPayments)

        // Reset settlement mode to full by default when new outstanding data loads
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
        setShowSettlementOptions(false)

        // Auto-select all outstanding balances so full settlement is the default action
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

    const normalize = (value) => {
      if (value === null || value === undefined) return ''
      return value.toString().toLowerCase()
    }

    const normalizedQuery = normalize(query)

    if (query.length >= 2) {

      let matches = inventoryItems.filter(p => 

        normalize(p.name).includes(normalizedQuery) ||

        normalize(p.sku).includes(normalizedQuery) ||

        normalize(p.barcode).includes(normalizedQuery) ||

        normalize(p.category).includes(normalizedQuery) ||

        normalize(p.description).includes(normalizedQuery)

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

        barcode: item.barcode,

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

      let port
      try {
        port = await acquireSerialPort()

        if (!port) {
          throw new Error('No port selected by user')
        }

        if (port.readable || port.writable) {
          try {
            await port.close()
          } catch (closeError) {
            console.warn('[POS] Unable to close port before reuse (thermal bill):', closeError)
          }
        }

        await port.open({ baudRate: 9600 })

        const writer = port.writable.getWriter()

        // ESC/POS commands for thermal printer
        const encoder = new TextEncoder()
        const data = encoder.encode(printContent)

        await writer.write(data)

        writer.releaseLock()
        await port.close()
        return
      } catch (serialError) {
        console.error('[POS] Thermal bill print error:', serialError)
        if (port) {
          try {
            if (port.readable || port.writable) {
              await port.close()
            }
          } catch (closeError) {
            console.warn('[POS] Error closing port after thermal bill failure:', closeError)
          }
        }
        resetCachedSerialPort()
      }

    }

    {

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

    
    
    const fmtNum = (v) => {
      const n = Number(v || 0)
      return Number.isFinite(n) && Number.isInteger(n) ? String(n) : n.toFixed(2)
    }

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

      content += `${item.quantity} x ${item.price} = ${fmtNum(item.quantity * item.price)}\n`

    })

    
    
  content += `

--------------------------------

Subtotal: ${fmtNum(subtotal)}

Tax: ${fmtNum(tax)}

--------------------------------

TOTAL: ${fmtNum(total)}

--------------------------------

Payment Method: ${paymentMethod || 'Cash'}

Amount Paid: ${fmtNum(paymentAmount || total)}

`

    
    
    if (paymentStatus === 'PARTIAL') {

  content += `Credit Amount: ${fmtNum(creditAmount || 0)}

Payment Status: PARTIAL PAYMENT

`

    } else {

  content += `Change: ${fmtNum(change || 0)}

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

              <span>${fmtNum(item.quantity * item.price)}</span>

            </div>

          `).join('')}

          <div class="line"></div>

          <div class="item">

            <span>Subtotal:</span>

            <span>${fmtNum(subtotal)}</span>

          </div>

          <div class="item">

            <span>Tax:</span>

            <span>${fmtNum(tax)}</span>

          </div>

          <div class="item total">

            <span>TOTAL:</span>

            <span>${fmtNum(total)}</span>

          </div>

          <div class="line"></div>

          <div class="payment-info">

            <div class="item">

              <span>Payment Method:</span>

              <span>${paymentMethod || 'Cash'}</span>

            </div>

            <div class="item">

              <span>Amount Paid:</span>

              <span>${fmtNum(paymentAmount || total)}</span>

            </div>

            ${paymentStatus === 'PARTIAL' ? `

              <div class="item partial-payment">

                <span>Credit Amount:</span>

                <span>${fmtNum(creditAmount || 0)}</span>

              </div>

              <div class="item partial-payment">

                <span>Payment Status:</span>

                <span>PARTIAL PAYMENT</span>

              </div>

            ` : `

              <div class="item">

                <span>Change:</span>

                <span>${fmtNum(change || 0)}</span>

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

  // Settlement payment handlers
  const handleSettlementPaymentChange = (amount) => {
    const paymentAmount = parseFloat(amount);
    setSettlementPaymentAmount(amount);
    
    if (isSettlementPartial || isSettlementFullyCredit) {
      const safePayment = Number.isNaN(paymentAmount) ? 0 : paymentAmount;
      const baseOutstanding = currentCart.length === 0 ? settlementTotal : outstandingTotal;
      const creditAmount = baseOutstanding - safePayment;
      setSettlementCreditAmount(creditAmount.toFixed(2));
      console.log('[POS] Settlement payment changed:', {
        mode: isSettlementFullyCredit ? 'credit_note' : 'partial',
        baseOutstanding,
        paymentAmount: safePayment,
        resultingBalance: creditAmount
      });
    }
  };

  const handleSettlementCreditChange = (amount) => {
    setSettlementCreditAmount(amount);

    if (isSettlementFullyCredit) {
      const creditValue = parseFloat(amount);
      const baseOutstanding = currentCart.length === 0 ? settlementTotal : outstandingTotal;
      if (Number.isNaN(creditValue)) {
        return;
      }

      const paymentValue = baseOutstanding - creditValue;
      setSettlementPaymentAmount(paymentValue.toFixed(2));
      console.log('[POS] Settlement credit note changed:', {
        baseOutstanding,
        creditValue,
        paymentValue
      });
    }
  };
  
  // Settlement payment type handlers
  const handleSettlementPaymentType = (type) => {
    switch (type) {
      case 'full':
        setIsSettlementPartial(false);
        setIsSettlementFullyCredit(false);
        setSettlementPaymentAmount(settlementTotal.toFixed(2));
        setSettlementCreditAmount('0');
        setShowSettlementOptions(false);
        break;
        
      case 'partial':
        setIsSettlementPartial(true);
        setIsSettlementFullyCredit(false);
        setSettlementPaymentAmount('');
        setSettlementCreditAmount(settlementTotal.toFixed(2));
        setShowSettlementOptions(true);
        break;
        
      case 'fullyCredit':
        setIsSettlementPartial(false);
        setIsSettlementFullyCredit(true);
        setSettlementPaymentAmount('0');
        setSettlementCreditAmount(settlementTotal.toFixed(2));
        setShowSettlementOptions(true);
        break;
        
      case 'balance':
        // Handle balance payment for settlements
        setIsSettlementPartial(false);
        setIsSettlementFullyCredit(false);
        setSettlementPaymentAmount('0');
        setSettlementCreditAmount(settlementTotal.toFixed(2));
        setShowSettlementOptions(true);
        break;
        
      default:
        break;
    }
  };

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
      
      if (newSelection.length === 0) {
        setShowSettlementOptions(false)
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
      }
      
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

// Calculate settlement total (when only settling, no cart items)
const settlementTotal = useMemo(() => {
  if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
    return outstandingPayments
      .filter(payment => selectedOutstandingPayments.includes(payment.id))
      .reduce((total, payment) => {
        const amount = parseFloat(payment.outstandingAmount || 0);
        return total + (payment.isCredit ? -amount : amount);
      }, 0);
  }
  return 0;
}, [outstandingPayments, selectedOutstandingPayments, currentCart.length]);

// Calculate outstanding total - use settlement amounts when in settlement mode (no cart)
const outstandingTotal = useMemo(() => {
  // If in settlement mode (no cart items, only outstanding payments)
  if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
    // In settlement mode, use the settlement payment amount
    if (isSettlementPartial && settlementPaymentAmount && settlementPaymentAmount.trim() !== '') {
      const partialAmount = parseFloat(settlementPaymentAmount) || 0;
      const actualPartial = Math.min(partialAmount, Math.abs(settlementTotal));
      console.log(`[POS] Settlement partial: using ${actualPartial} of ${settlementTotal}`);
      return settlementTotal > 0 ? actualPartial : settlementTotal; // For debts, use partial; for credits, use full
    } else if (isSettlementFullyCredit) {
      return 0; // Fully credit, no cash payment
    } else {
      return settlementTotal; // Full settlement
    }
  }
  
  // Regular mode with cart items: use full outstanding total
  return outstandingPayments
    .filter(payment => selectedOutstandingPayments.includes(payment.id))
    .reduce((total, payment) => {
      const amount = parseFloat(payment.outstandingAmount || 0);
      return total + (payment.isCredit ? -amount : amount);
    }, 0);
}, [outstandingPayments, selectedOutstandingPayments, currentCart.length, isSettlementPartial, settlementPaymentAmount, isSettlementFullyCredit, settlementTotal]);
  
  
  // Calculate outstanding payments total (including negative amounts for credits)
const billAmount = useMemo(() => {
  return subtotal + tax - totalDiscount
}, [subtotal, tax, totalDiscount])

  
  
 const total = useMemo(() => {
  return billAmount + outstandingTotal
}, [billAmount, outstandingTotal])

// Update the calculateSettlementValues function:

const calculateSettlementValues = useCallback(() => {
  // Calculate base outstanding from selected payments
  const baseOutstanding = outstandingPayments
    .filter(payment => selectedOutstandingPayments.includes(payment.id))
    .reduce((total, payment) => {
      // Use creditAmount if available (can be negative), otherwise use total or outstandingAmount
      const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
        ? parseFloat(payment.creditAmount)
        : (payment.total !== undefined && payment.total !== null
          ? parseFloat(payment.total)
          : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1));
      return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  
  console.log('[POS] calculateSettlementValues:', {
    baseOutstanding,
    isCredit: baseOutstanding < 0,
    isSettlementPartial,
    isSettlementFullyCredit,
    settlementPaymentAmount,
    settlementCreditAmount
  });
  
  const isCredit = baseOutstanding < 0;
  const absoluteOutstanding = Math.abs(baseOutstanding);
  
  let paymentValue, creditValue;
  
  if (isSettlementFullyCredit) {
    // Credit Note: Creating new credit (negative) when settling outstanding (positive)
    // OR: Using existing credit (negative) to create positive balance
    if (isCredit) {
      // Customer has credit (negative) - can't create more credit
      paymentValue = 0;
      creditValue = baseOutstanding; // Keep the credit
    } else {
      // Customer has outstanding (positive) - creating credit note
      const creditNoteAmount = parseFloat(settlementCreditAmount);
      paymentValue = 0;
      creditValue = Number.isNaN(creditNoteAmount) ? -absoluteOutstanding : -Math.abs(creditNoteAmount);
    }
  } else if (isSettlementPartial) {
    // Partial settlement
    const parsedPartialAmount = parseFloat(settlementPaymentAmount);
    paymentValue = Number.isNaN(parsedPartialAmount) ? 0 : Math.abs(parsedPartialAmount);
    
    if (isCredit) {
      // Using credit (negative): payment should be 0, credit gets less negative
      paymentValue = 0;
      creditValue = baseOutstanding + paymentValue; // Negative + 0 = same credit
    } else {
      // Paying outstanding (positive): payment reduces the outstanding
      creditValue = baseOutstanding - paymentValue; // Positive - payment = remaining
    }
  } else {
    // Full settlement
    if (isCredit) {
      // Using full credit: no payment, credit becomes 0
      paymentValue = 0;
      creditValue = 0;
    } else {
      // Paying full outstanding: payment = outstanding, credit = 0
      paymentValue = absoluteOutstanding;
      creditValue = 0;
    }
  }
  
  const normalizedPayment = Number.parseFloat(paymentValue.toFixed(2));
  const normalizedCredit = Number.parseFloat(creditValue.toFixed(2));
  
  return {
    baseOutstanding,
    paymentAmount: Number.isNaN(normalizedPayment) ? 0 : normalizedPayment,
    creditAmount: Number.isNaN(normalizedCredit) ? 0 : normalizedCredit,
    isCredit
  };
}, [
  outstandingPayments,
  selectedOutstandingPayments,
  isSettlementFullyCredit,
  isSettlementPartial,
  settlementPaymentAmount,
  settlementCreditAmount
]);

  const settlementSnapshot = useMemo(() => calculateSettlementValues(), [calculateSettlementValues]);
  const settlementPaymentValue = settlementSnapshot.paymentAmount;
  const settlementBalanceValue = settlementSnapshot.creditAmount;
  const settlementBaseAmount = settlementSnapshot.baseOutstanding;

  // Default settlement amounts to full settlement when outstanding balances are present
  useEffect(() => {
    if (
      currentCart.length === 0 &&
      selectedOutstandingPayments.length > 0 &&
      !isSettlementPartial &&
      !isSettlementFullyCredit
    ) {
      const { paymentAmount, creditAmount } = calculateSettlementValues();
      const formattedPayment = paymentAmount.toFixed(2);
      const formattedCredit = creditAmount.toFixed(2);

      if (settlementPaymentAmount !== formattedPayment) {
        setSettlementPaymentAmount(formattedPayment);
      }

      if (settlementCreditAmount !== formattedCredit) {
        setSettlementCreditAmount(formattedCredit);
      }
    }
  }, [
    currentCart.length,
    selectedOutstandingPayments,
    isSettlementPartial,
    isSettlementFullyCredit,
    calculateSettlementValues,
    settlementPaymentAmount,
    settlementCreditAmount
  ])

const settleOutstandingPayments = useCallback(async () => {
  if (selectedOutstandingPayments.length === 0) {
    return null;
  }

  const referencePayment = outstandingPayments.find(payment =>
    selectedOutstandingPayments.includes(payment.id)
  );

  if (!referencePayment) {
    throw new Error('Unable to locate outstanding payment details for settlement');
  }

  const settlementValues = calculateSettlementValues();
  
  console.log('[POS] Settlement values:', settlementValues);
  
  // Determine if we're dealing with credit (negative) or outstanding (positive)
  const isCreditSettlement = settlementValues.isCredit;
  
  // For credit settlements, we need to send the amount of credit being USED
  // For outstanding settlements, we send the payment amount
  
  const creditAmountToUse = Math.abs(settlementValues.creditAmount);
  const paymentAmountForBackend = isCreditSettlement 
    ? creditAmountToUse  // Send credit amount as payment amount for backend
    : settlementValues.paymentAmount;

  // Prepare payload based on type of settlement
  const payload = {
    customerName: referencePayment.customer_name,
    phone: referencePayment.customer_phone,
    paymentAmount: paymentAmountForBackend, // Always send positive value
    paymentMethod: (paymentMethod || 'CASH').toUpperCase()
  };

  // Add credit usage flag if applicable
  if (isCreditSettlement) {
    payload.isCreditUsage = true;
    payload.creditAmount = creditAmountToUse;
  }

  console.log('[POS] Settling outstanding payments with payload:', {
    ...payload,
    settlementValues,
    isCreditSettlement,
    originalPaymentAmount: settlementValues.paymentAmount,
    originalCreditAmount: settlementValues.creditAmount
  });

  const clearResponse = await api.post('/sales/clear-outstanding', payload);

  if (!clearResponse.data?.success) {
    throw new Error(clearResponse.data?.message || 'Failed to clear outstanding payments');
  }

  return clearResponse.data;
}, [
  selectedOutstandingPayments,
  outstandingPayments,
  calculateSettlementValues,
  paymentMethod
]);

  const normalizeCartItemForPrint = useCallback((item) => {
    const parseNumber = (value) => {
      if (value === null || value === undefined || value === '') {
        return NaN;
      }
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : NaN;
      }
      const normalized = String(value)
        .replace(/[^\d.\-]/g, '')
        .replace(/(\..*?)\./g, '$1'); // keep only first decimal point
      if (normalized === '' || normalized === '-' || normalized === '.') {
        return NaN;
      }
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    const resolveNumber = (candidates, fallback = 0) => {
      for (const candidate of candidates) {
        const parsed = parseNumber(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return fallback;
    };

    const quantity = resolveNumber([item?.quantity, item?.qty, item?.count], 0);
    const rawUnitPrice = resolveNumber([
      item?.customPrice,
      item?.unitPrice,
      item?.price,
      item?.sellingPrice,
      item?.salePrice,
      item?.unit_price,
      item?.originalPrice,
      item?.wholesalePrice,
      item?.retailPrice,
      item?.basePrice
    ], NaN);
    const discount = resolveNumber([item?.discount, item?.discountAmount], 0);
    let total = resolveNumber([item?.total, item?.lineTotal, item?.amount], NaN);

    let unitPrice = Number.isFinite(rawUnitPrice) ? rawUnitPrice : NaN;

    if (!Number.isFinite(unitPrice) || unitPrice === 0) {
      if (Number.isFinite(total) && quantity !== 0) {
        unitPrice = (total + discount) / quantity;
      }
    }

    if (!Number.isFinite(total)) {
      if (Number.isFinite(unitPrice)) {
        total = quantity * unitPrice - discount;
      } else {
        total = 0;
      }
    }

    unitPrice = Number.isFinite(unitPrice) ? Math.round(unitPrice) : 0;
    total = Number.isFinite(total) ? Math.round(total) : 0;

    return {
      name: item?.name || item?.productName || item?.itemName || 'Item',
      sku: item?.sku || item?.productSku || item?.barcode || '',
      quantity,
      unitPrice,
      price: unitPrice,
      discount: Math.round(discount),
      total: Number.isFinite(total) ? total : 0
    };
  }, []);

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

  // Auto-fill payment amount when customer has credit and purchases items
  useEffect(() => {
    // If customer has negative outstanding balance (credit) and has items in cart
    if (currentCart.length > 0 && outstandingTotal < 0 && !isPartialPayment && paymentAmount === '') {
      const cartTotal = subtotal + tax - totalDiscount
      const netAmount = cartTotal + outstandingTotal // Outstanding total is negative, so we're adding credit
      
      console.log('[POS] Auto-filling payment amount:', {
        cartTotal,
        outstandingTotal,
        netAmount,
        hasCredit: outstandingTotal < 0
      })
      
      // If net amount is still positive (customer needs to pay), auto-fill payment amount
      if (netAmount > 0) {
        setPaymentAmount(netAmount.toString())
        setCreditAmount('0')
        console.log('[POS] Auto-filled payment amount to:', netAmount)
      } else {
        // Customer has enough credit to cover the purchase
        setPaymentAmount('0')
        setCreditAmount(Math.abs(netAmount).toString())
        console.log('[POS] Customer has enough credit, setting payment to 0')
      }
    }
  }, [currentCart.length, outstandingTotal, subtotal, tax, totalDiscount, isPartialPayment, paymentAmount])

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
      const fallbackInfo = { ...DEFAULT_COMPANY_INFO }

      if (!user) {
        setCompanyInfo(fallbackInfo)
        return
      }

      const normalizedScopeType = typeof user.scopeType === 'string' ? user.scopeType.toUpperCase() : null
      const branchId = user.branchId || (normalizedScopeType === 'BRANCH' ? user.scopeId : null)
      const warehouseId = user.warehouseId || (normalizedScopeType === 'WAREHOUSE' ? user.scopeId : null)

      console.log('[POS] Loading company info for user:', {
        role: user.role,
        branchId,
        warehouseId,
        scopeType: normalizedScopeType
      })

      try {
        if (branchId) {
          const response = await api.get(`/branches/${branchId}`)
          if (response.data?.success && response.data?.data) {
            const branch = response.data.data
            console.log('[POS] Loaded branch info:', branch)
            setCompanyInfo({
              name: branch.name || fallbackInfo.name,
              address: branch.location || branch.address || fallbackInfo.address,
              phone: branch.phone || branch.managerPhone || fallbackInfo.phone,
              email: branch.email || branch.managerEmail || fallbackInfo.email,
              logoUrl: branch.logoUrl || fallbackInfo.logoUrl
            })
            return
          }
        }

        if (warehouseId) {
          const response = await api.get(`/warehouses/${warehouseId}`)
          if (response.data?.success && response.data?.data) {
            const warehouse = response.data.data
            console.log('[POS] Loaded warehouse info:', warehouse)
            setCompanyInfo({
              name: warehouse.name || fallbackInfo.name,
              address: warehouse.location || fallbackInfo.address,
              phone: warehouse.phone || warehouse.managerPhone || warehouse.manager || fallbackInfo.phone,
              email: warehouse.email || fallbackInfo.email,
              logoUrl: warehouse.logoUrl || fallbackInfo.logoUrl
            })
            return
          }
        }

        // Default fallback when no scoped info is available
        setCompanyInfo(fallbackInfo)
      } catch (error) {
        console.error('Error loading company info:', error)
        setCompanyInfo(fallbackInfo)
      }
    }

    loadCompanyInfo()
  }, [user])

  // Comprehensive function to clear all POS terminal state
  const clearAllPOSState = () => {
    console.log('[POS] Clearing active tab state...')

    if (!currentTab) {
      return
    }

    const clearedState = createEmptyTabState({
      createdAt: currentTab.createdAt,
      modifiedAt: new Date()
    })

    updateCurrentTab({
      cart: clearedState.cart,
      customerName: clearedState.customerName,
      customerPhone: clearedState.customerPhone,
      paymentMethod: clearedState.paymentMethod,
      paymentAmount: clearedState.paymentAmount,
      creditAmount: clearedState.creditAmount,
      isPartialPayment: clearedState.isPartialPayment,
      isFullyCredit: clearedState.isFullyCredit,
      isBalancePayment: clearedState.isBalancePayment,
      outstandingPayments: clearedState.outstandingPayments,
      selectedOutstandingPayments: clearedState.selectedOutstandingPayments,
      settlementPaymentAmount: clearedState.settlementPaymentAmount,
      settlementCreditAmount: clearedState.settlementCreditAmount,
      isSettlementPartial: clearedState.isSettlementPartial,
      isSettlementFullyCredit: clearedState.isSettlementFullyCredit,
      showSettlementOptions: clearedState.showSettlementOptions,
      taxRate: clearedState.taxRate,
      totalDiscount: clearedState.totalDiscount,
      notes: clearedState.notes
    })

    setCustomerName(clearedState.customerName)
    setCustomerPhone(clearedState.customerPhone)
    setPaymentMethod(clearedState.paymentMethod)
    setPaymentAmount(clearedState.paymentAmount)
    setCreditAmount(clearedState.creditAmount)
    setIsPartialPayment(clearedState.isPartialPayment)
    setIsFullyCredit(clearedState.isFullyCredit)
    setIsBalancePayment(clearedState.isBalancePayment)
    setOutstandingPayments(clearedState.outstandingPayments)
    setSelectedOutstandingPayments(clearedState.selectedOutstandingPayments)
    setSettlementPaymentAmount(clearedState.settlementPaymentAmount)
    setSettlementCreditAmount(clearedState.settlementCreditAmount)
    setIsSettlementPartial(clearedState.isSettlementPartial)
    setIsSettlementFullyCredit(clearedState.isSettlementFullyCredit)
    setShowSettlementOptions(clearedState.showSettlementOptions)
    setTaxRate(clearedState.taxRate)
    setTotalDiscount(clearedState.totalDiscount)
    setNotes(clearedState.notes)
    setCustomerSearchResults([])
    setShowCustomerSearch(false)
    setSearchResults([])
    setShowSearchResults(false)
    setManualInput('')
    setBarcodeInput('')
    setSearchQuery('')
    setSelectedCategory('all')

    console.log('[POS] Active tab state cleared successfully')
  }

  // Function to refresh outstanding payments data
  const refreshOutstandingPayments = () => {
    // Clear settlement state when refreshing outstanding
    setSettlementPaymentAmount('')
    setSettlementCreditAmount('')
    setIsSettlementPartial(false)
    setIsSettlementFullyCredit(false)
    console.log('[POS] Refreshing outstanding payments data...')

    // Clear current outstanding payments completely
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])

    if (currentTab) {
      updateCurrentTab({
        outstandingPayments: [],
        selectedOutstandingPayments: [],
        settlementPaymentAmount: '',
        settlementCreditAmount: '',
        isSettlementPartial: false,
        isSettlementFullyCredit: false,
        showSettlementOptions: false
      })
    }

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

      // Allow negative total when customer has advance credit (outstanding payment with negative balance)
      // Example: Customer has -29000 credit, buys 9000 item → Total = -20000 (still has 20000 credit remaining)
      // Only validate if total is negative AND cart is empty (prevent empty cart sales)
      if (total <= 0 && currentCart.length === 0) {
        alert('❌ Cannot process a sale without items.')
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

      // Calculate final payment and credit amounts
      // Outstanding total is already included in total (subtotal + outstandingTotal)
      // Payment amount is what user enters
      // Credit amount should be: outstandingTotal - (total without outstanding)
      
      // Determine if customer is using credit (total is negative)
      const isUsingCredit = total < 0
      
      // Calculate payment amounts CORRECTLY
console.log('[POS] Payment calculation:', {
  subtotal,
  tax,
  totalDiscount,
  cartTotal: subtotal + tax - totalDiscount,
  outstandingTotal,
  total,
  isUsingCredit: outstandingTotal < 0,
  isFullyCredit,
  isPartialPayment,
  paymentAmount
})

// Calculate the actual bill amount (cart + outstanding)
const billAmount = subtotal + tax - totalDiscount
const totalWithOutstanding = billAmount + outstandingTotal

// Calculate final payment and credit amounts correctly
let finalPaymentAmount, finalCreditAmount

if (isFullyCredit) {
  finalPaymentAmount = 0
  finalCreditAmount = totalWithOutstanding
} else if (isBalancePayment) {
  // Balance payment: Uses customer's existing credit
  // Payment: 0 (no cash), Credit: billAmount (uses from balance)
  finalPaymentAmount = 0
  finalCreditAmount = billAmount // Uses bill amount as credit, not totalWithOutstanding
} else if (isPartialPayment) {
  finalPaymentAmount = parseFloat(paymentAmount) || 0
  finalCreditAmount = totalWithOutstanding - finalPaymentAmount
} else {
  // Full payment
  finalPaymentAmount = totalWithOutstanding
  finalCreditAmount = 0
}

console.log('[POS] Final amounts:', {
  billAmount,
  totalWithOutstanding,
  finalPaymentAmount,
  finalCreditAmount,
  sum: finalPaymentAmount + finalCreditAmount,
  matches: Math.abs((finalPaymentAmount + finalCreditAmount) - totalWithOutstanding) < 0.01
})

// Payment status logic
const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

console.log('[POS] Final payment status:', finalPaymentStatus)
      console.log('[POS] Final credit amount:', finalCreditAmount);
      
      

      

      // Enhanced partial payment validation
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        // Validate payment amount
        if (finalPaymentAmount <= 0) {
          alert('❌ Payment amount must be greater than 0 for partial payments')
          return
        }

        // Allow overpayment - if payment amount >= total, then credit is negative (customer has advance credit)
        // Example: Total = 32000, Payment = 50000, Credit = -18000 (customer has 18000 credit for next purchase)
        // Removed validation that blocks paymentAmount >= total

        // Allow negative credit amount (represents advance payment from customer)
        // Negative credit = customer has paid more than the bill, has credit balance
        // This will show as negative outstanding balance in customer ledger

        // Validate amounts add up to totalWithOutstanding (with small tolerance for rounding)
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - totalWithOutstanding) > 0.01) {
          alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${totalWithOutstanding.toFixed(2)}\nSum: ${sum.toFixed(2)}`)
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
  items: currentCart.map(item => ({
    inventoryItemId: parseInt(item.id),
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
  total: isBalancePayment ? parseFloat(billAmount) : parseFloat(totalWithOutstanding), // For balance payment, send bill amount
  paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (isBalancePayment ? 'CASH' : (paymentMethod || 'CASH')), // Balance uses CASH but with 0 payment
  paymentType: isBalancePayment ? 'BALANCE_PAYMENT' : (isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT')),
  paymentStatus: finalPaymentStatus,
  paymentAmount: finalPaymentAmount,
  creditAmount: finalCreditAmount,
  customerInfo: {
    name: customerName || 'Walk-in Customer',
    phone: customerPhone || ''
  },
  notes: notes || 'Sale completed without printing'
}

      console.log('[POS] Sale data being sent:', saleData);      
      // Create the sale

      const result = await dispatch(createSale(saleData))

  console.log('[POS] createSale result', { result })

      

      
      
      if (createSale.fulfilled.match(result)) {

        const sale = result.payload

        
        
        let printerError = null

        
        
        // Clear outstanding if: settlement only OR cash payment with outstanding selected
        // This matches warehouse billing logic - allows clearing outstanding even when cart has items
        // For full payment with items in cart: clear outstanding if cash payment and outstanding selected
        const isCashPayment = (paymentMethod || 'CASH').toUpperCase() === 'CASH'
        const shouldClearOutstanding = (currentCart.length === 0 && showSettlementOptions) || 
                                       (isCashPayment && !isFullyCredit && !isBalancePayment && selectedOutstandingPayments.length > 0 && finalPaymentAmount > 0)
        
        if (shouldClearOutstanding) {
          console.log('[POS] Starting outstanding payment processing...', {
            selectedPayments: selectedOutstandingPayments,
            outstandingPayments: outstandingPayments,
            paymentMethod,
            finalPaymentAmount,
            cartLength: currentCart.length,
            showSettlementOptions
          })
          
          try {
            console.log('[POS] Processing outstanding payments:', selectedOutstandingPayments)
            const settlementResult = await settleOutstandingPayments();
            console.log('[POS] Outstanding payments cleared result:', settlementResult)
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
          console.log('[POS] No outstanding payments selected for processing or conditions not met', {
            selectedCount: selectedOutstandingPayments.length,
            cartLength: currentCart.length,
            showSettlementOptions,
            paymentMethod,
            finalPaymentAmount
          })
        }

        
        
        // Attempt to print receipt (with error handling)

        try {

          await printReceipt(sale)

        } catch (error) {

          printerError = error

        }

        
        
        // Show success message regardless of printer status

        const outstandingMessage = selected
        .length > 0 
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
  
// PRINT button handler - validates and shows confirmation dialog first
const handleSaleOnly = async () => {
  if (isProcessingSaleOnly) return

  console.log('[POS] handleSaleOnly (confirm-first) start', {
    currentCartLength: currentCart.length,
    billAmount,
    outstandingTotal,
    total
  })

  try {
    // --- Admin check ---
    if (user.role === 'ADMIN' && !isAdminMode) {
      alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
      return
    }

    // --- Auth check ---
    if (!user) {
      alert('❌ User not authenticated. Please login again.')
      return
    }

    // --- Credit/partial customer info ---
    if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
      alert('❌ Customer name and phone number are required for partial payments and credit sales.')
      return
    }

    // --- Empty cart branch: outstanding-only settlement ---
    if (!currentCart || currentCart.length === 0) {
      if (selectedOutstandingPayments.length > 0) {
        const { paymentAmount: settlementPaymentValue, creditAmount: settlementCreditValue, baseOutstanding } = calculateSettlementValues()

        if (isSettlementPartial && settlementPaymentValue < 0) {
          alert('❌ Payment amount cannot be negative.')
          return
        }

        // Build pending settlement data and show confirm dialog
        const pendingSettlement = {
          type: 'settlement-only',
          settlementPaymentValue,
          settlementCreditValue,
          baseOutstanding,
          customerName: customerName || 'Unknown',
          customerPhone: customerPhone || 'N/A',
          paymentMethod,
          selectedOutstandingPayments: [...selectedOutstandingPayments],
          outstandingPayments: [...outstandingPayments]
        }

        setPendingSaleData(pendingSettlement)
        setSaleConfirmDialog(true)
        return
      } else {
        alert('❌ Cart is empty. Please add items before processing sale.')
        return
      }
    }

    // --- Total validation ---
    if (total <= 0 && currentCart.length === 0) {
      alert('❌ Cannot process a sale without items.')
      return
    }

    // --- Build amounts ---
    const selectedOutstandingTotal = outstandingPayments
      .filter(payment => selectedOutstandingPayments.includes(payment.id))
      .reduce((total, payment) => {
        const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
          ? parseFloat(payment.creditAmount)
          : (payment.total !== undefined && payment.total !== null
            ? parseFloat(payment.total)
            : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
        return total + (Number.isFinite(amount) ? amount : 0)
      }, 0)

    const totalWithOutstanding = billAmount + selectedOutstandingTotal

    let finalPaymentAmount, finalCreditAmount

    if (isFullyCredit) {
      finalPaymentAmount = 0
      finalCreditAmount = totalWithOutstanding
    } else if (isBalancePayment) {
      finalPaymentAmount = 0
      finalCreditAmount = totalWithOutstanding
    } else if (isPartialPayment) {
      finalPaymentAmount = parseFloat(paymentAmount) || 0
      finalCreditAmount = totalWithOutstanding - finalPaymentAmount
    } else {
      finalPaymentAmount = totalWithOutstanding
      finalCreditAmount = 0
    }

    const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

    // --- Partial payment validation ---
    if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
      if (finalPaymentAmount <= 0) {
        alert('❌ Payment amount must be greater than 0 for partial payments')
        return
      }
      const sum = finalPaymentAmount + finalCreditAmount
      if (Math.abs(sum - totalWithOutstanding) > 0.01) {
        alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${totalWithOutstanding.toFixed(2)}\nSum: ${sum.toFixed(2)}`)
        return
      }
    }

    // --- Build saleData (to be sent to backend on confirm) ---
    const saleData = {
      items: currentCart.map(item => ({
        inventoryItemId: parseInt(item.id),
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
      total: parseFloat(totalWithOutstanding),
      paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
      paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'),
      paymentStatus: finalPaymentStatus,
      paymentAmount: finalPaymentAmount,
      creditAmount: finalCreditAmount,
      customerInfo: {
        name: customerName || 'Walk-in Customer',
        phone: customerPhone || ''
      },
      notes: notes || 'Sale completed via POS terminal'
    }

    // --- Build printData preview (receiptNumber filled in after backend creates sale) ---
    const printDataPreview = {
      type: 'receipt',
      title: 'SALES RECEIPT',
      companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
      companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
      companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
      companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
      logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
      receiptNumber: '', // filled after backend responds
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      cashierName: user?.name || user?.username || 'Cashier',
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      items: currentCart.map(normalizeCartItemForPrint),
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      discount: Math.round(totalDiscount),
      invoiceTotal: Math.round(billAmount),
      oldBalance: Math.round(selectedOutstandingTotal || 0),
      total: Math.round(totalWithOutstanding),
      paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
      paymentAmount: Math.round(finalPaymentAmount),
      creditAmount: Math.round(finalCreditAmount),
      remainingBalance: Math.round(Math.max(0, totalWithOutstanding - finalPaymentAmount)),
      change: isPartialPayment ? 0 : Math.round((parseFloat(paymentAmount) || finalPaymentAmount) - totalWithOutstanding),
      customerLabel: 'Customer',
      footerMessage: 'Thank you for choosing PetZone!'
    }

    // Store everything and show confirm dialog
    setPendingSaleData({
      type: 'sale',
      saleData,
      printDataPreview,
      finalPaymentAmount,
      finalCreditAmount,
      totalWithOutstanding,
      selectedOutstandingTotal,
      billAmount,
      selectedOutstandingPayments: [...selectedOutstandingPayments],
      showSettlementOptions
    })
    setSaleConfirmDialog(true)

  } catch (error) {
    console.error('[POS] handleSaleOnly validation error:', error)
    showToast(error?.message || 'Validation failed', 'error')
  }
}
// Called when user confirms in the sale confirmation dialog.
// THIS is where the backend call happens.
const handleCompleteSale = async () => {
  if (isCompletingSaleRef.current) return
  isCompletingSaleRef.current = true
  setIsProcessingSaleOnly(true) // ← fix: was missing previously

  setSaleConfirmDialog(false)

  try {
    if (!pendingSaleData) {
      throw new Error('No pending sale data found.')
    }

    // --- Settlement-only path ---
    if (pendingSaleData.type === 'settlement-only') {
      const { settlementPaymentValue, settlementCreditValue, baseOutstanding } = pendingSaleData

      try {
        const settlementResult = await settleOutstandingPayments()

        if (settlementResult?.data?.settlementSale) {
          const settlementSale = settlementResult.data.settlementSale
          const dbPaymentAmountRaw = parseFloat(settlementSale.payment_amount)
          const dbCreditAmountRaw = parseFloat(settlementSale.credit_amount)
          const dbTotal = parseFloat(settlementSale.total || 0) || 0

          let finalPaymentAmountPrint = Number.isFinite(dbPaymentAmountRaw) ? dbPaymentAmountRaw : parseFloat(settlementPaymentValue || 0) || 0
          if (finalPaymentAmountPrint === 0 && dbTotal > 0 && Number.isFinite(dbCreditAmountRaw) && dbCreditAmountRaw > 0) {
            finalPaymentAmountPrint = dbTotal - dbCreditAmountRaw
          }
          if (finalPaymentAmountPrint === 0) {
            finalPaymentAmountPrint = parseFloat(settlementPaymentValue || 0) || 0
          }

          let finalCreditAmountPrint = Number.isFinite(dbCreditAmountRaw) ? dbCreditAmountRaw : parseFloat(settlementCreditValue || 0) || 0
          const finalTotal = parseFloat((finalPaymentAmountPrint + finalCreditAmountPrint).toFixed(2))

          const settlementPrintData = {
            type: 'receipt',
            title: 'PAYMENT SETTLEMENT RECEIPT',
            companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
            companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
            companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
            companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
            logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
            receiptNumber: settlementSale.invoice_no || `SETTLE-${Date.now()}`,
            date: new Date(settlementSale.created_at).toLocaleDateString(),
            time: new Date(settlementSale.created_at).toLocaleTimeString(),
            cashierName: user?.name || user?.username || 'Cashier',
            customerName: settlementSale.customer_name || customerName || 'Unknown',
            customerPhone: settlementSale.customer_phone || customerPhone || '',
            customerLabel: 'Retailer',
            items: [],
            subtotal: 0,
            tax: 0,
            discount: 0,
            invoiceTotal: 0,
            oldBalance: Math.round(Number.isFinite(baseOutstanding) ? Math.abs(baseOutstanding) : 0),
            total: Math.round(finalTotal),
            paymentMethod: settlementSale.payment_method || paymentMethod || 'CASH',
            paymentAmount: Math.round(finalPaymentAmountPrint),
            creditAmount: Math.round(finalCreditAmountPrint),
            remainingBalance: Math.round(finalCreditAmountPrint),
            change: 0,
            notes: '',
            footerMessage: 'Thank you for your payment!'
          }

          setCompletedSaleData({
            sale: { invoice_no: settlementSale.invoice_no },
            printData: settlementPrintData,
            isSettlement: true,
            settlementPaymentValue,
            settlementCreditValue
          })
          setPostSaleDialog(true)
        }
      } catch (error) {
        console.error('[POS] Error processing outstanding-only settlement:', error)
        alert(`❌ Error processing outstanding payment settlement: ${error.message}`)
      }
      return
    }

    // --- Regular sale path ---
    const {
      saleData,
      printDataPreview,
      finalPaymentAmount,
      finalCreditAmount,
      totalWithOutstanding,
      selectedOutstandingTotal,
      selectedOutstandingPayments: pendingSelectedPayments,
      showSettlementOptions: pendingShowSettlement
    } = pendingSaleData

    const result = await dispatch(createSale(saleData))

    if (createSale.fulfilled.match(result)) {
      const sale = result.payload.data || result.payload

      // Process outstanding settlements if applicable
      if (pendingSelectedPayments.length > 0 && pendingShowSettlement) {
        try {
          await settleOutstandingPayments()
        } catch (error) {
          console.error('[POS] Error processing outstanding payments after sale:', error)
          alert(`❌ Sale created but outstanding settlement failed: ${error.message}`)
        }
      }

      // Build final printData with real invoice number from backend
      const finalPrintData = {
        ...printDataPreview,
        receiptNumber: sale.invoice_no || `POS-${Date.now()}`
      }

      setCompletedSaleData({
        sale,
        printData: finalPrintData,
        isSettlement: false,
        finalPaymentAmount,
        finalCreditAmount,
        totalWithOutstanding
      })

      // Clear terminal state
      clearAllPOSState()
      setTimeout(() => refreshOutstandingPayments(), 2000)

      setPostSaleDialog(true)

    } else if (createSale.rejected.match(result)) {
      const error = result.payload || result.error
      const message = error?.message || 'Sale failed'
      const severity = error?.status === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }

  } catch (error) {
    console.error('[POS] handleCompleteSale error:', error)
    showToast(error?.message || 'Sale failed', 'error')
  } finally {
    setIsProcessingSaleOnly(false)
    isCompletingSaleRef.current = false
    setPendingSaleData(null)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SALE ONLY button handler — confirm-first flow (matches warehouse billing)
//
// CHANGES vs old implementation:
//   • No more inline confirm() dialog
//   • No more direct dispatch(createSale(...)) call here
//   • Validates input, builds pendingSaleData, sets saleConfirmDialog = true
//   • handleCompleteSale() (unchanged) does the actual backend call and then
//     shows postSaleDialog with "Print / Skip" options
//   • pendingSaleData.source = 'sale-only' is stored so future callers can
//     distinguish if needed, but postSaleDialog already works for both flows
// ─────────────────────────────────────────────────────────────────────────────

const handleSaleWithoutPrint = async () => {
  if (isProcessingSale) {
    console.log('[POS] handleSaleWithoutPrint: already in progress, ignoring')
    return
  }

  console.log('[POS] handleSaleWithoutPrint (confirm-first) start', {
    currentCartLength: currentCart.length,
    billAmount,
    outstandingTotal,
    total
  })

  try {
    // --- Admin check ---
    if (user.role === 'ADMIN' && !isAdminMode) {
      alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
      return
    }

    // --- Auth check ---
    if (!user) {
      alert('❌ User not authenticated. Please login again.')
      return
    }

    // --- Credit/partial customer info ---
    if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
      alert('❌ Customer name and phone number are required for partial payments and credit sales.')
      return
    }

    // --- Empty cart branch: outstanding-only settlement ---
    if (!currentCart || currentCart.length === 0) {
      if (selectedOutstandingPayments.length > 0) {
        const { paymentAmount: settlementPaymentValue, creditAmount: settlementCreditValue, baseOutstanding } = calculateSettlementValues()

        if (isSettlementPartial && settlementPaymentValue < 0) {
          alert('❌ Payment amount cannot be negative.')
          return
        }

        // Build pending settlement data and show confirm dialog
        const pendingSettlement = {
          type: 'settlement-only',
          source: 'sale-only',
          settlementPaymentValue,
          settlementCreditValue,
          baseOutstanding,
          customerName: customerName || 'Unknown',
          customerPhone: customerPhone || 'N/A',
          paymentMethod,
          selectedOutstandingPayments: [...selectedOutstandingPayments],
          outstandingPayments: [...outstandingPayments]
        }

        setPendingSaleData(pendingSettlement)
        setSaleConfirmDialog(true)
        return
      } else {
        alert('❌ Cart is empty. Please add items before processing sale.')
        return
      }
    }

    // --- Total validation ---
    if (total <= 0 && currentCart.length === 0) {
      alert('❌ Cannot process a sale without items.')
      return
    }

    // --- Build amounts ---
    const selectedOutstandingTotal = outstandingPayments
      .filter(payment => selectedOutstandingPayments.includes(payment.id))
      .reduce((total, payment) => {
        const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
          ? parseFloat(payment.creditAmount)
          : (payment.total !== undefined && payment.total !== null
            ? parseFloat(payment.total)
            : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
        return total + (Number.isFinite(amount) ? amount : 0)
      }, 0)

    const totalWithOutstanding = billAmount + selectedOutstandingTotal

    let finalPaymentAmount, finalCreditAmount

    if (isFullyCredit) {
      finalPaymentAmount = 0
      finalCreditAmount = totalWithOutstanding
    } else if (isBalancePayment) {
      finalPaymentAmount = 0
      finalCreditAmount = totalWithOutstanding
    } else if (isPartialPayment) {
      finalPaymentAmount = parseFloat(paymentAmount) || 0
      finalCreditAmount = totalWithOutstanding - finalPaymentAmount
    } else {
      finalPaymentAmount = totalWithOutstanding
      finalCreditAmount = 0
    }

    const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

    // --- Partial payment validation ---
    if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
      if (finalPaymentAmount <= 0) {
        alert('❌ Payment amount must be greater than 0 for partial payments')
        return
      }
      const sum = finalPaymentAmount + finalCreditAmount
      if (Math.abs(sum - totalWithOutstanding) > 0.01) {
        alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${totalWithOutstanding.toFixed(2)}\nSum: ${sum.toFixed(2)}`)
        return
      }
    }

    // --- Build saleData ---
    const saleData = {
      items: currentCart.map(item => ({
        inventoryItemId: parseInt(item.id),
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
      total: parseFloat(totalWithOutstanding),
      paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
      paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'),
      paymentStatus: finalPaymentStatus,
      paymentAmount: finalPaymentAmount,
      creditAmount: finalCreditAmount,
      customerInfo: {
        name: customerName || 'Walk-in Customer',
        phone: customerPhone || ''
      },
      notes: notes || 'Sale completed without printing'   // ← preserves original intent
    }

    // --- Build printData preview (receiptNumber filled after backend responds) ---
    const printDataPreview = {
      type: 'receipt',
      title: 'SALES RECEIPT',
      companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
      companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
      companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
      companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
      logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
      receiptNumber: '',   // filled after backend responds
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      cashierName: user?.name || user?.username || 'Cashier',
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      items: currentCart.map(normalizeCartItemForPrint),
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      discount: Math.round(totalDiscount),
      invoiceTotal: Math.round(billAmount),
      oldBalance: Math.round(selectedOutstandingTotal || 0),
      total: Math.round(totalWithOutstanding),
      paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
      paymentAmount: Math.round(finalPaymentAmount),
      creditAmount: Math.round(finalCreditAmount),
      remainingBalance: Math.round(Math.max(0, totalWithOutstanding - finalPaymentAmount)),
      change: isPartialPayment ? 0 : Math.round((parseFloat(paymentAmount) || finalPaymentAmount) - totalWithOutstanding),
      customerLabel: 'Customer',
      footerMessage: 'Thank you for choosing PetZone!'
    }

    // --- Store and show confirm dialog ---
    setPendingSaleData({
      type: 'sale',
      source: 'sale-only',   // ← identifies which button triggered this
      saleData,
      printDataPreview,
      finalPaymentAmount,
      finalCreditAmount,
      totalWithOutstanding,
      selectedOutstandingTotal,
      billAmount,
      selectedOutstandingPayments: [...selectedOutstandingPayments],
      showSettlementOptions
    })
    setSaleConfirmDialog(true)

  } catch (error) {
    console.error('[POS] handleSaleWithoutPrint validation error:', error)
    showToast(error?.message || 'Validation failed', 'error')
  }
  // NOTE: No finally block needed — we never set isProcessingSale here.
  // isProcessingSale / isProcessingSaleOnly are managed inside handleCompleteSale.
}

  // Direct print function - prints current cart without creating sale
  const handleDirectPrint = async () => {
    console.log('[POS] handleDirectPrint start', { currentCartLength: currentCart.length })

    try {
        // Validate cart and gather totals
        if (!currentCart?.length) {
        alert('❌ Cart is empty. Please add items before printing.')
        return
      }

        // Calculate all totals including outstanding
        const cartSubtotal = subtotal || 0
        const cartTax = tax || 0
        const cartDiscount = totalDiscount || 0
        const cartTotal = total || 0
        const oldBalanceAmount = outstandingTotal > 0 ? outstandingTotal : 0
        const paymentAmountValue = parseFloat(paymentAmount) || 0
        const creditAmountValue = parseFloat(creditAmount) || 0

      // Prepare print data with current cart
      const printData = {
        type: 'receipt',
        title: 'DRAFT RECEIPT',
        companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
        companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
        companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
        logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
        receiptNumber: `DRAFT-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashierName: user?.name || user?.username || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        customerLabel: (typeof selectedRetailer !== 'undefined' && selectedRetailer) ? 'Retailer' : 'Customer',
        items: currentCart.map(normalizeCartItemForPrint),
        subtotal: Math.round(cartSubtotal),
        tax: Math.round(cartTax),
        discount: Math.round(cartDiscount),
        invoiceTotal: Math.round(cartTotal - cartDiscount),
        oldBalance: Math.round(oldBalanceAmount),
        total: Math.round(cartTotal),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
        paymentAmount: Math.round(paymentAmountValue),
        creditAmount: Math.round(creditAmountValue),
        remainingBalance: Math.round(Math.max(0, oldBalanceAmount + creditAmountValue - paymentAmountValue)),
        change: 0,
        notes: 'DRAFT - Not a completed sale',
        footerMessage: 'Thank you for your business!'
      }

      const { success: printSuccess, message: printMessage, usedBrowserFallback } = await attemptReceiptPrint(printData, 'Direct draft receipt')

      if (printSuccess) {
        if (usedBrowserFallback) {
          console.log('[POS] Browser print fallback used for direct draft receipt')
        }
        alert('✅ Receipt printed successfully!')
      } else {
        const printerStatus = await checkPrinterStatus()

        let errorMessage = '❌ Print failed. Please check printer connection.\n\n'
        errorMessage += `Reason: ${printMessage || 'Unknown error'}\n`
        errorMessage += `Printer Status: ${printerStatus.message}\n\n`
        errorMessage += 'Troubleshooting Steps:\n'
        errorMessage += '1. Check if printer is powered on\n'
        errorMessage += '2. Verify USB cable connection\n'
        errorMessage += '3. Check Windows Device Manager for printer\n'
        errorMessage += '4. Try printing from another application\n'
        errorMessage += '5. Restart the printer\n'
        errorMessage += '6. Check printer drivers\n\n'
        errorMessage += usedBrowserFallback
          ? 'Browser print fallback was attempted but may have been blocked. Please check popup blockers or manually trigger print.'
          : 'Tip: Printing now requires a connected thermal printer or the desktop app with Electron print service.'

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
    if (typeof navigator === 'undefined' || !navigator.serial) {
      throw new Error('Web Serial API not supported')
    }

    let port

    try {
      port = await acquireSerialPort()

      if (!port) {
        throw new Error('No port selected by user')
      }

      if (typeof port.getInfo === 'function') {
        console.log('[POS] Port selected:', port.getInfo())
      }

      if (port.readable || port.writable) {
        try {
          await port.close()
        } catch (closeError) {
          console.warn('[POS] Unable to close port before reuse:', closeError)
        }
      }

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
          if (port.readable || port.writable) {
            try {
              await port.close()
            } catch (closeError) {
              console.warn('[POS] Unable to close port after failed attempt:', closeError)
            }
          }
        }
      }

      if (!connected) {
        throw new Error('Could not connect to printer at any baud rate')
      }

      const writer = port.writable.getWriter()

      const commands = [
        0x1B, 0x40, // Initialize printer
        
        // HEADER SECTION - Company Logo/Name
        0x1B, 0x61, 0x01, // Center align
        0x1B, 0x21, 0x30, // Double height and width
        ...new TextEncoder().encode(printData.companyName || DEFAULT_COMPANY_INFO.name.toUpperCase()),
        0x0A, // Line feed
        
        // Company Info
        0x1B, 0x21, 0x00, // Normal size
        ...new TextEncoder().encode((printData.companyAddress || DEFAULT_COMPANY_INFO.address).substring(0, 32)),
        0x0A,
        ...new TextEncoder().encode(`Tel: ${printData.companyPhone || DEFAULT_COMPANY_INFO.phone}`),
        0x0A,
        ...new TextEncoder().encode(`Email: ${printData.companyEmail || DEFAULT_COMPANY_INFO.email}`),
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

      // small helper to format numbers for printer: always whole numbers (no decimals)
      const fmt = (v) => {
        const n = Number(v || 0)
        return String(Math.round(n))
      }

      // Add items with proper formatting
      printData.items.forEach(item => {
        const itemName = item.name || 'Unknown Item'
        const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
        const discountValue = Number.isFinite(item.discount) ? item.discount : 0
        const resolvedTotal = Number.isFinite(item.total)
          ? item.total
          : ((Number(item.unitPrice || item.price || 0) * quantity) - discountValue)
        const rawUnitPrice = Number.isFinite(item.unitPrice) && item.unitPrice !== 0
          ? item.unitPrice
          : Number.isFinite(item.price) && item.price !== 0
            ? item.price
            : (quantity !== 0 ? (resolvedTotal + discountValue) / quantity : 0)
        const unitPrice = Number.isFinite(rawUnitPrice) ? rawUnitPrice : 0
        const total = Number.isFinite(resolvedTotal) ? Number.parseFloat(resolvedTotal.toFixed(2)) : 0
        
        // Format item name (max 15 chars for thermal printer, pad with spaces)
        const formattedName = itemName.substring(0, 15).padEnd(15, ' ')
        const formattedQty = quantity.toString().padStart(3, ' ')
  const formattedPrice = fmt(unitPrice).padStart(7, ' ')
  const formattedTotal = fmt(total).padStart(7, ' ')
        
        commands.push(
          ...new TextEncoder().encode(`${formattedName}${formattedQty}${formattedPrice}${formattedTotal}`),
          0x0A
        )
      })

      // TOTALS SECTION - Scenario-wise handling
      commands.push(
        ...new TextEncoder().encode('================================'),
        0x0A,
        ...new TextEncoder().encode(`Subtotal:                    ${fmt(printData.subtotal || 0)}`),
        0x0A
      )
      
      // Add discount line if discount > 0
      if ((printData.discount || 0) > 0) {
        commands.push(
          ...new TextEncoder().encode(`Discount:                    -${fmt(printData.discount || 0)}`),
          0x0A
        )
      }
      
      commands.push(
        ...new TextEncoder().encode(`Tax:                         ${fmt(printData.tax || 0)}`),
        0x0A,
        ...new TextEncoder().encode(`Invoice Total:               ${fmt(printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0)))}`),
        0x0A
      )

      // Calculate invoice total
      const invoiceTotal = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0))
      
      // Use raw old balance (can be credit/negative); still print the line always
      const oldBalance = Number.isFinite(printData.oldBalance) ? printData.oldBalance : 0
      
      // Show Old Balance BEFORE TOTAL (always show line)
      commands.push(
        ...new TextEncoder().encode(`Old Balance:                    ${fmt(oldBalance)}`),
        0x0A
      )

      // Calculate TOTAL as Invoice Total + Old Balance (not using printData.total which might be negative)
      const calculatedTotal = invoiceTotal + oldBalance

      commands.push(
        ...new TextEncoder().encode('--------------------------------'),
        0x0A,
        ...new TextEncoder().encode(`TOTAL:                       ${fmt(calculatedTotal)}`),
        0x0A,
        ...new TextEncoder().encode(`Payment Method:      ${(printData.paymentMethod || 'CASH').substring(0, 12)}`),
        0x0A
      )
      
      // STANDARDIZED LAYOUT: Always show Payment Amount
      const paymentAmount = printData.paymentAmount || 0
      commands.push(
        ...new TextEncoder().encode(`Payment Amount:      ${fmt(paymentAmount)}`),
        0x0A
      )
      
      // Show Credit Amount if applicable (partial payment or fully credit)
      const creditAmount = printData.creditAmount || 0
      if (creditAmount > 0 || printData.paymentMethod === 'FULLY_CREDIT') {
        commands.push(
          ...new TextEncoder().encode(`Credit Amount:       ${fmt(creditAmount || calculatedTotal || 0)}`),
          0x0A
        )
      }
      
      // Calculate and show Remaining Balance if applicable
      // Formula: (Old Balance + Invoice Total) - Payment Amount
      const oldBalanceForRemaining = oldBalance
      const calculatedRemaining = Math.max(0, (oldBalanceForRemaining + invoiceTotal) - paymentAmount)
      const shouldShowRemaining = calculatedRemaining > 0 || oldBalanceForRemaining !== 0
      
      if (shouldShowRemaining) {
        commands.push(
          ...new TextEncoder().encode(`Remaining Balance:       ${fmt(calculatedRemaining)}`),
          0x0A
        )
      }
      
      // Show Change if overpaid (payment > total)
      const change = paymentAmount > calculatedTotal ? paymentAmount - calculatedTotal : 0
      if (change > 0) {
        commands.push(
          ...new TextEncoder().encode(`Change:                  ${fmt(change)}`),
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
      if (port) {
        try {
          if (port.readable || port.writable) {
            await port.close()
          }
        } catch (closeError) {
          console.warn('[POS] Error while closing port after failure:', closeError)
        }
      }
      resetCachedSerialPort()
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
      const baseOrigin = typeof window !== 'undefined' ? window.location.origin : ''
      const rawLogo = printData.logoUrl || DEFAULT_COMPANY_INFO.logoUrl
      const resolvedLogoPath = (() => {
        if (!rawLogo) {
          return baseOrigin ? `${baseOrigin}${DEFAULT_COMPANY_INFO.logoUrl}` : DEFAULT_COMPANY_INFO.logoUrl
        }
        if (/^(https?:|data:)/i.test(rawLogo)) {
          return rawLogo
        }
        const normalizedLogo = rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`
        return baseOrigin ? `${baseOrigin}${normalizedLogo}` : normalizedLogo
      })()
      const safeCompanyName = printData.companyName || DEFAULT_COMPANY_INFO.name
      const safeCompanyAddress = printData.companyAddress || DEFAULT_COMPANY_INFO.address
      const safeCompanyPhone = printData.companyPhone || DEFAULT_COMPANY_INFO.phone
      const safeCompanyEmail = printData.companyEmail || DEFAULT_COMPANY_INFO.email

      // Create a printable HTML content - matching exact thermal printer layout structure
      // Add extra padding for settlement receipts
  const isSettlementReceipt = printData.title === 'PAYMENT SETTLEMENT RECEIPT' || printData.outstandingCleared;
  // Use symmetric left/right padding so receipts print evenly on thermal paper
  const containerPadding = isSettlementReceipt ? '8px 16px 8px 16px' : '4px 16px 4px 16px';
      
      const printContent = `
        <div style="font-family: monospace; max-width: 280px; margin: 0 auto; padding: ${containerPadding}; font-size: 11px; line-height: 1.3; color: #000; background-color: #fff;">
          <!-- HEADER SECTION -->
          <div style="text-align: center; margin-bottom: ${isSettlementReceipt ? '12px' : '8px'};">
            <div style="margin-bottom: 4px;">
              <img src="${resolvedLogoPath}" alt="${safeCompanyName}" style="max-width: 100px; width: 100px; height: auto; filter: grayscale(100%); display: block; margin: 0 auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              <div style="font-size: 14px; font-weight: bold; display: none; text-align: center; border: 1px solid #000; padding: 4px; min-height: 50px;">
                ${safeCompanyName}
          </div>
            ${printData.branchName ? `<div style="border:1px solid #000; padding:8px; margin:8px 0; font-weight:bold; text-align:center;">${printData.branchName}</div>` : ''}
          </div>
            <div style="font-size: 9px; margin-bottom: 3px; line-height: 1.2;">
              ${safeCompanyAddress.substring(0, 32)}
          </div>
            <div style="font-size: 9px; margin-bottom: 3px; line-height: 1.2;">
              Tel: ${safeCompanyPhone}
          </div>
            <div style="font-size: 9px; margin-bottom: ${isSettlementReceipt ? '12px' : '8px'}; line-height: 1.2;">
              Email: ${safeCompanyEmail}
            </div>
            <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '6px' : '4px'} 0;"></div>
            <div style="font-weight: bold; text-transform: uppercase; font-size: ${isSettlementReceipt ? '13px' : '12px'}; color: #000; text-align: center; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'}; padding: ${isSettlementReceipt ? '4px 0' : '0'};">
              ${printData.title || 'SALES RECEIPT'}
            </div>
            <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '6px' : '4px'} 0;"></div>
          </div>
          
          <!-- RECEIPT INFO SECTION -->
          <div style="margin-bottom: ${isSettlementReceipt ? '12px' : '8px'};">
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '4px' : '3px'};">
              <span style="font-size: 10px; font-weight: bold;">Receipt #:</span>
              <span style="font-weight: bold; font-size: 10px;">${(printData.receiptNumber || 'N/A').substring(0, 20)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '4px' : '3px'};">
              <span style="font-size: 10px; font-weight: bold;">Date:</span>
              <span style="font-size: 10px;">${printData.date}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '4px' : '3px'};">
              <span style="font-size: 10px; font-weight: bold;">Time:</span>
              <span style="font-size: 10px;">${printData.time || ''}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '4px' : '3px'};">
              <span style="font-size: 10px; font-weight: bold;">Cashier:</span>
              <span style="font-size: 10px;">${printData.cashierName || 'N/A'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '4px' : '3px'};">
              <span style="font-size: 10px; font-weight: bold;">${printData.customerLabel || 'Customer'}:</span>
              <span style="font-size: 10px;">${printData.customerName || 'Walk-in Customer'}</span>
            </div>
          </div>
          
          <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '6px' : '4px'} 0;"></div>
          
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
                    ${Math.round(item.unitPrice || 0)}
                  </div>
                  <div style="width: 50px; text-align: right; font-weight: bold; font-size: 10px;">
                    ${Math.round((item.unitPrice || 0) * (item.quantity || 0))}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '6px' : '4px'} 0;"></div>
          
          <!-- TOTALS SECTION -->
          <div style="margin-bottom: ${isSettlementReceipt ? '12px' : '8px'};">
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
              <span style="font-size: 10px; font-weight: bold;">Subtotal:</span>
              <span style="font-size: 10px; font-weight: bold;">${Math.round(printData.subtotal || 0)}</span>
          </div>
            ${(printData.discount || 0) > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
              <span style="font-size: 10px; font-weight: bold; color: #d32f2f;">Discount:</span>
              <span style="font-size: 10px; font-weight: bold; color: #d32f2f;">-${Math.round(printData.discount || 0)}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
              <span style="font-size: 10px; font-weight: bold;">Tax:</span>
              <span style="font-size: 10px; font-weight: bold;">${Math.round(printData.tax || 0)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'}; margin-top: 4px; border-bottom: 1px dashed #000; padding-bottom: 4px;">
              <span style="font-size: 10px; font-weight: bold;">Invoice Total:</span>
              <span style="font-size: 10px; font-weight: bold;">${Math.round(printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0)))}</span>
            </div>
            
            <!-- Old Balance BEFORE TOTAL (as per user request) -->
            ${(() => {
              const oldBalance = Math.max(0, printData.oldBalance || 0);
              return oldBalance > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
                <span style="font-size: 10px; font-weight: bold;">Old Balance:</span>
                <span style="font-size: 10px; font-weight: bold;">${Math.round(oldBalance)}</span>
              </div>
            ` : '';
            })()}
            
            <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '8px' : '8px'} 0;"></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '10px' : '8px'};">
              <span style="font-weight: bold; font-size: 12px;">TOTAL:</span>
              <span style="font-weight: bold; font-size: 12px;">${(() => {
                const invoiceTotal = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0));
                const oldBalance = Math.max(0, printData.oldBalance || 0);
                return Math.round(invoiceTotal + oldBalance);
              })()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
              <span style="font-size: 10px; font-weight: bold;">Payment Method:</span>
              <span style="font-size: 10px; font-weight: bold;">${printData.paymentMethod || 'CASH'}</span>
            </div>
            
            <!-- STANDARDIZED PAYMENT DISPLAY - Same layout for all scenarios -->
            ${(() => {
              const invoiceTotalForDisplay = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0));
              const oldBalanceForDisplay = Math.max(0, printData.oldBalance || 0);
              const calculatedTotalForDisplay = invoiceTotalForDisplay + oldBalanceForDisplay;
              const paymentAmount = printData.paymentAmount || 0;
              const creditAmount = printData.creditAmount || 0;
              const calculatedRemaining = Math.max(0, (oldBalanceForDisplay + invoiceTotalForDisplay) - paymentAmount);
              const shouldShowRemaining = calculatedRemaining > 0 || (oldBalanceForDisplay > 0 && paymentAmount < calculatedTotalForDisplay);
              const change = paymentAmount > calculatedTotalForDisplay ? paymentAmount - calculatedTotalForDisplay : 0;
              
              return `
              <!-- Payment Amount - ALWAYS SHOW -->
              <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
                <span style="font-size: 10px; font-weight: bold;">Payment Amount:</span>
                <span style="font-size: 10px; font-weight: bold;">${Math.round(paymentAmount)}</span>
              </div>
              
              <!-- Credit Amount - Show if applicable -->
              ${(creditAmount > 0 || printData.paymentMethod === 'FULLY_CREDIT') ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
                <span style="font-size: 10px; font-weight: bold;">Credit Amount:</span>
                <span style="font-size: 10px; font-weight: bold;">${Math.round(creditAmount || calculatedTotalForDisplay || 0)}</span>
              </div>
              ` : ''}
              
              <!-- Remaining Balance - Show if applicable -->
              ${shouldShowRemaining ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'}; padding: ${isSettlementReceipt ? '4px 0' : '0'};">
                <span style="font-size: 10px; font-weight: bold;">Remaining Balance:</span>
                <span style="font-size: 10px; font-weight: bold;">${Math.round(calculatedRemaining)}</span>
              </div>
              ` : ''}
              
              <!-- Change - Show if overpaid -->
              ${change > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
                <span style="font-size: 10px; font-weight: bold; color: green;">Change:</span>
                <span style="font-size: 10px; font-weight: bold; color: green;">${Math.round(change)}</span>
              </div>
              ` : ''}
            `;
            })()}
            
            ${printData.notes && printData.notes.trim() ? `
              <div style="margin-top: ${isSettlementReceipt ? '8px' : '4px'}; margin-bottom: ${isSettlementReceipt ? '8px' : '4px'}; padding: ${isSettlementReceipt ? '8px' : '4px'}; background-color: ${isSettlementReceipt ? '#f5f5f5' : 'transparent'}; border-radius: ${isSettlementReceipt ? '4px' : '0'}; border-left: ${isSettlementReceipt ? '3px solid #1976d2' : 'none'};">
                <div style="font-size: ${isSettlementReceipt ? '9px' : '8px'}; line-height: 1.4; color: #333; white-space: pre-line;">
                  ${printData.notes}
                </div>
              </div>
            ` : ''}
          </div>
          
          <!-- FOOTER SECTION -->
          <div style="text-align: center; margin-top: ${isSettlementReceipt ? '12px' : '8px'};">
            <div style="border-top: 2px solid #000; margin-bottom: ${isSettlementReceipt ? '8px' : '6px'};"></div>
            <div style="font-size: 9px; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
              ${printData.footerMessage || 'Thank you for your business!'}
            </div>
            <div style="border-top: 2px solid #000; margin-bottom: ${isSettlementReceipt ? '8px' : '6px'};"></div>
                  <div style="font-size: 9px; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">
                    Return within 3 days
                  </div>
            <div style="border-top: 2px solid #000; margin-bottom: ${isSettlementReceipt ? '8px' : '6px'};"></div>
            <div style="font-size: 10px; margin-bottom: ${isSettlementReceipt ? '4px' : '2px'};">
              Powered by Tychora
            </div>
            <div style="font-size: 9px; padding-bottom: ${isSettlementReceipt ? '8px' : '4px'};">
              www.tychora.com
            </div>
          </div>
        </div>
      `

      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=400,height=600')
      
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups for this site to print receipts.')
      }
      
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
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Print window failed to load'))
        }, 3000)
        
        printWindow.onload = () => {
          clearTimeout(timeout)
          try {
            // Small delay to ensure content is fully rendered
            setTimeout(() => {
              try {
                printWindow.print()
                
                // Handle print completion
                const afterPrintHandler = () => {
                  printWindow.close()
                  resolve()
                }
                
                printWindow.addEventListener('afterprint', afterPrintHandler)
                
                // Fallback timeout to close window if afterprint doesn't fire
                setTimeout(() => {
                  if (!printWindow.closed) {
                    printWindow.removeEventListener('afterprint', afterPrintHandler)
                    printWindow.close()
                  }
                  resolve()
                }, 5000)
              } catch (printError) {
                printWindow.close()
                reject(new Error(`Failed to open print dialog: ${printError.message}`))
              }
            }, 100)
          } catch (error) {
            printWindow.close()
            reject(new Error(`Print window error: ${error.message}`))
          }
        }
        
        // If onload doesn't fire (some browsers), try printing anyway after a delay
        setTimeout(() => {
          if (printWindow.document.readyState === 'complete') {
            clearTimeout(timeout)
            try {
              printWindow.print()
              setTimeout(() => {
                if (!printWindow.closed) {
                  printWindow.close()
                }
                resolve()
              }, 5000)
            } catch (error) {
              printWindow.close()
              reject(new Error(`Failed to print: ${error.message}`))
            }
          }
        }, 500)
      })

      return { success: true, message: 'Opened browser print dialog' }
    } catch (error) {
      console.error('[POS] Browser print error:', error)
      return { success: false, message: error.message || 'Failed to open print dialog' }
    }
  };

  const attemptReceiptPrint = async (printData, contextLabel = 'receipt') => {
  const contextTag = `[POS] ${contextLabel}`
  let success = false
  let message = ''
  let usedBrowserFallback = false

  if (window.electronAPI?.printReceipt) {
    try {
      const electronResult = await window.electronAPI.printReceipt(printData)
      success = !!electronResult?.success
      message = electronResult?.message || ''
    } catch (electronError) {
      console.error(`${contextTag} Electron print error:`, electronError)
      message = electronError?.message || 'Electron print error'
    }
  } else {
    try {
      const thermalResult = await printToThermalPrinter(printData)
      success = !!thermalResult?.success
      message = thermalResult?.message || ''
    } catch (serialError) {
      console.error(`${contextTag} Thermal printer error:`, serialError)
      const canFallbackToBrowser = typeof window !== 'undefined' && typeof window.print === 'function'

      if (canFallbackToBrowser) {
        usedBrowserFallback = true
        try {
          const browserResult = await printToBrowser(printData)
          success = !!browserResult?.success
          message = browserResult?.message || ''
        } catch (browserError) {
          console.error(`${contextTag} Browser print fallback error:`, browserError)
          message = browserError?.message || 'Browser print failed'
        }
      } else {
        message = serialError?.message || 'Thermal printer not available'
      }
    }
  }

  return { success, message, usedBrowserFallback }
  };

  const printReceipt = async () => {
  // Prevent duplicate submissions
  if (isProcessingSale) {
    console.log('[POS] Sale already in progress, ignoring duplicate click')
    return
  }
  
  setIsProcessingSale(true)
  console.log('[POS] printReceipt start', { currentCartLength: currentCart.length, total, billAmount })

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

    // Allow negative total when customer has advance credit (outstanding payment with negative balance)
    // Example: Customer has -29000 credit, buys 9000 item → Total = -20000 (still has 20000 credit remaining)
    // No need to block - receipts can be printed even with negative totals
    console.log('[POS] Total:', total, '- Allowing negative total for advance credit scenario')

    // ✅ CORRECTED: Calculate payment amounts using billAmount
    // Recompute outstanding directly from current selection to avoid stale state
    const selectedOutstandingTotal = outstandingPayments
      .filter(payment => selectedOutstandingPayments.includes(payment.id))
      .reduce((total, payment) => {
        const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
          ? parseFloat(payment.creditAmount)
          : (payment.total !== undefined && payment.total !== null
            ? parseFloat(payment.total)
            : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
        return total + (Number.isFinite(amount) ? amount : 0)
      }, 0)

    const totalWithOutstanding = billAmount + selectedOutstandingTotal

    console.log('[POS] Payment calculation (printReceipt):', {
      billAmount,
      outstandingTotal,
      selectedOutstandingTotal,
      totalWithOutstanding,
      total,
      isFullyCredit,
      isBalancePayment,
      isPartialPayment,
      paymentAmount
    })

    let finalPaymentAmount, finalCreditAmount

    if (isFullyCredit) {
      finalPaymentAmount = 0
      finalCreditAmount = totalWithOutstanding
    } else if (isBalancePayment) {
      // Balance payment: Uses customer's existing credit
      // Payment: 0 (no cash), Credit: totalWithOutstanding (uses from balance)
      finalPaymentAmount = 0
      finalCreditAmount = totalWithOutstanding
    } else if (isPartialPayment) {
      finalPaymentAmount = parseFloat(paymentAmount) || 0
      finalCreditAmount = totalWithOutstanding - finalPaymentAmount
    } else {
      // Full payment
      finalPaymentAmount = totalWithOutstanding
      finalCreditAmount = 0
    }

    console.log('[POS] Final amounts (printReceipt):', {
      billAmount,
      finalPaymentAmount,
      finalCreditAmount,
      sum: finalPaymentAmount + finalCreditAmount,
      matches: Math.abs((finalPaymentAmount + finalCreditAmount) - billAmount) < 0.01
    })

    // Payment status logic
    const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

    // ✅ CORRECTED: Prepare sale data with billAmount
    const saleData = {
      scopeType: user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId),
      subtotal: subtotal,
      tax: tax,
      discount: totalDiscount,
      total: parseFloat(totalWithOutstanding), // ✅ Include outstanding in sale total
      paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod.toUpperCase(),
      paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'),
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
    
    console.log('[POS] printReceipt saleData:', saleData)

    // Create the sale first
    const result = await dispatch(createSale(saleData))

    console.log('[POS] printReceipt createSale result', { result })
    
    if (createSale.fulfilled.match(result)) {
      const sale = result.payload.data || result.payload
      
      // Now prepare print data with the actual sale information
      const printableItems = currentCart.map((cartItem) =>
        normalizeCartItemForPrint({
          ...cartItem,
          customPrice: cartItem?.customPrice ?? cartItem?.price ?? cartItem?.sellingPrice
        })
      )

      const printData = {
        type: 'receipt',
        title: 'SALES RECEIPT',
        companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
        companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
        companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
        logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
        receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashierName: user?.name || user?.username || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        items: printableItems,
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        discount: Math.round(totalDiscount),
        invoiceTotal: Math.round(billAmount), // Invoice total before adding old balance
        total: Math.round(totalWithOutstanding), // For display on receipt, use total (includes outstanding)
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
        paymentAmount: Math.round(finalPaymentAmount),
        creditAmount: Math.round(finalCreditAmount),
        oldBalance: Math.round(selectedOutstandingTotal || 0),
        remainingBalance: Math.round(Math.max(0, totalWithOutstanding - finalPaymentAmount)),
        change: isPartialPayment ? 0 : Math.round((parseFloat(paymentAmount) || finalPaymentAmount) - totalWithOutstanding),
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

  useEffect(() => {
    resetCachedSerialPort()
  }, [user?.id])

  useEffect(() => {
    return () => {
      resetCachedSerialPort()
    }
  }, [])

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
    {selectedOutstandingPayments.length > 0 ? (
      <Box sx={{ 
        mb: 2, 
        p: 1, 
        bgcolor: 'success.light', 
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'success.main'
      }}>
        <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 'bold' }}>
          ✓ {selectedOutstandingPayments.length} Outstanding Payment{selectedOutstandingPayments.length > 1 ? 's' : ''} Selected
        </Typography>
        <Typography variant="caption" sx={{ color: 'success.dark' }}>
          Total: {outstandingTotal.toFixed(2)} - Will be settled with this transaction
          {outstandingTotal < 0 && (
            <span style={{ color: 'info.dark', fontWeight: 'bold' }}>
              {' '}(Customer has {Math.abs(outstandingTotal).toFixed(2)} credit)
            </span>
          )}
        </Typography>
        {currentCart.length === 0 && (
          <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mt: 0.5 }}>
            💡 No items in cart - Click &quot;SETTLE&quot; to process outstanding payments only
          </Typography>
        )}
        {currentCart.length > 0 && (
          <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mt: 0.5 }}>
            💡 Selected outstanding payments will be applied with this sale
          </Typography>
        )}
        {currentCart.length === 0 && !showSettlementOptions && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setShowSettlementOptions(true)
                setIsSettlementPartial(false)
                setIsSettlementFullyCredit(false)
                setSettlementPaymentAmount(settlementTotal.toFixed(2))
                setSettlementCreditAmount('0')
              }}
            >
              Manage Settlement
            </Button>
          </Box>
        )}
      </Box>
    ) : (
      <Box sx={{ 
        mb: 2, 
        p: 1, 
        bgcolor: alpha(theme.palette.warning.main, 0.1), 
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'warning.main'
      }}>
        <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 'bold' }}>
          Select outstanding payments to include in this transaction
        </Typography>
        <Typography variant="caption" sx={{ color: 'warning.dark' }}>
          Use the checkboxes below to choose which balances you want to settle.
        </Typography>
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
                  {payment.isCredit ? 'CREDIT' : 'OUTSTANDING'}: {payment.invoice_no}
                </Typography>
                <Chip 
                  label={payment.isCredit ? 
                    `-${parseFloat(payment.outstandingAmount || 0).toFixed(2)}` : 
                    `${parseFloat(payment.outstandingAmount || 0).toFixed(2)}`
                  }
                  size="small"
                  color={payment.isCredit ? "error" : "warning"}
                  variant="filled"
                  sx={{ 
                    bgcolor: payment.isCredit ? 'error.light' : 'warning.light',
                    color: payment.isCredit ? 'error.dark' : 'warning.dark',
                    fontWeight: 'bold'
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {payment.isCredit ? 'Credit Balance' : 'Amount Due'}
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

                    variant={!isPartialPayment && !isFullyCredit && !isBalancePayment ? 'contained' : 'outlined'}

                    size="small"

                    onClick={() => {
                      setIsPartialPayment(false)
                      setIsFullyCredit(false)
                      setIsBalancePayment(false) // ✅ Reset balance payment flag
                      setPaymentAmount('')
                      setCreditAmount('')
                      // Reset payment method to default (CASH)
                      setPaymentMethod('CASH')
                      console.log('[POS] Full payment selected, payment method reset to CASH')
                      handleSettlementPaymentType('full')
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
                      setIsBalancePayment(false) // ✅ Reset balance payment flag

                      // Initialize partial payment amounts
                      if (!paymentAmount || paymentAmount === '') {
                        setPaymentAmount('')
                        console.log('[POS] Set payment amount to empty string')
                      }
                      if (!creditAmount || creditAmount === '') {
                        setCreditAmount(total.toFixed(2))
                        console.log('[POS] Set credit amount to total:', total.toFixed(2))
                      }

                      // Switch settlement panel into partial mode when outstanding payments exist
                      if (selectedOutstandingPayments.length > 0) {
                        handleSettlementPaymentType('partial')
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
                      setIsBalancePayment(false) // ✅ Reset balance payment flag
                      // Set full amount as credit
                      setPaymentAmount('')
                      setCreditAmount(total.toString())
                      // Keep the current payment method (CASH, CARD, etc.) - don't change it to FULLY_CREDIT
                      console.log('[POS] Fully credit selected, keeping current payment method:', paymentMethod)
                      handleSettlementPaymentType('fullyCredit')
                    }}

                    sx={{ fontFamily: 'monospace', flex: 1 }}

                  >

                    Fully Credit

                  </Button>

                  <Button

                    variant={isBalancePayment ? 'contained' : 'outlined'}

                    size="small"

                    disabled={outstandingTotal >= 0}

                    onClick={() => {
                      console.log('[POS] Balance payment selected')
                      console.log('[POS] Outstanding balance:', outstandingTotal)
                      console.log('[POS] Total with outstanding:', total)
                      console.log('[POS] Bill amount (cart only):', billAmount)
                      
                      setIsPartialPayment(false)
                      setIsFullyCredit(false)
                      setIsBalancePayment(true) // ✅ Set balance payment flag
                      
                      // Use customer's available credit (outstandingTotal is negative, so use absolute value)
                      const availableCredit = Math.abs(outstandingTotal) // e.g., 1000
                      
                      // The total includes the outstanding balance already
                      // When customer uses balance payment, payment amount = 0, credit = uses from balance
                      // The remaining balance after purchase = outstandingTotal + billAmount
                      
                      // Payment: 0 (using balance)
                      // Credit: This purchase amount (will be subtracted from balance)
                      setPaymentAmount('0')
                      setCreditAmount(billAmount.toString()) // Use billAmount, not total (total already includes outstanding)
                      
                      console.log('[POS] Balance payment - Customer has', availableCredit, 'credit, using', billAmount, 'for this purchase')
                      console.log('[POS] Balance payment activated')
                      handleSettlementPaymentType('balance')
                    }}

                    sx={{ fontFamily: 'monospace', flex: 1 }}

                  >

                    Balance

                  </Button>

                </Box>

              </Box>



              {/* Balance Payment Details */}
              {isBalancePayment && (
                <Box sx={{ mb: 2, p: 3, bgcolor: alpha(theme.palette.success.main, 0.15), borderRadius: 2, border: '2px solid', borderColor: 'success.main' }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'success.main', fontWeight: 'bold' }}>
                    💰 Using Balance Payment
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Current Purchase Amount
                    </Typography>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                      {parseFloat(billAmount).toFixed(2)}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Available Credit Balance
                    </Typography>
                    <Typography variant="h6" color="success.main" fontWeight="bold">
                      {Math.abs(outstandingTotal).toFixed(2)}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Remaining Balance After This Purchase
                    </Typography>
                    <Typography variant="h6" color={outstandingTotal + billAmount < 0 ? 'error.main' : 'success.main'} fontWeight="bold">
                      {(outstandingTotal + billAmount).toFixed(2)}
                    </Typography>
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    Payment Amount: 0 (using balance) | Credit: {parseFloat(billAmount).toFixed(2)}
                  </Typography>
                </Box>
              )}

  {/* Settlement Payment Section - Show when only outstanding payments (no cart items) */}
{currentCart.length === 0 && selectedOutstandingPayments.length > 0 && showSettlementOptions && (
  <Box sx={{ mb: 2, p: 3, bgcolor: alpha(theme.palette.info.main, 0.15), borderRadius: 2, border: '2px solid', borderColor: 'info.main' }}>
    <Typography variant="h6" sx={{ mb: 2, color: 'info.main', fontWeight: 'bold' }}>
      {settlementSnapshot.isCredit ? '💰 Customer Credit Refund' : '💰 Settlement Payment'}
    </Typography>
                  
    {/* Settlement Total */}
    <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {settlementSnapshot.isCredit ? 'Available Credit Balance' : 'Total Outstanding Amount'}
      </Typography>
      <Typography variant="h5" color={settlementSnapshot.isCredit ? 'success.main' : 'warning.main'} fontWeight="bold">
        {settlementSnapshot.isCredit 
          ? `-${Math.abs(settlementSnapshot.baseOutstanding).toFixed(2)}` 
          : `${settlementSnapshot.baseOutstanding.toFixed(2)}`
        }
      </Typography>
      {settlementSnapshot.isCredit && (
        <Typography variant="caption" color="success.dark">
          Customer will receive cash back when refunded
        </Typography>
      )}
    </Box>

    {/* Settlement Payment Type Selection */}
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontFamily: 'monospace', fontWeight: 'bold' }}>
        {settlementSnapshot.isCredit ? 'Refund Options:' : 'Settlement Type:'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant={!isSettlementPartial && !isSettlementFullyCredit ? 'contained' : 'outlined'}
          size="small"
          onClick={() => handleSettlementPaymentType('full')}
          sx={{ fontFamily: 'monospace' }}
          color={settlementSnapshot.isCredit ? "success" : "primary"}
        >
          {settlementSnapshot.isCredit ? 'Full Refund' : 'Full Settlement'}
        </Button>
        <Button
          variant={isSettlementPartial ? 'contained' : 'outlined'}
          size="small"
          onClick={() => handleSettlementPaymentType('partial')}
          sx={{ fontFamily: 'monospace' }}
          title={settlementSnapshot.isCredit ? 'Partial credit refund' : 'Partial settlement'}
        >
          {settlementSnapshot.isCredit ? 'Partial Refund' : 'Partial Settlement'}
        </Button>
        <Button
          variant={isSettlementFullyCredit ? 'contained' : 'outlined'}
          size="small"
          onClick={() => handleSettlementPaymentType('fullyCredit')}
          disabled={settlementSnapshot.isCredit}
          sx={{ fontFamily: 'monospace' }}
          title={settlementSnapshot.isCredit ? 'Cannot create credit note when customer already has credit' : ''}
        >
          Credit Note
        </Button>
      </Box>
    </Box>

    {/* Settlement Payment Amounts */}
    {(isSettlementPartial || isSettlementFullyCredit) && (
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label={isSettlementFullyCredit ? "Payment Amount" : (settlementSnapshot.isCredit ? "Refund Amount" : "Payment Amount (Paid Now)")}
          value={settlementPaymentAmount}
          onChange={(e) => handleSettlementPaymentChange(e.target.value)}
          sx={{ mb: 1 }}
          type="number"
          inputProps={{ min: 0, step: 0.01 }}
        />
        
        <TextField
          fullWidth
          size="small"
          label={isSettlementFullyCredit ? "Credit Note Amount" : (settlementSnapshot.isCredit ? "Remaining Credit" : "Remaining Balance")}
          value={isSettlementFullyCredit ? settlementCreditAmount : settlementBalanceValue.toFixed(2)}
          disabled={!isSettlementFullyCredit}
          onChange={(e) => handleSettlementCreditChange(e.target.value)}
          sx={{ mb: 1 }}
        />
        
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'info.main' }}>
            {settlementSnapshot.isCredit 
              ? `💰 Credit Before: ${Math.abs(settlementBaseAmount).toFixed(2)} | 💵 Refund: ${settlementPaymentValue.toFixed(2)} | 🧾 Remaining Credit: ${Math.abs(settlementBalanceValue).toFixed(2)}`
              : `💰 Outstanding Before: ${settlementBaseAmount.toFixed(2)} | 💵 Paid: ${settlementPaymentValue.toFixed(2)} | 🧾 Balance After: ${settlementBalanceValue.toFixed(2)}`
            }
          </Typography>
        </Box>
      </Box>
    )}

    {/* Settlement Summary */}
    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
        {settlementSnapshot.isCredit 
          ? `Refund Amount: ${Math.abs(settlementSnapshot.paymentAmount).toFixed(2)}`
          : `Final Settlement Amount: ${settlementSnapshot.paymentAmount.toFixed(2)}`
        }
      </Typography>
      <Typography variant="caption" sx={{ color: 'success.dark' }}>
        {settlementSnapshot.isCredit
          ? `Remaining Credit After: ${(settlementSnapshot.baseOutstanding + settlementSnapshot.paymentAmount).toFixed(2)}`
          : `Balance After Settlement: ${settlementSnapshot.creditAmount.toFixed(2)}`
        }
      </Typography>
    </Box>
  </Box>
)}  

              {/* Payment Fields */}
              {(isPartialPayment || isFullyCredit) && !(currentCart.length === 0 && showSettlementOptions) && (
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
                      inputProps={{ min: 0, step: 0.01 }}
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
                {Math.abs(outstandingTotal) > 0.01 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: outstandingTotal < 0 ? 'info.main' : 'warning.main' }}>
                      {outstandingTotal < 0 ? 'Customer Credit:' : 'Outstanding Payments:'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: outstandingTotal < 0 ? 'success.main' : 'warning.main', fontWeight: 'bold' }}>
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
      (currentCart.length === 0 && selectedOutstandingPayments.length === 0)
    }
    sx={{ fontFamily: 'monospace', py: 1, flex: 1 }}
  >
    {isProcessingSaleOnly ? 'PROCESSING...' : (currentCart.length === 0 && selectedOutstandingPayments.length > 0
      ? 'SETTLE'
      : 'COMPLETE SALE'
    )}
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
                           const selectedOutstandingTotal = outstandingPayments
                             .filter(payment => selectedOutstandingPayments.includes(payment.id))
                             .reduce((sum, payment) => {
                               const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
                                 ? parseFloat(payment.creditAmount)
                                 : (payment.total !== undefined && payment.total !== null
                                   ? parseFloat(payment.total)
                                   : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
                               return sum + (Number.isFinite(amount) ? amount : 0)
                             }, 0)

                           const totalWithOutstanding = billAmount + selectedOutstandingTotal
                           let previewPaymentAmount = 0
                           let previewCreditAmount = 0

                           if (isFullyCredit || isBalancePayment) {
                             previewPaymentAmount = 0
                             previewCreditAmount = totalWithOutstanding
                           } else if (isPartialPayment) {
                             previewPaymentAmount = parseFloat(paymentAmount) || 0
                             previewCreditAmount = totalWithOutstanding - previewPaymentAmount
                           } else {
                             // full payment
                             previewPaymentAmount = totalWithOutstanding
                             previewCreditAmount = 0
                           }

                           setShowPrinterDialog(false)
                           setSelectedLayout('thermal')
                           setPrintData({
                             type: 'receipt',
                             title: 'SALES RECEIPT',
                             companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
                             companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
                             companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
                             companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
                             logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
                             receiptNumber: `TEST-${Date.now()}`,
                             date: new Date().toLocaleDateString(),
                             time: new Date().toLocaleTimeString(),
                             cashierName: user?.name || user?.username || 'Cashier',
                             customerName: customerName || 'Walk-in Customer',
                             customerPhone: customerPhone || '',
                             items: currentCart.map(normalizeCartItemForPrint),
                             subtotal: subtotal,
                             tax: tax,
                             discount: totalDiscount,
                             invoiceTotal: billAmount,
                             oldBalance: selectedOutstandingTotal,
                             total: totalWithOutstanding,
                             paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
                             paymentAmount: previewPaymentAmount,
                             creditAmount: previewCreditAmount,
                             remainingBalance: Math.max(0, totalWithOutstanding - previewPaymentAmount),
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
                           const selectedOutstandingTotal = outstandingPayments
                             .filter(payment => selectedOutstandingPayments.includes(payment.id))
                             .reduce((sum, payment) => {
                               const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
                                 ? parseFloat(payment.creditAmount)
                                 : (payment.total !== undefined && payment.total !== null
                                   ? parseFloat(payment.total)
                                   : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
                               return sum + (Number.isFinite(amount) ? amount : 0)
                             }, 0)

                           const totalWithOutstanding = billAmount + selectedOutstandingTotal
                           let previewPaymentAmount = 0
                           let previewCreditAmount = 0

                           if (isFullyCredit || isBalancePayment) {
                             previewPaymentAmount = 0
                             previewCreditAmount = totalWithOutstanding
                           } else if (isPartialPayment) {
                             previewPaymentAmount = parseFloat(paymentAmount) || 0
                             previewCreditAmount = totalWithOutstanding - previewPaymentAmount
                           } else {
                             previewPaymentAmount = totalWithOutstanding
                             previewCreditAmount = 0
                           }

                           setShowPrinterDialog(false)
                           setSelectedLayout('color')
                           setPrintData({
                             type: 'receipt',
                             title: 'SALES RECEIPT',
                             companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
                             companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
                             companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
                             companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
                             logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
                             receiptNumber: `TEST-${Date.now()}`,
                             date: new Date().toLocaleDateString(),
                             time: new Date().toLocaleTimeString(),
                             cashierName: user?.name || user?.username || 'Cashier',
                             customerName: customerName || 'Walk-in Customer',
                             customerPhone: customerPhone || '',
                             items: currentCart.map(normalizeCartItemForPrint),
                             subtotal: subtotal,
                             tax: tax,
                             discount: totalDiscount,
                             invoiceTotal: billAmount,
                             oldBalance: selectedOutstandingTotal,
                             total: totalWithOutstanding,
                             paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
                             paymentAmount: previewPaymentAmount,
                             creditAmount: previewCreditAmount,
                             remainingBalance: Math.max(0, totalWithOutstanding - previewPaymentAmount),
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

          {/* Toast notifications */}
          <Snackbar
            open={toast.open}
            autoHideDuration={4000}
            onClose={handleToastClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              onClose={handleToastClose}
              severity={toast.severity || 'info'}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {toast.message}
            </Alert>
          </Snackbar>
          {/* ── Sale Confirmation Dialog ── */}
<Dialog
  open={saleConfirmDialog}
  onClose={() => {
    setSaleConfirmDialog(false)
    setPendingSaleData(null)
  }}
  maxWidth="sm"
  fullWidth
  sx={{ zIndex: 1400 }}
>
  <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CheckIcon />
      <Typography variant="h6">Confirm Sale</Typography>
    </Box>
  </DialogTitle>
  <DialogContent sx={{ mt: 2 }}>
    {pendingSaleData && (
      <Box>
        {pendingSaleData.type === 'settlement-only' ? (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Outstanding Payment Settlement
            </Alert>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Customer:</Typography>
                <Typography variant="body2" fontWeight="bold">{pendingSaleData.customerName}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Phone:</Typography>
                <Typography variant="body2">{pendingSaleData.customerPhone}</Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Total Outstanding:</Typography>
                <Typography variant="body2" fontWeight="bold" color="warning.main">
                  {pendingSaleData.baseOutstanding.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Payment Amount:</Typography>
                <Typography variant="body2" fontWeight="bold" color="success.main">
                  {pendingSaleData.settlementPaymentValue.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Balance After:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {pendingSaleData.settlementCreditValue.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Payment Method:</Typography>
                <Typography variant="body2">{pendingSaleData.paymentMethod}</Typography>
              </Box>
            </Box>
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Review the sale details before confirming. The sale will be created in the system once you confirm.
            </Alert>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Customer:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {pendingSaleData.saleData.customerInfo.name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Phone:</Typography>
                <Typography variant="body2">{pendingSaleData.saleData.customerInfo.phone || 'N/A'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Items:</Typography>
                <Typography variant="body2">{pendingSaleData.saleData.items.length} item(s)</Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                <Typography variant="body2">{pendingSaleData.saleData.subtotal.toFixed(2)}</Typography>
              </Box>
              {pendingSaleData.saleData.tax > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Tax:</Typography>
                  <Typography variant="body2">{pendingSaleData.saleData.tax.toFixed(2)}</Typography>
                </Box>
              )}
              {pendingSaleData.saleData.discount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Discount:</Typography>
                  <Typography variant="body2" color="error.main">-{pendingSaleData.saleData.discount.toFixed(2)}</Typography>
                </Box>
              )}
              {Math.abs(pendingSaleData.selectedOutstandingTotal) > 0.01 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Outstanding:</Typography>
                  <Typography variant="body2" color="warning.main">
                    {pendingSaleData.selectedOutstandingTotal.toFixed(2)}
                  </Typography>
                </Box>
              )}
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1" fontWeight="bold">Total:</Typography>
                <Typography variant="body1" fontWeight="bold" color="primary.main">
                  {pendingSaleData.totalWithOutstanding.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Payment:</Typography>
                <Typography variant="body2">{pendingSaleData.saleData.paymentMethod}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Amount Paid:</Typography>
                <Typography variant="body2" color="success.main">
                  {pendingSaleData.finalPaymentAmount.toFixed(2)}
                </Typography>
              </Box>
              {pendingSaleData.finalCreditAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Credit/Remaining:</Typography>
                  <Typography variant="body2" color="warning.main">
                    {pendingSaleData.finalCreditAmount.toFixed(2)}
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>
    )}
  </DialogContent>
  <DialogActions sx={{ p: 2, gap: 1 }}>
    <Button
      variant="outlined"
      color="error"
      onClick={() => {
        setSaleConfirmDialog(false)
        setPendingSaleData(null)
      }}
    >
      Cancel
    </Button>
    <Button
      variant="contained"
      color="primary"
      startIcon={isProcessingSaleOnly ? <CircularProgress size={18} color="inherit" /> : <CheckIcon />}
      onClick={handleCompleteSale}
      disabled={isProcessingSaleOnly}
    >
      {isProcessingSaleOnly ? 'Creating Sale...' : 'Confirm & Create Sale'}
    </Button>
  </DialogActions>
</Dialog>

{/* ── Post-Sale: Print or Skip Dialog ── */}
<Dialog
  open={postSaleDialog}
  onClose={() => {
    setPostSaleDialog(false)
    setCompletedSaleData(null)
  }}
  maxWidth="sm"
  fullWidth
  sx={{ zIndex: 1400 }}
>
  <DialogTitle sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CheckIcon />
      <Typography variant="h6">
        {completedSaleData?.isSettlement ? 'Settlement Complete!' : 'Sale Created!'}
      </Typography>
    </Box>
  </DialogTitle>
  <DialogContent sx={{ mt: 2 }}>
    <Typography variant="body1" gutterBottom align="center">
      {completedSaleData?.isSettlement
        ? `Settlement recorded. Invoice: ${completedSaleData?.sale?.invoice_no || 'N/A'}`
        : `Sale saved. Invoice: ${completedSaleData?.sale?.invoice_no || 'N/A'}`
      }
    </Typography>
    
    <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
      Would you like to print the receipt?
    </Typography>

    {/* Printer Options */}
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'primary.main' }}>
        Select Print Option:
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<PrintIcon />}
          color="primary"
          sx={{ py: 1.5, fontSize: '1rem', width: '100%' }}
          onClick={() => {
            setPostSaleDialog(false)
            if (completedSaleData?.printData) {
              setPrintData(completedSaleData.printData)
              setSelectedLayout('thermal')
              setShowPrintDialog(true)
            }
            setCompletedSaleData(null)
            if (barcodeInputRef.current) barcodeInputRef.current.focus()
          }}
        >
          Thermal Receipt (80mm)
        </Button>

        <Button
          variant="outlined"
          size="large"
          startIcon={<PrintIcon />}
          color="secondary"
          sx={{ py: 1.5, fontSize: '1rem', width: '100%' }}
          onClick={() => {
            setPostSaleDialog(false)
            if (completedSaleData?.printData) {
              setPrintData(completedSaleData.printData)
              setSelectedLayout('color')
              setShowPrintDialog(true)
            }
            setCompletedSaleData(null)
            if (barcodeInputRef.current) barcodeInputRef.current.focus()
          }}
        >
          Color Receipt (A4/Letter)
        </Button>

        <Button
          variant="outlined"
          size="large"
          startIcon={<PrintIcon />}
          color="info"
          sx={{ py: 1.5, fontSize: '1rem', width: '100%' }}
          onClick={async () => {
            setPostSaleDialog(false)
            if (completedSaleData?.printData) {
              try {
                const { success, message, usedBrowserFallback } = await attemptReceiptPrint(
                  completedSaleData.printData, 
                  'Post-sale receipt'
                )
                
                if (success) {
                  if (usedBrowserFallback) {
                    alert('✅ Receipt opened in browser print dialog!')
                  } else {
                    alert('✅ Receipt printed successfully!')
                  }
                } else {
                  alert(`❌ Print failed: ${message || 'Unknown error'}`)
                }
              } catch (error) {
                alert(`❌ Print failed: ${error.message}`)
              }
            }
            setCompletedSaleData(null)
            if (barcodeInputRef.current) barcodeInputRef.current.focus()
          }}
        >
          Direct Print (Auto-detect)
        </Button>
      </Box>
    </Box>

    {/* Printer Status Check */}
    <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
      <Button
        size="small"
        variant="text"
        startIcon={<PrintIcon />}
        onClick={async () => {
          const status = await checkPrinterStatus()
          alert(`Printer Status:\n\n${status.message}\n\n${status.hasSerialPorts ? 
            `✅ Found ${status.portCount} serial port(s)` : 
            '❌ No serial printers detected\n\nTry using Thermal Receipt or Browser Print option.'}`
          )
        }}
        sx={{ width: '100%' }}
      >
        Check Printer Status
      </Button>
    </Box>

    {/* Skip Option */}
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Button
        variant="text"
        color="inherit"
        onClick={() => {
          setPostSaleDialog(false)
          setCompletedSaleData(null)
          if (barcodeInputRef.current) barcodeInputRef.current.focus()
        }}
      >
        Skip Printing
      </Button>
    </Box>
  </DialogContent>
</Dialog>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}
export default POSTerminal

