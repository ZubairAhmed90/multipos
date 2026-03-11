'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../utils/axios'
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
  ListItemSecondaryAction,
  Autocomplete,
  Popper
} from '@mui/material'
import {
  QrCodeScanner as ScannerIcon,
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
  Inventory as InventoryIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material'
import PrintDialog from '../../components/print/PrintDialog'
import DashboardLayout from '../../components/layout/DashboardLayout'
import RouteGuard from '../../components/auth/RouteGuard'
import PhysicalScanner from '../../components/pos/PhysicalScanner'
import { fetchInventory } from '../store/slices/inventorySlice'
import { createWarehouseSale, fetchSales } from '../store/slices/salesSlice'
import { fetchRetailers } from '../store/slices/retailersSlice'

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
  selectedRetailer: null,
  paymentMethod: '',
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
  saleDate: '',
  ...overrides
})

// ─── Inline Row Component ────────────────────────────────────────────────────
function OrderRow({ item, index, inventoryItems, onUpdate, onRemove, onAddRow, isLast, autoFocusItem }) {
  const theme = useTheme()
  const [itemSearch, setItemSearch] = useState(item.name || '')
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const itemInputRef = useRef(null)
  const qtyInputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (autoFocusItem && itemInputRef.current) {
      setTimeout(() => itemInputRef.current?.focus(), 50)
    }
  }, [autoFocusItem])

  // Reset highlight when dropdown opens or results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [open, itemSearch])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[data-dropdown-item]')
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  const filteredProducts = useMemo(() => {
    if (!itemSearch || itemSearch.length < 1) return []
    const q = itemSearch.toLowerCase()
    return inventoryItems
      .filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
      .slice(0, 12)
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.sellingPrice,
        stock: p.currentStock,
        category: p.category,
        sku: p.sku,
        barcode: p.barcode,
        unit: p.unit
      }))
  }, [itemSearch, inventoryItems])

  const handleSelectProduct = (product) => {
    if (!product) return
    onUpdate(index, {
      ...product,
      quantity: 1,
      discount: 0,
      customPrice: product.price
    })
    setItemSearch(product.name)
    setOpen(false)
    setHighlightedIndex(-1)
    setTimeout(() => qtyInputRef.current?.focus(), 50)
  }

  const unitPrice = parseFloat(
    item.customPrice !== null && item.customPrice !== undefined
      ? item.customPrice
      : item.price || 0
  )
  const qty = parseFloat(item.quantity || 0)
  const disc = parseFloat(item.discount || 0)
  const lineTotal = Math.max(0, unitPrice * qty - disc)

  const cellSx = {
    py: 0.75,
    px: 1,
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    verticalAlign: 'middle'
  }

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      height: 48,
      fontSize: '0.95rem',
      fontFamily: 'monospace'
    },
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' }
  }

  return (
    <TableRow
      sx={{
        bgcolor: index % 2 === 0 ? 'transparent' : alpha(theme.palette.primary.main, 0.02),
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
        transition: 'background 0.15s'
      }}
    >
      {/* Checkbox */}
      <TableCell sx={{ ...cellSx, width: 40, px: 0.5 }}>
        <Typography variant="body2" sx={{ color: 'text.disabled', fontFamily: 'monospace', textAlign: 'center', fontSize: '0.8rem' }}>
          {index + 1}
        </Typography>
      </TableCell>

      {/* Item — searchable autocomplete */}
      <TableCell sx={{ ...cellSx, width: '42%' }}>
        <Box sx={{ position: 'relative' }}>
          <TextField
            inputRef={itemInputRef}
            fullWidth
            size="small"
            placeholder="Search item by name, SKU, barcode..."
            value={item.id ? item.name : itemSearch}
            onChange={(e) => {
              setItemSearch(e.target.value)
              if (item.id) {
                onUpdate(index, { id: null, name: '', price: 0, quantity: 1, discount: 0, customPrice: 0 })
              }
              setOpen(true)
            }}
            onFocus={() => { if (!item.id) setOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                setHighlightedIndex(-1)
                return
              }
              if (e.key === 'Tab' && item.id) {
                setOpen(false)
                return
              }
              if (!open || filteredProducts.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev + 1) % filteredProducts.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev <= 0 ? filteredProducts.length - 1 : prev - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (highlightedIndex >= 0 && filteredProducts[highlightedIndex]) {
                  handleSelectProduct(filteredProducts[highlightedIndex])
                }
              }
            }}
            sx={{
              ...inputSx,
              '& .MuiOutlinedInput-root': {
                ...inputSx['& .MuiOutlinedInput-root'],
                bgcolor: item.id ? alpha(theme.palette.success.main, 0.04) : 'background.paper',
                borderColor: item.id ? theme.palette.success.main : undefined
              }
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} />
            }}
          />
          {/* Dropdown */}
          {open && filteredProducts.length > 0 && (
            <Paper
              ref={dropdownRef}
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1400,
                maxHeight: 320,
                overflowY: 'auto',
                boxShadow: 6,
                border: `1px solid ${theme.palette.primary.main}`,
                borderTop: 'none',
                borderRadius: '0 0 8px 8px'
              }}
            >
              {filteredProducts.map((product, pi) => (
                <Box
                  key={product.id}
                  data-dropdown-item
                  onMouseDown={(e) => { e.preventDefault(); handleSelectProduct(product) }}
                  onMouseEnter={() => setHighlightedIndex(pi)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: pi === highlightedIndex ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SKU: {product.sku || '—'} &nbsp;|&nbsp; Stock: {product.stock}{product.unit && product.unit !== '0' ? ` ${product.unit}` : ''}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${product.price}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 60 }}
                  />
                </Box>
              ))}
            </Paper>
          )}
          {open && itemSearch.length >= 2 && filteredProducts.length === 0 && (
            <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1400, p: 2, boxShadow: 4, borderRadius: '0 0 8px 8px' }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                No products found for &quot;{itemSearch}&quot;
              </Typography>
            </Paper>
          )}
        </Box>
      </TableCell>

      {/* Unit Price */}
      <TableCell sx={{ ...cellSx, width: '13%' }}>
        <TextField
          fullWidth
          size="small"
          type="number"
          value={item.id ? parseFloat(item.customPrice ?? item.price ?? 0).toFixed(0) : ''}
          placeholder="—"
          disabled={!item.id}
          onChange={(e) => onUpdate(index, { customPrice: parseFloat(e.target.value) || 0 })}
          inputProps={{ min: 0, step: 1, style: { textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' } }}
          sx={{
            ...inputSx,
            '& .MuiOutlinedInput-root': {
              ...inputSx['& .MuiOutlinedInput-root'],
              bgcolor: item.customPrice !== undefined && item.customPrice !== null && item.customPrice !== item.price
                ? '#fff8e1' : 'transparent'
            }
          }}
        />
      </TableCell>

      {/* Qty */}
      <TableCell sx={{ ...cellSx, width: '10%' }}>
        <TextField
          inputRef={qtyInputRef}
          fullWidth
          size="small"
          type="number"
          value={item.id ? (item.quantity ?? 1) : ''}
          placeholder="—"
          disabled={!item.id}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onUpdate(index, { quantity: isNaN(v) || v < 0 ? 0 : v })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && item.id) {
              if (isLast) onAddRow()
              else {
                const rows = document.querySelectorAll('[data-row-item]')
                if (rows[index + 1]) rows[index + 1].focus()
              }
            }
          }}
          inputProps={{ min: 0.01, step: 1, style: { textAlign: 'center', fontFamily: 'monospace', fontSize: '0.95rem' } }}
          sx={inputSx}
        />
      </TableCell>

      {/* Discount */}
      <TableCell sx={{ ...cellSx, width: '12%' }}>
        <TextField
          fullWidth
          size="small"
          type="number"
          value={item.id ? (item.discount ?? 0) : ''}
          placeholder="—"
          disabled={!item.id}
          onChange={(e) => onUpdate(index, { discount: parseFloat(e.target.value) || 0 })}
          inputProps={{ min: 0, step: 1, style: { textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem', color: '#d32f2f' } }}
          sx={inputSx}
        />
      </TableCell>

      {/* Final Total */}
      <TableCell sx={{ ...cellSx, width: '13%', textAlign: 'right' }}>
        <Typography
          variant="body1"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '1rem',
            color: item.id ? 'text.primary' : 'text.disabled',
            pr: 1
          }}
        >
          {item.id ? Math.round(lineTotal).toLocaleString() : '—'}
        </Typography>
      </TableCell>

      {/* + / Delete */}
      <TableCell sx={{ ...cellSx, width: 56, textAlign: 'center' }}>
        {item.id ? (
          <IconButton
            size="small"
            color="error"
            onClick={() => onRemove(index)}
            sx={{
              bgcolor: alpha(theme.palette.error.main, 0.08),
              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.18) },
              width: 36, height: 36
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ) : (
          <IconButton
            size="small"
            color="primary"
            onClick={onAddRow}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.18) },
              width: 36, height: 36
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function WarehouseBillingPage() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const router = useRouter()

  const { user: originalUser } = useSelector((state) => state.auth)
  const [saleConfirmDialog, setSaleConfirmDialog] = useState(false)
  const [completedSaleData, setCompletedSaleData] = useState(null)

  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)

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

  const getEffectiveUser = useCallback((originalUser) => {
    if (!isAdminMode || !urlParams.role) return originalUser
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

  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.role) return null
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
  const {
    data: retailers = [],
    loading: retailersLoading = false,
    error: retailersError = null
  } = useSelector((state) => state.retailers || { data: [], loading: false, error: null })

  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity })
  }, [])
  const handleToastClose = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [tabCounter, setTabCounter] = useState(1)

  // ── All existing state ──────────────────────────────────────────────────────
  const [barcodeInput, setBarcodeInput] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedRetailer, setSelectedRetailer] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [isPartialPayment, setIsPartialPayment] = useState(false)
  const [isFullyCredit, setIsFullyCredit] = useState(false)
  const [isBalancePayment, setIsBalancePayment] = useState(false)
  const [selectedSalesperson, setSelectedSalesperson] = useState(null)
  const [salespeople, setSalespeople] = useState([])
  const [retailerSearchResults, setRetailerSearchResults] = useState([])
  const [showRetailerSearch, setShowRetailerSearch] = useState(false)
  const [retailerHighlightedIndex, setRetailerHighlightedIndex] = useState(-1)
  const retailerDropdownRef = useRef(null)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showPhysicalScanner, setShowPhysicalScanner] = useState(false)
  const [taxRate, setTaxRate] = useState(0)
  const [totalDiscount, setTotalDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [showPrinterDialog, setShowPrinterDialog] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  const retailerDisplayName = useMemo(() => {
    if (selectedRetailer?.name) return selectedRetailer.name
    return (customerName || '').trim() || 'Walk-in Retailer'
  }, [customerName, selectedRetailer])

  const retailerDisplayPhone = useMemo(() => {
    if (selectedRetailer?.phone) return selectedRetailer.phone
    return (customerPhone || '').trim()
  }, [customerPhone, selectedRetailer])

  const [isProcessingSale, setIsProcessingSale] = useState(false)
  const [isProcessingSaleOnly, setIsProcessingSaleOnly] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [selectedLayout, setSelectedLayout] = useState('color')
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [scannerStatus, setScannerStatus] = useState({ connected: false, lastScan: null, scanCount: 0, errors: [] })
  const [outstandingPayments, setOutstandingPayments] = useState([])
  const [selectedOutstandingPayments, setSelectedOutstandingPayments] = useState([])
  const [isSearchingOutstanding, setIsSearchingOutstanding] = useState(false)
  const [settlementPaymentAmount, setSettlementPaymentAmount] = useState('')
  const [settlementCreditAmount, setSettlementCreditAmount] = useState('')
  const [isSettlementPartial, setIsSettlementPartial] = useState(false)
  const [isSettlementFullyCredit, setIsSettlementFullyCredit] = useState(false)
  const [showSettlementOptions, setShowSettlementOptions] = useState(false)
  const [companyInfo, setCompanyInfo] = useState(() => ({ ...DEFAULT_COMPANY_INFO }))

  // track which row should autofocus
  const [newRowIndex, setNewRowIndex] = useState(null)

  const barcodeInputRef = useRef(null)
  const manualInputRef = useRef(null)
  const lastScanTimeRef = useRef(0)
  const hydratingTabIdRef = useRef(null)
  const isCompletingSaleRef = useRef(false)

  // ── Retailer fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const fetchParams = {}
    if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
      fetchParams.warehouseId = user.warehouseId
    } else if (scopeInfo?.scopeType === 'WAREHOUSE' && scopeInfo.scopeId) {
      fetchParams.warehouseId = scopeInfo.scopeId
    } else if (urlParams?.scope === 'warehouse' && urlParams.id) {
      fetchParams.warehouseId = urlParams.id
    }
    dispatch(fetchRetailers(fetchParams))
  }, [dispatch, scopeInfo, urlParams, user])

  useEffect(() => {
    if (retailersError) console.error('[WAREHOUSE] Failed to load retailers:', retailersError)
  }, [retailersError])

  // ── Tab helpers ─────────────────────────────────────────────────────────────
  const currentTab = useMemo(() => tabs.find(tab => tab.id === activeTabId) || null, [tabs, activeTabId])
  const currentCart = useMemo(() => currentTab?.cart || [], [currentTab])

  // ── STEP 1: Define updateCurrentTabCart FIRST before anything uses it ───────
  const updateCurrentTabCart = useCallback((newCart) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId ? { ...tab, cart: newCart, modifiedAt: new Date() } : tab
    ))
  }, [activeTabId])

  // ── STEP 2: Define updateCurrentTab ─────────────────────────────────────────
  const updateCurrentTab = useCallback((updates) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId ? { ...tab, ...updates, modifiedAt: new Date() } : tab
    ))
  }, [activeTabId])

  // ── STEP 3: Now define everything that uses updateCurrentTabCart ─────────────

  const cartWithPlaceholder = useMemo(() => {
    const hasEmptyRow = currentCart.length === 0 || currentCart[currentCart.length - 1]?.id
    return hasEmptyRow
      ? [...currentCart, { id: null, name: '', price: 0, quantity: 1, discount: 0, customPrice: 0 }]
      : currentCart
  }, [currentCart])

  const handleRowUpdate = useCallback((rowIndex, updates) => {
    const actualCart = [...currentCart]
    if (rowIndex >= actualCart.length) {
      if (updates.id) {
        const newItem = { ...updates }
        updateCurrentTabCart([...actualCart, newItem])
        setNewRowIndex(actualCart.length)
      }
    } else {
      const updated = actualCart.map((item, i) => i === rowIndex ? { ...item, ...updates } : item)
      updateCurrentTabCart(updated)
    }
  }, [currentCart, updateCurrentTabCart])

  const handleRowRemove = useCallback((rowIndex) => {
    const newCart = currentCart.filter((_, i) => i !== rowIndex)
    updateCurrentTabCart(newCart)
  }, [currentCart, updateCurrentTabCart])

  const handleAddRow = useCallback(() => {
    setNewRowIndex(currentCart.length)
  }, [currentCart.length])

  // ── addToCart (kept for barcode) ───────────────────────────────────────────
  const addToCart = useCallback((product) => {
    const existingItem = currentCart.find(item => item.id === product.id)
    let newCart
    if (existingItem) {
      newCart = currentCart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      )
    } else {
      newCart = [...currentCart, {
        ...product,
        quantity: 1,
        discount: 0,
        customPrice: product.sellingPrice || product.price
      }]
    }
    updateCurrentTabCart(newCart)
  }, [currentCart, updateCurrentTabCart])

  // ── Build payload ──────────────────────────────────────────────────────────
  const buildWarehouseSalePayload = useCallback(({
    billAmount: inputBillAmount,
    totalWithOutstanding,
    finalPaymentAmount,
    finalCreditAmount,
    finalPaymentStatus,
    paymentMethodValue,
    paymentTypeValue,
    includeOutstandingPayments = false,
    itemsOverride
  }) => {
    const safeNumber = (value, fallback = 0) => {
      const parsed = parseFloat(value)
      return Number.isNaN(parsed) ? fallback : parsed
    }

    const sourceItems = Array.isArray(itemsOverride) ? itemsOverride : currentCart

    const computedSubtotal = sourceItems.reduce((sum, item) => {
      const price = safeNumber(
        item.customPrice !== null && item.customPrice !== undefined
          ? item.customPrice
          : (item.unitPrice !== null && item.unitPrice !== undefined ? item.unitPrice : item.price)
      )
      const quantity = safeNumber(item.quantity)
      const discountValue = safeNumber(item.discount)
      return sum + Math.max(0, (price * quantity) - discountValue)
    }, 0)

    const computedTax = computedSubtotal * (taxRate / 100)
    const computedBillAmount = computedSubtotal + computedTax - totalDiscount
    const normalizedBillAmount = safeNumber(inputBillAmount, computedBillAmount)
    const normalizedTotalWithOutstanding = safeNumber(totalWithOutstanding, normalizedBillAmount)
    const normalizedPaymentAmount = safeNumber(finalPaymentAmount)
    const normalizedCreditAmount = safeNumber(finalCreditAmount)

    const normalizedRetailerId = selectedRetailer?.id !== undefined && selectedRetailer?.id !== null
      ? Number.isNaN(Number(selectedRetailer.id)) ? selectedRetailer.id : Number(selectedRetailer.id)
      : null

    const retailerInfo = selectedRetailer
      ? { id: normalizedRetailerId, name: retailerDisplayName, phone: retailerDisplayPhone }
      : { id: null, name: retailerDisplayName, phone: retailerDisplayPhone }

    const salespersonInfo = selectedSalesperson
      ? { id: selectedSalesperson.id, name: selectedSalesperson.name, phone: selectedSalesperson.phone }
      : null

    const itemsPayload = sourceItems.map(item => {
      const inventoryId = item.id !== undefined && item.id !== null ? parseInt(item.id) : null
      const unitPrice = safeNumber(
        item.customPrice !== null && item.customPrice !== undefined
          ? item.customPrice
          : (item.unitPrice !== null && item.unitPrice !== undefined ? item.unitPrice : item.price)
      )
      const quantity = safeNumber(item.quantity)
      const discountValue = safeNumber(item.discount)
      const lineTotal = safeNumber((unitPrice * quantity) - discountValue)
      return {
        inventoryItemId: inventoryId,
        sku: item.sku || '',
        name: item.name || '',
        quantity,
        unitPrice,
        discount: discountValue,
        total: lineTotal
      }
    })

    const outstandingIds = includeOutstandingPayments
      ? selectedOutstandingPayments.map(id => {
          const parsed = parseInt(id, 10)
          return Number.isNaN(parsed) ? id : parsed
        })
      : []

    const payload = {
      retailerId: retailerInfo.id,
      salespersonId: salespersonInfo?.id,
      salespersonName: salespersonInfo?.name,
      salespersonPhone: salespersonInfo?.phone,
      items: itemsPayload,
      subtotal: safeNumber(computedSubtotal),
      taxAmount: safeNumber(computedTax),
      tax: safeNumber(computedTax),
      discountAmount: safeNumber(totalDiscount),
      discount: safeNumber(totalDiscount),
      billAmount: normalizedBillAmount,
      totalWithOutstanding: normalizedTotalWithOutstanding,
      totalAmount: normalizedBillAmount,
      finalAmount: normalizedTotalWithOutstanding,
      finalTotal: normalizedTotalWithOutstanding,
      paymentMethod: paymentMethodValue,
      paymentType: paymentTypeValue,
      paymentStatus: finalPaymentStatus,
      paymentAmount: normalizedPaymentAmount,
      creditAmount: normalizedCreditAmount,
      notes: notes || '',
      saleDate: saleDate || null,
      customerInfo: { id: retailerInfo.id, name: retailerInfo.name, phone: retailerInfo.phone },
      outstandingPayments: outstandingIds
    }

    return { payload, retailerInfo, salespersonInfo }
  }, [
    currentCart, notes, saleDate, retailerDisplayName, retailerDisplayPhone,
    selectedOutstandingPayments, selectedRetailer, selectedSalesperson, taxRate, totalDiscount
  ])

  const calculateWarehousePaymentDetails = ({
    billAmount, outstandingTotal, isFullyCredit, isPartialPayment, isBalancePayment, inputPaymentAmount
  }) => {
    const safeNumber = (value, fallback = 0) => { const parsed = parseFloat(value); return Number.isNaN(parsed) ? fallback : parsed }
    const normalizedBill = safeNumber(billAmount)
    const normalizedOutstanding = safeNumber(outstandingTotal)
    const rawTotal = normalizedBill + normalizedOutstanding
    const totalForLedger = isBalancePayment ? normalizedBill : rawTotal
    let finalPaymentAmount, finalCreditAmount
    if (isFullyCredit) { finalPaymentAmount = 0; finalCreditAmount = totalForLedger }
    else if (isBalancePayment) { finalPaymentAmount = 0; finalCreditAmount = normalizedBill }
    else if (isPartialPayment) { finalPaymentAmount = safeNumber(inputPaymentAmount); finalCreditAmount = totalForLedger - finalPaymentAmount }
    else { finalPaymentAmount = totalForLedger; finalCreditAmount = 0 }
    const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'
    const paymentTypeValue = isBalancePayment ? 'BALANCE_PAYMENT' : (isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'))
    return { totalWithOutstanding: totalForLedger, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentTypeValue }
  }

  // ── Barcode scan ───────────────────────────────────────────────────────────
  const handleBarcodeScan = useCallback((barcode) => {
    const product = inventoryItems.find(p => {
      const skuMatch = p.sku && p.sku.toString().toLowerCase() === barcode.toLowerCase()
      const barcodeMatch = p.barcode && p.barcode.toString().toLowerCase() === barcode.toLowerCase()
      const nameMatch = p.name && p.name.toLowerCase().includes(barcode.toLowerCase())
      return skuMatch || barcodeMatch || nameMatch
    })
    if (product) {
      const cartProduct = { id: product.id, name: product.name, price: product.sellingPrice, stock: product.currentStock, category: product.category, sku: product.sku, barcode: product.barcode, unit: product.unit }
      addToCart(cartProduct)
      setBarcodeInput('')
      setShowSearchResults(false)
    }
  }, [inventoryItems, addToCart])

  useEffect(() => {
    const handlePhysicalScanner = (event) => {
      const now = Date.now()
      const timeDiff = now - (lastScanTimeRef.current || 0)
      setScannerStatus(prev => ({ ...prev, connected: true, lastScan: now }))
      if (timeDiff < 50 && event.key !== 'Enter') { lastScanTimeRef.current = now; return }
      if (event.key === 'Enter' && barcodeInput.trim().length > 0) {
        event.preventDefault()
        setScannerStatus(prev => ({ ...prev, scanCount: prev.scanCount + 1, lastScan: now }))
        handleBarcodeScan(barcodeInput.trim())
        setBarcodeInput('')
        return
      }
    }
    document.addEventListener('keydown', handlePhysicalScanner)
    return () => document.removeEventListener('keydown', handlePhysicalScanner)
  }, [barcodeInput, handleBarcodeScan])

  // ── Tab management ─────────────────────────────────────────────────────────
  const createNewTab = useCallback(() => {
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
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
    setSettlementPaymentAmount('')
    setSettlementCreditAmount('')
    setIsSettlementPartial(false)
    setIsSettlementFullyCredit(false)
    setShowSettlementOptions(false)
    setCustomerName(newTab.customerName)
    setCustomerPhone(newTab.customerPhone)
    setSelectedRetailer(newTab.selectedRetailer)
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
    setSaleDate(newTab.saleDate || '')
  }, [tabCounter])

  const loadAvailablePrinters = useCallback(async () => {
    try {
      if (navigator.serial) {
        const ports = await navigator.serial.getPorts()
        setAvailablePrinters(ports.map(port => { const info = port.getInfo(); return { id: info.usbVendorId || info.usbProductId || 'unknown', name: `Serial Printer`, type: 'thermal', port, info } }))
      }
      setAvailablePrinters(prev => [...prev, { id: 'default', name: 'Default Printer', type: 'default' }, { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' }, { id: 'browser-print', name: 'Browser Print Dialog', type: 'browser' }])
    } catch (error) {
      setAvailablePrinters([{ id: 'default', name: 'Default Printer', type: 'default' }, { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' }, { id: 'browser-print', name: 'Browser Print Dialog', type: 'browser' }])
    }
  }, [])

  useEffect(() => { if (tabs.length === 0) createNewTab() }, [tabs.length, createNewTab])

  useEffect(() => {
    if (user) {
      const params = { limit: 'all' }
      if (user.role === 'CASHIER') { params.scopeType = 'BRANCH'; if (user.branchId) params.scopeId = user.branchId }
      else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) { params.scopeType = 'WAREHOUSE'; params.scopeId = user.warehouseId }
      dispatch(fetchInventory(params))
    }
    dispatch(fetchSales())
    loadAvailablePrinters()
  }, [dispatch, user, loadAvailablePrinters, isAdminMode])

  // ── Outstanding payments ───────────────────────────────────────────────────
  const searchOutstandingPayments = useCallback(async (phoneNumber, customerName) => {
    if ((!phoneNumber || phoneNumber.trim().length < 3) && (!customerName || customerName.trim().length < 3)) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
      return
    }
    setIsSearchingOutstanding(true)
    try {
      const params = new URLSearchParams()
      if (phoneNumber && phoneNumber.trim().length >= 3) params.append('phone', phoneNumber.trim())
      if (customerName && customerName.trim().length >= 3) params.append('customerName', customerName.trim())
      const response = await api.get(`/sales/outstanding?${params.toString()}`)
      if (response.data.success) {
        const outstandingPayments = response.data.data.map(customer => {
          const actualBalance = customer.creditAmount || customer.finalAmount || customer.totalOutstanding
          return {
            id: `customer_${customer.customerName}_${customer.phone}`,
            invoice_no: customer.isCredit ? `CREDIT_${customer.customerName}` : `OUTSTANDING_${customer.customerName}`,
            customer_name: customer.customerName,
            customer_phone: customer.phone,
            total: actualBalance,
            outstandingAmount: Math.abs(actualBalance),
            paymentStatus: customer.isCredit ? 'CREDIT' : 'PENDING',
            paymentMethod: 'OUTSTANDING',
            creditStatus: customer.isCredit ? 'CREDIT' : 'PENDING',
            creditAmount: actualBalance,
            paymentAmount: 0,
            pendingSalesCount: customer.pendingSalesCount,
            isCredit: customer.isCredit || false,
            created_at: new Date().toISOString()
          }
        })
        setOutstandingPayments(outstandingPayments)
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
        setShowSettlementOptions(false)
        const autoSelectedIds = outstandingPayments.map(payment => payment.id)
        setSelectedOutstandingPayments(autoSelectedIds)
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    } catch (error) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
    } finally {
      setIsSearchingOutstanding(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const retailerPhone = selectedRetailer?.phone?.trim()
      const retailerName = selectedRetailer?.name?.trim()
      if ((retailerPhone && retailerPhone.length >= 3) || (retailerName && retailerName.length >= 3)) {
        searchOutstandingPayments(retailerPhone || '', retailerName || '')
        return
      }
      if ((customerPhone && customerPhone.trim().length >= 3) || (customerName && customerName.trim().length >= 3)) {
        searchOutstandingPayments(customerPhone?.trim(), customerName?.trim())
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [customerPhone, customerName, selectedRetailer, searchOutstandingPayments])

  useEffect(() => {
    if (barcodeInputRef.current && activeTabId) barcodeInputRef.current.focus()
  }, [activeTabId])

  const closeTab = (tabId) => {
    if (tabs.length <= 1) return
    const tabIndex = tabs.findIndex(tab => tab.id === tabId)
    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)
    if (tabId === activeTabId) {
      const newActiveIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex
      setActiveTabId(newTabs[newActiveIndex]?.id)
    }
  }

  const switchToTab = (tabId) => {
    setActiveTabId(tabId)
    setBarcodeInput('')
    setManualInput('')
    setShowSearchResults(false)
  }

  const searchRetailers = useCallback((query) => {
    if (!query || query.length < 2) { setRetailerSearchResults([]); setShowRetailerSearch(false); return }
    const normalizedQuery = query.toLowerCase()
    const matches = retailers.filter(retailer => {
      const nameMatch = retailer.name?.toLowerCase().includes(normalizedQuery)
      const phoneMatch = retailer.phone?.toLowerCase().includes(normalizedQuery)
      const codeMatch = retailer.code?.toString().toLowerCase().includes(normalizedQuery)
      return nameMatch || phoneMatch || codeMatch
    })
    const formattedResults = matches.map(retailer => ({ id: retailer.id, name: retailer.name || 'Walk-in Retailer', phone: retailer.phone || '', address: retailer.address || '', code: retailer.code || '', city: retailer.city || '' }))
    setRetailerSearchResults(formattedResults)
    setShowRetailerSearch(formattedResults.length > 0)
    setRetailerHighlightedIndex(-1)
  }, [retailers])

  const selectRetailer = useCallback((retailer) => {
    if (!retailer) return
    setSelectedRetailer(retailer)
    setCustomerName(retailer.name || '')
    setCustomerPhone(retailer.phone || '')
    setShowRetailerSearch(false)
    setRetailerSearchResults([])
    if (retailer.phone && retailer.phone.trim().length >= 3) searchOutstandingPayments(retailer.phone.trim(), retailer.name?.trim())
    else if (retailer.name && retailer.name.trim().length >= 3) searchOutstandingPayments('', retailer.name.trim())
  }, [searchOutstandingPayments])

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal = useMemo(() => {
    return currentCart.reduce((sum, item) => {
      const itemPrice = parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0)
      const itemDiscount = parseFloat(item.discount || 0)
      const itemTotal = (itemPrice * item.quantity) - itemDiscount
      return sum + Math.max(0, itemTotal)
    }, 0)
  }, [currentCart])

  const tax = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate])

  const settlementTotal = useMemo(() => {
    if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
      return outstandingPayments
        .filter(payment => selectedOutstandingPayments.includes(payment.id))
        .reduce((total, payment) => {
          const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
            ? parseFloat(payment.creditAmount)
            : (payment.total !== undefined && payment.total !== null ? parseFloat(payment.total) : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
          return total + amount
        }, 0)
    }
    return 0
  }, [outstandingPayments, selectedOutstandingPayments, currentCart.length])

  const outstandingTotal = useMemo(() => {
    if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
      if (isSettlementPartial && settlementPaymentAmount && settlementPaymentAmount.trim() !== '') {
        const partialAmount = parseFloat(settlementPaymentAmount) || 0
        const actualPartial = Math.min(partialAmount, Math.abs(settlementTotal))
        return settlementTotal > 0 ? actualPartial : settlementTotal
      } else if (isSettlementFullyCredit) {
        return 0
      } else {
        return settlementTotal
      }
    }
    return outstandingPayments.reduce((total, payment) => {
      const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
        ? parseFloat(payment.creditAmount)
        : (payment.total !== undefined && payment.total !== null ? parseFloat(payment.total) : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
      return total + amount
    }, 0)
  }, [outstandingPayments, selectedOutstandingPayments, currentCart.length, isSettlementPartial, settlementPaymentAmount, isSettlementFullyCredit, settlementTotal])

  const billAmount = useMemo(() => subtotal + tax - totalDiscount, [subtotal, tax, totalDiscount])
  const total = useMemo(() => billAmount + outstandingTotal, [billAmount, outstandingTotal])

  const calculateSettlementValues = useCallback(() => {
    const baseOutstanding = currentCart.length === 0 ? settlementTotal : outstandingTotal
    const isCredit = baseOutstanding < 0
    const parsedPartialAmount = parseFloat(settlementPaymentAmount)
    let paymentValue
    if (isSettlementFullyCredit) { paymentValue = 0 }
    else if (isSettlementPartial) { paymentValue = Number.isNaN(parsedPartialAmount) ? 0 : Math.max(0, parsedPartialAmount) }
    else { paymentValue = isCredit ? Math.abs(baseOutstanding) : Math.max(0, baseOutstanding) }
    if (!Number.isFinite(paymentValue)) paymentValue = 0
    let creditValue
    if (isSettlementFullyCredit) {
      const creditNoteAmount = parseFloat(settlementCreditAmount)
      creditValue = isCredit ? baseOutstanding : (Number.isNaN(creditNoteAmount) ? -Math.abs(baseOutstanding) : -Math.abs(creditNoteAmount))
    } else {
      creditValue = baseOutstanding - (isCredit ? -paymentValue : paymentValue)
    }
    const normalizedPayment = Number.parseFloat(paymentValue.toFixed(2))
    const normalizedCredit = Number.parseFloat(creditValue.toFixed(2))
    return { baseOutstanding, isCredit, paymentAmount: Number.isNaN(normalizedPayment) ? 0 : normalizedPayment, creditAmount: Number.isNaN(normalizedCredit) ? 0 : normalizedCredit }
  }, [currentCart.length, settlementTotal, outstandingTotal, isSettlementFullyCredit, isSettlementPartial, settlementPaymentAmount, settlementCreditAmount])

  const settlementSnapshot = useMemo(() => calculateSettlementValues(), [calculateSettlementValues])
  const settlementPaymentValue = settlementSnapshot.paymentAmount
  const settlementBalanceValue = settlementSnapshot.creditAmount
  const settlementBaseAmount = settlementSnapshot.baseOutstanding

  useEffect(() => {
    if (currentCart.length === 0 && selectedOutstandingPayments.length > 0 && !isSettlementPartial && !isSettlementFullyCredit) {
      const { paymentAmount, creditAmount } = calculateSettlementValues()
      const formattedPayment = paymentAmount.toFixed(2)
      const formattedCredit = creditAmount.toFixed(2)
      if (settlementPaymentAmount !== formattedPayment) setSettlementPaymentAmount(formattedPayment)
      if (settlementCreditAmount !== formattedCredit) setSettlementCreditAmount(formattedCredit)
    }
  }, [currentCart.length, selectedOutstandingPayments, isSettlementPartial, isSettlementFullyCredit, calculateSettlementValues, settlementPaymentAmount, settlementCreditAmount])

  const settleOutstandingPayments = useCallback(async () => {
    if (selectedOutstandingPayments.length === 0) return null
    const referencePayment = outstandingPayments.find(payment => selectedOutstandingPayments.includes(payment.id))
    if (!referencePayment) throw new Error('Unable to locate outstanding payment details for settlement')
    const { paymentAmount, creditAmount, isCredit } = calculateSettlementValues()
    const paymentAmountForBackend = isCredit ? Math.abs(creditAmount) : Math.max(0, paymentAmount)
    const payload = {
      customerName: referencePayment.customer_name,
      phone: referencePayment.customer_phone,
      paymentAmount: paymentAmountForBackend,
      paymentMethod: (paymentMethod || 'CASH').toUpperCase()
    }
    if (isCredit) { payload.isCreditUsage = true; payload.creditAmount = Math.abs(creditAmount) }
    if (paymentAmountForBackend === 0 && !isCredit) payload.isCreditNote = true
    const clearResponse = await api.post('/sales/clear-outstanding', payload)
    if (!clearResponse.data?.success) throw new Error(clearResponse.data?.message || 'Failed to clear outstanding payments')
    return clearResponse.data
  }, [selectedOutstandingPayments, outstandingPayments, calculateSettlementValues, paymentMethod])

  const normalizeCartItemForPrint = useCallback((item) => {
    const parseNumber = (value) => {
      if (value === null || value === undefined || value === '') return NaN
      if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
      const normalized = String(value).replace(/[^\d.\-]/g, '').replace(/(\..*?)\./g, '$1')
      if (normalized === '' || normalized === '-' || normalized === '.') return NaN
      const parsed = Number.parseFloat(normalized)
      return Number.isFinite(parsed) ? parsed : NaN
    }
    const resolveNumber = (candidates, fallback = 0) => {
      for (const candidate of candidates) { const parsed = parseNumber(candidate); if (Number.isFinite(parsed)) return parsed }
      return fallback
    }
    const quantity = resolveNumber([item?.quantity, item?.qty, item?.count], 0)
    const rawUnitPrice = resolveNumber([item?.customPrice, item?.custom_price, item?.unitPrice, item?.price, item?.sellingPrice, item?.salePrice, item?.selling_price, item?.catalogPrice, item?.catalog_price, item?.unit_price, item?.originalPrice, item?.wholesalePrice, item?.retailPrice, item?.basePrice], NaN)
    const discount = resolveNumber([item?.discount, item?.discountAmount], 0)
    let total = resolveNumber([item?.total, item?.total_price, item?.lineTotal, item?.amount, item?.subtotal, item?.subTotal], NaN)
    let unitPrice = Number.isFinite(rawUnitPrice) ? rawUnitPrice : NaN
    if (!Number.isFinite(unitPrice) || unitPrice === 0) { if (Number.isFinite(total) && quantity !== 0) unitPrice = (total + discount) / quantity }
    if (!Number.isFinite(total)) { total = Number.isFinite(unitPrice) ? quantity * unitPrice - discount : 0 }
    unitPrice = Number.isFinite(unitPrice) ? Math.round(unitPrice) : 0
    total = Number.isFinite(total) ? Math.round(total) : 0
    return { name: item?.name || 'Item', sku: item?.sku || '', quantity, unitPrice, price: unitPrice, discount: Math.round(discount), total: Number.isFinite(total) ? total : 0 }
  }, [])

  // ── Payment effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (paymentMethod === 'FULLY_CREDIT') { setPaymentAmount('0'); setCreditAmount(total.toFixed(2)); setIsPartialPayment(false) }
    else if (paymentMethod !== 'FULLY_CREDIT' && paymentAmount === '0' && !isPartialPayment) { setPaymentAmount(''); setCreditAmount('') }
  }, [paymentMethod, total, isPartialPayment, paymentAmount])

  useEffect(() => {
    if (currentCart.length > 0 && outstandingTotal < 0 && !isPartialPayment && paymentAmount === '') {
      const cartTotal = subtotal + tax - totalDiscount
      const netAmount = cartTotal + outstandingTotal
      if (netAmount > 0) { setPaymentAmount(netAmount.toString()); setCreditAmount('0') }
      else { setPaymentAmount('0'); setCreditAmount(Math.abs(netAmount).toString()) }
    }
  }, [currentCart.length, outstandingTotal, subtotal, tax, totalDiscount, isPartialPayment, paymentAmount])

  useEffect(() => {
    if (!isPartialPayment && paymentMethod === 'FULLY_CREDIT') { setPaymentAmount('0'); setCreditAmount(total.toFixed(2)) }
    else if (!isPartialPayment && paymentMethod !== 'FULLY_CREDIT') { setPaymentAmount(''); setCreditAmount('') }
  }, [isPartialPayment, total, paymentMethod, paymentAmount])

  useEffect(() => {
    const loadSalespeople = async () => {
      if (user?.role === 'WAREHOUSE_KEEPER') {
        try {
          const response = await api.get('/salespeople/warehouse-billing')
          if (response.data.success) setSalespeople(response.data.data)
        } catch (error) { console.error('Error loading salespeople:', error) }
      }
    }
    loadSalespeople()
  }, [user])

  useEffect(() => {
    const loadCompanyInfo = async () => {
      const fallbackInfo = { ...DEFAULT_COMPANY_INFO }
      if (!user) { setCompanyInfo(fallbackInfo); return }
      const normalizedScopeType = typeof user.scopeType === 'string' ? user.scopeType.toUpperCase() : null
      const branchId = user.branchId || (normalizedScopeType === 'BRANCH' ? user.scopeId : null)
      const warehouseId = user.warehouseId || (normalizedScopeType === 'WAREHOUSE' ? user.scopeId : null)
      try {
        if (branchId) {
          const response = await api.get(`/branches/${branchId}`)
          if (response.data?.success && response.data?.data) {
            const branch = response.data.data
            setCompanyInfo({ name: branch.name || fallbackInfo.name, address: branch.location || branch.address || fallbackInfo.address, phone: branch.phone || branch.managerPhone || fallbackInfo.phone, email: branch.email || branch.managerEmail || fallbackInfo.email, logoUrl: branch.logoUrl || fallbackInfo.logoUrl })
            return
          }
        }
        if (warehouseId) {
          const response = await api.get(`/warehouses/${warehouseId}`)
          if (response.data?.success && response.data?.data) {
            const warehouse = response.data.data
            setCompanyInfo({ name: warehouse.name || fallbackInfo.name, address: warehouse.location || fallbackInfo.address, phone: warehouse.phone || warehouse.managerPhone || fallbackInfo.phone, email: warehouse.email || fallbackInfo.email, logoUrl: warehouse.logoUrl || fallbackInfo.logoUrl })
            return
          }
        }
        setCompanyInfo(fallbackInfo)
      } catch (error) { setCompanyInfo(fallbackInfo) }
    }
    loadCompanyInfo()
  }, [user])

  useEffect(() => {
    resetCachedSerialPort()
  }, [user?.id])

  useEffect(() => {
    return () => { resetCachedSerialPort() }
  }, [])

  const clearAllPOSState = () => {
    if (!currentTab) return
    const clearedState = createEmptyTabState({ createdAt: currentTab.createdAt, modifiedAt: new Date() })
    updateCurrentTab({
      cart: clearedState.cart, customerName: clearedState.customerName, customerPhone: clearedState.customerPhone,
      selectedRetailer: clearedState.selectedRetailer, paymentMethod: clearedState.paymentMethod, paymentAmount: clearedState.paymentAmount,
      creditAmount: clearedState.creditAmount, isPartialPayment: clearedState.isPartialPayment, isFullyCredit: clearedState.isFullyCredit,
      isBalancePayment: clearedState.isBalancePayment, outstandingPayments: clearedState.outstandingPayments,
      selectedOutstandingPayments: clearedState.selectedOutstandingPayments, settlementPaymentAmount: clearedState.settlementPaymentAmount,
      settlementCreditAmount: clearedState.settlementCreditAmount, isSettlementPartial: clearedState.isSettlementPartial,
      isSettlementFullyCredit: clearedState.isSettlementFullyCredit, showSettlementOptions: clearedState.showSettlementOptions,
      taxRate: clearedState.taxRate, totalDiscount: clearedState.totalDiscount, notes: clearedState.notes
    })
    setCustomerName(clearedState.customerName); setCustomerPhone(clearedState.customerPhone); setSelectedRetailer(clearedState.selectedRetailer)
    setPaymentMethod(clearedState.paymentMethod); setPaymentAmount(clearedState.paymentAmount); setCreditAmount(clearedState.creditAmount)
    setIsPartialPayment(clearedState.isPartialPayment); setIsFullyCredit(clearedState.isFullyCredit); setIsBalancePayment(clearedState.isBalancePayment)
    setOutstandingPayments(clearedState.outstandingPayments); setSelectedOutstandingPayments(clearedState.selectedOutstandingPayments)
    setSettlementPaymentAmount(clearedState.settlementPaymentAmount); setSettlementCreditAmount(clearedState.settlementCreditAmount)
    setIsSettlementPartial(clearedState.isSettlementPartial); setIsSettlementFullyCredit(clearedState.isSettlementFullyCredit)
    setShowSettlementOptions(clearedState.showSettlementOptions); setTaxRate(clearedState.taxRate); setTotalDiscount(clearedState.totalDiscount)
    setNotes(clearedState.notes); setRetailerSearchResults([]); setShowRetailerSearch(false); setSearchResults([])
    setShowSearchResults(false); setManualInput(''); setBarcodeInput(''); setSearchQuery(''); setSelectedCategory('all')
  }

  const refreshOutstandingPayments = () => {
    setSettlementPaymentAmount(''); setSettlementCreditAmount(''); setIsSettlementPartial(false); setIsSettlementFullyCredit(false)
    setOutstandingPayments([]); setSelectedOutstandingPayments([])
    if (currentTab) {
      updateCurrentTab({
        outstandingPayments: [], selectedOutstandingPayments: [], settlementPaymentAmount: '',
        settlementCreditAmount: '', isSettlementPartial: false, isSettlementFullyCredit: false, showSettlementOptions: false
      })
    }
  }

  const handleOutstandingPaymentToggle = (paymentId) => {
    setSelectedOutstandingPayments(prev => {
      const newSelection = prev.includes(paymentId) ? prev.filter(id => id !== paymentId) : [...prev, paymentId]
      if (newSelection.length === 0) { setShowSettlementOptions(false); setIsSettlementPartial(false); setIsSettlementFullyCredit(false) }
      return newSelection
    })
  }

  const handleSettlementPaymentChange = (amount) => {
    const paymentAmount = parseFloat(amount)
    setSettlementPaymentAmount(amount)
    if (isSettlementPartial || isSettlementFullyCredit) {
      const safePayment = Number.isNaN(paymentAmount) ? 0 : Math.max(0, paymentAmount)
      const { baseOutstanding, isCredit } = calculateSettlementValues()
      let creditAmount
      if (isSettlementFullyCredit) { creditAmount = isCredit ? baseOutstanding : -Math.abs(baseOutstanding - safePayment) }
      else { creditAmount = baseOutstanding - safePayment }
      setSettlementCreditAmount(creditAmount.toFixed(2))
    }
  }

  const handleSettlementCreditChange = (amount) => {
    setSettlementCreditAmount(amount)
    if (isSettlementFullyCredit) setSettlementPaymentAmount('0')
  }

  const handleSettlementPaymentType = (type) => {
    const { baseOutstanding, isCredit } = calculateSettlementValues()
    switch (type) {
      case 'full':
        setIsSettlementPartial(false); setIsSettlementFullyCredit(false)
        setSettlementPaymentAmount(Math.abs(baseOutstanding).toFixed(2)); setSettlementCreditAmount('0')
        setShowSettlementOptions(false); break
      case 'partial':
        setIsSettlementPartial(true); setIsSettlementFullyCredit(false)
        if (isCredit) { setSettlementPaymentAmount(''); setSettlementCreditAmount(baseOutstanding.toFixed(2)) }
        else { setSettlementPaymentAmount(''); setSettlementCreditAmount(Math.abs(baseOutstanding).toFixed(2)) }
        setShowSettlementOptions(true); break
      case 'fullyCredit':
        setIsSettlementPartial(false); setIsSettlementFullyCredit(true)
        setSettlementPaymentAmount('0'); setSettlementCreditAmount(Math.abs(baseOutstanding).toFixed(2))
        setShowSettlementOptions(true); break
      case 'balance':
        setIsSettlementPartial(false); setIsSettlementFullyCredit(false)
        if (isCredit) { setSettlementPaymentAmount('0'); setSettlementCreditAmount(baseOutstanding.toFixed(2)) }
        else { setSettlementPaymentAmount('0'); setSettlementCreditAmount(baseOutstanding.toFixed(2)) }
        setShowSettlementOptions(true); break
      default: break
    }
  }

  // ── handleCompleteSale ─────────────────────────────────────────────────────
  const handleCompleteSale = async () => {
    if (isCompletingSaleRef.current) return
    isCompletingSaleRef.current = true

    try {
      if (user.role === 'ADMIN' && !isAdminMode) { alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.'); return }
      if (!selectedRetailer || selectedRetailer.id === undefined || selectedRetailer.id === null) { alert('❌ Please select a retailer before completing this sale.'); return }
      if ((isPartialPayment || isFullyCredit) && !selectedRetailer?.id) { alert('❌ Retailer selection is required for partial payments and credit sales.'); return }
      if (!user) { alert('❌ User not authenticated. Please login again.'); return }
      if (!paymentMethod) { alert('❌ Please select a Payment Method before completing this sale.'); return }
      if (!isPartialPayment && !isFullyCredit && !isBalancePayment) {
        // "Full" is the default type — allowed, no extra check needed
      }

      if (!currentCart || currentCart.length === 0) {
        if (selectedOutstandingPayments.length > 0) {
          const { paymentAmount: settlementPaymentValue, creditAmount: settlementCreditValue, baseOutstanding } = calculateSettlementValues()
          if (isSettlementPartial && settlementPaymentValue <= 0) { alert('❌ Please enter a payment amount greater than 0 for partial settlement.'); return }
          const retailerNameDisplay = selectedRetailer?.name || customerName || 'Unknown'
          const retailerPhoneDisplay = selectedRetailer?.phone || customerPhone || 'N/A'
          const isCredit = baseOutstanding < 0
          const confirmOk = confirm(`${isCredit ? '💰 CREDIT REFUND' : '💰 OUTSTANDING PAYMENT SETTLEMENT'}\n\nRetailer: ${retailerNameDisplay}\nPhone: ${retailerPhoneDisplay}\nTotal ${isCredit ? 'Credit' : 'Outstanding'}: ${Math.abs(baseOutstanding).toFixed(2)}\n${isCredit ? 'Refund' : 'Payment'} Amount: ${settlementPaymentValue.toFixed(2)}\nBalance After: ${settlementCreditValue.toFixed(2)}\n\nDo you want to proceed?`)
          if (!confirmOk) return

          try {
            const settlementResult = await settleOutstandingPayments()
            if (settlementResult?.data?.settlementSale) {
              const settlementSale = settlementResult.data.settlementSale
              const { paymentAmount: spv, creditAmount: scv, baseOutstanding: ba } = calculateSettlementValues()
              const spd = {
                type: 'receipt', title: isCredit ? 'CREDIT REFUND RECEIPT' : 'PAYMENT SETTLEMENT RECEIPT',
                companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name, companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
                companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone, companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
                logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
                receiptNumber: settlementSale.invoice_no || `SETTLE-${Date.now()}`,
                date: new Date(settlementSale.created_at).toLocaleDateString(), time: new Date(settlementSale.created_at).toLocaleTimeString(),
                cashierName: user?.name || user?.username || 'Warehouse Keeper',
                customerName: settlementSale.customer_name || retailerNameDisplay, customerPhone: settlementSale.customer_phone || retailerPhoneDisplay,
                items: [], subtotal: 0, tax: 0, discount: 0, invoiceTotal: 0,
                oldBalance: Math.round(Math.abs(ba)), total: Math.round(parseFloat(settlementSale.total || 0)),
                paymentMethod: settlementSale.payment_method || paymentMethod || 'CASH',
                paymentAmount: Math.round(spv), creditAmount: Math.round(scv), remainingBalance: Math.round(scv), change: 0, notes: '',
                footerMessage: isCredit ? 'Credit refund processed!' : 'Thank you for your payment!'
              }
              setCompletedSaleData({ sale: settlementSale, printData: spd, isSaved: true })
              setSaleConfirmDialog(true)
            }
            clearAllPOSState()
            setTimeout(() => refreshOutstandingPayments(), 2000)
          } catch (error) { alert(`❌ Error processing settlement: ${error.message}`) }
          return
        } else { alert('❌ Cart is empty and no outstanding payments selected.'); return }
      }

      if (total <= 0 && currentCart.length === 0) { alert('❌ Cannot process a sale without items.'); return }

      const { totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentTypeValue } = calculateWarehousePaymentDetails({
        billAmount, outstandingTotal: 0, isFullyCredit, isPartialPayment, isBalancePayment, inputPaymentAmount: paymentAmount
      })

      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) { alert('❌ Payment amount must be greater than 0 for partial payments'); return }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - normalizedBillTotal) > 0.01) { alert(`❌ Payment amounts don't add up.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nBill: ${normalizedBillTotal.toFixed(2)}`); return }
      }

      const paymentMethodValue = isFullyCredit ? 'FULLY_CREDIT' : paymentMethod
      const isSettlementOnly = selectedOutstandingPayments.length > 0 && currentCart.length === 0 && showSettlementOptions

      const salePayloadInfo = buildWarehouseSalePayload({
        billAmount, totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount,
        finalPaymentStatus, paymentMethodValue, paymentTypeValue, includeOutstandingPayments: isSettlementOnly
      })
      if (!salePayloadInfo) return
      const { payload: saleData, retailerInfo } = salePayloadInfo
      const result = await dispatch(createWarehouseSale(saleData))

      if (createWarehouseSale.fulfilled.match(result)) {
        const sale = result.payload?.data || result.payload
        if (selectedOutstandingPayments.length > 0) {
          const shouldClear = (currentCart.length === 0 && showSettlementOptions) || (paymentMethodValue === 'CASH' && selectedOutstandingPayments.length > 0 && finalPaymentAmount > 0)
          if (shouldClear) { try { await settleOutstandingPayments() } catch (error) { console.error('[WAREHOUSE] Error settling outstanding:', error) } }
        }
        const printableItems = currentCart.map(normalizeCartItemForPrint)
        const printableSubtotal = Math.round(Math.max(0, subtotal))
        const printableTax = Math.round(Math.max(0, tax))
        const printableDiscount = Math.round(Math.max(0, totalDiscount))
        const printableInvoiceTotal = Math.max(0, (printableSubtotal + printableTax) - printableDiscount)
        const pd = {
          type: 'warehouse', title: 'SALES RECEIPT',
          companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name, companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
          companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone, companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
          logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
          items: printableItems, subtotal: printableSubtotal, tax: printableTax, discount: printableDiscount, invoiceTotal: printableInvoiceTotal,
          oldBalance: Math.round(outstandingTotal || 0), total: Math.round(total),
          customerName: retailerInfo.name || 'Walk-in Retailer', customerPhone: retailerInfo.phone || '',
          date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(),
          receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
          warehouseName: user?.warehouseName || scopeInfo?.scopeName || '',
          cashierName: user?.name || user?.username || 'Cashier',
          paymentMethod: paymentMethodValue, paymentAmount: Math.round(finalPaymentAmount), creditAmount: Math.round(finalCreditAmount),
          remainingBalance: Math.round(finalCreditAmount),
          change: isPartialPayment ? 0 : Math.round(Math.max(0, (parseFloat(paymentAmount) || total) - total)),
          notes: isPartialPayment ? `Partial Payment - Credit: ${Math.round(finalCreditAmount)}` : '',
          footerMessage: 'Thank you for choosing PetZone!'
        }
        setCompletedSaleData({ sale, printData: pd, retailerInfo, isSaved: true })
        setSaleConfirmDialog(true)
        clearAllPOSState()
        setTimeout(() => refreshOutstandingPayments(), 2000)
      } else if (createWarehouseSale.rejected.match(result)) {
        const error = result.payload || result.error
        showToast(error?.message || 'Sale failed. Please try again.', 'error')
      }
    } catch (error) { alert(`❌ Sale failed: ${error.message || 'Unknown error'}`) }
    finally { setIsProcessingSaleOnly(false); isCompletingSaleRef.current = false }
  }

  // ── Print helpers ──────────────────────────────────────────────────────────
  const checkPrinterStatus = async () => {
    try {
      if (navigator.serial) {
        const ports = await navigator.serial.getPorts()
        if (ports.length > 0) return { hasSerialPorts: true, portCount: ports.length, message: `Found ${ports.length} serial port(s)` }
      }
      return { hasSerialPorts: false, portCount: 0, message: 'No serial ports detected' }
    } catch (error) { return { hasSerialPorts: false, portCount: 0, message: 'Error checking printer status' } }
  }

  const printToBrowser = async (printData) => {
    try {
      const baseOrigin = typeof window !== 'undefined' ? window.location.origin : ''
      const rawLogo = printData.logoUrl || DEFAULT_COMPANY_INFO.logoUrl
      const resolvedLogoPath = (() => {
        if (!rawLogo) return baseOrigin ? `${baseOrigin}${DEFAULT_COMPANY_INFO.logoUrl}` : DEFAULT_COMPANY_INFO.logoUrl
        if (/^(https?:|data:)/i.test(rawLogo)) return rawLogo
        const normalizedLogo = rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`
        return baseOrigin ? `${baseOrigin}${normalizedLogo}` : normalizedLogo
      })()
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`<html><head><title>Receipt</title><style>@media print{body{margin:0;}@page{margin:0;size:80mm auto;}}</style></head><body><div style="font-family:monospace;max-width:280px;margin:0 auto;padding:4px 16px;font-size:11px;"><div style="text-align:center;"><img src="${resolvedLogoPath}" style="max-width:80px;filter:grayscale(100%);"><div style="font-size:14px;font-weight:bold;">${printData.companyName || ''}</div><div style="font-size:9px;">${printData.companyAddress || ''}</div><div style="font-size:9px;">Tel: ${printData.companyPhone || ''}</div></div><div style="border-top:2px solid #000;margin:4px 0;"></div><div style="font-weight:bold;text-align:center;">${printData.title || 'SALES RECEIPT'}</div><div style="border-top:2px solid #000;margin:4px 0;"></div><div>Receipt #: ${printData.receiptNumber || ''}</div><div>Date: ${printData.date} ${printData.time || ''}</div><div>Cashier: ${printData.cashierName || ''}</div><div>Retailer: ${printData.customerName || ''}</div><div style="border-top:2px solid #000;margin:4px 0;"></div>${(printData.items || []).map(item => `<div><div style="font-weight:bold;">${item.name}</div><div style="display:flex;justify-content:space-between;"><span>${item.quantity} x ${Math.round(item.unitPrice || 0)}</span><span>${Math.round(item.total || 0)}</span></div></div>`).join('')}<div style="border-top:2px solid #000;margin:4px 0;"></div><div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>${Math.round(printData.subtotal || 0)}</span></div><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold;"><span>TOTAL:</span><span>${Math.round(printData.total || 0)}</span></div><div style="display:flex;justify-content:space-between;"><span>Payment:</span><span>${printData.paymentMethod || 'CASH'}</span></div><div style="display:flex;justify-content:space-between;"><span>Paid:</span><span>${Math.round(printData.paymentAmount || 0)}</span></div><div style="border-top:2px solid #000;margin:4px 0;"></div><div style="text-align:center;">${printData.footerMessage || 'Thank you!'}</div></div></body></html>`)
      printWindow.document.close()
      printWindow.onload = () => { try { printWindow.print(); setTimeout(() => { if (!printWindow.closed) printWindow.close() }, 5000) } catch (e) { printWindow.close() } }
      return { success: true, message: 'Opened browser print dialog' }
    } catch (error) { throw error }
  }

  const printToThermalPrinter = async (printData) => {
    if (typeof navigator === 'undefined' || !navigator.serial) throw new Error('Web Serial API not supported')
    let port
    try {
      port = await acquireSerialPort()
      if (!port) throw new Error('No port selected by user')
      if (port.readable || port.writable) { try { await port.close() } catch (e) {} }
      const baudRates = [9600, 19200, 38400, 57600, 115200]
      let connected = false
      for (const baudRate of baudRates) {
        try { await port.open({ baudRate }); connected = true; break }
        catch (error) { if (port.readable || port.writable) { try { await port.close() } catch (e) {} } }
      }
      if (!connected) throw new Error('Could not connect to printer at any baud rate')
      const writer = port.writable.getWriter()
      const fmt = (v) => String(Math.round(Number(v || 0)))
      const commands = [0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1B, 0x21, 0x30, ...new TextEncoder().encode((printData.companyName || DEFAULT_COMPANY_INFO.name).toUpperCase()), 0x0A, 0x1B, 0x21, 0x00, ...new TextEncoder().encode((printData.companyAddress || '').substring(0, 32)), 0x0A, ...new TextEncoder().encode(`Tel: ${printData.companyPhone || ''}`), 0x0A, 0x1B, 0x61, 0x00, ...new TextEncoder().encode('================================'), 0x0A, 0x1B, 0x61, 0x01, 0x1B, 0x21, 0x20, ...new TextEncoder().encode('SALES RECEIPT'), 0x0A, 0x1B, 0x21, 0x00, 0x1B, 0x61, 0x00, ...new TextEncoder().encode('================================'), 0x0A, ...new TextEncoder().encode(`Receipt #: ${(printData.receiptNumber || 'N/A').substring(0, 20)}`), 0x0A, ...new TextEncoder().encode(`Date: ${printData.date}`), 0x0A, ...new TextEncoder().encode(`Retailer: ${printData.customerName || 'Walk-in'}`), 0x0A, ...new TextEncoder().encode('================================'), 0x0A]
      ;(printData.items || []).forEach(item => {
        const name = (item.name || 'Item').substring(0, 15).padEnd(15, ' ')
        const qty = (item.quantity || 0).toString().padStart(3, ' ')
        const price = fmt(item.unitPrice || 0).padStart(7, ' ')
        const total = fmt(item.total || 0).padStart(7, ' ')
        commands.push(...new TextEncoder().encode(`${name}${qty}${price}${total}`), 0x0A)
      })
      commands.push(...new TextEncoder().encode('================================'), 0x0A, ...new TextEncoder().encode(`Subtotal: ${fmt(printData.subtotal || 0)}`), 0x0A, ...new TextEncoder().encode(`TOTAL: ${fmt(printData.total || 0)}`), 0x0A, ...new TextEncoder().encode(`Payment: ${printData.paymentMethod || 'CASH'}`), 0x0A, ...new TextEncoder().encode(`Paid: ${fmt(printData.paymentAmount || 0)}`), 0x0A, ...new TextEncoder().encode('================================'), 0x0A, 0x1B, 0x61, 0x01, ...new TextEncoder().encode(printData.footerMessage || 'Thank you!'), 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00)
      await writer.write(new Uint8Array(commands))
      writer.releaseLock()
      await port.close()
      return { success: true, message: 'Printed to thermal printer' }
    } catch (error) {
      if (port) { try { if (port.readable || port.writable) await port.close() } catch (e) {} }
      resetCachedSerialPort()
      throw error
    }
  }

  const attemptReceiptPrint = async (printData, contextLabel = 'receipt') => {
    let success = false; let message = ''; let usedBrowserFallback = false
    if (window.electronAPI?.printReceipt) {
      try { const r = await window.electronAPI.printReceipt(printData); success = !!r?.success; message = r?.message || '' }
      catch (e) { message = e?.message || 'Electron print error' }
    } else {
      try { const r = await printToThermalPrinter(printData); success = !!r?.success; message = r?.message || '' }
      catch (serialError) {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          usedBrowserFallback = true
          try { const r = await printToBrowser(printData); success = !!r?.success; message = r?.message || '' }
          catch (browserError) { message = browserError?.message || 'Browser print failed' }
        } else { message = serialError?.message || 'Thermal printer not available' }
      }
    }
    return { success, message, usedBrowserFallback }
  }

  // ── Tab component ─────────────────────────────────────────────────────────
  const TabComponent = ({ tab, isActive, onClose, onClick }) => {
    const itemCount = tab.cart.reduce((sum, item) => sum + item.quantity, 0)
    const hasItems = itemCount > 0
    return (
      <Paper
        sx={{
          display: 'flex', alignItems: 'center', minWidth: 130, maxWidth: 180, cursor: 'pointer',
          bgcolor: isActive ? theme.palette.primary.main : theme.palette.background.paper,
          color: isActive ? theme.palette.primary.contrastText : theme.palette.text.primary,
          border: `1px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
          borderBottom: isActive ? 'none' : `1px solid ${theme.palette.divider}`,
          borderRadius: '8px 8px 0 0', position: 'relative', zIndex: isActive ? 2 : 1,
          transition: 'all 0.15s ease-in-out',
          '&:hover': { bgcolor: isActive ? theme.palette.primary.dark : alpha(theme.palette.primary.main, 0.1) }
        }}
        onClick={onClick}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, p: 0.75 }}>
          <TabIcon sx={{ mr: 0.5, fontSize: 13 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>
            {tab.name}
          </Typography>
          {hasItems && <Badge badgeContent={itemCount} color="secondary" sx={{ mr: 0.75 }}><CartIcon sx={{ fontSize: 14 }} /></Badge>}
        </Box>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onClose() }}
          sx={{ color: isActive ? theme.palette.primary.contrastText : theme.palette.text.secondary, '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2), color: theme.palette.error.main } }}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Paper>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <RouteGuard allowedRoles={['CASHIER', 'ADMIN', 'MANAGER']}>
        {isAdminMode && scopeInfo && (
          <Box sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', p: 0.75, textAlign: 'center', borderBottom: 1, borderColor: 'warning.main' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
              🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
            </Typography>
          </Box>
        )}

        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5', overflow: 'hidden' }}>

          <Box sx={{ flexShrink: 0 }}>

            {/* Tab Bar */}
            <Paper elevation={0} sx={{ px: 1.5, pt: 1, pb: 0, bgcolor: '#e8eaf0', borderBottom: `2px solid ${theme.palette.primary.main}` }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 0.5, flex: 1, overflowX: 'auto', '&::-webkit-scrollbar': { height: 3 } }}>
                  {tabs.map(tab => (
                    <TabComponent key={tab.id} tab={tab} isActive={tab.id === activeTabId} onClick={() => switchToTab(tab.id)} onClose={() => closeTab(tab.id)} />
                  ))}
                </Box>
                <Tooltip title="New Tab (Ctrl+T)">
                  <IconButton onClick={createNewTab} size="small"
                    sx={{ mb: 0.5, bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText, width: 30, height: 30, '&:hover': { bgcolor: theme.palette.primary.dark } }}>
                    <NewTabIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>

            {/* Control Panel */}
            <Paper elevation={1} sx={{ px: 2, py: 1.5, borderRadius: 0, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* Retailer Name */}
                <Box sx={{ flex: '1 1 200px', minWidth: 180, position: 'relative' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonIcon sx={{ fontSize: 14 }} /> RETAILER
                  </Typography>
                  <TextField
                    fullWidth size="small"
                    placeholder="Search retailer..."
                    value={customerName}
                    onChange={(e) => { setCustomerName(e.target.value); setSelectedRetailer(null); setRetailerHighlightedIndex(-1); searchRetailers(e.target.value) }}
                    disabled={retailersLoading}
                    onKeyDown={(e) => {
                      if (!showRetailerSearch || retailerSearchResults.length === 0) return
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setRetailerHighlightedIndex(prev => {
                          const next = (prev + 1) % retailerSearchResults.length
                          setTimeout(() => {
                            if (retailerDropdownRef.current) {
                              const items = retailerDropdownRef.current.querySelectorAll('[data-retailer-item]')
                              if (items[next]) items[next].scrollIntoView({ block: 'nearest' })
                            }
                          }, 0)
                          return next
                        })
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setRetailerHighlightedIndex(prev => {
                          const next = prev <= 0 ? retailerSearchResults.length - 1 : prev - 1
                          setTimeout(() => {
                            if (retailerDropdownRef.current) {
                              const items = retailerDropdownRef.current.querySelectorAll('[data-retailer-item]')
                              if (items[next]) items[next].scrollIntoView({ block: 'nearest' })
                            }
                          }, 0)
                          return next
                        })
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        if (retailerHighlightedIndex >= 0 && retailerSearchResults[retailerHighlightedIndex]) {
                          selectRetailer(retailerSearchResults[retailerHighlightedIndex])
                          setRetailerHighlightedIndex(-1)
                        }
                      } else if (e.key === 'Escape') {
                        setShowRetailerSearch(false)
                        setRetailerHighlightedIndex(-1)
                      }
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 44, fontSize: '0.9rem', bgcolor: selectedRetailer ? alpha(theme.palette.success.main, 0.08) : 'white' } }}
                    InputProps={{
                      endAdornment: selectedRetailer ? <CheckIcon sx={{ color: 'success.main', fontSize: 18 }} /> : null
                    }}
                  />
                  {showRetailerSearch && retailerSearchResults.length > 0 && (
                    <Paper ref={retailerDropdownRef} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1400, maxHeight: 240, overflowY: 'auto', boxShadow: 6, border: `1px solid ${theme.palette.primary.main}`, borderRadius: '0 0 8px 8px' }}>
                      {retailerSearchResults.map((retailer, i) => (
                        <Box key={`r-${retailer.id || i}`}
                          data-retailer-item
                          onClick={() => { selectRetailer(retailer); setRetailerHighlightedIndex(-1) }}
                          onMouseEnter={() => setRetailerHighlightedIndex(i)}
                          sx={{ px: 2, py: 1.25, cursor: 'pointer', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`, bgcolor: i === retailerHighlightedIndex ? alpha(theme.palette.primary.main, 0.15) : 'transparent', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }, '&:last-child': { borderBottom: 'none' } }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{retailer.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{retailer.phone ? `📞 ${retailer.phone}` : ''}{retailer.city ? ` · ${retailer.city}` : ''}</Typography>
                        </Box>
                      ))}
                    </Paper>
                  )}
                </Box>

                {/* Phone */}
                <Box sx={{ flex: '1 1 160px', minWidth: 140 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PhoneIcon sx={{ fontSize: 14 }} /> PHONE
                  </Typography>
                  <TextField
                    fullWidth size="small" type="tel"
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={(e) => { setCustomerPhone(e.target.value); setSelectedRetailer(null); if (e.target.value && e.target.value.trim().length >= 2) searchRetailers(e.target.value) }}
                    disabled={retailersLoading}
                    sx={{ '& .MuiOutlinedInput-root': { height: 44, fontSize: '0.9rem', bgcolor: 'white' } }}
                  />
                  {isSearchingOutstanding && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <CircularProgress size={10} />
                      <Typography variant="caption" color="text.secondary">Checking outstanding...</Typography>
                    </Box>
                  )}
                  {outstandingPayments.length > 0 && (
                    <Chip
                      size="small"
                      icon={<OutstandingIcon sx={{ fontSize: '14px !important' }} />}
                      label={`${outstandingPayments.length} outstanding · ${outstandingTotal < 0 ? 'CREDIT' : 'PENDING'}: ${Math.abs(outstandingTotal).toFixed(0)}`}
                      color={outstandingTotal < 0 ? 'success' : 'warning'}
                      variant="outlined"
                      sx={{ mt: 0.5, fontSize: '0.72rem', height: 22 }}
                    />
                  )}
                </Box>

                {/* Salesperson */}
                {user?.role === 'WAREHOUSE_KEEPER' && salespeople.length > 0 && (
                  <Box sx={{ flex: '1 1 160px', minWidth: 140 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>
                      SALESPERSON
                    </Typography>
                    <TextField fullWidth size="small" select
                      value={selectedSalesperson?.id || ''}
                      onChange={(e) => { const sp = salespeople.find(s => s.id === parseInt(e.target.value)); setSelectedSalesperson(sp) }}
                      sx={{ '& .MuiOutlinedInput-root': { height: 44, fontSize: '0.9rem', bgcolor: 'white' } }}>
                      <MenuItem value=""><em>Select...</em></MenuItem>
                      {salespeople.map(sp => <MenuItem key={sp.id} value={sp.id}>{sp.name}</MenuItem>)}
                    </TextField>
                  </Box>
                )}

                {/* Payment Method */}
                <Box sx={{ flex: '1 1 140px', minWidth: 130 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: !paymentMethod ? 'error.main' : 'text.secondary', mb: 0.5, display: 'block' }}>
                    PAYMENT METHOD {!paymentMethod && <span style={{ fontSize: '0.7rem' }}>*</span>}
                  </Typography>
                  <TextField fullWidth size="small" select
                    value={paymentMethod}
                    disabled={isFullyCredit}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { height: 44, fontSize: '0.9rem', bgcolor: 'white', borderColor: !paymentMethod ? 'error.main' : undefined } }}>
                    <MenuItem value=""><em style={{ color: '#aaa' }}>Select method...</em></MenuItem>
                    <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="CARD">Card</MenuItem>
                    <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                    <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
                    <MenuItem value="CHEQUE">Cheque</MenuItem>
                    <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
                    <MenuItem value="FULLY_CREDIT">Fully Credit</MenuItem>
                  </TextField>
                </Box>

                {/* Payment Type */}
                <Box sx={{ flex: '1 1 260px', minWidth: 240 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: (!isPartialPayment && !isFullyCredit && !isBalancePayment && currentCart.length > 0) ? 'text.secondary' : 'text.secondary', mb: 0.5, display: 'block' }}>
                    PAYMENT TYPE
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[
                      { key: 'full', label: 'Full', active: !isPartialPayment && !isFullyCredit && !isBalancePayment && paymentMethod !== '' && paymentMethod !== 'FULLY_CREDIT' },
                      { key: 'partial', label: 'Partial', active: isPartialPayment },
                      { key: 'credit', label: 'Credit', active: isFullyCredit },
                      { key: 'balance', label: 'Balance', active: isBalancePayment, disabled: outstandingTotal >= 0 }
                    ].map(btn => (
                      <Button key={btn.key} size="small" variant={btn.active ? 'contained' : 'outlined'} disabled={btn.disabled}
                        onClick={() => {
                          if (btn.key === 'full') { setIsPartialPayment(false); setIsFullyCredit(false); setIsBalancePayment(false); setPaymentAmount(''); setCreditAmount(''); if (paymentMethod === 'FULLY_CREDIT') setPaymentMethod(''); handleSettlementPaymentType('full') }
                          if (btn.key === 'partial') { setIsPartialPayment(true); setIsFullyCredit(false); setIsBalancePayment(false); if (!paymentAmount) { setPaymentAmount(''); setCreditAmount(total.toFixed(2)) }; if (selectedOutstandingPayments.length > 0) handleSettlementPaymentType('partial') }
                          if (btn.key === 'credit') { setIsPartialPayment(false); setIsFullyCredit(true); setIsBalancePayment(false); setPaymentMethod('FULLY_CREDIT'); setPaymentAmount(''); setCreditAmount(total.toString()); handleSettlementPaymentType('fullyCredit') }
                          if (btn.key === 'balance' && !btn.disabled) { setIsPartialPayment(false); setIsFullyCredit(false); setIsBalancePayment(true); setPaymentAmount('0'); setCreditAmount(billAmount.toString()); handleSettlementPaymentType('balance') }
                        }}
                        sx={{ flex: 1, height: 44, fontSize: '0.78rem', fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: btn.active ? 700 : 400 }}>
                        {btn.label}
                      </Button>
                    ))}
                  </Box>
                </Box>

                {/* Partial Payment Amounts */}
                {(isPartialPayment || isFullyCredit) && (
                  <Box sx={{ flex: '1 1 220px', minWidth: 200 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.main', mb: 0.5, display: 'block' }}>
                      {isFullyCredit ? 'CREDIT AMOUNT' : 'PAID / CREDIT'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <TextField size="small" type="number" label="Paid"
                        value={isFullyCredit ? '0' : (paymentAmount || '')} disabled={isFullyCredit}
                        onChange={(e) => { const v = Math.floor(parseFloat(e.target.value) || 0); setPaymentAmount(v.toString()); setCreditAmount((total - v).toString()) }}
                        inputProps={{ style: { textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' } }}
                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 44, bgcolor: 'white' }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' } }}
                      />
                      <TextField size="small" type="number" label="Credit"
                        value={creditAmount || ''} disabled={isFullyCredit}
                        onChange={(e) => { const v = parseFloat(e.target.value) || 0; setCreditAmount(v.toString()); setPaymentAmount((total - v).toString()) }}
                        inputProps={{ style: { textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', color: '#d32f2f' } }}
                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 44, bgcolor: 'white' }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' } }}
                      />
                    </Box>
                  </Box>
                )}

                {/* Summary + Action */}
                <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75, ml: 'auto' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Chip size="small" label={`${currentCart.length} items`} color="primary" variant="outlined" sx={{ fontFamily: 'monospace', fontWeight: 600 }} />
                    {Math.abs(outstandingTotal) > 0.01 && (
                      <Chip size="small"
                        label={`${outstandingTotal < 0 ? 'Credit' : 'Outstanding'}: ${outstandingTotal.toFixed(0)}`}
                        color={outstandingTotal < 0 ? 'success' : 'warning'} variant="filled"
                        sx={{ fontFamily: 'monospace', fontWeight: 600 }} />
                    )}
                    <Chip size="small"
                      label={`TOTAL: ${total.toFixed(0)}`}
                      color="primary" variant="filled"
                      sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', height: 28 }} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Settings">
                      <IconButton size="small" onClick={() => setShowSettings(true)} sx={{ bgcolor: alpha(theme.palette.grey[500], 0.1) }}>
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Inventory">
                      <IconButton size="small" onClick={() => router.push('/dashboard/inventory')} sx={{ bgcolor: alpha(theme.palette.grey[500], 0.1) }}>
                        <InventoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      color="success"
                      size="medium"
                      startIcon={isProcessingSaleOnly ? <CircularProgress size={16} color="inherit" /> : <CartIcon />}
                      onClick={handleCompleteSale}
                      disabled={isProcessingSaleOnly || isProcessingSale || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)}
                      sx={{ fontFamily: 'monospace', fontWeight: 700, height: 44, px: 3, fontSize: '0.9rem', minWidth: 150 }}>
                      {isProcessingSaleOnly ? 'SAVING...' : (currentCart.length === 0 && selectedOutstandingPayments.length > 0 ? 'SETTLE' : 'COMPLETE SALE')}
                    </Button>
                  </Box>
                </Box>
              </Box>

              {/* Outstanding payments panel */}
              {outstandingPayments.length > 0 && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${theme.palette.warning.main}`, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <OutstandingIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                      OUTSTANDING PAYMENTS:
                    </Typography>
                    <IconButton size="small" onClick={() => { if (customerPhone?.trim().length >= 3) searchOutstandingPayments(customerPhone.trim(), customerName?.trim()) }} disabled={isSearchingOutstanding} sx={{ color: 'warning.main', p: 0.25 }}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
                    {outstandingPayments.map(payment => (
                      <Chip key={payment.id}
                        icon={<Checkbox size="small" checked={selectedOutstandingPayments.includes(payment.id)} onChange={() => handleOutstandingPaymentToggle(payment.id)} sx={{ p: 0 }} />}
                        label={
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>
                            {payment.isCredit ? 'CREDIT' : 'DUE'}: {Math.abs(parseFloat(payment.outstandingAmount || 0)).toLocaleString()}
                          </span>
                        }
                        variant="filled"
                        color={payment.isCredit ? 'success' : 'warning'}
                        onClick={() => handleOutstandingPaymentToggle(payment.id)}
                        sx={{ cursor: 'pointer', height: 40, px: 1, fontSize: '0.95rem', borderRadius: 2 }}
                      />
                    ))}
                  </Box>
                  {/* Date field next to outstanding */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>DATE</Typography>
                    <TextField
                      size="small"
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      sx={{ width: 150, '& .MuiOutlinedInput-root': { height: 36, bgcolor: 'white', fontSize: '0.85rem' } }}
                      inputProps={{ style: { fontFamily: 'monospace' } }}
                    />
                  </Box>
                </Box>
              )}

              {/* Notes + Date */}
              <Box sx={{ mt: 1, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  size="small" fullWidth multiline rows={1}
                  placeholder="Notes (optional, max 500 chars)..."
                  value={notes}
                  onChange={(e) => { if (e.target.value.length <= 500) setNotes(e.target.value) }}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white', fontSize: '0.85rem' } }}
                  inputProps={{ maxLength: 500 }}
                />
                {/* Date field — always visible */}
                {outstandingPayments.length === 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>DATE</Typography>
                    <TextField
                      size="small"
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      sx={{ width: 150, '& .MuiOutlinedInput-root': { height: 36, bgcolor: 'white', fontSize: '0.85rem' } }}
                      inputProps={{ style: { fontFamily: 'monospace' } }}
                    />
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>TAX %</Typography>
                    <TextField size="small" type="number" value={taxRate}
                      onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      inputProps={{ min: 0, max: 100, step: 0.1, style: { textAlign: 'center', width: 44, fontFamily: 'monospace' } }}
                      sx={{ width: 64, '& .MuiOutlinedInput-root': { height: 36, bgcolor: 'white' }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' } }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>DISC</Typography>
                    <TextField size="small" type="number"
                      value={parseFloat(totalDiscount || 0).toFixed(0)}
                      onChange={(e) => setTotalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      inputProps={{ min: 0, step: 1, style: { textAlign: 'right', width: 56, fontFamily: 'monospace' } }}
                      sx={{ width: 80, '& .MuiOutlinedInput-root': { height: 36, bgcolor: 'white' }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' } }}
                    />
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* ORDER ENTRY */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 1.5, pt: 1 }}>
            <Paper elevation={1} sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 2 }}>

              {/* Table header */}
              <Box sx={{ bgcolor: theme.palette.primary.main, px: 2, py: 1, display: 'flex', alignItems: 'center', borderRadius: '8px 8px 0 0' }}>
                <Typography variant="subtitle2" sx={{ color: 'white', fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>
                  ORDER ENTRY — {currentTab?.name || ''}
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip size="small" label={`Subtotal: ${Math.round(subtotal).toLocaleString()}`} sx={{ bgcolor: alpha('#fff', 0.2), color: 'white', fontFamily: 'monospace', fontWeight: 600 }} />
                  {tax > 0 && <Chip size="small" label={`Tax: ${Math.round(tax)}`} sx={{ bgcolor: alpha('#fff', 0.15), color: 'white', fontFamily: 'monospace' }} />}
                  {totalDiscount > 0 && <Chip size="small" label={`Disc: -${Math.round(totalDiscount)}`} sx={{ bgcolor: alpha(theme.palette.error.main, 0.6), color: 'white', fontFamily: 'monospace' }} />}
                  <Chip size="small" label={`BILL: ${Math.round(billAmount).toLocaleString()}`} sx={{ bgcolor: alpha('#fff', 0.3), color: 'white', fontFamily: 'monospace', fontWeight: 700 }} />
                </Box>
              </Box>

              {/* Scrollable table */}
              <TableContainer sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.primary.main, 0.3), borderRadius: 3 } }}>
                <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', bgcolor: '#f8f9fa', color: 'text.secondary', borderBottom: `2px solid ${theme.palette.primary.main}`, px: 0.5, textAlign: 'center' }}>#</TableCell>
                      <TableCell sx={{ width: '42%', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', bgcolor: '#f8f9fa', borderBottom: `2px solid ${theme.palette.primary.main}` }}>
                        ITEM &nbsp;<Typography component="span" variant="caption" color="text.secondary">(name / SKU / barcode)</Typography>
                      </TableCell>
                      <TableCell sx={{ width: '13%', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', bgcolor: '#f8f9fa', borderBottom: `2px solid ${theme.palette.primary.main}`, textAlign: 'right' }}>UNIT PRICE</TableCell>
                      <TableCell sx={{ width: '10%', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', bgcolor: '#f8f9fa', borderBottom: `2px solid ${theme.palette.primary.main}`, textAlign: 'center' }}>QTY</TableCell>
                      <TableCell sx={{ width: '12%', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', bgcolor: '#f8f9fa', borderBottom: `2px solid ${theme.palette.primary.main}`, textAlign: 'right', color: 'error.main' }}>DISCOUNT</TableCell>
                      <TableCell sx={{ width: '13%', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', bgcolor: '#f8f9fa', borderBottom: `2px solid ${theme.palette.primary.main}`, textAlign: 'right' }}>FINAL</TableCell>
                      <TableCell sx={{ width: 56, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', bgcolor: '#f8f9fa', borderBottom: `2px solid ${theme.palette.primary.main}`, textAlign: 'center' }}>+</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cartWithPlaceholder.map((item, index) => (
                      <OrderRow
                        key={`row-${item.id || 'placeholder'}-${index}`}
                        item={item}
                        index={index}
                        inventoryItems={inventoryItems || []}
                        onUpdate={handleRowUpdate}
                        onRemove={handleRowRemove}
                        onAddRow={handleAddRow}
                        isLast={index === cartWithPlaceholder.length - 1}
                        autoFocusItem={index === newRowIndex || (index === 0 && currentCart.length === 0)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Footer totals bar */}
              <Box sx={{
                px: 2, py: 1,
                borderTop: `2px solid ${theme.palette.divider}`,
                bgcolor: '#f8f9fa',
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
                borderRadius: '0 0 8px 8px'
              }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  Subtotal: <strong>{Math.round(subtotal).toLocaleString()}</strong>
                </Typography>
                {tax > 0 && (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    + Tax {taxRate}%: <strong>{Math.round(tax)}</strong>
                  </Typography>
                )}
                {totalDiscount > 0 && (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'error.main' }}>
                    − Discount: <strong>{Math.round(totalDiscount)}</strong>
                  </Typography>
                )}
                {Math.abs(outstandingTotal) > 0.01 && (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: outstandingTotal < 0 ? 'success.main' : 'warning.main', fontWeight: 700 }}>
                    {outstandingTotal < 0 ? '+ Credit:' : '+ Outstanding:'} <strong>{outstandingTotal.toFixed(0)}</strong>
                  </Typography>
                )}
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 800, color: 'primary.main' }}>
                    TOTAL: {Math.round(total).toLocaleString()}
                  </Typography>
                  <Button
                    variant="contained" color="success" size="large"
                    startIcon={isProcessingSaleOnly ? <CircularProgress size={18} color="inherit" /> : <CartIcon />}
                    onClick={handleCompleteSale}
                    disabled={isProcessingSaleOnly || isProcessingSale || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)}
                    sx={{ fontFamily: 'monospace', fontWeight: 700, height: 48, px: 4, fontSize: '0.95rem' }}>
                    {isProcessingSaleOnly ? 'SAVING...' : (currentCart.length === 0 && selectedOutstandingPayments.length > 0 ? 'SETTLE' : 'COMPLETE SALE')}
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Sale Confirmation Dialog */}
        <Dialog open={saleConfirmDialog} onClose={() => {}} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CheckIcon sx={{ fontSize: 56, color: 'success.main' }} />
              <Typography variant="h5" fontWeight="bold" color="success.main">Sale Saved Successfully!</Typography>
              {completedSaleData?.sale?.invoice_no && (
                <Chip label={`Invoice: ${completedSaleData.sale.invoice_no}`} color="primary" variant="outlined" sx={{ fontWeight: 'bold', fontSize: '1rem', px: 1 }} />
              )}
            </Box>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center', pt: 2 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>The sale has been recorded. Would you like to print a receipt?</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              <Button variant="contained" size="large" startIcon={<PrintIcon />} color="primary" sx={{ py: 1.5 }}
                onClick={() => { setSaleConfirmDialog(false); if (completedSaleData?.printData) { setPrintData(completedSaleData.printData); setSelectedLayout('thermal'); setShowPrintDialog(true) }; setCompletedSaleData(null) }}>
                Print Thermal Receipt (80mm)
              </Button>
              <Button variant="outlined" size="large" startIcon={<PrintIcon />} color="secondary" sx={{ py: 1.5 }}
                onClick={() => { setSaleConfirmDialog(false); if (completedSaleData?.printData) { setPrintData(completedSaleData.printData); setSelectedLayout('color'); setShowPrintDialog(true) }; setCompletedSaleData(null) }}>
                Print Color Receipt (A4/Letter)
              </Button>
              <Button variant="outlined" size="large" startIcon={<PrintIcon />} color="info" sx={{ py: 1.5 }}
                onClick={async () => {
                  setSaleConfirmDialog(false)
                  if (completedSaleData?.printData) {
                    try {
                      const { success, message } = await attemptReceiptPrint(completedSaleData.printData, 'Post-sale receipt')
                      if (success) alert('✅ Receipt printed successfully!')
                      else alert(`❌ Print failed: ${message || 'Unknown error'}`)
                    } catch (error) { alert(`❌ Print failed: ${error.message}`) }
                  }
                  setCompletedSaleData(null)
                }}>
                Direct Print (Auto-detect Printer)
              </Button>
            </Box>
            <Button variant="text" color="inherit" onClick={() => { setSaleConfirmDialog(false); setCompletedSaleData(null) }}>Skip Printing</Button>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 2, pt: 0 }}>
            <Typography variant="caption" color="text.secondary">✅ Sale is already saved regardless of your choice above</Typography>
          </DialogActions>
        </Dialog>

        {/* Physical Scanner */}
        <PhysicalScanner open={showPhysicalScanner} onScan={(barcode) => { handleBarcodeScan(barcode); setShowPhysicalScanner(false) }} onClose={() => setShowPhysicalScanner(false)} inventoryItems={inventoryItems} />

        {/* Settings Dialog */}
        <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
          <DialogTitle><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><SettingsIcon /><Typography variant="h6">Settings</Typography></Box></DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Tax Settings</Typography>
              <TextField fullWidth label="Default Tax Rate (%)" type="number" value={taxRate}
                onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                inputProps={{ min: 0, max: 100, step: 0.1 }} sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>Category Filter</Typography>
              <TextField fullWidth label="Default Category" select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <MenuItem value="all">All Categories</MenuItem>
                {[...new Set((inventoryItems || []).map(item => item.category).filter(Boolean))].sort().map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettings(false)}>Close</Button>
            <Button variant="contained" onClick={() => setShowSettings(false)}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Print Dialog */}
        <PrintDialog open={showPrintDialog} onClose={() => setShowPrintDialog(false)} printData={printData} title="Print Sales Receipt" defaultLayout={selectedLayout}
          onPrintComplete={() => { setShowPrintDialog(false); setPrintData(null); setCustomerName(''); setCustomerPhone(''); if (currentTab) updateCurrentTab({ ...currentTab, cart: [] }); setSearchResults([]); setShowSearchResults(false); setManualInput(''); setSearchQuery('') }} />

        {/* Toast */}
        <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleToastClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={handleToastClose} severity={toast.severity || 'info'} variant="filled" sx={{ width: '100%' }}>{toast.message}</Alert>
        </Snackbar>

    </RouteGuard>
  )
}

export default WarehouseBillingPage