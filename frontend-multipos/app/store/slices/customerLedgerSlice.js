import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
export const fetchCustomerLedger = createAsyncThunk(
  'customerLedger/fetchCustomerLedger',
  async ({ customerId, params = {} }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.transactionType) queryParams.append('transactionType', params.transactionType)
      if (params.paymentMethod) queryParams.append('paymentMethod', params.paymentMethod)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.offset) queryParams.append('offset', params.offset)
      if (params.detailed) queryParams.append('detailed', params.detailed)
      
      const response = await api.get(`/customer-ledger/${customerId}?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customer ledger')
    }
  }
)

export const fetchAllCustomersWithSummaries = createAsyncThunk(
  'customerLedger/fetchAllCustomersWithSummaries',
  async (params = {}, { rejectWithValue }) => {
    try {
      console.log('🚨🚨🚨 CUSTOMER LEDGER API CALL STARTING 🚨🚨🚨')
      
      const queryParams = new URLSearchParams()
      if (params.search) queryParams.append('search', params.search)
      if (params.customerType) queryParams.append('customerType', params.customerType)
      if (params.hasBalance) queryParams.append('hasBalance', params.hasBalance)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.offset) queryParams.append('offset', params.offset)
      
      const url = `/customer-ledger/customers?${queryParams.toString()}`
      console.log('🔍 CUSTOMER LEDGER DEBUG - Fetching customers from URL:', url)
      
      const response = await api.get(url)
      console.log('🔍 CUSTOMER LEDGER DEBUG - API response:', response.data)
      
      return response.data
    } catch (error) {
      console.error('Error fetching customers:', error)
      console.error('Error response:', error.response?.data)
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customers')
    }
  }
)

export const exportCustomerLedger = createAsyncThunk(
  'customerLedger/exportCustomerLedger',
  async ({ customerId, params = {} }, { rejectWithValue }) => {
    try {
      console.log('Exporting customer ledger:', { customerId, params })
      const queryParams = new URLSearchParams()
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.format) queryParams.append('format', params.format)
      if (params.detailed) queryParams.append('detailed', params.detailed)
      
      const url = `/customer-ledger/${customerId}/export?${queryParams.toString()}`
      console.log('Export API URL:', url)
      const response = await api.get(url)
      console.log('Export API response:', response.data)
      
      // Handle HTML content for PDF generation
      if (params.format === 'pdf') {
        // Open HTML content in new window and trigger print
        const printWindow = window.open('', '_blank')
        printWindow.document.write(response.data)
        printWindow.document.close()
        
        // Wait for content to load, then trigger print
        // Don't close the window automatically - let user decide
        setTimeout(() => {
          printWindow.print()
        }, 250) // Small delay to ensure content is rendered
      } else if (params.format === 'excel') {
        // Generate Excel file from JSON data
        const XLSX = await import('xlsx')
        
        // Prepare data for Excel
        let excelData = []
        const payload = response.data.data

        if (payload?.groupedLedgers) {
          const workbook = XLSX.utils.book_new()

          const sanitizeSheetName = (name, index) => {
            const cleaned = (name || 'Customer').replace(/[\\/?*\[\]:]/g, '').trim() || 'Customer'
            const base = cleaned.length > 25 ? cleaned.slice(0, 25) : cleaned
            const suffix = `-${index + 1}`
            const combined = `${base}${suffix}`
            return combined.length > 31 ? combined.slice(0, 31) : combined
          }

          const summaryRows = payload.groupedLedgers.map((group) => ({
            'Customer Name': group.customer?.name || 'Unknown Customer',
            'Customer Phone': group.customer?.phone || '',
            'Transactions': group.summary?.totalTransactions || 0,
            'Total Amount': Number.parseFloat(group.summary?.totalAmount || 0).toFixed(2),
            'Total Paid': Number.parseFloat(group.summary?.totalPaid || 0).toFixed(2),
            'Total Credit': Number.parseFloat(group.summary?.totalCredit || 0).toFixed(2),
            'Outstanding': Number.parseFloat(group.summary?.outstandingBalance || 0).toFixed(2)
          }))

          if (summaryRows.length > 0) {
            const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
          }

          payload.groupedLedgers.forEach((group, index) => {
            const transactions = group.transactions || []
            const customerName = group.customer?.name || 'Customer'

            let rows = []

            if (params.detailed === 'true') {
              transactions.forEach((transaction) => {
                const amount = parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0)
                const oldBalance = parseFloat(transaction.old_balance ?? 0)
                const totalAmountDue = parseFloat(transaction.total_amount ?? (oldBalance + amount))
                const payment = parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0)
                const balance = parseFloat(transaction.balance ?? transaction.running_balance ?? transaction.credit_amount ?? 0)

                if (transaction.items && transaction.items.length > 0) {
                  transaction.items.forEach((item) => {
                    rows.push({
                      'Customer Name': customerName,
                      'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
                      'Invoice #': transaction.invoice_no || 'N/A',
                      'Item Name': item.item_name || item.name || 'N/A',
                      'SKU': item.sku || 'N/A',
                      'Quantity': item.quantity || 0,
                      'Unit Price': parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2),
                      'Discount': parseFloat(item.discount || 0).toFixed(2),
                      'Item Total': parseFloat(item.item_total || item.total || 0).toFixed(2),
                      'Amount': amount.toFixed(2),
                      'Old Balance': oldBalance.toFixed(2),
                      'Total Amount Due': totalAmountDue.toFixed(2),
                      'Payment': payment.toFixed(2),
                      'Payment Method': transaction.payment_method || 'N/A',
                      'Payment Status': transaction.payment_status || 'N/A',
                      'Balance': balance.toFixed(2)
                    })
                  })
                } else {
                  rows.push({
                    'Customer Name': customerName,
                    'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
                    'Invoice #': transaction.invoice_no || 'N/A',
                    'Item Name': 'No items',
                    'SKU': 'N/A',
                    'Quantity': 0,
                    'Unit Price': '0.00',
                    'Discount': '0.00',
                    'Item Total': '0.00',
                    'Amount': amount.toFixed(2),
                    'Old Balance': oldBalance.toFixed(2),
                    'Total Amount Due': totalAmountDue.toFixed(2),
                    'Payment': payment.toFixed(2),
                    'Payment Method': transaction.payment_method || 'N/A',
                    'Payment Status': transaction.payment_status || 'N/A',
                    'Balance': balance.toFixed(2)
                  })
                }
              })
            } else {
              rows = transactions.map((transaction) => ({
                'Customer Name': customerName,
                'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
                'Invoice #': transaction.invoice_no || 'N/A',
                'Amount': parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0).toFixed(2),
                'Old Balance': parseFloat(transaction.old_balance ?? 0).toFixed(2),
                'Total Amount': parseFloat(transaction.total_amount ?? transaction.total ?? 0).toFixed(2),
                'Payment': parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0).toFixed(2),
                'Payment Method': transaction.payment_method || 'N/A',
                'Payment Status': transaction.payment_status || 'N/A',
                'Balance': parseFloat(transaction.balance ?? transaction.running_balance ?? transaction.credit_amount ?? 0).toFixed(2)
              }))
            }

            const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Notice: 'No transactions available' }])
            XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(customerName, index))
          })

          if (Array.isArray(payload.transactions) && payload.transactions.length > 0) {
            const allRows = payload.transactions.map((transaction) => ({
              'Customer Name': transaction.customer_name || 'Unknown Customer',
              'Customer Phone': transaction.customer_phone || '',
              'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
              'Invoice #': transaction.invoice_no || 'N/A',
              'Amount': parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0).toFixed(2),
              'Old Balance': parseFloat(transaction.old_balance ?? 0).toFixed(2),
              'Total Amount': parseFloat(transaction.total_amount ?? transaction.total ?? 0).toFixed(2),
              'Payment': parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0).toFixed(2),
              'Payment Method': transaction.payment_method || 'N/A',
              'Payment Status': transaction.payment_status || 'N/A',
              'Balance': parseFloat(transaction.balance ?? transaction.running_balance ?? transaction.credit_amount ?? 0).toFixed(2)
            }))

            const allSheet = XLSX.utils.json_to_sheet(allRows)
            XLSX.utils.book_append_sheet(workbook, allSheet, 'All Transactions')
          }

          const excelBuffer = XLSX.write(workbook, {
            type: 'array',
            bookType: 'xlsx'
          })

          const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          const filePrefix = params.detailed === 'true' ? 'detailed-all-customers-ledger' : 'all-customers-ledger'
          link.download = `${filePrefix}-${new Date().toISOString().split('T')[0]}.xlsx`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)

          return { success: true }
        }
        
        if (params.detailed === 'true' && payload) {
          const detailedTransactions = Array.isArray(payload)
            ? payload
            : (payload.transactions || []);

          // Detailed export - sort by date ascending and flatten items into separate rows
          const sortedTransactions = [...detailedTransactions].sort((a, b) => {
            const dateA = new Date(a.transaction_date || a.created_at);
            const dateB = new Date(b.transaction_date || b.created_at);
            return dateA - dateB;
          });
          
          sortedTransactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0);
            const oldBalance = parseFloat(transaction.old_balance ?? 0);
            const totalAmountDue = parseFloat(transaction.total_amount ?? (oldBalance + amount));
            const payment = parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0);
            const balance = parseFloat(transaction.balance ?? transaction.running_balance ?? transaction.credit_amount ?? 0);

            if (transaction.items && transaction.items.length > 0) {
              transaction.items.forEach(item => {
                excelData.push({
                  'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
                  'Invoice #': transaction.invoice_no || 'N/A',
                  'Item Name': item.item_name || item.name || 'N/A',
                  'SKU': item.sku || 'N/A',
                  'Quantity': item.quantity || 0,
                  'Unit Price': parseFloat(item.unit_price || 0).toFixed(2),
                  'Discount': parseFloat(item.discount || 0).toFixed(2),
                  'Item Total': parseFloat(item.item_total || item.total || 0).toFixed(2),
                  'Amount': amount.toFixed(2),
                  'Old Balance': oldBalance.toFixed(2),
                  'Total Amount Due': totalAmountDue.toFixed(2),
                  'Payment': payment.toFixed(2),
                  'Payment Method': transaction.payment_method || 'N/A',
                  'Payment Status': transaction.payment_status || 'N/A',
                  'Balance': balance.toFixed(2)
                })
              })
            } else {
              // Transaction without items
              excelData.push({
                'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
                'Invoice #': transaction.invoice_no || 'N/A',
                'Item Name': 'No items',
                'SKU': 'N/A',
                'Quantity': 0,
                'Unit Price': '0.00',
                'Discount': '0.00',
                'Item Total': '0.00',
                'Amount': amount.toFixed(2),
                'Old Balance': oldBalance.toFixed(2),
                'Total Amount Due': totalAmountDue.toFixed(2),
                'Payment': payment.toFixed(2),
                'Payment Method': transaction.payment_method || 'N/A',
                'Payment Status': transaction.payment_status || 'N/A',
                'Balance': balance.toFixed(2)
              })
            }
          })
        } else {
          // Summary export - sort by date ascending
          const summaryTransactions = Array.isArray(payload)
            ? payload
            : (payload.transactions || []);

          const sortedTransactions = [...summaryTransactions].sort((a, b) => {
            const dateA = new Date(a.transaction_date || a.created_at);
            const dateB = new Date(b.transaction_date || b.created_at);
            return dateA - dateB;
          });
          
          excelData = sortedTransactions.map(transaction => ({
            'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
            'Invoice #': transaction.invoice_no || 'N/A',
            'Amount': parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0).toFixed(2),
            'Old Balance': parseFloat(transaction.old_balance ?? 0).toFixed(2),
            'Total Amount Due': parseFloat(transaction.total_amount ?? ((parseFloat(transaction.old_balance ?? 0)) + parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0))).toFixed(2),
            'Payment': parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0).toFixed(2),
            'Payment Method': transaction.payment_method || 'N/A',
            'Payment Status': transaction.payment_status || 'N/A',
            'Status': transaction.status || transaction.payment_status_display || 'N/A',
            'Balance': parseFloat(transaction.balance ?? transaction.running_balance ?? transaction.credit_amount ?? 0).toFixed(2)
          }))
        }
        
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet(excelData)
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Ledger')
        
        // Generate Excel file buffer
        const excelBuffer = XLSX.write(workbook, { 
          type: 'array', 
          bookType: 'xlsx' 
        })
        
        // Create download link
        const blob = new Blob([excelBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const filePrefix = params.detailed === 'true' ? 'detailed-customer-ledger' : 'customer-ledger'
        link.download = `${filePrefix}-${customerId}-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } else {
        // For other formats, create download link
        const blob = new Blob([response.data], { type: 'text/plain' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.txt`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
      
      return { success: true }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export customer ledger')
    }
  }
)

const initialState = {
  customers: [],
  currentCustomerLedger: null,
  loading: false,
  error: null,
  pagination: {
    customers: { total: 0, limit: 50, offset: 0, hasMore: false },
    ledger: { total: 0, limit: 100, offset: 0, hasMore: false }
  }
}

const customerLedgerSlice = createSlice({
  name: 'customerLedger',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearCurrentLedger: (state) => {
      state.currentCustomerLedger = null
    },
    setCustomersPagination: (state, action) => {
      state.pagination.customers = { ...state.pagination.customers, ...action.payload }
    },
    setLedgerPagination: (state, action) => {
      state.pagination.ledger = { ...state.pagination.ledger, ...action.payload }
    },
    // NEW: Add debug action to log current state
    debugState: (state) => {
      console.log('🔍 CUSTOMER LEDGER STATE DEBUG:', {
        customers: state.customers,
        currentCustomerLedger: state.currentCustomerLedger,
        loading: state.loading,
        error: state.error,
        pagination: state.pagination
      })
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch customer ledger
      .addCase(fetchCustomerLedger.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCustomerLedger.fulfilled, (state, action) => {
        state.loading = false
        
        // FIX: Handle different response structures
        const responseData = action.payload.data || action.payload
        
        // Ensure transactions have old_balance field
        if (responseData.transactions) {
          responseData.transactions = responseData.transactions.map((transaction, index) => {
            // Calculate old_balance if not provided by API
            let old_balance = transaction.old_balance
            
            if (old_balance === undefined || old_balance === null) {
              if (index === 0) {
                // First transaction has old balance of 0
                old_balance = 0
              } else {
                // Calculate old balance from previous transaction
                const prevTransaction = responseData.transactions[index - 1]
                const prevTotal = parseFloat(prevTransaction.total_amount || prevTransaction.total || 0)
                const prevPaid = prevTransaction.payment_method === 'FULLY_CREDIT' ? 0 : 
                               parseFloat(prevTransaction.paid_amount || prevTransaction.payment_amount || 0)
                old_balance = prevTotal - prevPaid
              }
            }
            
            return {
              ...transaction,
              old_balance: old_balance,
              // Ensure all required fields are present
              subtotal: transaction.subtotal || transaction.amount || 0,
              total_amount: transaction.total_amount || transaction.total || 0,
              paid_amount: transaction.paid_amount || transaction.payment_amount || 0,
              payment_status_display: transaction.payment_status_display || 
                                    (transaction.payment_status === 'COMPLETED' ? 'Paid' :
                                     transaction.payment_status === 'PARTIAL' ? 'Partial' : 'Credit')
            }
          })
        }
        
        state.currentCustomerLedger = responseData
        
        // Update pagination if available
        if (responseData.pagination) {
          state.pagination.ledger = { 
            ...state.pagination.ledger, 
            ...responseData.pagination 
          }
        }
        
        state.error = null
        
        // Debug log
        console.log('🔍 Ledger data processed:', state.currentCustomerLedger)
      })
      .addCase(fetchCustomerLedger.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch all customers with summaries
      .addCase(fetchAllCustomersWithSummaries.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllCustomersWithSummaries.fulfilled, (state, action) => {
        state.loading = false
        
        // FIX: Handle different response structures
        const responseData = action.payload.data || action.payload
        
        // Ensure customers array exists and has proper structure
        if (responseData.customers) {
          state.customers = responseData.customers.map(customer => ({
            ...customer,
            // Ensure all required fields are present with fallbacks
            customer_name: customer.customer_name || customer.name || 'N/A',
            customer_phone: customer.customer_phone || customer.phone || 'N/A',
            total_transactions: customer.total_transactions || 0,
            total_amount: customer.total_amount || customer.total_purchases || 0,
            total_paid: customer.total_paid || customer.total_payments || 0,
            current_balance: customer.current_balance || customer.outstanding_balance || 0,
            last_transaction_date: customer.last_transaction_date || customer.last_purchase_date
          }))
        } else {
          state.customers = responseData || []
        }
        
        // Update pagination if available
        if (responseData.pagination) {
          state.pagination.customers = { 
            ...state.pagination.customers, 
            ...responseData.pagination 
          }
        } else if (action.payload.pagination) {
          state.pagination.customers = { 
            ...state.pagination.customers, 
            ...action.payload.pagination 
          }
        }
        
        state.error = null
        
        // Debug log
        console.log('🔍 Customers data processed:', state.customers)
        console.log('🔍 Pagination:', state.pagination.customers)
      })
      .addCase(fetchAllCustomersWithSummaries.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Export customer ledger
      .addCase(exportCustomerLedger.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(exportCustomerLedger.fulfilled, (state) => {
        state.loading = false
        state.error = null
      })
      .addCase(exportCustomerLedger.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { 
  clearError, 
  clearCurrentLedger, 
  setCustomersPagination, 
  setLedgerPagination,
  debugState // NEW: Export debug action
} = customerLedgerSlice.actions

export default customerLedgerSlice.reducer