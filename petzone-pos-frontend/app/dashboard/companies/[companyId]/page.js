'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Chip,
  Menu,
  MenuItem,
  Alert,
  Stack,
  Divider,
  TextField,
  InputAdornment
} from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Paid,
  Inventory as InventoryIcon,
  Today,
  Assignment as AssignmentIcon,
  Place,
  Phone as PhoneIcon,
  Email as EmailIcon,
  BusinessCenter,
  WorkspacePremium,
  Timeline,
  LocalShipping,
  Assessment,
  Description,
  Category,
  Search
} from '@mui/icons-material'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import withAuth from '../../../../components/auth/withAuth'
import { useParams, useRouter } from 'next/navigation'
import { fetchCompanyDetails, exportCompanyDetailsReport } from '../../../store/slices/companiesSlice'

const defaultMetrics = {
  purchaseOrderCount: 0,
  totalPurchaseAmount: 0,
  totalQuantityOrdered: 0,
  inventoryItemCount: 0,
  totalCurrentStock: 0,
  lastPurchaseDate: null
}

const CompanyDetailPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()
  const { companyId } = useParams()

  const {
    detail,
    detailLoading,
    exportLoading,
    error
  } = useSelector((state) => state.companies || {
    detail: null,
    detailLoading: false,
    exportLoading: false,
    error: null
  })

  const [exportAnchor, setExportAnchor] = useState(null)
  const [historySearchTerm, setHistorySearchTerm] = useState('')
  const [historyStatus, setHistoryStatus] = useState('all')
  const [historyStartDate, setHistoryStartDate] = useState(null)
  const [historyEndDate, setHistoryEndDate] = useState(null)

  useEffect(() => {
    if (companyId) {
      dispatch(fetchCompanyDetails(companyId))
    }
  }, [dispatch, companyId])

  const handleOpenExportMenu = (event) => {
    setExportAnchor(event.currentTarget)
  }

  const handleCloseExportMenu = () => {
    setExportAnchor(null)
  }

  const handleExport = async (format) => {
    try {
      handleCloseExportMenu()
      const result = await dispatch(exportCompanyDetailsReport({ companyId, format })).unwrap()

      if (format === 'pdf') {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(result.data)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
        }, 250)
        return
      }

      const dataset = result?.data || result
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()

      const summarySheet = XLSX.utils.json_to_sheet([
        { Metric: 'Company Name', Value: dataset.company?.name || '' },
        { Metric: 'Code', Value: dataset.company?.code || '' },
        { Metric: 'Contact Person', Value: dataset.company?.contactPerson || '' },
        { Metric: 'Phone', Value: dataset.company?.phone || '' },
        { Metric: 'Email', Value: dataset.company?.email || '' },
        { Metric: 'Purchase Orders', Value: dataset.stats?.purchaseOrderCount || 0 },
        { Metric: 'Total Purchase Amount', Value: dataset.stats?.totalPurchaseAmount || 0 },
        { Metric: 'Products Purchased', Value: dataset.stats?.totalQuantityOrdered || 0 },
        { Metric: 'Inventory Items', Value: dataset.stats?.inventoryItemCount || 0 },
        { Metric: 'Last Purchase Date', Value: dataset.stats?.lastPurchaseDate ? new Date(dataset.stats.lastPurchaseDate).toLocaleDateString() : '—' }
      ])
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      const purchaseOrdersSheet = XLSX.utils.json_to_sheet((dataset.purchaseOrders || []).map(order => ({
        'Order #': order.order_number,
        Date: order.order_date ? new Date(order.order_date).toLocaleDateString() : (order.created_at ? new Date(order.created_at).toLocaleDateString() : ''),
        Status: order.status || '',
        'Total Amount': order.total_amount || 0,
        'Items Count': order.items?.length || 0
      })))
      XLSX.utils.book_append_sheet(workbook, purchaseOrdersSheet, 'Purchase Orders')

      const purchaseItems = []
      ;(dataset.purchaseOrders || []).forEach(order => {
        (order.items || []).forEach(item => {
          purchaseItems.push({
            'Order #': order.order_number,
            'Item Name': item.name,
            'SKU': item.sku,
            'Quantity Ordered': item.quantityOrdered,
            'Unit Price': item.unitPrice,
            'Total Price': item.totalPrice
          })
        })
      })
      if (purchaseItems.length > 0) {
        const purchaseItemsSheet = XLSX.utils.json_to_sheet(purchaseItems)
        XLSX.utils.book_append_sheet(workbook, purchaseItemsSheet, 'Purchase Order Items')
      }

      const inventorySheet = XLSX.utils.json_to_sheet((dataset.inventoryItems || []).map(item => ({
        Name: item.name,
        SKU: item.sku,
        Category: item.category,
        'Current Stock': item.current_stock,
        'Cost Price': item.cost_price,
        'Purchase Price': item.purchase_price,
        'Last Updated': item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''
      })))
      XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventory Items')

      const topProductsSheet = XLSX.utils.json_to_sheet((dataset.topProducts || []).map(product => ({
        Product: product.name,
        'Total Quantity': product.totalQuantity,
        'Total Cost': product.totalCost
      })))
      XLSX.utils.book_append_sheet(workbook, topProductsSheet, 'Top Products')

      const timelineSheet = XLSX.utils.json_to_sheet((dataset.purchaseTimeline || []).map(row => ({
        Period: row.period,
        Orders: row.orders,
        'Total Amount': row.totalAmount
      })))
      XLSX.utils.book_append_sheet(workbook, timelineSheet, 'Purchase Timeline')

      if (format === 'excel') {
        XLSX.writeFile(workbook, `company-${companyId}-detail-${Date.now()}.xlsx`)
      } else if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(summarySheet)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `company-${companyId}-summary-${Date.now()}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(downloadUrl)
      }
    } catch (error) {
      console.error('Error exporting company details:', error)
      alert(error?.message || 'Failed to export company details')
    }
  }

  const detailData = detail || { company: null, stats: defaultMetrics, purchaseOrders: [], inventoryItems: [], purchaseTimeline: [], topProducts: [] }
  const stats = detailData.stats || defaultMetrics

  const formatNumber = (value) => Number(value || 0).toLocaleString()
  const formatCurrency = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isLoading = detailLoading && !detail

  const purchaseTotals = useMemo(() => {
    const totalAmount = (detailData.purchaseOrders || []).reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0)
    const totalItems = (detailData.purchaseOrders || []).reduce((sum, order) => sum + (order.items?.length || 0), 0)
    return { totalAmount, totalItems }
  }, [detailData.purchaseOrders])

  const purchaseHistoryRows = useMemo(() => {
    if (!Array.isArray(detailData.purchaseOrders)) {
      return []
    }

    return detailData.purchaseOrders.flatMap((order, orderIndex) => {
      const rawDate = order?.order_date || order?.created_at || order?.updated_at || null
      const orderDate = rawDate ? new Date(rawDate) : null
      const orderDateMs = orderDate && !Number.isNaN(orderDate.getTime()) ? orderDate.getTime() : null
      const items = Array.isArray(order?.items) ? order.items : []

      if (items.length === 0) {
        return []
      }

      return items.map((item, itemIndex) => {
        const rawQuantity = item?.quantityOrdered ?? item?.quantity ?? item?.quantity_ordered ?? item?.qty ?? 0
        const quantity = Number(rawQuantity) || 0
        const rawUnitCost = item?.unitPrice ?? item?.purchase_price ?? item?.costPrice ?? item?.unit_cost ?? 0
        const unitCost = Number(rawUnitCost) || 0
        const rawTotalCost = item?.totalPrice ?? item?.total_price ?? (quantity * unitCost)
        const totalCost = Number(rawTotalCost) || 0

        return {
          id: `${order?.id || order?.order_number || orderIndex}-${item?.id || item?.sku || itemIndex}`,
          orderNumber: order?.order_number || `PO-${order?.id || orderIndex + 1}`,
          orderDate,
          orderDateMs,
          status: (order?.status || 'UNKNOWN').toUpperCase(),
          itemName: item?.name || item?.productName || item?.product_name || 'Unnamed Item',
          sku: item?.sku || item?.productSku || item?.product_sku || '—',
          category: item?.category || item?.productCategory || item?.product_category || '—',
          quantity,
          unitCost,
          totalCost
        }
      })
    })
  }, [detailData.purchaseOrders])

  const historyStatusOptions = useMemo(() => {
    const statuses = new Set(purchaseHistoryRows.map(row => row.status).filter(Boolean))
    return Array.from(statuses).sort()
  }, [purchaseHistoryRows])

  const filteredPurchaseHistory = useMemo(() => {
    const startMs = historyStartDate ? new Date(historyStartDate).setHours(0, 0, 0, 0) : null
    const endMs = historyEndDate ? new Date(historyEndDate).setHours(23, 59, 59, 999) : null
    const search = historySearchTerm.trim().toLowerCase()

    return purchaseHistoryRows.filter(row => {
      if (historyStatus !== 'all' && row.status !== historyStatus) {
        return false
      }

      if (startMs !== null) {
        if (row.orderDateMs === null || row.orderDateMs < startMs) {
          return false
        }
      }

      if (endMs !== null) {
        if (row.orderDateMs === null || row.orderDateMs > endMs) {
          return false
        }
      }

      if (search) {
        const haystack = `${row.orderNumber} ${row.itemName} ${row.sku} ${row.category}`.toLowerCase()
        if (!haystack.includes(search)) {
          return false
        }
      }

      return true
    })
  }, [purchaseHistoryRows, historyStartDate, historyEndDate, historyStatus, historySearchTerm])

  const sortedPurchaseHistory = useMemo(() => {
    return [...filteredPurchaseHistory].sort((a, b) => (b.orderDateMs ?? 0) - (a.orderDateMs ?? 0))
  }, [filteredPurchaseHistory])

  const purchaseHistorySummary = useMemo(() => {
    const totalQuantity = filteredPurchaseHistory.reduce((sum, row) => sum + (row.quantity || 0), 0)
    const totalValue = filteredPurchaseHistory.reduce((sum, row) => sum + (row.totalCost || 0), 0)
    const totalOrders = new Set(filteredPurchaseHistory.map(row => row.orderNumber)).size

    return {
      totalQuantity,
      totalValue,
      totalOrders,
      totalItems: filteredPurchaseHistory.length
    }
  }, [filteredPurchaseHistory])

  const historyFiltersActive = historyStatus !== 'all' || historySearchTerm.trim() !== '' || historyStartDate !== null || historyEndDate !== null

  const handleResetHistoryFilters = () => {
    setHistorySearchTerm('')
    setHistoryStatus('all')
    setHistoryStartDate(null)
    setHistoryEndDate(null)
  }

  const handleExportHistory = async () => {
    if (sortedPurchaseHistory.length === 0) {
      alert('No purchase history available to export.')
      return
    }

    try {
      const XLSX = await import('xlsx')
      const worksheetData = sortedPurchaseHistory.map(row => ({
        'Order #': row.orderNumber,
        Date: row.orderDate ? row.orderDate.toLocaleDateString() : '',
        Status: row.status,
        'Item Name': row.itemName,
        SKU: row.sku,
        Category: row.category,
        Quantity: row.quantity,
        'Unit Cost': row.unitCost,
        'Total Cost': row.totalCost
      }))

      const worksheet = XLSX.utils.json_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase History')
      XLSX.writeFile(workbook, `company-${companyId}-purchase-history-${Date.now()}.xlsx`)
    } catch (historyExportError) {
      console.error('Error exporting purchase history:', historyExportError)
      alert(historyExportError?.message || 'Failed to export purchase history')
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
      <DashboardLayout>
        <Box sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => router.push('/dashboard/companies')}
              >
                Back to Companies
              </Button>
              <Box>
                <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon sx={{ color: 'primary.main' }} />
                  Company Insight
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  Detailed purchase and inventory analytics for your supplier partners
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleOpenExportMenu}
              disabled={exportLoading || isLoading}
              sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
            >
              {exportLoading ? 'Exporting…' : 'Export Report'}
            </Button>
          </Stack>

          <Menu
            anchorEl={exportAnchor}
            open={Boolean(exportAnchor)}
            onClose={handleCloseExportMenu}
          >
            <MenuItem onClick={() => handleExport('pdf')}>PDF</MenuItem>
            <MenuItem onClick={() => handleExport('excel')}>Excel</MenuItem>
            <MenuItem onClick={() => handleExport('csv')}>CSV</MenuItem>
          </Menu>

          {error && !detail && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : !detailData.company ? (
            <Alert severity="info">Company details not available.</Alert>
          ) : (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6} lg={3}>
                  <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'primary.main', boxShadow: 3 }}>
                    <CardContent>
                      <Typography variant="overline" color="textSecondary">
                        Company Name
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
                        {detailData.company?.name || 'Unnamed Company'}
                      </Typography>
                      <Chip
                        icon={<WorkspacePremium fontSize="small" />}
                        label={`Code: ${detailData.company?.code || '—'}`}
                        size="small"
                        color="primary"
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} lg={3}>
                  <Card sx={{ height: '100%', boxShadow: 3 }}>
                    <CardContent>
                      <Typography variant="overline" color="textSecondary">
                        Primary Contact
                      </Typography>
                      <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessCenter fontSize="small" color="primary" />
                        {detailData.company?.contactPerson || '—'}
                      </Typography>
                      <Stack spacing={1} sx={{ mt: 2 }}>
                        {detailData.company?.phone && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PhoneIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="textSecondary">
                              {detailData.company.phone}
                            </Typography>
                          </Stack>
                        )}
                        {detailData.company?.email && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <EmailIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="textSecondary">
                              {detailData.company.email}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} lg={3}>
                  <Card sx={{ height: '100%', boxShadow: 3 }}>
                    <CardContent>
                      <Typography variant="overline" color="textSecondary">
                        Address
                      </Typography>
                      <Typography variant="body1" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Place fontSize="small" color="action" sx={{ mt: 0.2 }} />
                        {detailData.company?.address || '—'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} lg={3}>
                  <Card sx={{ height: '100%', boxShadow: 3 }}>
                    <CardContent>
                      <Typography variant="overline" color="textSecondary">
                        Scope & Status
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Chip
                          label={detailData.company?.status?.toUpperCase() || 'UNKNOWN'}
                          color={detailData.company?.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                        <Chip
                          label={`${detailData.company?.scopeType || 'N/A'} ${detailData.company?.scopeId ? `• ${detailData.company.scopeId}` : ''}`}
                          color={detailData.company?.scopeType === 'WAREHOUSE' ? 'info' : 'secondary'}
                          size="small"
                        />
                      </Stack>
                      <Typography variant="body2" color="textSecondary">
                        Created: {detailData.company?.created_at ? new Date(detailData.company.created_at).toLocaleDateString() : '—'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                  <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 4, position: 'relative', overflow: 'hidden' }}>
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'primary.light', opacity: 0.08 }} />
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Paid sx={{ fontSize: 30 }} />
                        </Box>
                        <Box>
                          <Typography color="textSecondary" variant="subtitle2">Total Purchase Amount</Typography>
                          <Typography variant="h5" fontWeight="bold">{`$${formatCurrency(stats.totalPurchaseAmount)}`}</Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 2, opacity: 0.12 }} />
                        <Typography variant="caption" color="textSecondary">
                        Last purchase {stats.lastPurchaseDate ? new Date(stats.lastPurchaseDate).toLocaleDateString() : '—'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'secondary.light', color: 'secondary.dark', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Assessment sx={{ fontSize: 30 }} />
                        </Box>
                        <Box>
                          <Typography color="textSecondary" variant="subtitle2">Purchase Orders</Typography>
                          <Typography variant="h5" fontWeight="bold">{formatNumber(stats.purchaseOrderCount)}</Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 2, opacity: 0.12 }} />
                      <Typography variant="caption" color="textSecondary">
                        Spend {formatCurrency(purchaseTotals.totalAmount)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'success.light', color: 'success.dark', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Category sx={{ fontSize: 30 }} />
                        </Box>
                        <Box>
                          <Typography color="textSecondary" variant="subtitle2">Products Purchased</Typography>
                          <Typography variant="h5" fontWeight="bold">{formatNumber(stats.totalQuantityOrdered)}</Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 2, opacity: 0.12 }} />
                      <Typography variant="caption" color="textSecondary">
                        Across {formatNumber(purchaseTotals.totalItems)} order lines
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'info.light', color: 'info.dark', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <InventoryIcon sx={{ fontSize: 30 }} />
                        </Box>
                        <Box>
                          <Typography color="textSecondary" variant="subtitle2">Inventory Items Linked</Typography>
                          <Typography variant="h5" fontWeight="bold">{formatNumber(stats.inventoryItemCount)}</Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 2, opacity: 0.12 }} />
                      <Typography variant="caption" color="textSecondary">
                        Current stock {formatNumber(stats.totalCurrentStock)} units
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={3}>
                <Grid item xs={12} lg={6}>
                  <Card sx={{ borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Timeline fontSize="small" color="primary" />
                        Purchase Timeline
                      </Typography>
                      <Table size="small" component={Paper} variant="outlined">
                        <TableHead>
                          <TableRow>
                            <TableCell>Period</TableCell>
                            <TableCell>Orders</TableCell>
                            <TableCell>Total Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(detailData.purchaseTimeline || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} align="center">No timeline data available</TableCell>
                            </TableRow>
                          ) : (
                            detailData.purchaseTimeline.map(row => (
                              <TableRow key={row.period}>
                                <TableCell>{row.period}</TableCell>
                                <TableCell>{formatNumber(row.orders)}</TableCell>
                                <TableCell>{formatCurrency(row.totalAmount)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} lg={6}>
                  <Card sx={{ borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalShipping fontSize="small" color="success" />
                        Top Purchased Products
                      </Typography>
                      <Table size="small" component={Paper} variant="outlined">
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Product</TableCell>
                            <TableCell>Total Quantity</TableCell>
                            <TableCell>Total Cost</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(detailData.topProducts || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center">No product insights available</TableCell>
                            </TableRow>
                          ) : (
                            detailData.topProducts.map((product, index) => (
                              <TableRow key={`${product.name}-${index}`}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{product.name}</TableCell>
                                <TableCell>{formatNumber(product.totalQuantity)}</TableCell>
                                <TableCell>{formatCurrency(product.totalCost)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card sx={{ borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Assessment fontSize="small" color="info" />
                        Recent Purchase Orders
                      </Typography>
                      <Table component={Paper} variant="outlined" size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Order #</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Total Amount</TableCell>
                            <TableCell>Items</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(detailData.purchaseOrders || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} align="center">No purchase orders recorded for this company yet.</TableCell>
                            </TableRow>
                          ) : (
                            detailData.purchaseOrders.map(order => (
                              <TableRow key={order.id}>
                                <TableCell>{order.order_number}</TableCell>
                                <TableCell>{order.order_date ? new Date(order.order_date).toLocaleDateString() : (order.created_at ? new Date(order.created_at).toLocaleDateString() : '—')}</TableCell>
                                <TableCell>
                                  <Chip label={order.status || 'Pending'} size="small" color={order.status === 'COMPLETED' ? 'success' : 'default'} />
                                </TableCell>
                                <TableCell>{formatCurrency(order.total_amount || 0)}</TableCell>
                                <TableCell>{order.items?.length || 0}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card sx={{ borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Assessment fontSize="small" color="secondary" />
                            Purchase History
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Review every item purchased from this company, filter by date or status, and export the filtered report.
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button variant="outlined" onClick={handleResetHistoryFilters} disabled={!historyFiltersActive}>
                            Clear Filters
                          </Button>
                          <Button variant="contained" onClick={handleExportHistory} disabled={sortedPurchaseHistory.length === 0}>
                            Export History
                          </Button>
                        </Stack>
                      </Stack>

                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6} md={3}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                              label="Start date"
                              value={historyStartDate}
                              onChange={(newValue) => setHistoryStartDate(newValue)}
                              slotProps={{ textField: { size: 'small', fullWidth: true } }}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                              label="End date"
                              value={historyEndDate}
                              onChange={(newValue) => setHistoryEndDate(newValue)}
                              slotProps={{ textField: { size: 'small', fullWidth: true } }}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            select
                            label="Status"
                            size="small"
                            fullWidth
                            value={historyStatus}
                            onChange={(event) => setHistoryStatus(event.target.value)}
                          >
                            <MenuItem value="all">All Statuses</MenuItem>
                            {historyStatusOptions.map(status => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <TextField
                            label="Search items, SKU, order #"
                            size="small"
                            fullWidth
                            value={historySearchTerm}
                            onChange={(event) => setHistorySearchTerm(event.target.value)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Search fontSize="small" />
                                </InputAdornment>
                              )
                            }}
                          />
                        </Grid>
                      </Grid>

                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="caption" color="textSecondary">Orders</Typography>
                            <Typography variant="h6" fontWeight="bold">{formatNumber(purchaseHistorySummary.totalOrders)}</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="caption" color="textSecondary">Line Items</Typography>
                            <Typography variant="h6" fontWeight="bold">{formatNumber(purchaseHistorySummary.totalItems)}</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="caption" color="textSecondary">Total Quantity</Typography>
                            <Typography variant="h6" fontWeight="bold">{formatNumber(purchaseHistorySummary.totalQuantity)}</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="caption" color="textSecondary">Total Spend</Typography>
                            <Typography variant="h6" fontWeight="bold">{`$${formatCurrency(purchaseHistorySummary.totalValue)}`}</Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Order #</TableCell>
                              <TableCell>Date</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Item</TableCell>
                              <TableCell>SKU</TableCell>
                              <TableCell>Category</TableCell>
                              <TableCell align="right">Quantity</TableCell>
                              <TableCell align="right">Unit Cost</TableCell>
                              <TableCell align="right">Total Cost</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sortedPurchaseHistory.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} align="center">No purchase history matches the current filters.</TableCell>
                              </TableRow>
                            ) : (
                              sortedPurchaseHistory.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell>{row.orderNumber}</TableCell>
                                  <TableCell>{row.orderDate ? row.orderDate.toLocaleDateString() : '—'}</TableCell>
                                  <TableCell>
                                    <Chip label={row.status} size="small" color={row.status === 'COMPLETED' ? 'success' : 'default'} />
                                  </TableCell>
                                  <TableCell>{row.itemName}</TableCell>
                                  <TableCell>{row.sku}</TableCell>
                                  <TableCell>{row.category}</TableCell>
                                  <TableCell align="right">{formatNumber(row.quantity)}</TableCell>
                                  <TableCell align="right">{formatCurrency(row.unitCost)}</TableCell>
                                  <TableCell align="right">{formatCurrency(row.totalCost)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card sx={{ borderRadius: 3, boxShadow: 4 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Description fontSize="small" color="secondary" />
                        Linked Inventory Items
                      </Typography>
                      <Table component={Paper} variant="outlined" size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>SKU</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell>Current Stock</TableCell>
                            <TableCell>Cost Price</TableCell>
                            <TableCell>Last Updated</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(detailData.inventoryItems || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} align="center">No inventory items linked to this company.</TableCell>
                            </TableRow>
                          ) : (
                            detailData.inventoryItems.map(item => (
                              <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.sku}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell>{formatNumber(item.current_stock)}</TableCell>
                                <TableCell>{formatCurrency(item.cost_price)}</TableCell>
                                <TableCell>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(CompanyDetailPage)

