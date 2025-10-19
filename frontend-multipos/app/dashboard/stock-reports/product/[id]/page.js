'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Grid,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Avatar,
  Divider,
  Tabs,
  Tab
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShoppingCart as ShoppingCartIcon,
  Undo as UndoIcon,
  Build as BuildIcon,
  SwapHoriz as TransferIcon,
  Inventory as InventoryIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material'
import DashboardLayout from '../../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../../components/auth/RouteGuard'
import api from '../../../../../utils/axios'

function ProductStockHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id
  
  // State management
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  
  // Data state
  const [productData, setProductData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [dailyMovements, setDailyMovements] = useState([])
  const [monthlyMovements, setMonthlyMovements] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])

  const loadProductData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.get(`/stock-reports/product/${productId}`)
      const data = response.data.data
      
      setProductData(data.inventoryItem)
      setSummary(data.summary)
      setDailyMovements(data.dailyMovements)
      setMonthlyMovements(data.monthlyMovements)
      setRecentTransactions(data.recentTransactions)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load product data')
    } finally {
      setLoading(false)
    }
  }, [productId])

  // Load product data
  useEffect(() => {
    if (productId) {
      loadProductData()
    }
  }, [productId, loadProductData])

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

  // Render product overview
  const renderProductOverview = () => {
    if (!productData) return null

    const stockStatus = productData.currentStock <= productData.minStockLevel ? 'low' : 
                       productData.currentStock >= productData.maxStockLevel ? 'high' : 'normal'
    
    const stockPercentage = (productData.currentStock / productData.maxStockLevel) * 100

    return (
      <Grid container spacing={3}>
        {/* Product Info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Product Information
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {productData.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  SKU: {productData.sku || 'N/A'} | Category: {productData.category}
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Cost Price
                  </Typography>
                  <Typography variant="h6" color="primary">
                    ${productData.costPrice?.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Selling Price
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ${productData.sellingPrice?.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Stock Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stock Status
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">
                    Current Stock
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {productData.currentStock}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(stockPercentage, 100)}
                  color={stockStatus === 'low' ? 'error' : stockStatus === 'high' ? 'warning' : 'success'}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Min Level
                  </Typography>
                  <Typography variant="body1">
                    {productData.minStockLevel}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Max Level
                  </Typography>
                  <Typography variant="body1">
                    {productData.maxStockLevel}
                  </Typography>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Chip
                  label={`Stock ${stockStatus.toUpperCase()}`}
                  color={stockStatus === 'low' ? 'error' : stockStatus === 'high' ? 'warning' : 'success'}
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  // Render summary statistics
  const renderSummaryStatistics = () => {
    if (!summary) return null

    // Ensure all values are numbers with proper defaults
    const totalPurchased = parseFloat(summary.total_purchased || 0)
    const totalSold = parseFloat(summary.total_sold || 0)
    const totalReturned = parseFloat(summary.total_returned || 0)
    const totalAdjusted = parseFloat(summary.total_adjusted || 0)
    const totalTransferredIn = parseFloat(summary.total_transferred_in || 0)
    const totalTransferredOut = parseFloat(summary.total_transferred_out || 0)

    const netChange = totalPurchased - totalSold + totalReturned + totalAdjusted + totalTransferredIn - totalTransferredOut

    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Summary Statistics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  {totalPurchased.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Purchased
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary.main">
                  {totalSold.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Sold
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Typography variant="h4" color="warning.main">
                  {totalReturned.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Returned
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Typography variant="h4" color="info.main">
                  {totalAdjusted.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Adjusted
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Typography variant="h4" color={netChange >= 0 ? 'success.main' : 'error.main'}>
                  {netChange >= 0 ? '+' : ''}{netChange.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Net Change
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {summary.total_transactions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Transactions
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    )
  }

  // Render daily movements chart
  const renderDailyMovements = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Daily Movements (Last 30 Days)
        </Typography>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Purchased</TableCell>
                <TableCell>Sold</TableCell>
                <TableCell>Returned</TableCell>
                <TableCell>Adjusted</TableCell>
                <TableCell>Net Change</TableCell>
                <TableCell>Transactions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyMovements.map((movement, index) => {
                // Ensure all values are numbers with proper defaults
                const purchased = parseFloat(movement.purchased || 0)
                const sold = parseFloat(movement.sold || 0)
                const returned = parseFloat(movement.returned || 0)
                const adjusted = parseFloat(movement.adjusted || 0)
                
                const netChange = purchased - sold + returned + adjusted
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      {new Date(movement.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Typography color="success.main">
                        +{purchased.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="primary.main">
                        -{sold.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="warning.main">
                        +{returned.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="info.main">
                        {adjusted >= 0 ? '+' : ''}{adjusted.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color={netChange >= 0 ? 'success.main' : 'error.main'}>
                        {netChange >= 0 ? '+' : ''}{netChange.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {movement.transactions}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )

  // Render monthly movements chart
  const renderMonthlyMovements = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Monthly Movements (Last 12 Months)
        </Typography>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell>Purchased</TableCell>
                <TableCell>Sold</TableCell>
                <TableCell>Returned</TableCell>
                <TableCell>Adjusted</TableCell>
                <TableCell>Net Change</TableCell>
                <TableCell>Transactions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {monthlyMovements.map((movement, index) => {
                // Ensure all values are numbers with proper defaults
                const purchased = parseFloat(movement.purchased || 0)
                const sold = parseFloat(movement.sold || 0)
                const returned = parseFloat(movement.returned || 0)
                const adjusted = parseFloat(movement.adjusted || 0)
                
                const netChange = purchased - sold + returned + adjusted
                const monthName = new Date(movement.year, movement.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      {monthName}
                    </TableCell>
                    <TableCell>
                      <Typography color="success.main">
                        +{purchased.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="primary.main">
                        -{sold.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="warning.main">
                        +{returned.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="info.main">
                        {adjusted >= 0 ? '+' : ''}{adjusted.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color={netChange >= 0 ? 'success.main' : 'error.main'}>
                        {netChange >= 0 ? '+' : ''}{netChange.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {movement.transactions}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )

  // Render recent transactions
  const renderRecentTransactions = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent Transactions
        </Typography>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Transaction</TableCell>
                <TableCell>Quantity Change</TableCell>
                <TableCell>Previous Qty</TableCell>
                <TableCell>New Qty</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>User</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentTransactions.map((transaction) => (
                <TableRow key={transaction.id} hover>
                  <TableCell>
                    {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : 'Invalid Date'}
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      {transaction.createdAt ? new Date(transaction.createdAt).toLocaleTimeString() : 'Invalid Time'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getTransactionTypeIcon(transaction.transactionType)}
                      label={transaction.transactionType}
                      color={getTransactionTypeColor(transaction.transactionType)}
                      size="small"
                      variant="outlined"
                    />
                    {transaction.adjustmentReason && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {transaction.adjustmentReason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {transaction.quantityChange > 0 ? (
                        <TrendingUpIcon color="success" fontSize="small" />
                      ) : (
                        <TrendingDownIcon color="error" fontSize="small" />
                      )}
                      <Typography
                        color={transaction.quantityChange > 0 ? 'success.main' : 'error.main'}
                        fontWeight="medium"
                      >
                        {transaction.quantityChange > 0 ? '+' : ''}{transaction.quantityChange}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{transaction.previousQuantity}</TableCell>
                  <TableCell>
                    <Typography fontWeight="medium">
                      {transaction.newQuantity}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {transaction.totalValue ? `$${parseFloat(transaction.totalValue).toFixed(2)}` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                        {transaction.userName?.charAt(0) || 'U'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{transaction.userName || 'Unknown'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transaction.userRole || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <DashboardLayout>
        <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
            <CircularProgress />
          </Box>
        </RouteGuard>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.back()}
            >
              Go Back
            </Button>
          </Box>
        </RouteGuard>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <IconButton onClick={() => router.back()}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Product Stock History
            </Typography>
          </Box>

          {/* Product Overview */}
          {renderProductOverview()}

          {/* Summary Statistics */}
          {renderSummaryStatistics()}

          {/* Tabs */}
          <Card sx={{ mt: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                <Tab icon={<TimelineIcon />} label="Daily Movements" />
                <Tab icon={<AssessmentIcon />} label="Monthly Movements" />
                <Tab icon={<InventoryIcon />} label="Recent Transactions" />
              </Tabs>
            </Box>

            <CardContent>
              {activeTab === 0 && renderDailyMovements()}
              {activeTab === 1 && renderMonthlyMovements()}
              {activeTab === 2 && renderRecentTransactions()}
            </CardContent>
          </Card>
        </Box>
      </RouteGuard>
    </DashboardLayout>
  )
}

export default ProductStockHistoryPage
