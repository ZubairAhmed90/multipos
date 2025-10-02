import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for Financial Management
export const fetchFinancialSummary = createAsyncThunk(
  'financial/fetchFinancialSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      
      const response = await api.get(`/dashboard/financial-summary?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch financial summary')
    }
  }
)

export const fetchSalesSummary = createAsyncThunk(
  'financial/fetchSalesSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.shiftId) queryParams.append('shiftId', params.shiftId)
      
      const response = await api.get(`/dashboard/sales-summary?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch sales summary')
    }
  }
)

export const fetchLedgerEntries = createAsyncThunk(
  'financial/fetchLedgerEntries',
  async ({ scopeType, scopeId, partyType, partyId, params = {} }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      
      const response = await api.get(`/ledger/${scopeType}/${scopeId}/${partyType}/${partyId}/entries?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch ledger entries')
    }
  }
)

export const fetchBalanceSummary = createAsyncThunk(
  'financial/fetchBalanceSummary',
  async ({ scopeType, scopeId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/ledger/balance/${scopeType}/${scopeId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch balance summary')
    }
  }
)

export const addDebitEntry = createAsyncThunk(
  'financial/addDebitEntry',
  async ({ scopeType, scopeId, partyType, partyId, entryData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/ledger/${scopeType}/${scopeId}/${partyType}/${partyId}/debit`, entryData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add debit entry')
    }
  }
)

export const addCreditEntry = createAsyncThunk(
  'financial/addCreditEntry',
  async ({ scopeType, scopeId, partyType, partyId, entryData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/ledger/${scopeType}/${scopeId}/${partyType}/${partyId}/credit`, entryData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add credit entry')
    }
  }
)

export const fetchProfitLossReport = createAsyncThunk(
  'financial/fetchProfitLossReport',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.groupBy) queryParams.append('groupBy', params.groupBy)
      
      const response = await api.get(`/dashboard/profit-loss?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profit/loss report')
    }
  }
)

export const fetchRevenueAnalytics = createAsyncThunk(
  'financial/fetchRevenueAnalytics',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.period) queryParams.append('period', params.period)
      
      const response = await api.get(`/dashboard/revenue-analytics?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch revenue analytics')
    }
  }
)

export const fetchExpenseAnalytics = createAsyncThunk(
  'financial/fetchExpenseAnalytics',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.category) queryParams.append('category', params.category)
      
      const response = await api.get(`/dashboard/expense-analytics?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch expense analytics')
    }
  }
)

export const fetchFinancialForecast = createAsyncThunk(
  'financial/fetchFinancialForecast',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.forecastPeriod) queryParams.append('forecastPeriod', params.forecastPeriod)
      if (params.forecastType) queryParams.append('forecastType', params.forecastType)
      
      const response = await api.get(`/dashboard/financial-forecast?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch financial forecast')
    }
  }
)

export const fetchCashFlowReport = createAsyncThunk(
  'financial/fetchCashFlowReport',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.groupBy) queryParams.append('groupBy', params.groupBy)
      
      const response = await api.get(`/dashboard/cash-flow?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch cash flow report')
    }
  }
)

const initialState = {
  // Financial Summary Data
  financialSummary: null,
  salesSummary: null,
  ledgerEntries: [],
  balanceSummary: null,
  
  // Reports and Analytics
  profitLossReport: null,
  revenueAnalytics: null,
  expenseAnalytics: null,
  financialForecast: null,
  cashFlowReport: null,
  
  // Filters and Parameters
  filters: {
    scopeType: 'BRANCH',
    scopeId: '',
    startDate: '',
    endDate: '',
    period: 'monthly',
    groupBy: 'day',
    forecastPeriod: '3months',
    forecastType: 'revenue'
  },
  
  // Pagination
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  
  // General state
  loading: false,
  error: null,
  lastUpdated: null,
  
  // UI state
  activeTab: 'overview', // overview, revenue, expenses, profit-loss, forecasting, cash-flow
  showLedgerForm: false,
  showReportModal: false,
  selectedLedger: null,
  reportType: 'summary',
}

const financialSlice = createSlice({
  name: 'financial',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString()
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    setSelectedLedger: (state, action) => {
      state.selectedLedger = action.payload
    },
    setReportType: (state, action) => {
      state.reportType = action.payload
    },
    toggleLedgerForm: (state) => {
      state.showLedgerForm = !state.showLedgerForm
    },
    toggleReportModal: (state) => {
      state.showReportModal = !state.showReportModal
    },
    clearSelectedData: (state) => {
      state.selectedLedger = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Financial Summary
      .addCase(fetchFinancialSummary.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFinancialSummary.fulfilled, (state, action) => {
        state.loading = false
        state.financialSummary = action.payload
        state.error = null
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchFinancialSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Sales Summary
      .addCase(fetchSalesSummary.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSalesSummary.fulfilled, (state, action) => {
        state.loading = false
        state.salesSummary = action.payload
        state.error = null
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchSalesSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Ledger Entries
      .addCase(fetchLedgerEntries.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLedgerEntries.fulfilled, (state, action) => {
        state.loading = false
        state.ledgerEntries = action.payload
        state.error = null
      })
      .addCase(fetchLedgerEntries.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Balance Summary
      .addCase(fetchBalanceSummary.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBalanceSummary.fulfilled, (state, action) => {
        state.loading = false
        state.balanceSummary = action.payload
        state.error = null
      })
      .addCase(fetchBalanceSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Add Debit Entry
      .addCase(addDebitEntry.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addDebitEntry.fulfilled, (state, action) => {
        state.loading = false
        state.ledgerEntries.push(action.payload)
        state.error = null
        state.showLedgerForm = false
      })
      .addCase(addDebitEntry.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Add Credit Entry
      .addCase(addCreditEntry.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addCreditEntry.fulfilled, (state, action) => {
        state.loading = false
        state.ledgerEntries.push(action.payload)
        state.error = null
        state.showLedgerForm = false
      })
      .addCase(addCreditEntry.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Profit/Loss Report
      .addCase(fetchProfitLossReport.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProfitLossReport.fulfilled, (state, action) => {
        state.loading = false
        state.profitLossReport = action.payload
        state.error = null
      })
      .addCase(fetchProfitLossReport.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Revenue Analytics
      .addCase(fetchRevenueAnalytics.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRevenueAnalytics.fulfilled, (state, action) => {
        state.loading = false
        state.revenueAnalytics = action.payload
        state.error = null
      })
      .addCase(fetchRevenueAnalytics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Expense Analytics
      .addCase(fetchExpenseAnalytics.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchExpenseAnalytics.fulfilled, (state, action) => {
        state.loading = false
        state.expenseAnalytics = action.payload
        state.error = null
      })
      .addCase(fetchExpenseAnalytics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Financial Forecast
      .addCase(fetchFinancialForecast.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFinancialForecast.fulfilled, (state, action) => {
        state.loading = false
        state.financialForecast = action.payload
        state.error = null
      })
      .addCase(fetchFinancialForecast.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Cash Flow Report
      .addCase(fetchCashFlowReport.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCashFlowReport.fulfilled, (state, action) => {
        state.loading = false
        state.cashFlowReport = action.payload
        state.error = null
      })
      .addCase(fetchCashFlowReport.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { 
  clearError, 
  setLastUpdated,
  setActiveTab,
  setFilters,
  setPagination,
  setSelectedLedger,
  setReportType,
  toggleLedgerForm,
  toggleReportModal,
  clearSelectedData
} = financialSlice.actions

export default financialSlice.reducer
