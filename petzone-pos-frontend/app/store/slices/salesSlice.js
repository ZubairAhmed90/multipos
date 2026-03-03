import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

// Async thunks - REMOVED all scope validation
export const fetchSales = createAsyncThunk(
  'sales/fetchSales',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers
      console.log('[SalesSlice] fetchSales - Request params:', params)

      const response = await api.get('/sales', { params })

      console.log('[SalesSlice] fetchSales - Response:', {
        success: response.data?.success,
        count: response.data?.count,
        dataLength: response.data?.data?.length,
        hasData: !!response.data?.data
      })

      return response.data
    } catch (error) {
      console.error('[SalesSlice] fetchSales - Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        params
      })

      const status = error.response?.status
      const serverMsg = error.response?.data?.message || error.response?.data || null

      return rejectWithValue({
        message: error.message || 'Failed to fetch sales',
        status,
        serverMsg
      })
    }
  }
)

export const createSale = createAsyncThunk(
  'sales/createSale',
  async (saleData, { rejectWithValue, getState }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers
      console.log('[SalesSlice] createSale - Request data:', saleData)

      const response = await api.post('/sales', saleData)

      if (response.data.success) {
        return response.data
      } else {
        const message = response.data.message || 'Failed to create sale'
        return rejectWithValue({ message, status: response.status })
      }
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message || error.response?.data?.errors
      const defaultMessage = 'Failed to create sale'

      if (status === 403) {
        const permissionMessage =
          apiMessage || 'Permission denied. You may not have access to this scope.'
        return rejectWithValue({ message: permissionMessage, status })
      }

      console.error('[SalesSlice] createSale error:', error)

      const errorMessage = apiMessage || error.message || defaultMessage
      return rejectWithValue({ message: errorMessage, status })
    }
  }
)

export const createWarehouseSale = createAsyncThunk(
  'sales/createWarehouseSale',
  async (saleData, { rejectWithValue, getState }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers
      console.log('[SalesSlice] createWarehouseSale - Request data:', saleData)

      const response = await api.post('/warehouse-sales', saleData)
      return response.data
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message || error.response?.data?.errors
      const defaultMessage = 'Failed to create warehouse sale'

      if (status === 403) {
        const permissionMessage =
          apiMessage || 'Permission denied. You may not have access to this warehouse.'
        return rejectWithValue({ message: permissionMessage, status })
      }

      return rejectWithValue({
        message: apiMessage || error.message || defaultMessage,
        status
      })
    }
  }
)

export const updateSale = createAsyncThunk(
  'sales/updateSale',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/sales/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update sale')
    }
  }
)

export const deleteSale = createAsyncThunk(
  'sales/deleteSale',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/sales/${id}`)
      return id
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete sale')
    }
  }
)

export const getSale = createAsyncThunk(
  'sales/getSale',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/sales/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sale')
    }
  }
)

export const fetchSalesReturns = createAsyncThunk(
  'sales/fetchSalesReturns',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/sales/returns', { params })
      return response.data
    } catch (error) {
      const status = error.response?.status
      const serverMsg = error.response?.data?.message || error.response?.data || null

      return rejectWithValue({
        message: error.message || 'Failed to fetch sales returns',
        status,
        serverMsg
      })
    }
  }
)

export const createSalesReturn = createAsyncThunk(
  'sales/createSalesReturn',
  async (returnData, { rejectWithValue }) => {
    try {
      const response = await api.post('/sales/returns', returnData)
      return response.data
    } catch (error) {
      const status = error.response?.status
      const serverMsg = error.response?.data?.message || error.response?.data || null

      return rejectWithValue({
        message: error.message || 'Failed to create sales return',
        status,
        serverMsg
      })
    }
  }
)

export const fetchLatestSales = createAsyncThunk(
  'sales/fetchLatestSales',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/sales/latest')
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch latest sales')
    }
  }
)

export const fetchSalesSummary = createAsyncThunk(
  'sales/fetchSalesSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/sales/summary', { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sales summary')
    }
  }
)

const initialState = {
  data: [],
  returns: [],
  latestSales: [],
  summary: {
    totalSales: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    completedSales: 0
  },
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  },
  cache: {},
  loading: false,
  error: null
}

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearCache: (state) => {
      state.cache = {}
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchSales
      .addCase(fetchSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.loading = false

        const payload = action.payload || {}
        const data = payload.data || payload

        state.data = data
        state.error = null

        state.pagination = {
          page: payload.page || action.meta?.arg?.page || 1,
          limit: payload.limit || action.meta?.arg?.limit || data?.length || 50,
          total: payload.count ?? payload.total ?? data?.length ?? 0,
          totalPages:
            payload.totalPages ||
            Math.max(1, Math.ceil((payload.count ?? data?.length ?? 0) / (payload.limit || data?.length || 50)))
        }

        state.summary = payload.summary || state.summary

        const cacheKey = JSON.stringify(action.meta?.arg || {})
        state.cache[cacheKey] = {
          timestamp: Date.now(),
          payload
        }
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // createSale
      .addCase(createSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createSale.fulfilled, (state, action) => {
        state.loading = false
        const newSale = action.payload.data || action.payload
        state.data = [newSale, ...state.data] // Add to beginning for better UX
        state.error = null
      })
      .addCase(createSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // createWarehouseSale
      .addCase(createWarehouseSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createWarehouseSale.fulfilled, (state, action) => {
        state.loading = false
        const newSale = action.payload.data || action.payload
        state.data = [newSale, ...state.data]
        state.error = null
      })
      .addCase(createWarehouseSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // updateSale
      .addCase(updateSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateSale.fulfilled, (state, action) => {
        state.loading = false
        const updatedSale = action.payload.data || action.payload
        const index = state.data.findIndex((sale) => sale.id === updatedSale.id)

        if (index !== -1) {
          state.data[index] = updatedSale
        }

        state.error = null
      })
      .addCase(updateSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // deleteSale
      .addCase(deleteSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteSale.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter((sale) => sale.id !== action.payload)
        state.error = null
      })
      .addCase(deleteSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // getSale
      .addCase(getSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getSale.fulfilled, (state, action) => {
        state.loading = false
        state.error = null

        const saleData = action.payload.data || action.payload
        const index = state.data.findIndex((sale) => sale.id === saleData.id)

        if (index !== -1) {
          state.data[index] = saleData
        } else {
          state.data.push(saleData)
        }
      })
      .addCase(getSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchSalesReturns
      .addCase(fetchSalesReturns.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSalesReturns.fulfilled, (state, action) => {
        state.loading = false
        state.returns = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchSalesReturns.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // createSalesReturn
      .addCase(createSalesReturn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createSalesReturn.fulfilled, (state, action) => {
        state.loading = false
        const newReturn = action.payload.data || action.payload
        state.returns = [newReturn, ...state.returns]
        state.error = null
      })
      .addCase(createSalesReturn.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchLatestSales
      .addCase(fetchLatestSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLatestSales.fulfilled, (state, action) => {
        state.loading = false
        state.latestSales = action.payload.sales || action.payload
        state.error = null
      })
      .addCase(fetchLatestSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchSalesSummary
      .addCase(fetchSalesSummary.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSalesSummary.fulfilled, (state, action) => {
        state.loading = false
        state.summary = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchSalesSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { clearError, clearCache } = salesSlice.actions
export default salesSlice.reducer