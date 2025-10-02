import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for dashboard API calls
export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchData',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/sales-summary', params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch dashboard data')
    }
  }
)

export const fetchSalesSummary = createAsyncThunk(
  'dashboard/fetchSalesSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/sales-summary', params)
      return response.data
    } catch (error) {
      console.error('Sales summary fetch error:', error)
      if (error.code === 'ECONNABORTED') {
        return rejectWithValue('Request timeout - backend server may be slow or unavailable')
      }
      if (error.code === 'ERR_NETWORK') {
        return rejectWithValue('Network error - backend server may be down')
      }
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch sales summary')
    }
  }
)

export const fetchInventorySummary = createAsyncThunk(
  'dashboard/fetchInventorySummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/inventory-summary', params)
      return response.data
    } catch (error) {
      console.error('Inventory summary fetch error:', error)
      if (error.code === 'ECONNABORTED') {
        return rejectWithValue('Request timeout - backend server may be slow or unavailable')
      }
      if (error.code === 'ERR_NETWORK') {
        return rejectWithValue('Network error - backend server may be down')
      }
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch inventory summary')
    }
  }
)

export const fetchFinancialSummary = createAsyncThunk(
  'dashboard/fetchFinancialSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/financial-summary', params)
      return response.data
    } catch (error) {
      console.error('Financial summary fetch error:', error)
      if (error.code === 'ECONNABORTED') {
        return rejectWithValue('Request timeout - backend server may be slow or unavailable')
      }
      if (error.code === 'ERR_NETWORK') {
        return rejectWithValue('Network error - backend server may be down')
      }
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch financial summary')
    }
  }
)

export const fetchSuppliersSummary = createAsyncThunk(
  'dashboard/fetchSuppliersSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/suppliers', params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch suppliers summary')
    }
  }
)

export const fetchCompaniesSummary = createAsyncThunk(
  'dashboard/fetchCompaniesSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/companies', params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch companies summary')
    }
  }
)

export const fetchShiftAnalytics = createAsyncThunk(
  'dashboard/fetchShiftAnalytics',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/shift-analytics', params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch shift analytics')
    }
  }
)

const initialState = {
  dashboardData: null,
  salesSummary: null,
  inventorySummary: null,
  financialSummary: null,
  suppliersSummary: null,
  companiesSummary: null,
  shiftAnalytics: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
}

const dashboardSlice = createSlice({
  name: 'dashboard',
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
      // Dashboard data
      .addCase(fetchDashboardData.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.isLoading = false
        state.dashboardData = action.payload.data || action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Sales summary
      .addCase(fetchSalesSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchSalesSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.salesSummary = action.payload.data || action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchSalesSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Inventory summary
      .addCase(fetchInventorySummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchInventorySummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.inventorySummary = action.payload.data || action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchInventorySummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Financial summary
      .addCase(fetchFinancialSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFinancialSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.financialSummary = action.payload.data || action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchFinancialSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Suppliers summary
      .addCase(fetchSuppliersSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchSuppliersSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.suppliersSummary = action.payload.data || action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchSuppliersSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Companies summary
      .addCase(fetchCompaniesSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchCompaniesSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.companiesSummary = action.payload.data || action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchCompaniesSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Shift analytics
      .addCase(fetchShiftAnalytics.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchShiftAnalytics.fulfilled, (state, action) => {
        state.isLoading = false
        state.shiftAnalytics = action.payload.data || action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchShiftAnalytics.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

export const { clearError, setLastUpdated } = dashboardSlice.actions
export default dashboardSlice.reducer
