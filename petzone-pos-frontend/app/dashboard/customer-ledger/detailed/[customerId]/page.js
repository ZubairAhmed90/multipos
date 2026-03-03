'use client'

import React, { useEffect, useState, useCallback } from 'react'
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
  Chip,
  CircularProgress,
  Alert,
  Button,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material'
import { 
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '../../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../../components/auth/RoleGuard'
import PermissionCheck from '../../../../../components/auth/PermissionCheck'
import { fetchCustomerLedger, exportCustomerLedger } from '../../../../store/slices/customerLedgerSlice'
import api from '../../../../../utils/axios'

const DetailedCustomerLedgerPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()
  const { customerId } = useParams()
  const { currentCustomerLedger, loading, error } = useSelector((state) => state.customerLedger)
  
  const [customerInfo, setCustomerInfo] = useState(null)
  const [transactionsWithItems, setTransactionsWithItems] = useState([])
  const [summaryStats, setSummaryStats] = useState({
    totalTransactions: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalCredit: 0,
    outstandingBalance: 0,
    completedTransactions: 0,
    pendingTransactions: 0,
    partialTransactions: 0
  })

  const loadDetailedLedger = useCallback(async () => {
    try {
      const result = await dispatch(fetchCustomerLedger({ 
        customerId: decodeURIComponent(customerId),
        params: { detailed: true, limit: 1000 }
      })).unwrap()
      
      console.log('🔍 FRONTEND: Received ledger data:', result)
      
      if (result.success && result.data) {
        // ✅ CRITICAL: Use the transactions as returned by the backend
        // The backend normalizeLedgerTransactions function has already calculated:
        // - old_balance (balance before this transaction)
        // - amount (current bill amount, positive for sales, negative for returns)
        // - total_amount (old_balance + amount)
        // - corrected_paid (payment amount, 0 for FULLY_CREDIT, actual for others)
        // - running_balance / balance (new balance after this transaction)
        
        const transactions = result.data.transactions || []
        console.log('🔍 FRONTEND: Transactions from backend:', transactions.map(t => ({
          invoice: t.invoice_no,
          old_balance: t.old_balance,
          amount: t.amount,
          total_amount: t.total_amount,
          corrected_paid: t.corrected_paid,
          running_balance: t.running_balance,
          balance: t.balance,
          payment_method: t.payment_method,
          payment_type: t.payment_type
        })))
        
        // Fetch items for each transaction
        const transactionsWithItems = await Promise.all(
          transactions.map(async (transaction) => {
            try {
              console.log(`Fetching items for transaction ${transaction.transaction_id}, type: ${transaction.transaction_type}`)
              
              // Check if this is a return transaction
              const isReturn = transaction.transaction_type === 'RETURN' || 
                               transaction.return_id || 
                               (transaction.invoice_no && transaction.invoice_no.startsWith('RET-'))
              
              let itemsResponse
              if (isReturn) {
                // Fetch return details
                const returnId = transaction.return_id || transaction.transaction_id
                console.log(`Fetching return items for returnId: ${returnId}`)
                itemsResponse = await api.get(`/sales/returns/${returnId}`)
              } else {
                // Fetch sale details
                console.log(`Fetching sale items for saleId: ${transaction.transaction_id}`)
                itemsResponse = await api.get(`/sales/${transaction.transaction_id}`)
              }
              
              if (itemsResponse.data.success && itemsResponse.data.data.items) {
                console.log(`Transaction ${transaction.transaction_id} has ${itemsResponse.data.data.items.length} items`)
                return {
                  ...transaction,
                  items: itemsResponse.data.data.items
                }
              } else {
                console.log(`Transaction ${transaction.transaction_id} has no items`)
                return {
                  ...transaction,
                  items: []
                }
              }
            } catch (error) {
              console.error(`Error fetching items for transaction ${transaction.transaction_id}:`, error)
              return {
                ...transaction,
                items: []
              }
            }
          })
        )
        
        // Extract customer info
        let customerData = {
          customer_name: decodeURIComponent(customerId),
          customer_phone: '',
          customer_email: '',
          customer_address: ''
        }
        
        if (result.data.customer) {
          customerData = {
            customer_name: result.data.customer.customer_name || decodeURIComponent(customerId),
            customer_phone: result.data.customer.customer_phone || '',
            customer_email: result.data.customer.customer_email || '',
            customer_address: result.data.customer.customer_address || ''
          }
        }
        
        // Use the summary stats from the backend
        if (result.data.summary) {
          console.log('🔍 FRONTEND: Using backend summary:', result.data.summary)
          setSummaryStats({
            totalTransactions: result.data.summary.totalTransactions || 0,
            totalAmount: result.data.summary.totalAmount || 0,
            totalPaid: result.data.summary.totalPaid || 0,
            totalCredit: result.data.summary.totalCredit || 0,
            outstandingBalance: result.data.summary.outstandingBalance || 0,
            completedTransactions: result.data.summary.completedTransactions || 0,
            pendingTransactions: result.data.summary.pendingTransactions || 0,
            partialTransactions: result.data.summary.partialTransactions || 0
          })
        } else {
          // Fallback: Calculate from transactions
          calculateSummaryStats(transactionsWithItems)
        }
        
        setCustomerInfo(customerData)
        setTransactionsWithItems(transactionsWithItems)
      }
    } catch (error) {
      console.error('Error loading detailed ledger:', error)
    }
  }, [dispatch, customerId])

  useEffect(() => {
    if (customerId) {
      loadDetailedLedger()
    }
  }, [customerId, loadDetailedLedger])

  const calculateSummaryStats = (transactions) => {
    console.log('calculateSummaryStats - transactions:', transactions.length)
    
    // Use backend-calculated values directly
    const stats = transactions.reduce((acc, transaction) => {
      // Use normalized values from backend
      const currentAmount = parseFloat(transaction.amount || 0)
      const paidAmount = parseFloat(transaction.corrected_paid || transaction.paid_amount || 0)
      const balance = parseFloat(transaction.balance || transaction.running_balance || 0)
      
      acc.totalTransactions += 1
      acc.totalAmount += currentAmount
      acc.totalPaid += paidAmount
      
      // Determine transaction status based on balance
      if (balance <= 0) {
        acc.completedTransactions += 1
      } else if (paidAmount > 0 && transaction.payment_method !== 'FULLY_CREDIT') {
        acc.partialTransactions += 1
      } else {
        acc.pendingTransactions += 1
      }
      
      return acc
    }, {
      totalTransactions: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalCredit: 0,
      completedTransactions: 0,
      pendingTransactions: 0,
      partialTransactions: 0,
      outstandingBalance: 0
    })
    
    // Use the last transaction's running_balance from backend
    const lastTransaction = transactions[transactions.length - 1]
    const outstandingBalance = lastTransaction ? 
      parseFloat(lastTransaction.running_balance || lastTransaction.balance || 0) : 0
    
    stats.outstandingBalance = outstandingBalance
    stats.totalCredit = outstandingBalance
    
    console.log('Final calculated stats:', stats)
    setSummaryStats(stats)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0)
    if (num % 1 === 0) {
      return num.toString() // No decimal places for whole numbers
    }
    return num.toFixed(2)
  }

  const getPaymentStatusClass = (status) => {
    switch (status) {
      case 'COMPLETED': return 'completed'
      case 'PARTIAL': return 'partial'
      case 'PENDING': return 'pending'
      default: return 'default'
    }
  }

  const getPaymentStatusDisplay = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Paid'
      case 'PARTIAL': return 'Partial'
      case 'PENDING': return 'Credit'
      default: return status || 'N/A'
    }
  }

  const formatPaymentMethod = (paymentMethod) => {
    if (!paymentMethod) return 'N/A'
    
    const cleanMethod = paymentMethod.replace(/^\d+/, '')
    
    switch (cleanMethod) {
      case 'CASH': return 'Cash'
      case 'CARD': return 'Card'
      case 'BANK_TRANSFER': return 'Bank Transfer'
      case 'PARTIAL_PAYMENT': return 'Partial Payment'
      case 'FULLY_CREDIT': return 'Credit'
      case 'CHEQUE': return 'Cheque'
      case 'REFUND': return 'Refund'
      default: return cleanMethod
    }
  }

  const formatPaymentType = (paymentType, paymentMethod) => {
    if (!paymentType) {
      if (paymentMethod === 'FULLY_CREDIT') return 'Fully Credit'
      if (paymentMethod === 'PARTIAL_PAYMENT') return 'Partial Payment'
      if (paymentMethod === 'CASH') return 'Full Payment'
      if (paymentMethod === 'CARD') return 'Full Payment'
      if (paymentMethod === 'BANK_TRANSFER') return 'Full Payment'
      if (paymentMethod === 'CHEQUE') return 'Full Payment'
      if (paymentMethod === 'REFUND') return 'Refund'
      return 'N/A'
    }
    
    switch (paymentType) {
      case 'FULL_PAYMENT': return 'Full Payment'
      case 'PARTIAL_PAYMENT': return 'Partial Payment'
      case 'FULLY_CREDIT': return 'Fully Credit'
      case 'CASH': return 'Cash'
      case 'CARD': return 'Card'
      case 'BANK_TRANSFER': return 'Bank Transfer'
      case 'CHEQUE': return 'Cheque'
      case 'REFUND': return 'Refund'
      case 'OUTSTANDING_SETTLEMENT': return 'Outstanding Settlement'
      default: return paymentType
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    dispatch(exportCustomerLedger({ 
      customerId: decodeURIComponent(customerId),
      params: { detailed: true, format: 'pdf' }
    }))
  }

  const handleRefresh = () => {
    loadDetailedLedger()
  }

  const handleBack = () => {
    router.back()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </DashboardLayout>
    )
  }

const transactions = (
  transactionsWithItems.length > 0
    ? transactionsWithItems
    : (currentCustomerLedger?.transactions || [])
).slice().sort((a, b) => {
  const dateA = new Date(a.transaction_date || a.created_at)
  const dateB = new Date(b.transaction_date || b.created_at)
  return dateA - dateB // ✅ oldest first
})
  
  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
        <PermissionCheck roles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
          <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={handleBack} color="primary">
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" component="h1">
                  Detailed Customer Ledger: {customerInfo?.customer_name || decodeURIComponent(customerId)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Refresh">
                  <IconButton onClick={handleRefresh} color="primary">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Print">
                  <IconButton onClick={handlePrint} color="primary">
                    <PrintIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download PDF">
                  <IconButton onClick={handleDownload} color="secondary">
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Customer Info */}
            {customerInfo && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Customer Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Name:</strong> {customerInfo.customer_name || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Phone:</strong> {customerInfo.customer_phone || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Email:</strong> {customerInfo.customer_email || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Address:</strong> {customerInfo.customer_address || 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Summary Statistics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Transactions
                    </Typography>
                    <Typography variant="h5" component="div">
                      {summaryStats.totalTransactions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Amount
                    </Typography>
                    <Typography variant="h5" component="div">
                      {formatCurrency(summaryStats.totalAmount)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Paid
                    </Typography>
                    <Typography variant="h5" component="div" color="success.main">
                      {formatCurrency(summaryStats.totalPaid)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Outstanding Balance
                    </Typography>
                    <Typography variant="h5" component="div" color="error.main">
                      {formatCurrency(summaryStats.outstandingBalance)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Transaction Status Summary */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Completed
                    </Typography>
                    <Typography variant="h6" component="div" color="success.main">
                      {summaryStats.completedTransactions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Partial
                    </Typography>
                    <Typography variant="h6" component="div" color="warning.main">
                      {summaryStats.partialTransactions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Pending
                    </Typography>
                    <Typography variant="h6" component="div" color="error.main">
                      {summaryStats.pendingTransactions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Detailed Transactions Table */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Transaction Details
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Invoice</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Items</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Amount</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Old Balance</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Total Amount</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Payment</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Payment Method</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Payment Type</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(transaction.transaction_date || transaction.created_at)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {transaction.invoice_no || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                              {transaction.items && transaction.items.length > 0 ? (
                                transaction.items.map((item, itemIndex) => {
                                  const itemName = item.item_name ?? item.name ?? 'N/A'
                                  const quantity = parseFloat(item.quantity ?? 0)
                                  const unitPrice = parseFloat(item.unitPrice ?? item.unit_price ?? 0)
                                  const total = parseFloat(item.total ?? (quantity * unitPrice))

                                  
                                  return (
                                    <Box key={itemIndex} sx={{ mb: 0.5, pb: 0.5, borderBottom: '1px solid #f0f0f0' }}>
                                      {itemName} ({quantity}x) @ {formatCurrency(unitPrice)} = {formatCurrency(total)}
                                    </Box>
                                  )
                                })
                              ) : (
                                <Box sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                  No items
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace">
                              {formatCurrency(transaction.amount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" color="warning.main">
                              {formatCurrency(transaction.old_balance || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" fontWeight="bold" color="primary.main">
                              {formatCurrency(transaction.total_amount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" color="success.main">
                              {formatCurrency(transaction.corrected_paid || transaction.paid_amount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatPaymentMethod(transaction.payment_method)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                              {formatPaymentType(transaction.payment_type, transaction.payment_method)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getPaymentStatusDisplay(transaction.payment_status)}
                              color={getPaymentStatusClass(transaction.payment_status) === 'completed' ? 'success' : 
                                     getPaymentStatusClass(transaction.payment_status) === 'partial' ? 'warning' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" 
                              fontFamily="monospace"
                              color={(() => {
                                const balance = parseFloat(transaction.running_balance || transaction.balance || 0)
                                return balance > 0 ? 'error.main' : 'success.main'
                              })()}
                            >
                              {formatCurrency(transaction.running_balance || transaction.balance || 0)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                     {/* Table Footer - Summary Row with proper column alignment */}
<TableRow sx={{ 
  backgroundColor: '#f5f5f5', 
  borderTop: '2px solid #ccc',
  '& .MuiTableCell-root': { 
    fontWeight: 'bold',
    fontSize: '0.875rem',
    py: 2
  }
}}>
  <TableCell colSpan={3}>GRAND TOTAL</TableCell>
  <TableCell align="right">{formatCurrency(summaryStats.totalAmount)}</TableCell>
  <TableCell align="right">—</TableCell> {/* Old Balance total not typically summed */}
  <TableCell align="right">{formatCurrency(transactions.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0))}</TableCell>
  <TableCell align="right">{formatCurrency(summaryStats.totalPaid)}</TableCell>
  <TableCell align="center" colSpan={2}>—</TableCell> {/* Payment Method & Type */}
  <TableCell align="center">
    <Chip 
      label={`${summaryStats.completedTransactions} Completed`} 
      size="small" 
      color="success"
    />
  </TableCell>
  <TableCell align="right" sx={{ color: summaryStats.outstandingBalance > 0 ? 'error.main' : 'success.main' }}>
    {formatCurrency(summaryStats.outstandingBalance)}
  </TableCell>
</TableRow>

                      {/* Additional Summary Row with Transaction Counts */}
                      <TableRow sx={{ 
                        backgroundColor: '#fafafa',
                        '& .MuiTableCell-root': { 
                          fontSize: '0.813rem',
                          py: 1.5
                        }
                      }}>
                        <TableCell colSpan={3}>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
                              Summary:
                            </Typography>
                            <Chip 
                              label={`Completed: ${summaryStats.completedTransactions}`} 
                              size="small" 
                              color="success"
                              variant="outlined"
                            />
                            <Chip 
                              label={`Partial: ${summaryStats.partialTransactions}`} 
                              size="small" 
                              color="warning"
                              variant="outlined"
                            />
                            <Chip 
                              label={`Pending: ${summaryStats.pendingTransactions}`} 
                              size="small" 
                              color="error"
                              variant="outlined"
                            />
                            <Chip 
                              label={`Total Txns: ${summaryStats.totalTransactions}`} 
                              size="small" 
                              color="info"
                              variant="outlined"
                            />
                          </Box>
                        </TableCell>
                        <TableCell colSpan={8} align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                            Last Updated: {new Date().toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        </PermissionCheck>
      </RouteGuard>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .MuiAppBar-root,
          .MuiDrawer-root,
          button,
          .MuiIconButton-root {
            display: none !important;
          }
          
          .MuiBox-root {
            padding: 0 !important;
          }
          
          .MuiTableRow-root {
            page-break-inside: avoid;
          }
          
          /* Ensure footer rows print properly */
          .MuiTableRow-root:last-child {
            background-color: #f5f5f5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}

export default DetailedCustomerLedgerPage

