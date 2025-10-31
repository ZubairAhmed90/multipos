'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  Pagination,
  Tabs,
  Tab,
  Divider,
  Avatar,
  LinearProgress,
  Menu,
  ButtonGroup,
  Popover
} from '@mui/material'
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  Undo as UndoIcon,
  Build as BuildIcon,
  SwapHoriz as TransferIcon,
  Assessment as AssessmentIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  ArrowDropDown as ArrowDropDownIcon,
  PictureAsPdf as PDFIcon,
  TableChart as ExcelIcon
} from '@mui/icons-material'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import { fetchInventoryReports, fetchStockSummary, fetchStockStatistics } from '../../../app/store/slices/reportsSlice'

function StockReportsPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { inventoryReports, stockSummary, stockStatistics, isLoading, error } = useSelector((state) => state.reports)
  
  // State management
  const [activeTab, setActiveTab] = useState(0)
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null)
  
  // Filter states
  const [filters, setFilters] = useState({
    searchTerm: '',
    scopeType: 'all',
    scopeId: 'all',
    transactionType: 'all',
    itemCategory: 'all',
    startDate: '',
    endDate: '',
    userRole: 'all',
    specificProduct: '', // New: Filter by specific product
    priceRange: { min: '', max: '' }, // New: Price range filter
    stockStatus: 'all', // New: Low stock, out of stock, etc.
    showPriceChanges: false, // New: Show only transactions with price changes
    showRestockOnly: false // New: Show only restock transactions
  })
  
  // Pagination states
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 25
  })

  // Update pagination from Redux state
  useEffect(() => {
    if (inventoryReports?.pagination) {
      setPagination(prev => ({
        ...prev,
        totalPages: inventoryReports.pagination.totalPages,
        totalCount: inventoryReports.pagination.totalCount
      }))
    }
  }, [inventoryReports])

  useEffect(() => {
    if (stockSummary?.pagination) {
      setPagination(prev => ({
        ...prev,
        totalPages: stockSummary.pagination.totalPages,
        totalCount: stockSummary.pagination.totalCount
      }))
    }
  }, [stockSummary])

  // Load stock reports
  const loadStockReports = useCallback(async () => {
    const params = {
      page: pagination.currentPage,
      limit: pagination.limit,
      ...filters
    }
    
    // Remove 'all' values
    Object.keys(params).forEach(key => {
      if (params[key] === 'all' || params[key] === '') {
        delete params[key]
      }
    })
    
    dispatch(fetchInventoryReports(params))
  }, [dispatch, pagination.currentPage, pagination.limit, filters])

  // Load stock summary
  const loadStockSummary = useCallback(async () => {
    const params = {
      page: pagination.currentPage,
      limit: pagination.limit,
      ...filters
    }
    
    // Remove 'all' values
    Object.keys(params).forEach(key => {
      if (params[key] === 'all' || params[key] === '') {
        delete params[key]
      }
    })
    
    dispatch(fetchStockSummary(params))
  }, [dispatch, pagination.currentPage, pagination.limit, filters])

  // Load statistics
  const loadStatistics = useCallback(async () => {
    const params = { ...filters }
    
    // Remove 'all' values
    Object.keys(params).forEach(key => {
      if (params[key] === 'all' || params[key] === '') {
        delete params[key]
      }
    })
    
    dispatch(fetchStockStatistics(params))
  }, [dispatch, filters])

  // Load data based on active tab
  const loadData = useCallback(async () => {
    if (activeTab === 0) {
      await loadStockReports()
    } else if (activeTab === 1) {
      await loadStockSummary()
    } else if (activeTab === 2) {
      await loadStatistics()
    }
  }, [activeTab, loadStockReports, loadStockSummary, loadStatistics])

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [activeTab, pagination.currentPage, pagination.limit, loadData])

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }))
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      scopeType: 'all',
      scopeId: 'all',
      transactionType: 'all',
      itemCategory: 'all',
      startDate: '',
      endDate: '',
      userRole: 'all',
      specificProduct: '',
      priceRange: { min: '', max: '' },
      stockStatus: 'all',
      showPriceChanges: false,
      showRestockOnly: false
    })
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }))
  }

  // Handle pagination
  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }))
  }

  const handleRowsPerPageChange = (event) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(event.target.value),
      currentPage: 1
    }))
  }

  // Handle export menu
  const handleExportMenuOpen = (event) => {
    console.log('Export button clicked', event.currentTarget)
    setExportMenuAnchor(event.currentTarget)
  }

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null)
  }

  const generatePDFContent = (data, headers, fieldMapping, title) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .positive { color: #28a745; }
            .negative { color: #dc3545; }
            .footer { margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map((row, index) => {
                const values = headers.map(header => {
                  const fieldKey = fieldMapping[header] || header.toLowerCase().replace(/\s+/g, '')
                  let value = row[fieldKey] || ''
                  
                  if (value === null || value === undefined) value = ''
                  
                  // Format dates
                  if (header.includes('Date') && value) {
                    value = new Date(value).toLocaleString()
                  }
                  
                  // Format numbers
                  if (typeof value === 'number') {
                    value = value.toFixed(2)
                  }
                  
                  return value || ''
                })
                return `<tr>${values.map(v => `<td>${v}</td>`).join('')}</tr>`
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Total Records: ${data.length}</p>
            <p>MultiPOS Dashboard - Stock Reports</p>
          </div>
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

  const handleExportPDF = () => {
    handleExportMenuClose()
    
    // Get current data based on active tab
    let exportData = []
    let headers = []
    let fieldMapping = {}
    let title = 'Stock Reports'
    
    if (activeTab === 0) {
      // Stock Reports data
      exportData = inventoryReports?.data || []
      headers = ['Date & Time', 'Product', 'Transaction Type', 'Quantity Change', 'Previous Stock', 'Available Stock', 'Unit Price', 'Total Value', 'User', 'Scope']
      fieldMapping = {
        'Date & Time': 'createdAt',
        'Product': 'itemName',
        'Transaction Type': 'transactionType',
        'Quantity Change': 'quantityChange',
        'Previous Stock': 'previousQuantity',
        'Available Stock': 'newQuantity',
        'Unit Price': 'unitPrice',
        'Total Value': 'totalValue',
        'User': 'userName',
        'Scope': 'scopeName'
      }
      title = 'Stock Transaction Reports'
    } else if (activeTab === 1) {
      // Stock Summary data
      exportData = stockSummary?.data || []
      headers = ['Item', 'Current Stock', 'Min Level', 'Max Level', 'Cost Price', 'Selling Price', 'Stock Value', 'Total Purchased', 'Total Sold', 'Total Returned', 'Total Adjusted', 'Net Change']
      fieldMapping = {
        'Item': 'itemName',
        'Current Stock': 'currentStock',
        'Min Level': 'minStockLevel',
        'Max Level': 'maxStockLevel',
        'Cost Price': 'costPrice',
        'Selling Price': 'sellingPrice',
        'Stock Value': 'currentStockValue',
        'Total Purchased': 'totalPurchased',
        'Total Sold': 'totalSold',
        'Total Returned': 'totalReturned',
        'Total Adjusted': 'totalAdjusted',
        'Net Change': 'netChange'
      }
      title = 'Stock Summary Report'
    } else {
      // Statistics data - properly format the nested data
      const formattedStats = []
      
      if (stockStatistics) {
        // Overall statistics
        if (stockStatistics.overall) {
          formattedStats.push({
            category: 'Total Transactions',
            value: stockStatistics.overall.total_transactions || 0
          })
          formattedStats.push({
            category: 'Total Purchased',
            value: stockStatistics.overall.total_purchased || 0
          })
          formattedStats.push({
            category: 'Total Sold',
            value: stockStatistics.overall.total_sold || 0
          })
          formattedStats.push({
            category: 'Total Returned',
            value: stockStatistics.overall.total_returned || 0
          })
          formattedStats.push({
            category: 'Total Adjusted',
            value: stockStatistics.overall.total_adjusted || 0
          })
          formattedStats.push({
            category: 'Total Transferred In',
            value: stockStatistics.overall.total_transferred_in || 0
          })
          formattedStats.push({
            category: 'Total Transferred Out',
            value: stockStatistics.overall.total_transferred_out || 0
          })
        }
        
        // Transaction types
        if (stockStatistics.transactionTypes && Array.isArray(stockStatistics.transactionTypes)) {
          stockStatistics.transactionTypes.forEach(type => {
            formattedStats.push({
              category: `${type.transactionType || type.transaction_type}`,
              value: `${type.count || 0} transactions, Total Qty: ${type.totalQuantity || 0}`
            })
          })
        }
        
        // Top items
        if (stockStatistics.topItems && Array.isArray(stockStatistics.topItems)) {
          stockStatistics.topItems.forEach((item, index) => {
            formattedStats.push({
              category: `Top Item ${index + 1}: ${item.itemName || item.item_name}`,
              value: `${item.transactionCount || 0} transactions, Total Qty: ${item.totalQuantity || 0}`
            })
          })
        }
        
        // Daily activity
        if (stockStatistics.dailyActivity && Array.isArray(stockStatistics.dailyActivity)) {
          stockStatistics.dailyActivity.forEach(day => {
            formattedStats.push({
              category: `Daily Activity: ${day.date}`,
              value: `Purchased: ${day.purchased || 0}, Sold: ${day.sold || 0}, Returned: ${day.returned || 0}`
            })
          })
        }
      }
      
      exportData = formattedStats
      headers = ['Category', 'Value']
      fieldMapping = { 'Category': 'category', 'Value': 'value' }
      title = 'Stock Statistics Report'
    }
    
    const pdfContent = generatePDFContent(exportData, headers, fieldMapping, title)
    downloadFile(pdfContent, `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`, 'application/pdf')
  }

  const handleExportExcel = () => {
    handleExportMenuClose()
    
    // Get current data based on active tab
    let exportData = []
    let headers = []
    let filename = 'stock-reports.xlsx'
    
    if (activeTab === 0) {
      // Stock Reports data
      exportData = inventoryReports?.data || []
      headers = ['Date & Time', 'Product', 'Transaction Type', 'Quantity Change', 'Previous Stock', 'Available Stock', 'Unit Price', 'Total Value', 'Price Change', 'User', 'Scope']
      filename = 'stock-reports.xlsx'
    } else if (activeTab === 1) {
      // Stock Summary data
      exportData = stockSummary?.data || []
      headers = ['Item', 'Current Stock', 'Min Level', 'Max Level', 'Cost Price', 'Selling Price', 'Stock Value', 'Total Purchased', 'Total Sold', 'Total Returned', 'Total Adjusted', 'Net Change']
      filename = 'stock-summary.xlsx'
    } else {
      // Statistics data - flatten for export
      exportData = stockStatistics ? Object.entries(stockStatistics).flatMap(([key, value]) => 
        Array.isArray(value) ? value.map(item => ({ category: key, ...item })) : [{ category: key, value }]
      ) : []
      headers = ['Category', 'Value']
      filename = 'stock-statistics.xlsx'
    }
    
    // Convert to CSV and download
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => {
        const values = headers.map(header => {
          // Convert header to field name (camelCase or snake_case)
          const fieldName = header.toLowerCase().replace(/\s+/g, '')
          const value = row[fieldName] || ''
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value || ''
        })
        return values.join(',')
      })
    ].join('\n')
    
    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename.replace('.xlsx', '.csv'))
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Get transaction type color
  const getTransactionTypeColor = (type) => {
    const colors = {
      'PURCHASE': 'success',
      'SALE': 'primary',
      'RETURN': 'warning',
      'ADJUSTMENT': 'info',
      'TRANSFER_IN': 'secondary',
      'TRANSFER_OUT': 'error'
    }
    return colors[type] || 'default'
  }

  // Get transaction type icon
  const getTransactionTypeIcon = (type) => {
    const icons = {
      'PURCHASE': <TrendingUpIcon />,
      'SALE': <ShoppingCartIcon />,
      'RETURN': <UndoIcon />,
      'ADJUSTMENT': <BuildIcon />,
      'TRANSFER_IN': <TransferIcon />,
      'TRANSFER_OUT': <TransferIcon />
    }
    return icons[type] || <InventoryIcon />
  }

  // Render stock reports table
  const renderStockReportsTable = () => (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date & Time</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Transaction Type</TableCell>
            <TableCell>Quantity Change</TableCell>
            <TableCell>Previous Stock</TableCell>
            <TableCell>Available Stock</TableCell>
            <TableCell>Unit Price</TableCell>
            <TableCell>Total Value</TableCell>
            <TableCell>Price Change</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Scope</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(Array.isArray(inventoryReports?.data) ? inventoryReports.data : []).map((report) => {
            // Debug: Log the report data to see what fields are available
            console.log('Stock report data:', report);
            return (
            <TableRow key={report.id} hover>
              <TableCell>
                {new Date(report.createdAt).toLocaleDateString()}
                <br />
                <Typography variant="caption" color="text.secondary">
                  {new Date(report.createdAt).toLocaleTimeString()}
                </Typography>
              </TableCell>
              <TableCell>
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {report.itemName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {report.itemCategory}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  icon={getTransactionTypeIcon(report.transactionType)}
                  label={report.transactionType}
                  color={getTransactionTypeColor(report.transactionType)}
                  size="small"
                  variant="outlined"
                />
                {report.adjustmentReason && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {report.adjustmentReason}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {report.quantityChange > 0 ? (
                    <TrendingUpIcon color="success" fontSize="small" />
                  ) : (
                    <TrendingDownIcon color="error" fontSize="small" />
                  )}
                  <Typography
                    color={report.quantityChange > 0 ? 'success.main' : 'error.main'}
                    fontWeight="medium"
                  >
                    {report.quantityChange > 0 ? '+' : ''}{report.quantityChange}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>{report.previousQuantity}</TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">{report.newQuantity}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="primary.main">
                  {parseFloat(report.unitPrice || 0).toFixed(2)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">
                  {parseFloat(report.totalValue || 0).toFixed(2)}
                </Typography>
              </TableCell>
              <TableCell>
                {report.priceChange ? (
                  <Chip
                    label={report.priceChange > 0 ? `+${report.priceChange.toFixed(2)}` : `-$${Math.abs(report.priceChange).toFixed(2)}`}
                    color={report.priceChange > 0 ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                ) : (
                  <Typography variant="caption" color="text.secondary">No change</Typography>
                )}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                    {report.userName?.charAt(0)?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">{report.userName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {report.userRole}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  label={report.scopeName}
                  variant="outlined"
                  size="small"
                  color={report.scopeType === 'BRANCH' ? 'primary' : 'secondary'}
                />
              </TableCell>
              <TableCell>
                <Tooltip title="View Product History">
                  <IconButton
                    size="small"
                    onClick={() => {
                      console.log('Button clicked for report:', report);
                      console.log('inventoryItemId value:', report.inventoryItemId);
                      console.log('All report fields:', Object.keys(report));
                      
                      // Try multiple possible field names
                      const productId = report.inventoryItemId || report.inventory_item_id || report.itemId;
                      
                      if (productId) {
                        window.open(`/dashboard/stock-reports/product/${productId}`, '_blank');
                      } else {
                        console.error('Inventory Item ID is undefined for report:', report);
                        alert('Product ID not available. Please refresh the page and try again.');
                      }
                    }}
                    disabled={!report.inventoryItemId && !report.inventory_item_id && !report.itemId}
                  >
                    <ViewIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )

  // Render stock summary table
  const renderStockSummaryTable = () => (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell>Current Stock</TableCell>
            <TableCell>Total Purchased</TableCell>
            <TableCell>Total Sold</TableCell>
            <TableCell>Total Returned</TableCell>
            <TableCell>Net Change</TableCell>
            <TableCell>Stock Value</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(Array.isArray(stockSummary?.data) ? stockSummary.data : []).map((summary) => {
            // Ensure all values are numbers with proper defaults
            const totalPurchased = parseFloat(summary.totalPurchased || 0)
            const totalSold = parseFloat(summary.totalSold || 0)
            const totalReturned = parseFloat(summary.totalReturned || 0)
            const totalAdjusted = parseFloat(summary.totalAdjusted || 0)
            const totalTransferredIn = parseFloat(summary.totalTransferredIn || 0)
            const totalTransferredOut = parseFloat(summary.totalTransferredOut || 0)
            
            const netChange = totalPurchased - totalSold + totalReturned + totalAdjusted + totalTransferredIn - totalTransferredOut
            const stockStatus = summary.currentStock <= summary.minStockLevel ? 'low' : 
                               summary.currentStock >= summary.maxStockLevel ? 'high' : 'normal'
            
            return (
              <TableRow key={summary.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {summary.itemName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {summary.itemCategory}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography fontWeight="medium">
                    {summary.currentStock}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography color="success.main">
                    {totalPurchased.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography color="primary.main">
                    {totalSold.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography color="warning.main">
                    {totalReturned.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography color={netChange >= 0 ? 'success.main' : 'error.main'}>
                    {netChange >= 0 ? '+' : ''}{netChange.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {parseFloat(summary.currentStockValue || 0).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={stockStatus.toUpperCase()}
                    color={stockStatus === 'low' ? 'error' : stockStatus === 'high' ? 'warning' : 'success'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )

  // Render statistics
  const renderStatistics = () => {
    if (!stockStatistics) return null

    console.log('[StockReports] stockStatistics:', stockStatistics)
    const { overall, transactionTypes, topItems, dailyActivity } = stockStatistics || {}
    console.log('[StockReports] transactionTypes:', transactionTypes, 'topItems:', topItems)

    return (
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Overall Statistics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Overall Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {overall?.totalTransactions || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Transactions
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {overall?.totalPurchased || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Purchased
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">
                      {overall?.totalSold || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Sold
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {overall?.totalReturned || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Returned
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Transaction Types */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transaction Types
              </Typography>
              {(Array.isArray(transactionTypes) ? transactionTypes : []).map((type) => (
                <Box key={type.transactionType} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {type.transactionType}
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {type.count} transactions
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(type.count / (overall?.totalTransactions || 1)) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Items */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Items by Transactions
              </Typography>
              {(Array.isArray(topItems) ? topItems : []).slice(0, 5).map((item, index) => (
                <Box key={item.inventoryItemId} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {item.itemName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.transactionCount} transactions
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Category: {item.itemCategory}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Stock Reports
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadData}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={handleExportMenuOpen}
                disabled={isLoading}
                sx={{ textTransform: 'none' }}
              >
                Export
              </Button>
              <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={handleExportMenuClose}
              >
                <MenuItem onClick={handleExportPDF}>
                  <PDFIcon sx={{ mr: 1 }} />
                  Export to PDF
                </MenuItem>
                <MenuItem onClick={handleExportExcel}>
                  <ExcelIcon sx={{ mr: 1 }} />
                  Export to Excel
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Filters & Search
              </Typography>
              
              {/* First Row - Basic Filters */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search items..."
                    value={filters.searchTerm}
                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Specific product..."
                    value={filters.specificProduct}
                    onChange={(e) => handleFilterChange('specificProduct', e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <InventoryIcon />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Scope Type</InputLabel>
                    <Select
                      value={filters.scopeType}
                      onChange={(e) => handleFilterChange('scopeType', e.target.value)}
                      label="Scope Type"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="BRANCH">Branch</MenuItem>
                      <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Transaction</InputLabel>
                    <Select
                      value={filters.transactionType}
                      onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                      label="Transaction"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="PURCHASE">Purchase</MenuItem>
                      <MenuItem value="SALE">Sale</MenuItem>
                      <MenuItem value="RETURN">Return</MenuItem>
                      <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
                      <MenuItem value="TRANSFER_IN">Transfer In</MenuItem>
                      <MenuItem value="TRANSFER_OUT">Transfer Out</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={filters.itemCategory}
                      onChange={(e) => handleFilterChange('itemCategory', e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="Electronics">Electronics</MenuItem>
                      <MenuItem value="Clothing">Clothing</MenuItem>
                      <MenuItem value="Food">Food</MenuItem>
                      <MenuItem value="Books">Books</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="End Date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>

              {/* Second Row - Advanced Filters */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Stock Status</InputLabel>
                    <Select
                      value={filters.stockStatus}
                      onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
                      label="Stock Status"
                    >
                      <MenuItem value="all">All Items</MenuItem>
                      <MenuItem value="low_stock">Low Stock</MenuItem>
                      <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                      <MenuItem value="in_stock">In Stock</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Min Price"
                    value={filters.priceRange?.min || ''}
                    onChange={(e) => handleFilterChange('priceRange', { ...(filters.priceRange || {}), min: e.target.value })}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"></InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Max Price"
                    value={filters.priceRange?.max || ''}
                    onChange={(e) => handleFilterChange('priceRange', { ...(filters.priceRange || {}), max: e.target.value })}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"></InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>User Role</InputLabel>
                    <Select
                      value={filters.userRole}
                      onChange={(e) => handleFilterChange('userRole', e.target.value)}
                      label="User Role"
                    >
                      <MenuItem value="all">All Users</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                      <MenuItem value="CASHIER">Cashier</MenuItem>
                      <MenuItem value="WAREHOUSE_KEEPER">Warehouse Keeper</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    variant={filters.showPriceChanges ? "contained" : "outlined"}
                    size="small"
                    onClick={() => handleFilterChange('showPriceChanges', !filters.showPriceChanges)}
                    startIcon={<TrendingUpIcon />}
                  >
                    Price Changes
                  </Button>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    variant={filters.showRestockOnly ? "contained" : "outlined"}
                    size="small"
                    onClick={() => handleFilterChange('showRestockOnly', !filters.showRestockOnly)}
                    startIcon={<InventoryIcon />}
                  >
                    Restock Only
                  </Button>
                </Grid>
                <Grid item xs={12} md={1}>
                  <IconButton
                    onClick={clearFilters}
                    color="primary"
                    title="Clear Filters"
                  >
                    <ClearIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                <Tab label="Stock Reports" />
                <Tab label="Stock Summary" />
                <Tab label="Statistics" />
              </Tabs>
            </Box>

            <CardContent>
              {isLoading && <LinearProgress sx={{ mb: 2 }} />}
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Tab Content */}
              {activeTab === 0 && renderStockReportsTable()}
              {activeTab === 1 && renderStockSummaryTable()}
              {activeTab === 2 && renderStatistics()}

              {/* Pagination */}
              {activeTab !== 2 && pagination.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to{' '}
                      {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of{' '}
                      {pagination.totalCount} entries
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={pagination.limit}
                        onChange={handleRowsPerPageChange}
                      >
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Pagination
                    count={pagination.totalPages}
                    page={pagination.currentPage}
                    onChange={handlePageChange}
                    color="primary"
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </RouteGuard>
    </DashboardLayout>
  )
}

export default StockReportsPage





