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
  CircularProgress,
  Avatar,
  Badge,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material'
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  ShoppingCart as ShoppingCartIcon,
  Person as PersonIcon,
  Payment as PaymentIcon,
  Notes as NotesIcon,
  AttachMoney as AttachMoneyIcon,
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as AssignmentIcon,
  LocalShipping as LocalShippingIcon,
  Store as StoreIcon,
  AccountBalance as AccountBalanceIcon,
  CreditCard as CreditCardIcon,
  MonetizationOn as MonetizationOnIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationOnIcon,
  Delete as DeleteIcon
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
import api from '../../../utils/axios'

// Validation schema for warehouse billing
const warehouseBillingSchema = yup.object({
  retailerId: yup.number().required('Retailer is required'),
  paymentMethod: yup.string().required('Payment method is required').oneOf(['CASH', 'PARTIAL_PAYMENT', 'FULLY_CREDIT', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'MOBILE_MONEY']),
  paymentAmount: yup.number().when('paymentMethod', {
    is: 'PARTIAL_PAYMENT',
    then: (schema) => schema.required('Payment amount is required for partial payments').min(0.01, 'Payment amount must be greater than 0'),
    otherwise: (schema) => schema.optional()
  }),
  paymentTerms: yup.string().when('paymentMethod', {
    is: 'FULLY_CREDIT',
    then: (schema) => schema.required('Payment terms are required for credit sales'),
    otherwise: (schema) => schema.optional()
  }),
  notes: yup.string().optional().max(500, 'Notes cannot exceed 500 characters'),
})

const WarehouseBillingPage = () => {
  const dispatch = useDispatch()
  const theme = useTheme()
  const { user } = useSelector((state) => state.auth)
  const { inventoryItems, loading: inventoryLoading } = useSelector((state) => state.inventory)
  const { retailers, loading: retailersLoading } = useSelector((state) => state.retailers)
  const { loading: salesLoading } = useSelector((state) => state.sales)

  // State variables
  const [selectedRetailer, setSelectedRetailer] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printData, setPrintData] = useState(null)

  // Salesperson state
  const [salespeople, setSalespeople] = useState([])
  const [salespeopleLoading, setSalespeopleLoading] = useState(false)
  const [selectedSalesperson, setSelectedSalesperson] = useState('')

  // Partial payment state
  const [isPartialPayment, setIsPartialPayment] = useState(false)
  const [outstandingPayments, setOutstandingPayments] = useState([])
  const [selectedOutstandingPayments, setSelectedOutstandingPayments] = useState([])
  const [outstandingSearchQuery, setOutstandingSearchQuery] = useState('')

  // Customer phone search state
  const [customerPhoneSearch, setCustomerPhoneSearch] = useState('')
  const [searchedCustomer, setSearchedCustomer] = useState(null)

  // Tax and discount state
  const [taxRate, setTaxRate] = useState(0)
  const [totalDiscount, setTotalDiscount] = useState(0)

  // Company/Warehouse info state
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  })

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
      
      // Load salespeople for this warehouse
      loadSalespeople()
      // Load company/warehouse info
      loadCompanyInfo()
    } else if (user?.role === 'ADMIN') {
      // Admin can see all salespeople
      loadSalespeople()
      // Load company info
      loadCompanyInfo()
    }
  }, [dispatch, user, loadSalespeople, loadCompanyInfo])

  // Auto-search outstanding payments when retailer is selected
  useEffect(() => {
    if (selectedRetailer) {
      const selectedRetailerData = retailers.find(r => r.id.toString() === selectedRetailer)
      if (selectedRetailerData) {
        // Set the retailer name in the outstanding search query
        setOutstandingSearchQuery(selectedRetailerData.name)
        // Auto-search outstanding payments for this retailer
        searchOutstandingPaymentsForRetailer(selectedRetailerData.name, selectedRetailerData.phone)
      }
    } else {
      // Clear outstanding payments when no retailer is selected
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
      setOutstandingSearchQuery('')
    }
  }, [selectedRetailer, retailers])

  // Load salespeople for the warehouse
  const loadSalespeople = async () => {
    try {
      setSalespeopleLoading(true)
      const response = await api.get('/salespeople')
      if (response.data.success) {
        // Filter salespeople by warehouse scope for warehouse keepers
        if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
          const filteredSalespeople = response.data.data.filter(
            sp => sp.warehouse_id === user.warehouseId
          )
          setSalespeople(filteredSalespeople)
    } else {
          // Admin can see all salespeople
          setSalespeople(response.data.data)
        }
      }
    } catch (error) {
      console.error('Error loading salespeople:', error)
      setSalespeople([])
    } finally {
      setSalespeopleLoading(false)
    }
  }

  // Load company/warehouse information
  const loadCompanyInfo = async () => {
    console.log('[Warehouse Billing] Loading company info for user:', user?.role, user?.warehouseId)
    try {
      if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        // Load warehouse-specific information
        const response = await api.get(`/warehouses/${user.warehouseId}`)
        if (response.data.success) {
          const warehouse = response.data.data
          console.log('[Warehouse Billing] Loaded warehouse info:', warehouse)
          setCompanyInfo({
            name: warehouse.name || '',
            address: warehouse.location || '', // warehouse.location is the address field
            phone: warehouse.manager || '', // Use manager as phone since warehouse has no phone field
            email: '' // warehouse has no email field
          })
        }
      } else if (user?.role === 'ADMIN') {
        // For admin, try to get company info from companies table
        // But companies table is for suppliers/customers, not main company
        // So we'll use a default company info for now
        console.log('[Warehouse Billing] Admin user - using default company info')
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

  // Filter inventory based on search term
  const filteredInventory = searchTerm.trim() 
    ? (inventoryItems || []).filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : (inventoryItems || [])

  // Add item to cart
  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id)
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + 1)
    } else {
      setCart([...cart, { ...item, quantity: 1 }])
    }
  }

  // Update quantity in cart
  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId)
    } else {
        setCart(cart.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ))
    }
  }

  // Remove item from cart
  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId))
  }

  // Update item price in cart
  const updateItemPrice = (itemId, newPrice) => {
    setCart(cart.map(item => 
      item.id === itemId ? { ...item, customPrice: newPrice } : item
    ))
  }

  // Update item discount in cart
  const updateItemDiscount = (itemId, newDiscount) => {
        setCart(cart.map(item => 
      item.id === itemId ? { ...item, discount: newDiscount } : item
    ))
  }

  // Clear all items from cart
  const clearAll = () => {
    setCart([])
    setSelectedRetailer('')
    setPaymentMethod('CASH')
    setPaymentAmount(0)
    setPaymentTerms('')
    setNotes('')
    setSelectedSalesperson('')
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
    setOutstandingSearchQuery('')
    setCustomerPhoneSearch('')
    setSearchedCustomer(null)
    setTaxRate(0)
    setTotalDiscount(0)
    setError('')
  }

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => {
    const itemPrice = item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.selling_price
    const itemTotal = (item.quantity * Number(itemPrice)) - (item.discount || 0)
    return sum + itemTotal
  }, 0)
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount - totalDiscount

  // Calculate payment amounts based on payment method
  const creditAmount = paymentMethod === 'FULLY_CREDIT' ? total : 
                     paymentMethod === 'PARTIAL_PAYMENT' ? Math.max(0, total - paymentAmount) : 0
  const finalPaymentAmount = paymentMethod === 'FULLY_CREDIT' ? 0 :
                            paymentMethod === 'PARTIAL_PAYMENT' ? paymentAmount :
                            paymentMethod === 'CASH' ? total : total

  // Calculate outstanding total from selected outstanding payments
  const outstandingTotal = selectedOutstandingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0)

  // Final total including outstanding payments
  const finalTotal = total + outstandingTotal

  // Search outstanding payments for a specific retailer
  const searchOutstandingPaymentsForRetailer = async (retailerName, retailerPhone) => {
    if (!retailerName && !retailerPhone) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
      return
    }

    try {
      // Search by retailer name or phone
      const searchParam = retailerName || retailerPhone
      const response = await api.get(`/sales/outstanding?search=${encodeURIComponent(searchParam)}`)
      
      if (response.data.success) {
        setOutstandingPayments(response.data.data)
        // Auto-select all outstanding payments
        setSelectedOutstandingPayments((response.data.data || []).map(payment => payment.id))
        console.log(`[Warehouse Billing] Found ${response.data.data.length} outstanding payments for retailer: ${retailerName}`)
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
        console.log(`[Warehouse Billing] No outstanding payments found for retailer: ${retailerName}`)
      }
    } catch (error) {
      console.error('[Warehouse Billing] Error searching outstanding payments for retailer:', error)
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
    }
  }

  // Search outstanding payments manually
  const searchOutstandingPayments = async () => {
    if (!outstandingSearchQuery.trim()) {
      setOutstandingPayments([])
      return
    }

    try {
      const response = await api.get(`/sales/outstanding?search=${encodeURIComponent(outstandingSearchQuery)}`)
      if (response.data.success) {
        setOutstandingPayments(response.data.data)
        // Auto-select all outstanding payments
        setSelectedOutstandingPayments((response.data.data || []).map(payment => payment.id))
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    } catch (error) {
      console.error('Error searching outstanding payments:', error)
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
    }
  }

  // Search customer by phone
  const searchCustomerByPhone = async () => {
    if (!customerPhoneSearch.trim()) return

    try {
      // Search in retailers first
      const foundRetailer = (retailers || []).find(retailer => 
        retailer.phone.includes(customerPhoneSearch.trim())
      )

      if (foundRetailer) {
        setSearchedCustomer(foundRetailer)
        setSelectedRetailer(foundRetailer.id.toString())
        // Also search for outstanding payments for this customer
        setOutstandingSearchQuery(foundRetailer.name)
        await searchOutstandingPayments()
      } else {
        // If not found in retailers, search in outstanding payments
        setOutstandingSearchQuery(customerPhoneSearch.trim())
        await searchOutstandingPayments()
        setSearchedCustomer(null)
      }
    } catch (error) {
      console.error('Error searching customer by phone:', error)
      setSearchedCustomer(null)
    }
  }

  // Clear outstanding payments
  const clearOutstandingPayments = () => {
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
    setOutstandingSearchQuery('')
  }

  // Thermal printer functionality (ESC/POS commands)
  const printToThermalPrinter = async (printData) => {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported')
    }

    try {
      // Request access to serial port
      console.log('[Warehouse Billing] Requesting serial port access...')
      const port = await navigator.serial.requestPort()
      
      if (!port) {
        throw new Error('No printer selected')
      }

      // Open the port
      await port.open({ baudRate: 9600 })
      console.log('[Warehouse Billing] Printer connected successfully')

      const writer = port.writable.getWriter()
      const encoder = new TextEncoder()

      // ESC/POS commands for thermal printer
      const commands = [
        '\x1B\x40', // Initialize printer
        '\x1B\x61\x01', // Center alignment
        '\x1B\x21\x30', // Double height and width
        `${companyInfo.name}\n`,
        '\x1B\x21\x00', // Normal size
        `${companyInfo.address.substring(0, 32)}\n`, // Limit address length
        `${companyInfo.phone}\n`,
        '--------------------------------\n',
        '\x1B\x21\x08', // Bold
        'WAREHOUSE RECEIPT\n',
        '\x1B\x21\x00', // Normal size
        '\x1B\x61\x00', // Left alignment
        `Invoice: ${printData.sale?.invoice_no || 'N/A'}\n`,
        `Date: ${new Date().toLocaleDateString()}\n`,
        `Time: ${new Date().toLocaleTimeString()}\n`,
        `Retailer: ${printData.retailer?.name || 'N/A'}\n`,
        `Phone: ${printData.retailer?.phone || 'N/A'}\n`,
        `Salesperson: ${printData.salesperson?.name || 'N/A'}\n`,
        '--------------------------------\n',
        '\x1B\x21\x08', // Bold
        'ITEMS\n',
        '\x1B\x21\x00', // Normal
        '--------------------------------\n'
      ]

      // Add items
      printData.items.forEach(item => {
        const itemName = item.name.substring(0, 15) // Limit length
        const qty = item.quantity
        const price = Number(item.selling_price).toFixed(2)
        const total = (qty * Number(item.selling_price)).toFixed(2)
        
        commands.push(
          `${itemName}\n`,
          `Qty: ${qty} x ${price} = ${total}\n`
        )
      })

      // Add totals
      commands.push(
        '--------------------------------\n',
        `Subtotal: ${printData.total.toFixed(2)}\n`,
        `Tax: ${(printData.total * 0.1).toFixed(2)}\n`,
        `Discount: ${printData.totalDiscount?.toFixed(2) || '0.00'}\n`
      )

      // Add outstanding payments if any
      if (printData.outstandingTotal > 0) {
        commands.push(`Outstanding Cleared: ${printData.outstandingTotal.toFixed(2)}\n`)
      }

      // Add payment information
      commands.push(
        '--------------------------------\n',
        `Payment Method: ${printData.paymentMethod}\n`,
        `Payment Amount: ${printData.paymentAmount?.toFixed(2) || '0.00'}\n`
      )

      if (printData.creditAmount > 0) {
        commands.push(`Credit Amount: ${printData.creditAmount.toFixed(2)}\n`)
      }

      commands.push(
        `Total: ${printData.total.toFixed(2)}\n`,
        '--------------------------------\n',
        '\x1B\x61\x01', // Center alignment
        'Thank you for your business!\n',
        '\x1B\x61\x00', // Left alignment
        '--------------------------------\n',
        '\x1B\x61\x01', // Center alignment
        '\x1B\x21\x08', // Bold
        'Powered by Tychora\n',
        '\x1B\x21\x00', // Normal size
        'www.tychora.com\n',
        '\x1B\x61\x00', // Left alignment
        '\x1D\x56\x00', // Cut paper
        '\x1B\x64\x02' // Feed paper
      )

      // Send commands to printer
      for (const command of commands) {
        await writer.write(encoder.encode(command))
      }

      // Close the writer and port
      writer.releaseLock()
      await port.close()
      
      console.log('[Warehouse Billing] Receipt printed successfully')
      return true

    } catch (error) {
      console.error('[Warehouse Billing] Thermal printer error:', error)
      throw error
    }
  }

  // Browser print functionality
  const printToBrowser = async (printData) => {
    try {
      // Create printable HTML content
      const printContent = `
        <div style="font-family: monospace; max-width: 280px; margin: 0 auto; padding: 4px 0 4px 16px; font-size: 11px; line-height: 1.1; color: #000; background-color: #fff;">
          <!-- HEADER SECTION -->
          <div style="text-align: center; margin-bottom: 8px;">
            <div style="margin-bottom: 4px;">
              <img src="/petzonelogo.png" alt="PetZone" style="max-width: 100px; width: 100px; height: auto; filter: grayscale(100%); display: block; margin: 0 auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              <div style="font-size: 14px; font-weight: bold; display: none; text-align: center; border: 1px solid #000; padding: 4px; min-height: 50px; display: flex; align-items: center; justify-content: center;">
                ${companyInfo.name}
              </div>
            </div>
            <div style="font-size: 12px; font-weight: bold; margin-bottom: 2px;">WAREHOUSE RECEIPT</div>
            <div style="font-size: 10px;">${companyInfo.address}</div>
            <div style="font-size: 10px;">${companyInfo.phone}</div>
          </div>

          <!-- CUSTOMER INFO -->
          <div style="margin-bottom: 6px;">
            <div style="font-weight: bold;">Retailer: ${printData.retailer?.name || 'N/A'}</div>
            <div>Phone: ${printData.retailer?.phone || 'N/A'}</div>
            <div>Invoice: ${printData.sale?.invoice_no || 'N/A'}</div>
            <div>Date: ${new Date().toLocaleDateString()}</div>
            <div>Time: ${new Date().toLocaleTimeString()}</div>
            <div>Salesperson: ${printData.salesperson?.name || 'N/A'}</div>
          </div>

          <!-- DIVIDER -->
          <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

          <!-- ITEMS SECTION -->
          <div style="margin-bottom: 6px;">
            <div style="font-weight: bold; margin-bottom: 4px;">ITEMS</div>
            <div style="border-top: 1px dashed #000; margin-bottom: 4px;"></div>
            ${printData.items.map(item => `
              <div style="margin-bottom: 2px;">
                <div style="font-weight: bold;">${item.name.substring(0, 20)}</div>
                <div>Qty: ${item.quantity} x ${Number(item.selling_price).toFixed(2)} = ${(item.quantity * Number(item.selling_price)).toFixed(2)}</div>
              </div>
            `).join('')}
          </div>

          <!-- DIVIDER -->
          <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

          <!-- TOTALS SECTION -->
          <div style="margin-bottom: 6px;">
            <div>Subtotal: ${printData.total.toFixed(2)}</div>
            <div>Tax: ${(printData.total * 0.1).toFixed(2)}</div>
            <div>Discount: ${printData.totalDiscount?.toFixed(2) || '0.00'}</div>
            ${printData.outstandingTotal > 0 ? `<div>Outstanding Cleared: ${printData.outstandingTotal.toFixed(2)}</div>` : ''}
          </div>

          <!-- DIVIDER -->
          <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

          <!-- PAYMENT SECTION -->
          <div style="margin-bottom: 6px;">
            <div>Payment Method: ${printData.paymentMethod}</div>
            <div>Payment Amount: ${printData.paymentAmount?.toFixed(2) || '0.00'}</div>
            ${printData.creditAmount > 0 ? `<div>Credit Amount: ${printData.creditAmount.toFixed(2)}</div>` : ''}
            <div style="font-weight: bold; margin-top: 4px;">Total: ${printData.total.toFixed(2)}</div>
          </div>

          <!-- DIVIDER -->
          <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

          <!-- FOOTER -->
          <div style="text-align: center; margin-top: 8px;">
            <div style="font-weight: bold;">Thank you for your business!</div>
            <div style="font-size: 9px; margin-top: 4px;">Return within 3 days</div>
            <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
            <div style="font-weight: bold; font-size: 10px;">Powered by Tychora</div>
            <div style="font-size: 9px;">www.tychora.com</div>
          </div>
        </div>
      `

      // Open print window
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <html>
          <head>
            <title>Warehouse Receipt</title>
            <style>
              @media print {
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  font-family: monospace !important;
                  font-size: 11px !important;
                  line-height: 1.1 !important;
                  color: #000 !important;
                  background: #fff !important;
                }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `)
      
      printWindow.document.close()
      printWindow.focus()
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 500)

      console.log('[Warehouse Billing] Browser print completed')
      return true
      
    } catch (error) {
      console.error('[Warehouse Billing] Browser print error:', error)
      throw error
    }
  }

  // Handle print action
  const handlePrint = async (printType = 'browser') => {
    if (!printData) {
      alert('No print data available')
      return
    }

    try {
      if (printType === 'thermal') {
        await printToThermalPrinter(printData)
        alert('✅ Receipt printed successfully to thermal printer!')
      } else {
        await printToBrowser(printData)
      }
      
      // Close print dialog after successful print
      setShowPrintDialog(false)
      
    } catch (error) {
      console.error('[Warehouse Billing] Print error:', error)
      alert(`❌ Print failed: ${error.message}`)
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setLoading(true)
    setError('')

      // Validate form
      await warehouseBillingSchema.validate({
        retailerId: parseInt(selectedRetailer),
        paymentMethod,
        paymentAmount: paymentMethod === 'PARTIAL_PAYMENT' ? paymentAmount : undefined,
        paymentTerms: paymentMethod === 'FULLY_CREDIT' ? paymentTerms : undefined,
        notes
      })

      const warehouseSaleData = {
        retailerId: parseInt(selectedRetailer),
        items: cart.map(item => ({
          inventoryItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.selling_price
        })),
        subtotal,
        taxRate,
        taxAmount,
        total: finalTotal, // Use finalTotal
        paymentMethod,
        paymentAmount: finalPaymentAmount, // New
        creditAmount: creditAmount, // New
        paymentTerms: paymentMethod === 'FULLY_CREDIT' ? paymentTerms : '',
        salespersonId: selectedSalesperson ? parseInt(selectedSalesperson) : null,
        outstandingPayments: selectedOutstandingPayments, // New
        notes: `Warehouse Billing - ${paymentMethod === 'FULLY_CREDIT' ? `Credit Terms: ${paymentTerms}` : paymentMethod === 'PARTIAL_PAYMENT' ? `Partial Payment: $${finalPaymentAmount.toFixed(2)}` : 'Cash Sale'}${selectedSalesperson ? ` | Salesperson: ${(salespeople || []).find(s => s.id === parseInt(selectedSalesperson))?.name}` : ''}${notes ? ` | ${notes}` : ''}`
      }

      const response = await dispatch(createWarehouseSale(warehouseSaleData))
      
      if (response.payload.success) {
        // Set print data
        setPrintData({
          sale: response.payload.data,
          items: cart,
          retailer: (retailers || []).find(r => r.id === parseInt(selectedRetailer)),
          salesperson: selectedSalesperson ? (salespeople || []).find(s => s.id === parseInt(selectedSalesperson)) : null,
          paymentMethod,
          paymentAmount: finalPaymentAmount,
          creditAmount,
          outstandingTotal,
          total: finalTotal,
          notes,
          companyInfo // Add company info to print data
        })
        
        // Clear form
        clearAll()
        
        // Show print dialog
        setShowPrintDialog(true)
      } else {
        setError(response.payload.message || 'Failed to create sale')
      }
    } catch (error) {
      console.error('Error creating warehouse sale:', error)
      setError(error.message || 'An error occurred while creating the sale')
    } finally {
      setLoading(false)
    }
  }

  // Payment methods
  const paymentMethods = [
    { value: 'CASH', label: 'Cash', icon: <MonetizationOnIcon />, color: '#4caf50' },
    { value: 'PARTIAL_PAYMENT', label: 'Partial Payment', icon: <AttachMoneyIcon />, color: '#ff5722' },
    { value: 'FULLY_CREDIT', label: 'Fully Credit', icon: <CreditCardIcon />, color: '#ff9800' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: <AccountBalanceIcon />, color: '#2196f3' },
    { value: 'CARD', label: 'Card', icon: <CreditCardIcon />, color: '#9c27b0' },
    { value: 'CHEQUE', label: 'Cheque', icon: <AssignmentIcon />, color: '#607d8b' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: <PhoneIcon />, color: '#00bcd4' }
  ]

  return (
      <DashboardLayout>
      <RouteGuard allowedRoles={['WAREHOUSE_KEEPER', 'ADMIN']}>
        {/* Full Width Header */}
        <Paper sx={{ p: 2, backgroundColor: theme.palette.primary.main, color: 'white', mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalShippingIcon />
              <Typography variant="h6" fontWeight="bold">
                Warehouse Billing Terminal
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">
                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
              </Typography>
            </Box>
            </Box>
          </Paper>

        <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', gap: 2, p: 2 }}>
          {/* Left Panel - POS-like Interface */}
          <Box sx={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Retailer Selection & Products */}
            <Paper sx={{ p: 0.5, height: 'fit-content', display: 'flex', flexDirection: 'column' }}>
              {/* Retailer Selection */}
              <Box sx={{ mb: 0.5 }}>
                <Typography variant="caption" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 'bold' }}>
                  <StoreIcon color="primary" fontSize="small" />
                  Select Retailer
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: '0.7rem' }}>Choose Retailer</InputLabel>
                  <Select
                    value={selectedRetailer}
                    onChange={(e) => setSelectedRetailer(e.target.value)}
                    label="Choose Retailer"
                    sx={{ fontSize: '0.7rem', height: '32px' }}
                  >
                    <MenuItem value="">
                      <em>Select a retailer...</em>
                    </MenuItem>
                    {(retailers || []).map((retailer) => (
                      <MenuItem key={retailer.id} value={retailer.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 20, height: 20 }}>
                            <StoreIcon sx={{ fontSize: 12 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="caption" fontWeight="bold">
                              {retailer.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                              {retailer.phone}
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Product Search */}
              <Box sx={{ mb: 0.5 }}>
                <Typography variant="caption" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 'bold' }}>
                  <InventoryIcon color="primary" fontSize="small" />
                  Products
                </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 0.5, fontSize: 14 }} />
                    }}
                    sx={{ fontSize: '0.7rem', height: '32px' }}
                  />
              </Box>
              
              {/* Product Grid */}
              <Box sx={{ maxHeight: '200px', overflow: 'auto' }}>
                {filteredInventory.length > 0 && (
                  <Grid container spacing={0.5}>
                    {filteredInventory.map((item) => (
                      <Grid item xs={6} sm={4} md={3} key={item.id}>
                        <Card 
                          sx={{ 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: 1
                            }
                          }}
                          onClick={() => addToCart(item)}
                        >
                          <CardContent sx={{ p: 0.5, '&:last-child': { pb: 0.5 } }}>
                            <Typography variant="caption" fontWeight="bold" noWrap fontSize="0.7rem">
                              {item.name}
                              </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap fontSize="0.6rem">
                              SKU: {item.sku}
                            </Typography>
                          <Typography variant="caption" color="primary" fontWeight="bold" fontSize="0.7rem">
                            {Number(item.selling_price).toFixed(2)}
                          </Typography>
                            <Typography variant="caption" color="text.secondary" fontSize="0.6rem">
                              Stock: {item.current_stock}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  )}
                </Box>
              </Paper>

            {/* Cart & Order Summary Section */}
            <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShoppingCartIcon color="primary" fontSize="small" />
                    Cart ({cart.length} items)
                  </Typography>
                </Box>

              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                  <TableContainer>
                  <Table size="small">
                      <TableHead>
                        <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Item</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Price</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Discount</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                      {cart.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                              No items in cart
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {item.name}
                                </Typography>
                              <Typography variant="caption" color="text.secondary">
                                  SKU: {item.sku}
                              </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                                <TextField
                                  size="small"
                                type="number"
                                value={item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.selling_price}
                                onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                inputProps={{
                                  min: 0,
                                  step: 0.01,
                                  style: { textAlign: 'center', fontSize: '0.8rem' }
                                }}
                                sx={{
                                  width: 80,
                                  '& input': {
                                    padding: '4px 8px',
                                    fontSize: '0.8rem'
                                  },
                                  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                                    display: 'none'
                                  },
                                  '& input[type=number]': {
                                    MozAppearance: 'textfield'
                                  }
                                }}
                                onWheel={(e) => e.target.blur()}
                                onKeyDown={(e) => {
                                  if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                                    e.preventDefault()
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                  <RemoveIcon fontSize="small" />
                                </IconButton>
                                <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>
                                  {item.quantity}
                                </Typography>
                                <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <TextField
                                size="small"
                                type="number"
                                value={item.discount || 0}
                                onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                                inputProps={{
                                  min: 0,
                                  step: 0.01,
                                  style: { textAlign: 'center', fontSize: '0.8rem' }
                                }}
                                sx={{
                                  width: 80,
                                  '& input': {
                                    padding: '4px 8px',
                                    fontSize: '0.8rem'
                                  },
                                  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                                    display: 'none'
                                  },
                                  '& input[type=number]': {
                                    MozAppearance: 'textfield'
                                  }
                                }}
                                onWheel={(e) => e.target.blur()}
                                onKeyDown={(e) => {
                                  if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                                    e.preventDefault()
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell align="right" fontWeight="bold">
                              {((item.quantity * (item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.selling_price)) - (item.discount || 0)).toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <IconButton size="small" color="error" onClick={() => removeFromCart(item.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      </TableBody>
                    </Table>
                  </TableContainer>
              </Box>

              {/* Order Summary */}
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptIcon color="primary" fontSize="small" />
                  Order Summary
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Subtotal:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {subtotal.toFixed(2)}
                    </Typography>
                  </Box>
                
                  {/* Discount Field */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Discount:
                    </Typography>
                  <TextField
                      size="small"
                      type="number"
                      value={totalDiscount}
                      onChange={(e) => setTotalDiscount(parseFloat(e.target.value) || 0)}
                      inputProps={{
                        min: 0,
                        step: 0.01,
                        style: { textAlign: 'right', fontSize: '0.8rem', width: '80px' }
                      }}
                      sx={{
                        width: 100,
                        '& input': {
                          padding: '4px 8px',
                          fontSize: '0.8rem'
                        },
                        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                          display: 'none'
                        },
                        '& input[type=number]': {
                          MozAppearance: 'textfield'
                        }
                      }}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => {
                        if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                          e.preventDefault()
                        }
                      }}
                    />
                  </Box>

                  {/* Tax Field */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Tax:
                    </Typography>
                      <TextField
                        size="small"
                        type="number"
                      value={taxRate * 100}
                      onChange={(e) => setTaxRate((parseFloat(e.target.value) || 0) / 100)}
                        inputProps={{ 
                          min: 0, 
                          max: 100, 
                          step: 0.1,
                        style: { textAlign: 'right', fontSize: '0.8rem', width: '80px' }
                      }}
                      sx={{
                        width: 100,
                        '& input': {
                          padding: '4px 8px',
                          fontSize: '0.8rem'
                        },
                        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                          display: 'none'
                        },
                        '& input[type=number]': {
                          MozAppearance: 'textfield'
                        }
                      }}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => {
                        if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                          e.preventDefault()
                        }
                      }}
                    />
                    </Box>
                  
                  {outstandingTotal > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Outstanding:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="warning.main">
                        {outstandingTotal.toFixed(2)}
                      </Typography>
                  </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, pt: 0.5, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="body1" fontWeight="bold" color="primary">
                      Total:
                    </Typography>
                    <Typography variant="body1" fontWeight="bold" color="primary">
                      {total.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={clearAll}
                    size="small"
                    sx={{ flex: 1 }}
                  >
                    Clear All
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading || cart.length === 0}
                    size="small"
                    sx={{ flex: 1 }}
                  >
                    {loading ? <CircularProgress size={16} /> : 'Create Sale'}
                  </Button>
                </Box>
                </Box>
              </Paper>
          </Box>

          {/* Right Panel - Payment & Order Summary */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Payment Section */}
            <Paper sx={{ p: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentIcon color="primary" fontSize="small" />
                Payment
                </Typography>

              {/* Payment Methods */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Payment Method
                </Typography>
                <Grid container spacing={1}>
                  {paymentMethods.map((method) => (
                    <Grid item xs={6} key={method.value}>
                      <Button
            fullWidth
                        variant={paymentMethod === method.value ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => setPaymentMethod(method.value)}
                        sx={{ 
                          backgroundColor: paymentMethod === method.value ? method.color : 'transparent',
                          color: paymentMethod === method.value ? 'white' : method.color,
                          borderColor: method.color,
                          '&:hover': {
                            backgroundColor: paymentMethod === method.value ? method.color : alpha(method.color, 0.1)
                          }
                        }}
                      >
                        {method.icon}
                        <Typography sx={{ ml: 0.5, fontSize: '0.8rem' }}>
                          {method.label}
                </Typography>
                  </Button>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Payment Amount for Partial Payment */}
              {paymentMethod === 'PARTIAL_PAYMENT' && (
                <TextField
                    fullWidth
                    size="small"
                  label="Payment Amount (Paid Now)"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Enter amount paid now"
                  required
                    sx={{ mb: 1, fontSize: '0.8rem' }}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1, fontSize: '0.8rem' }}></Typography>
                  }}
                  inputProps={{
                    min: 0,
                    step: 0.01,
                    style: { fontSize: '0.8rem' }
                  }}
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                      e.preventDefault()
                    }
                  }}
                />
              )}

              {/* Credit Amount Display */}
              {(paymentMethod === 'PARTIAL_PAYMENT' || paymentMethod === 'FULLY_CREDIT') && (
                <TextField
                  fullWidth
                  size="small"
                  label="Credit Amount (Remaining)"
                  type="number"
                  value={creditAmount}
                  disabled
                  sx={{ mb: 1, fontSize: '0.8rem' }}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1, fontSize: '0.8rem' }}></Typography>
                  }}
                  inputProps={{
                    min: 0,
                    step: 0.01,
                    style: { fontSize: '0.8rem' }
                  }}
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                      e.preventDefault()
                    }
                  }}
                />
              )}

              {/* Payment Terms for Credit Sales */}
              {paymentMethod === 'FULLY_CREDIT' && (
                  <TextField
                    fullWidth
                    size="small"
                    label="Payment Terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g., Net 30 days, Due on delivery"
                  required
                    sx={{ mb: 1, fontSize: '0.8rem' }}
                  />
                )}

              {/* Outstanding Payments */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Outstanding Payments
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                    placeholder="Search customer by name or phone..."
                    value={outstandingSearchQuery}
                    onChange={(e) => setOutstandingSearchQuery(e.target.value)}
                    size="small"
                    sx={{ fontSize: '0.8rem' }}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ fontSize: 14, mr: 0.5 }} />
                    }}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => {
                      if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                        e.preventDefault()
                      }
                    }}
                  />
                  <Button variant="outlined" onClick={searchOutstandingPayments} size="small">
                    Search
                  </Button>
                  <Button variant="outlined" onClick={clearOutstandingPayments} size="small">
                    Clear
                  </Button>
                </Box>
                
                {outstandingPayments.length > 0 && (
                  <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    {(outstandingPayments || []).map((payment) => (
                      <Box key={payment.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <input
                          type="checkbox"
                          checked={selectedOutstandingPayments.includes(payment.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOutstandingPayments([...selectedOutstandingPayments, payment.id])
                            } else {
                              setSelectedOutstandingPayments(selectedOutstandingPayments.filter(id => id !== payment.id))
                            }
                          }}
                        />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {payment.customerName} - {payment.amount}
                        </Typography>
                    </Box>
                    ))}
                  </Box>
                )}
                </Box>

              {/* Salesperson Selection */}
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel sx={{ fontSize: '0.8rem' }}>Salesperson (Optional)</InputLabel>
                <Select
                  value={selectedSalesperson}
                  onChange={(e) => setSelectedSalesperson(e.target.value)}
                  label="Salesperson (Optional)"
                  sx={{ fontSize: '0.8rem' }}
                >
                  <MenuItem value="">
                    <em>No salesperson selected</em>
                  </MenuItem>
                  {(salespeople || []).map((salesperson) => (
                    <MenuItem key={salesperson.id} value={salesperson.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          <PersonIcon />
                        </Avatar>
                                <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {salesperson.name}
                                    </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {salesperson.phone}
                  </Typography>
                                </Box>
                </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

                {/* Notes */}
                <TextField
                  fullWidth
                                  size="small"
                label="Notes (Optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                  multiline
                rows={2}
                  sx={{ mb: 1, fontSize: '0.8rem' }}
                />
            </Paper>
                </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ m: 2 }}
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}

          {/* Print Dialog */}
            <PrintDialog
              open={showPrintDialog}
              onClose={() => setShowPrintDialog(false)}
              printData={printData}
              onPrint={handlePrint}
              title="Print Warehouse Receipt"
              showPreview={true}
              showSettings={true}
              defaultLayout="thermal"
            />
    </RouteGuard>
    </DashboardLayout>
  )
}

export default withAuth(WarehouseBillingPage)