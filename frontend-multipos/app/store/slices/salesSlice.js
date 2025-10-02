import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
export const fetchSales = createAsyncThunk(
  'sales/fetchSales',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/sales', params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sales')
    }
  }
)

export const createSale = createAsyncThunk(
  'sales/createSale',
  async (saleData, { rejectWithValue }) => {
    try {
      const response = await api.post('/sales', saleData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create sale')
    }
  }
)

export const createWarehouseSale = createAsyncThunk(
  'sales/createWarehouseSale',
  async (saleData, { rejectWithValue }) => {
    try {
      const response = await api.post('/warehouse-sales', saleData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create warehouse sale')
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
      const response = await api.get('/sales/returns', params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sales returns')
    }
  }
)

export const createSalesReturn = createAsyncThunk(
  'sales/createSalesReturn',
  async (returnData, { rejectWithValue }) => {
    try {
      const response = await api.post('api/sales/returns', returnData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create sales return')
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
      const response = await api.get('/sales/summary', params)
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
  summary: null,
  loading: false,
  error: null,
}

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.loading = false
        if (action.payload.data) {
          action.payload.data.forEach((sale, index) => {
(`🔍 Frontend - Sale ${index}:`, {
              id: sale.id,
              customerInfo: sale.customerInfo,
              customer_info: sale.customer_info,
              payment_method: sale.payment_method,
              paymentMethod: sale.paymentMethod,
              notes: sale.notes
            })
          })
        }
        state.data = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createSale.fulfilled, (state, action) => {
        state.loading = false
        const newSale = action.payload.data || action.payload
        state.data.push(newSale)
        state.error = null
      })
      .addCase(createSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Create warehouse sale
      .addCase(createWarehouseSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createWarehouseSale.fulfilled, (state, action) => {
        state.loading = false
        // Don't add to state.data as warehouse sales are handled separately
        // The main sales table will be updated via the backend
        state.error = null
      })
      .addCase(createWarehouseSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(updateSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateSale.fulfilled, (state, action) => {
        state.loading = false
        const updatedSale = action.payload.data || action.payload
        const index = state.data.findIndex(sale => sale.id === updatedSale.id)
        if (index !== -1) {
          state.data[index] = updatedSale
        }
        state.error = null
      })
      .addCase(updateSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(deleteSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteSale.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter(sale => sale.id !== action.payload)
        state.error = null
      })
      .addCase(deleteSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Get single sale
      .addCase(getSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getSale.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        const saleData = action.payload.data || action.payload
        const index = state.data.findIndex(sale => sale.id === saleData.id)
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
      
      // Fetch sales returns
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
      
      // Create sales return
      .addCase(createSalesReturn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createSalesReturn.fulfilled, (state, action) => {
        state.loading = false
        const newReturn = action.payload.data || action.payload
        state.returns.push(newReturn)
        state.error = null
      })
      .addCase(createSalesReturn.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch latest sales
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
      
      // Fetch sales summary
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
  },
})

export const { clearError } = salesSlice.actions
export default salesSlice.reducer
