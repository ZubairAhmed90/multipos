'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
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
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon
} from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  GetApp as ExportIcon,
  FileDownload as DownloadIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Visibility as ViewIcon,
  ShoppingCart as SalesIcon
} from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import api from '../../../utils/axios'
import SalespersonForm from '../../../components/salesperson/SalespersonForm'

const SalespeoplePage = () => {
  const { user } = useSelector((state) => state.auth)
  const [salespeople, setSalespeople] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedSalesperson, setSelectedSalesperson] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [salespersonToDelete, setSalespersonToDelete] = useState(null)
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null)
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [salesDialogOpen, setSalesDialogOpen] = useState(false)
  const [selectedSalespersonForSales, setSelectedSalespersonForSales] = useState(null)
  const [salespersonSales, setSalespersonSales] = useState([])
  const [salespersonSalesLoading, setSalespersonSalesLoading] = useState(false)
  const [salespersonExportMenuAnchor, setSalespersonExportMenuAnchor] = useState(null)
  const [salespersonStartDate, setSalespersonStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days ago
  const [salespersonEndDate, setSalespersonEndDate] = useState(new Date()) // Today

  // Load salespeople and warehouses
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load salespeople
      const salespeopleResponse = await api.get('/salespeople')
      if (salespeopleResponse.data.success) {
        setSalespeople(salespeopleResponse.data.data)
      }

      // Load warehouses (only for admin)
      if (user?.role === 'ADMIN') {
        const warehousesResponse = await api.get('/warehouses')
        if (warehousesResponse.data.success) {
          setWarehouses(warehousesResponse.data.data)
        }
      } else if (user?.role === 'WAREHOUSE_KEEPER') {
        // For warehouse keepers, set their warehouse
        console.log('🔧 Setting warehouses for warehouse keeper:', {
          id: user.warehouseId,
          name: user.warehouseName,
          code: user.warehouseCode
        })
        setWarehouses([{
          id: user.warehouseId,
          name: user.warehouseName,
          code: user.warehouseCode
        }])
      }

    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Debug warehouses state changes
  useEffect(() => {
    console.log('🔧 Warehouses state changed:', warehouses)
  }, [warehouses])

  const handleAddSalesperson = () => {
    setSelectedSalesperson(null)
    setFormOpen(true)
  }

  const handleEditSalesperson = (salesperson) => {
    setSelectedSalesperson(salesperson)
    setFormOpen(true)
  }

  const handleDeleteSalesperson = (salesperson) => {
    setSalespersonToDelete(salesperson)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/salespeople/${salespersonToDelete.id}`)
      setSalespeople(prev => prev.filter(sp => sp.id !== salespersonToDelete.id))
      setDeleteDialogOpen(false)
      setSalespersonToDelete(null)
    } catch (err) {
      console.error('Error deleting salesperson:', err)
      setError(err.response?.data?.message || 'Failed to delete salesperson')
    }
  }

  const handleFormSave = (savedSalesperson) => {
    if (selectedSalesperson) {
      // Update existing
      setSalespeople(prev => prev.map(sp => 
        sp.id === savedSalesperson.id ? savedSalesperson : sp
      ))
    } else {
      // Add new
      setSalespeople(prev => [...prev, savedSalesperson])
    }
    setFormOpen(false)
    setSelectedSalesperson(null)
  }

  // Filter salespeople based on search term and warehouse filter
  const filteredSalespeople = salespeople.filter(salesperson => {
    const matchesSearch = !searchTerm || 
    salesperson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    salesperson.phone.includes(searchTerm) ||
    salesperson.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesWarehouse = warehouseFilter === 'all' || 
      salesperson.warehouse_id === parseInt(warehouseFilter)
    
    return matchesSearch && matchesWarehouse
  })

  // Calculate statistics
  const salespeopleStats = React.useMemo(() => {
    const totalSalespeople = salespeople.length
    const activeSalespeople = salespeople.filter(sp => sp.status === 'ACTIVE').length
    const averageCommission = 0 // Removed commission calculation
    const warehouseCount = new Set(salespeople.map(sp => sp.warehouse_id)).size

    return {
      totalSalespeople,
      activeSalespeople,
      averageCommission,
      warehouseCount
    }
  }, [salespeople])

  // Export functions
  const generateCSV = (salespeopleData) => {
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Warehouse', 'Status', 'Created At']
    const rows = salespeopleData.map(sp => [
      sp.id,
      sp.name,
      sp.phone,
      sp.email || 'N/A',
      sp.warehouse_name || 'N/A',
      sp.status,
      new Date(sp.created_at).toLocaleDateString()
    ])
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const generateExcel = async (salespeopleData) => {
    try {
      const XLSX = await import('xlsx')
      
      const excelData = salespeopleData.map(sp => ({
        'ID': sp.id,
        'Name': sp.name,
        'Phone': sp.phone,
        'Email': sp.email || 'N/A',
        'Warehouse': sp.warehouse_name || 'N/A',
        'Status': sp.status,
        'Created At': new Date(sp.created_at).toLocaleDateString()
      }))
      
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Salespeople Data')
      
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      return excelBuffer
    } catch (error) {
      console.warn('XLSX library not available, falling back to CSV format:', error)
      return generateCSV(salespeopleData)
    }
  }

  const generatePDF = (salespeopleData) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salespeople Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .status-active { color: #28a745; }
            .status-inactive { color: #dc3545; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Salespeople Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>Total Records: ${salespeopleData.length}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p>Total Salespeople: ${salespeopleData.length}</p>
            <p>Active Salespeople: ${salespeopleData.filter(sp => sp.status === 'ACTIVE').length}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Warehouse</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${salespeopleData.map(sp => `
                <tr>
                  <td>${sp.id}</td>
                  <td>${sp.name}</td>
                  <td>${sp.phone}</td>
                  <td>${sp.email || 'N/A'}</td>
                  <td>${sp.warehouse_name || 'N/A'}</td>
                  <td class="status-${sp.status.toLowerCase()}">${sp.status}</td>
                  <td>${new Date(sp.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    return htmlContent
  }

  const downloadFile = (content, filename, mimeType) => {
    if (mimeType === 'application/pdf') {
      const printWindow = window.open('', '_blank')
      printWindow.document.write(content)
      printWindow.document.close()
      printWindow.print()
      return
    }

    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleExportClick = (event) => {
    setExportMenuAnchor(event.currentTarget)
  }

  const handleExportClose = () => {
    setExportMenuAnchor(null)
  }

  const exportToCSV = () => {
    const csvContent = generateCSV(filteredSalespeople)
    downloadFile(csvContent, `salespeople-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
    handleExportClose()
  }

  const exportToExcel = async () => {
    try {
      const excelContent = await generateExcel(filteredSalespeople)
      downloadFile(excelContent, `salespeople-${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
    }
    handleExportClose()
  }

  const exportToPDF = () => {
    const pdfContent = generatePDF(filteredSalespeople)
    downloadFile(pdfContent, `salespeople-${new Date().toISOString().split('T')[0]}.html`, 'application/pdf')
    handleExportClose()
  }

  const canManageSalespeople = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_KEEPER'

  // Load sales for a specific salesperson with date filters
  const loadSalespersonSales = async (salespersonId, startDate = null, endDate = null) => {
    try {
      setSalespersonSalesLoading(true)
      const params = {
        salespersonId: salespersonId,
        scopeType: 'WAREHOUSE' // Only warehouse sales have salespeople
      }
      
      // Add date filters if provided
      if (startDate) {
        params.startDate = startDate.toISOString().split('T')[0]
      }
      if (endDate) {
        params.endDate = endDate.toISOString().split('T')[0]
      }
      
      const response = await api.get('/sales', { params })
      if (response.data.success) {
        setSalespersonSales(response.data.data || [])
      }
    } catch (err) {
      console.error('Error loading salesperson sales:', err)
      setError(err.response?.data?.message || 'Failed to load sales')
      setSalespersonSales([])
    } finally {
      setSalespersonSalesLoading(false)
    }
  }

  // Handle view sales for salesperson
  const handleViewSales = (salesperson) => {
    setSelectedSalespersonForSales(salesperson)
    setSalesDialogOpen(true)
    // Reset dates to default (last 30 days)
    setSalespersonStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    setSalespersonEndDate(new Date())
    loadSalespersonSales(salesperson.id, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date())
  }

  // Handle date filter change
  const handleSalespersonDateFilterChange = () => {
    if (selectedSalespersonForSales) {
      loadSalespersonSales(selectedSalespersonForSales.id, salespersonStartDate, salespersonEndDate)
    }
  }

  // Quick date filter presets
  const setDateFilterPreset = (preset) => {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setHours(23, 59, 59, 999)
    
    let startDate = new Date()
    
    switch (preset) {
      case 'today':
        startDate = new Date(today)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate = new Date(today)
        startDate.setMonth(today.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case '3months':
        startDate = new Date(today)
        startDate.setMonth(today.getMonth() - 3)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'year':
        startDate = new Date(today)
        startDate.setFullYear(today.getFullYear() - 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'all':
        startDate = new Date(2020, 0, 1) // Very old date to get all records
        endDate = new Date(today)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        startDate.setHours(0, 0, 0, 0)
    }
    
    setSalespersonStartDate(startDate)
    setSalespersonEndDate(endDate)
    
    if (selectedSalespersonForSales) {
      loadSalespersonSales(selectedSalespersonForSales.id, startDate, endDate)
    }
  }

  // Export salesperson sales
  const generateSalesCSV = (salesData) => {
    const headers = ['ID', 'Date', 'Time', 'Invoice #', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment', 'Credit', 'Balance', 'Payment Method', 'Payment Status', 'Created By']
    const rows = salesData.map(sale => {
      const saleDate = new Date(sale.created_at)
      const customerInfo = sale.customerInfo || (sale.customer_info ? JSON.parse(sale.customer_info) : {})
      return [
        sale.id,
        saleDate.toLocaleDateString(),
        saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        sale.invoice_no || 'N/A',
        customerInfo.name || sale.customer_name || 'Walk-in Customer',
        parseFloat(sale.subtotal || 0).toFixed(2),
        parseFloat(sale.tax || 0).toFixed(2),
        parseFloat(sale.discount || 0).toFixed(2),
        parseFloat(sale.total || 0).toFixed(2),
        parseFloat(sale.payment_amount || 0).toFixed(2),
        parseFloat(sale.credit_amount || 0).toFixed(2),
        parseFloat(sale.running_balance || 0).toFixed(2),
        sale.payment_method || 'Cash',
        sale.payment_status || 'N/A',
        sale.username || sale.created_by || 'Unknown'
      ]
    })
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const generateSalesExcel = async (salesData) => {
    try {
      const XLSX = await import('xlsx')
      const excelData = salesData.map(sale => {
        const saleDate = new Date(sale.created_at)
        const customerInfo = sale.customerInfo || (sale.customer_info ? JSON.parse(sale.customer_info) : {})
        return {
          'ID': sale.id,
          'Date': saleDate.toLocaleDateString(),
          'Time': saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          'Invoice #': sale.invoice_no || 'N/A',
          'Customer': customerInfo.name || sale.customer_name || 'Walk-in Customer',
          'Subtotal': parseFloat(sale.subtotal || 0).toFixed(2),
          'Tax': parseFloat(sale.tax || 0).toFixed(2),
          'Discount': parseFloat(sale.discount || 0).toFixed(2),
          'Total': parseFloat(sale.total || 0).toFixed(2),
          'Payment': parseFloat(sale.payment_amount || 0).toFixed(2),
          'Credit': parseFloat(sale.credit_amount || 0).toFixed(2),
          'Balance': parseFloat(sale.running_balance || 0).toFixed(2),
          'Payment Method': sale.payment_method || 'Cash',
          'Payment Status': sale.payment_status || 'N/A',
          'Created By': sale.username || sale.created_by || 'Unknown'
        }
      })
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Data')
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      return excelBuffer
    } catch (error) {
      console.warn('XLSX library not available, falling back to CSV format:', error)
      return generateSalesCSV(salesData)
    }
  }

  const handleSalespersonExportClick = (event) => {
    setSalespersonExportMenuAnchor(event.currentTarget)
  }

  const handleSalespersonExportClose = () => {
    setSalespersonExportMenuAnchor(null)
  }

  // Generate PDF HTML for salesperson sales
  const generateSalesPDF = (salesData, salespersonName) => {
    const totalRevenue = salesData.reduce((sum, s) => sum + parseFloat(s.total || 0), 0)
    const totalPayment = salesData.reduce((sum, s) => sum + parseFloat(s.payment_amount || 0), 0)
    const totalCredit = salesData.reduce((sum, s) => sum + parseFloat(s.credit_amount || 0), 0)
    const totalTransactions = salesData.length
    
    const dateRange = salespersonStartDate && salespersonEndDate
      ? `${salespersonStartDate.toLocaleDateString()} to ${salespersonEndDate.toLocaleDateString()}`
      : 'All Time'
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salesperson Sales Report - ${salespersonName}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #333; 
              padding-bottom: 20px; 
            }
            .summary { 
              background: #f5f5f5; 
              padding: 15px; 
              margin-bottom: 20px; 
              border-radius: 5px;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 10px;
            }
            .summary-item {
              text-align: center;
              padding: 10px;
              background: white;
              border-radius: 3px;
            }
            .summary-label {
              font-size: 11px;
              color: #666;
              margin-bottom: 5px;
            }
            .summary-value {
              font-size: 18px;
              font-weight: bold;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px; 
              font-size: 11px;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #f2f2f2; 
              font-weight: bold;
            }
            .amount { text-align: right; }
            .status-completed { color: #28a745; font-weight: bold; }
            .status-pending { color: #ffc107; font-weight: bold; }
            .total-row { 
              font-weight: bold; 
              background-color: #e6f3ff; 
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Salesperson Sales Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p><strong>Salesperson:</strong> ${salespersonName}</p>
            <p><strong>Date Range:</strong> ${dateRange}</p>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Sales</div>
              <div class="summary-value">${totalTransactions}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Revenue</div>
              <div class="summary-value" style="color: #28a745;">${totalRevenue.toFixed(2)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Payments</div>
              <div class="summary-value" style="color: #2196f3;">${totalPayment.toFixed(2)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Credit</div>
              <div class="summary-value" style="color: #ff9800;">${totalCredit.toFixed(2)}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Customer</th>
                <th class="amount">Total</th>
                <th class="amount">Payment</th>
                <th class="amount">Credit</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(sale => {
                const saleDate = new Date(sale.created_at)
                const customerInfo = sale.customerInfo || (sale.customer_info ? JSON.parse(sale.customer_info) : {})
                const customerName = customerInfo.name || sale.customer_name || 'Walk-in Customer'
                return `
                  <tr>
                    <td>${saleDate.toLocaleDateString()} ${saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                    <td>${sale.invoice_no || 'N/A'}</td>
                    <td>${customerName}</td>
                    <td class="amount">${parseFloat(sale.total || 0).toFixed(2)}</td>
                    <td class="amount">${parseFloat(sale.payment_amount || 0).toFixed(2)}</td>
                    <td class="amount">${parseFloat(sale.credit_amount || 0).toFixed(2)}</td>
                    <td>${sale.payment_method || 'Cash'}</td>
                    <td class="status-${sale.payment_status?.toLowerCase() || 'completed'}">${sale.payment_status || 'COMPLETED'}</td>
                    <td>${sale.username || sale.created_by || 'Unknown'}</td>
                  </tr>
                `
              }).join('')}
              <tr class="total-row">
                <td colspan="3"><strong>Total</strong></td>
                <td class="amount"><strong>${totalRevenue.toFixed(2)}</strong></td>
                <td class="amount"><strong>${totalPayment.toFixed(2)}</strong></td>
                <td class="amount"><strong>${totalCredit.toFixed(2)}</strong></td>
                <td colspan="3"></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `
    return htmlContent
  }

  const exportSalespersonSalesCSV = () => {
    const csvContent = generateSalesCSV(salespersonSales)
    const salespersonName = selectedSalespersonForSales?.name?.replace(/\s+/g, '_') || 'salesperson'
    const dateSuffix = salespersonStartDate && salespersonEndDate
      ? `_${salespersonStartDate.toISOString().split('T')[0]}_to_${salespersonEndDate.toISOString().split('T')[0]}`
      : `_${new Date().toISOString().split('T')[0]}`
    downloadFile(csvContent, `sales_${salespersonName}${dateSuffix}.csv`, 'text/csv')
    handleSalespersonExportClose()
  }

  const exportSalespersonSalesExcel = async () => {
    try {
      const excelContent = await generateSalesExcel(salespersonSales)
      const salespersonName = selectedSalespersonForSales?.name?.replace(/\s+/g, '_') || 'salesperson'
      const dateSuffix = salespersonStartDate && salespersonEndDate
        ? `_${salespersonStartDate.toISOString().split('T')[0]}_to_${salespersonEndDate.toISOString().split('T')[0]}`
        : `_${new Date().toISOString().split('T')[0]}`
      downloadFile(excelContent, `sales_${salespersonName}${dateSuffix}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
    }
    handleSalespersonExportClose()
  }

  const exportSalespersonSalesPDF = () => {
    const salespersonName = selectedSalespersonForSales?.name || 'Salesperson'
    const pdfContent = generateSalesPDF(salespersonSales, salespersonName)
    const printWindow = window.open('', '_blank')
    printWindow.document.write(pdfContent)
    printWindow.document.close()
    
    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print()
    }, 250)
    
    handleSalespersonExportClose()
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
        <PermissionCheck roles={['ADMIN', 'WAREHOUSE_KEEPER']}>
    <Box sx={{ p: 3 }}>
            {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
            Salespeople Management
          </Typography>
            </Box>

            {/* Salespeople Statistics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Salespeople
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.totalSalespeople}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Active Salespeople
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.activeSalespeople}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Warehouses
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.warehouseCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Warehouses Covered
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.warehouseCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Salespeople Table */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Salespeople
          </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadData}
                    disabled={loading}
                    sx={{ minWidth: 120 }}
                  >
                    Refresh
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<ExportIcon />}
                    onClick={handleExportClick}
                    sx={{ minWidth: 120 }}
                  >
                    Export
                  </Button>
        {canManageSalespeople && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSalesperson}
          >
            Add Salesperson
          </Button>
        )}
                </Box>
      </Box>

              {/* Search and Filter Section */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <FilterIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="subtitle2">Search & Filters</Typography>
                  </Box>
                  
                  <Grid container spacing={2} alignItems="center">
                    {/* Search Input */}
                    <Grid item xs={12} md={6}>
          <TextField
            fullWidth
                        size="small"
                        label="Search Salespeople"
                        placeholder="Search by name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
                          endAdornment: searchTerm && (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setSearchTerm('')}
                                edge="end"
                              >
                                <ClearIcon />
                              </IconButton>
                            </InputAdornment>
                          )
            }}
          />
        </Grid>

                    {/* Warehouse Filter */}
                    {user?.role === 'ADMIN' && (
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Warehouse</InputLabel>
                          <Select
                            value={warehouseFilter}
                            label="Warehouse"
                            onChange={(e) => setWarehouseFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Warehouses</MenuItem>
                            {warehouses.map((warehouse) => (
                              <MenuItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>
            </CardContent>
          </Card>

      {/* Salespeople Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Salesperson</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Contact</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Warehouse</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSalespeople.map((salesperson) => (
              <TableRow key={salesperson.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="primary" />
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {salesperson.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {salesperson.id}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <PhoneIcon fontSize="small" color="action" />
                      <Typography variant="body2">{salesperson.phone}</Typography>
                    </Box>
                    {salesperson.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">{salesperson.email}</Typography>
                      </Box>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2">{salesperson.warehouse_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {salesperson.warehouse_code}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={salesperson.status}
                    color={salesperson.status === 'ACTIVE' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="View Sales">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewSales(salesperson)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEditSalesperson(salesperson)}
                        disabled={!canManageSalespeople}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSalesperson(salesperson)}
                        disabled={!canManageSalespeople || user?.role !== 'ADMIN'}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredSalespeople.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No salespeople found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try adjusting your search terms' : 'Add your first salesperson to get started'}
          </Typography>
        </Box>
      )}
            </Box>

      {/* Salesperson Form */}
      <SalespersonForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setSelectedSalesperson(null)
        }}
        salesperson={selectedSalesperson}
        onSave={handleFormSave}
        warehouses={warehouses}
        userRole={user?.role}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Salesperson</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{salespersonToDelete?.name}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportClose}
      >
        <MenuItem onClick={exportToCSV}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={exportToExcel}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as Excel
        </MenuItem>
        <MenuItem onClick={exportToPDF}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as PDF
        </MenuItem>
      </Menu>

      {/* Salesperson Sales Dialog */}
      <Dialog 
        open={salesDialogOpen} 
        onClose={() => {
          setSalesDialogOpen(false)
          setSelectedSalespersonForSales(null)
          setSalespersonSales([])
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SalesIcon color="primary" />
              <Typography variant="h6">
                Sales for {selectedSalespersonForSales?.name || 'Salesperson'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ExportIcon />}
                onClick={handleSalespersonExportClick}
                disabled={salespersonSales.length === 0}
              >
                Export
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Date Filter Section */}
          <Card sx={{ mb: 3, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ minWidth: 120 }}>Date Range:</Typography>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={salespersonStartDate}
                  onChange={(newValue) => {
                    setSalespersonStartDate(newValue)
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: 180 }
                    }
                  }}
                />
              </LocalizationProvider>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={salespersonEndDate}
                  onChange={(newValue) => {
                    setSalespersonEndDate(newValue)
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: 180 }
                    }
                  }}
                />
              </LocalizationProvider>
              <Button
                variant="contained"
                size="small"
                onClick={handleSalespersonDateFilterChange}
              >
                Apply Filter
              </Button>
            </Box>
            
            {/* Quick Date Presets */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" onClick={() => setDateFilterPreset('today')}>
                Today
              </Button>
              <Button size="small" variant="outlined" onClick={() => setDateFilterPreset('week')}>
                Last 7 Days
              </Button>
              <Button size="small" variant="outlined" onClick={() => setDateFilterPreset('month')}>
                Last Month
              </Button>
              <Button size="small" variant="outlined" onClick={() => setDateFilterPreset('3months')}>
                Last 3 Months
              </Button>
              <Button size="small" variant="outlined" onClick={() => setDateFilterPreset('year')}>
                Last Year
              </Button>
              <Button size="small" variant="outlined" onClick={() => setDateFilterPreset('all')}>
                All Time
              </Button>
            </Box>
          </Card>

          {salespersonSalesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : salespersonSales.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SalesIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No sales found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This salesperson hasn&apos;t made any sales yet
              </Typography>
            </Box>
          ) : (
            <>
              {/* Sales Summary */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Total Sales</Typography>
                    <Typography variant="h6">{salespersonSales.length}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Total Revenue</Typography>
                    <Typography variant="h6" color="success.main">
                      {salespersonSales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0).toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Total Payments</Typography>
                    <Typography variant="h6" color="primary.main">
                      {salespersonSales.reduce((sum, s) => sum + parseFloat(s.payment_amount || 0), 0).toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Total Credit</Typography>
                    <Typography variant="h6" color="warning.main">
                      {salespersonSales.reduce((sum, s) => sum + parseFloat(s.credit_amount || 0), 0).toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Sales Table */}
              <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Invoice #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Total</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Payment</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Credit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Payment Method</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Created By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salespersonSales.map((sale) => {
                      const saleDate = new Date(sale.created_at)
                      const customerInfo = sale.customerInfo || (sale.customer_info ? JSON.parse(sale.customer_info) : {})
                      return (
                        <TableRow key={sale.id} hover>
                          <TableCell>
                            {saleDate.toLocaleDateString()} {saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </TableCell>
                          <TableCell>{sale.invoice_no || 'N/A'}</TableCell>
                          <TableCell>{customerInfo.name || sale.customer_name || 'Walk-in Customer'}</TableCell>
                          <TableCell align="right">{parseFloat(sale.total || 0).toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            {parseFloat(sale.payment_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'warning.main' }}>
                            {parseFloat(sale.credit_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={sale.payment_method || 'Cash'} 
                              size="small"
                              color={sale.payment_method === 'FULLY_CREDIT' ? 'error' : sale.payment_method === 'PARTIAL_PAYMENT' ? 'warning' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={sale.payment_status || 'N/A'} 
                              size="small"
                              color={sale.payment_status === 'COMPLETED' ? 'success' : sale.payment_status === 'PENDING' ? 'warning' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{sale.username || sale.created_by || 'Unknown'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setSalesDialogOpen(false)
            setSelectedSalespersonForSales(null)
            setSalespersonSales([])
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Salesperson Sales Export Menu */}
      <Menu
        anchorEl={salespersonExportMenuAnchor}
        open={Boolean(salespersonExportMenuAnchor)}
        onClose={handleSalespersonExportClose}
      >
        <MenuItem onClick={exportSalespersonSalesCSV}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={exportSalespersonSalesExcel}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as Excel
        </MenuItem>
        <MenuItem onClick={exportSalespersonSalesPDF}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as PDF
        </MenuItem>
      </Menu>
    </Box>
        </PermissionCheck>
      </RouteGuard>
    </DashboardLayout>
  )
}

export default withAuth(SalespeoplePage)
