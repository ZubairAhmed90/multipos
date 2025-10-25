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

  // Debug: Log summaryStats changes
  useEffect(() => {
    console.log('Summary stats updated:', summaryStats)
  }, [summaryStats])

  const loadDetailedLedger = useCallback(async () => {
    try {
      const result = await dispatch(fetchCustomerLedger({ 
        customerId: decodeURIComponent(customerId),
        params: { detailed: true, limit: 1000 }
      })).unwrap()
      
      if (result.success && result.data) {
        // Fetch items for each transaction separately since backend detailed mode isn't working
        const transactionsWithItems = await Promise.all(
          result.data.transactions.map(async (transaction) => {
            try {
              console.log(`Fetching items for transaction ${transaction.transaction_id}`)
              const itemsResponse = await api.get(`/sales/${transaction.transaction_id}`)
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
        
        // Create a new result object with transactions that have items
        const updatedResult = {
          ...result,
          data: {
            ...result.data,
            transactions: transactionsWithItems
          }
        }
        // Extract customer info from the first transaction or use customerId as fallback
        let customerData = {
          customer_name: decodeURIComponent(customerId),
          customer_phone: '',
          customer_email: '',
          customer_address: ''
        }
        
        // If customer info is available from API, use it
        if (updatedResult.data.customer) {
          customerData = {
            customer_name: updatedResult.data.customer.customer_name || decodeURIComponent(customerId),
            customer_phone: updatedResult.data.customer.customer_phone || '',
            customer_email: updatedResult.data.customer.customer_email || '',
            customer_address: updatedResult.data.customer.customer_address || ''
          }
        }
        
        // If customer info is not available, try to extract from transactions
        if (!customerData.customer_name || customerData.customer_name === 'N/A' || !customerData.customer_phone) {
          const firstTransaction = updatedResult.data.transactions?.[0]
          if (firstTransaction) {
            customerData = {
              ...customerData,
              customer_name: firstTransaction.customer_name || decodeURIComponent(customerId),
              customer_phone: firstTransaction.customer_phone || customerData.customer_phone || '',
              customer_email: firstTransaction.customer_email || customerData.customer_email || '',
              customer_address: firstTransaction.customer_address || customerData.customer_address || ''
            }
          }
        }
        
        setCustomerInfo(customerData)
        setTransactionsWithItems(transactionsWithItems)
        console.log('About to call calculateSummaryStats with:', transactionsWithItems)
        console.log('Number of transactions:', transactionsWithItems.length)
        calculateSummaryStats(transactionsWithItems)
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
    console.log('calculateSummaryStats - transactions:', transactions)
    
    const stats = transactions.reduce((acc, transaction) => {
      // Debug: Log transaction fields
      console.log('Transaction fields:', {
        invoice_no: transaction.invoice_no,
        subtotal: transaction.subtotal,
        amount: transaction.amount,
        total: transaction.total,
        paid_amount: transaction.paid_amount,
        payment_amount: transaction.payment_amount,
        payment_status: transaction.payment_status,
        payment_method: transaction.payment_method,
        invoice_balance: transaction.invoice_balance,
        balance: transaction.balance,
        running_balance: transaction.running_balance
      })
      
      // Use Amount column only (current bill amounts, not including old balances) and corrected paid_amount
      const currentAmount = parseFloat(transaction.subtotal || transaction.amount || transaction.total || 0) // Amount column only
      // Use corrected payment amount (0 for FULLY_CREDIT)
      const correctedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || transaction.payment_amount || 0)
      
      console.log('Calculated amounts:', { currentAmount, correctedPaid })
      
      acc.totalTransactions += 1
      acc.totalAmount += currentAmount // Sum of Amount column only (not including old balances)
      acc.totalPaid += correctedPaid
      
      // Count transaction types based on payment method and balance
      const transactionTotalAmount = parseFloat(transaction.total_amount || transaction.total || 0)
      const transactionCorrectedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || transaction.payment_amount || 0)
      const remainingBalance = transactionTotalAmount - transactionCorrectedPaid
      
      if (transaction.payment_method === 'FULLY_CREDIT') {
        // FULLY_CREDIT transactions are always pending (no payment made)
        acc.pendingTransactions += 1
      } else if (remainingBalance === 0) {
        // Fully paid transactions
        acc.completedTransactions += 1
      } else if (transactionCorrectedPaid > 0 && remainingBalance > 0) {
        // Partial payment transactions
        acc.partialTransactions += 1
      } else {
        // Pending transactions (no payment made)
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
      partialTransactions: 0
    })
    
    // Calculate outstanding balance as Total Amount - Total Paid
    // Since totalAmount already includes old balances, we just subtract totalPaid
    const outstandingBalance = stats.totalAmount - stats.totalPaid
    
    // Set totalCredit to be the same as outstandingBalance for consistency
    stats.totalCredit = outstandingBalance
    stats.outstandingBalance = outstandingBalance
    
    console.log('Final calculated stats:', stats)
    console.log('Setting summary stats to:', stats)
    setSummaryStats(stats)
    console.log('Summary stats set successfully')
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
    
    // Remove any numeric prefixes that might be concatenated
    const cleanMethod = paymentMethod.replace(/^\d+/, '')
    
    // Format common payment methods
    switch (cleanMethod) {
      case 'CASH': return 'Cash'
      case 'CARD': return 'Card'
      case 'BANK_TRANSFER': return 'Bank Transfer'
      case 'PARTIAL_PAYMENT': return 'Partial Payment'
      case 'FULLY_CREDIT': return 'Credit'
      case 'CHEQUE': return 'Cheque'
      default: return cleanMethod
    }
  }

  const formatPaymentType = (paymentType, paymentMethod) => {
    // If payment_type is not available, derive it from payment_method
    if (!paymentType) {
      if (paymentMethod === 'FULLY_CREDIT') return 'Fully Credit'
      if (paymentMethod === 'PARTIAL_PAYMENT') return 'Partial Payment'
      if (paymentMethod === 'CASH') return 'Full Payment'
      if (paymentMethod === 'CARD') return 'Full Payment'
      if (paymentMethod === 'BANK_TRANSFER') return 'Full Payment'
      if (paymentMethod === 'CHEQUE') return 'Full Payment'
      return 'N/A'
    }
    
    // Format payment types
    switch (paymentType) {
      case 'FULL_PAYMENT': return 'Full Payment'
      case 'PARTIAL_PAYMENT': return 'Partial Payment'
      case 'FULLY_CREDIT': return 'Fully Credit'
      case 'CASH': return 'Cash'
      case 'CARD': return 'Card'
      case 'BANK_TRANSFER': return 'Bank Transfer'
      case 'CHEQUE': return 'Cheque'
      default: return paymentType
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // Trigger download of detailed PDF
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

  const transactions = transactionsWithItems.length > 0 ? transactionsWithItems : (currentCustomerLedger?.transactions || [])
  
  // Debug: Log what transactions we're using
  console.log('Rendering with transactions:', transactions.length, 'transactions')
  console.log('First transaction has items?', transactions[0]?.items ? 'YES' : 'NO')
  console.log('First transaction items count:', transactions[0]?.items?.length || 0)

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
                        <TableCell sx={{ fontWeight: 'bold', minWidth: '120px' }}>Payment Type</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...transactions].reverse().map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(transaction.transaction_date || transaction.created_at)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {transaction.invoice_no || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                              {(() => {
                                console.log('Transaction items for', transaction.invoice_no, ':', transaction.items)
                                console.log('Transaction data:', transaction)
                                console.log('Items array:', transaction.items)
                                console.log('Items length:', transaction.items?.length || 0)
                                
                                if (transaction.items && transaction.items.length > 0) {
                                  return transaction.items.map((item, itemIndex) => {
                                    const itemName = item.item_name || item.name || 'N/A'
                                    const quantity = item.quantity || 0
                                    const unitPrice = item.unit_price || item.price || 0
                                    const total = item.total || (quantity * unitPrice)
                                    
                                    console.log('Item data:', { itemName, quantity, unitPrice, total })
                                    
                                    return (
                                      <Box key={itemIndex} sx={{ mb: 0.5, pb: 0.5, borderBottom: '1px solid #f0f0f0' }}>
                                        {itemName} ({quantity}x) @ {formatCurrency(unitPrice)} = {formatCurrency(total)}
                                      </Box>
                                    )
                                  })
                                } else {
                                  return (
                                    <Box sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                      No items
                                    </Box>
                                  )
                                }
                              })()}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace">
                              {formatCurrency(transaction.subtotal || transaction.total || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" color="warning.main">
                              {formatCurrency(transaction.old_balance || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" fontWeight="bold" color="primary.main">
                              {formatCurrency(transaction.total_amount || transaction.total || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontFamily="monospace" color="success.main">
                              {(() => {
                                // Use corrected payment amount (0 for FULLY_CREDIT)
                                const correctedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || transaction.payment_amount || 0);
                                return formatCurrency(correctedPaid);
                              })()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatPaymentMethod(transaction.payment_method)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ minWidth: '120px' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'primary.main' }}>
                              {formatPaymentType(transaction.payment_type, transaction.payment_method)}
                            </Typography>
                            {/* Debug: Log payment_type */}
                            {console.log('Payment Type Debug:', transaction.payment_type, 'for transaction:', transaction.invoice_no)}
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
                            <Typography variant="body2" fontFamily="monospace"                                 color={(() => {
                                  const totalAmount = parseFloat(transaction.total_amount || transaction.total || 0);
                                  // Use corrected payment amount (0 for FULLY_CREDIT)
                                  const correctedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || transaction.payment_amount || 0);
                                  const balance = totalAmount - correctedPaid;
                                  return balance > 0 ? 'error.main' : 'success.main';
                                })()}>
                              {(() => {
                                const totalAmount = parseFloat(transaction.total_amount || transaction.total || 0);
                                // Use corrected payment amount (0 for FULLY_CREDIT)
                                const correctedPaid = transaction.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(transaction.paid_amount || transaction.payment_amount || 0);
                                const balance = totalAmount - correctedPaid;
                                return formatCurrency(balance);
                              })()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
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
        }
      `}</style>
    </DashboardLayout>
  )
}

export default DetailedCustomerLedgerPage
