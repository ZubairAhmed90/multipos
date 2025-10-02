import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for reports API calls
export const fetchSalesReports = createAsyncThunk(
  'reports/fetchSales',
  async ({ branch, cashier, dateRange }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()
      if (branch) params.append('branch', branch)
      if (cashier) params.append('cashier', cashier)
      if (dateRange?.start) params.append('startDate', dateRange.start)
      if (dateRange?.end) params.append('endDate', dateRange.end)
      
      const response = await api.get(`/reports/sales?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch sales reports')
    }
  }
)

export const fetchInventoryReports = createAsyncThunk(
  'reports/fetchInventory',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/reports/inventory')
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch inventory reports')
    }
  }
)

export const fetchLedgerReports = createAsyncThunk(
  'reports/fetchLedger',
  async ({ dateRange }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()
      if (dateRange?.start) params.append('startDate', dateRange.start)
      if (dateRange?.end) params.append('endDate', dateRange.end)
      
      const response = await api.get(`/reports/ledger?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch ledger reports')
    }
  }
)

export const fetchFinancialReports = createAsyncThunk(
  'reports/fetchFinancial',
  async ({ period, year, quarter, dateFrom, dateTo }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()
      if (period) params.append('period', period)
      if (year) params.append('year', year)
      if (quarter) params.append('quarter', quarter)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      
      const response = await api.get(`/reports/financial?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch financial reports')
    }
  }
)

export const fetchReportsSummary = createAsyncThunk(
  'reports/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/reports/summary')
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports summary')
    }
  }
)

const initialState = {
  salesReports: null,
  inventoryReports: null,
  ledgerReports: null,
  financialReports: null,
  reportsSummary: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
}

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString()
    },
  },
  extraReducers: (builder) => {
    builder
      // Sales reports
      .addCase(fetchSalesReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchSalesReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.salesReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchSalesReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Inventory reports
      .addCase(fetchInventoryReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchInventoryReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.inventoryReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchInventoryReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Ledger reports
      .addCase(fetchLedgerReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchLedgerReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.ledgerReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchLedgerReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Financial reports
      .addCase(fetchFinancialReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFinancialReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.financialReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchFinancialReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Reports summary
      .addCase(fetchReportsSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchReportsSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.reportsSummary = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchReportsSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

export const { clearError, setLastUpdated } = reportsSlice.actions
export default reportsSlice.reducer
