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
      console.log('🚨🚨🚨 CUSTOMER LEDGER API CALL STARTING 🚨🚨🚨')
      console.log('🚨🚨🚨 CUSTOMER LEDGER API CALL STARTING 🚨🚨🚨')
      
      const queryParams = new URLSearchParams()
      if (params.search) queryParams.append('search', params.search)
      if (params.customerType) queryParams.append('customerType', params.customerType)
      if (params.hasBalance) queryParams.append('hasBalance', params.hasBalance)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.offset) queryParams.append('offset', params.offset)
      
      const url = `/customer-ledger/customers?${queryParams.toString()}`
      console.log('🔍 CUSTOMER LEDGER DEBUG - Fetching customers from URL:', url)
      console.log('🔍 CUSTOMER LEDGER DEBUG - Query params:', queryParams.toString())
      console.log('🔍 CUSTOMER LEDGER DEBUG - Request headers:', api.defaults.headers)
      
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
        printWindow.onload = () => {
          printWindow.print()
          // Keep window open for a moment to allow print dialog
          setTimeout(() => {
            printWindow.close()
          }, 1000)
        }
      } else if (params.format === 'excel') {
        // Generate Excel file from JSON data
        const XLSX = await import('xlsx')
        
        // Prepare data for Excel
        let excelData = []
        
        if (params.detailed === 'true' && response.data.data) {
          // Detailed export - flatten items into separate rows
          response.data.data.forEach(transaction => {
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
                  'Transaction Total': parseFloat(transaction.total || 0).toFixed(2),
                  'Payment Method': transaction.payment_method || 'N/A',
                  'Payment Status': transaction.payment_status || 'N/A'
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
                'Transaction Total': parseFloat(transaction.total || 0).toFixed(2),
                'Payment Method': transaction.payment_method || 'N/A',
                'Payment Status': transaction.payment_status || 'N/A'
              })
            }
          })
        } else {
          // Summary export
          excelData = response.data.data.map(transaction => ({
            'Date': new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString(),
            'Invoice #': transaction.invoice_no || 'N/A',
            'Description': transaction.description || 'Sale Transaction',
            'Total Amount': parseFloat(transaction.total || 0).toFixed(2),
            'Payment Amount': parseFloat(transaction.payment_amount || 0).toFixed(2),
            'Outstanding': parseFloat(transaction.credit_amount || transaction.outstanding || 0).toFixed(2),
            'Payment Method': transaction.payment_method || 'N/A',
            'Payment Status': transaction.payment_status || 'N/A',
            'Status': transaction.status || 'N/A'
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
        state.currentCustomerLedger = action.payload.data
        state.pagination.ledger = action.payload.data.pagination
        state.error = null
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
        state.customers = action.payload.data.customers
        state.pagination.customers = action.payload.data.pagination
        state.error = null
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

export const { clearError, clearCurrentLedger, setCustomersPagination, setLedgerPagination } = customerLedgerSlice.actions
export default customerLedgerSlice.reducer




