import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
export const fetchRetailers = createAsyncThunk(
  'retailers/fetchRetailers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      
      if (params.status) queryParams.append('status', params.status)
      if (params.businessType) queryParams.append('businessType', params.businessType)
      if (params.paymentTerms) queryParams.append('paymentTerms', params.paymentTerms)
      if (params.warehouseId) queryParams.append('warehouseId', params.warehouseId)
      
      const response = await api.get(`/retailers?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch retailers')
    }
  }
)

export const fetchRetailer = createAsyncThunk(
  'retailers/fetchRetailer',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/retailers/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch retailer')
    }
  }
)

export const createRetailer = createAsyncThunk(
  'retailers/createRetailer',
  async (retailerData, { rejectWithValue }) => {
    try {
      const response = await api.post('/retailers', retailerData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create retailer')
    }
  }
)

export const updateRetailer = createAsyncThunk(
  'retailers/updateRetailer',
  async ({ id, retailerData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/retailers/${id}`, retailerData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update retailer')
    }
  }
)

export const deleteRetailer = createAsyncThunk(
  'retailers/deleteRetailer',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/retailers/${id}`)
      return id
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete retailer')
    }
  }
)

const initialState = {
  data: [],
  selectedRetailer: null,
  loading: false,
  error: null,
  createLoading: false,
  updateLoading: false,
  deleteLoading: false
}

const retailersSlice = createSlice({
  name: 'retailers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearSelectedRetailer: (state) => {
      state.selectedRetailer = null
    },
    setSelectedRetailer: (state, action) => {
      state.selectedRetailer = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch retailers
      .addCase(fetchRetailers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRetailers.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || []
        state.error = null
      })
      .addCase(fetchRetailers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch single retailer
      .addCase(fetchRetailer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRetailer.fulfilled, (state, action) => {
        state.loading = false
        state.selectedRetailer = action.payload.data
        state.error = null
      })
      .addCase(fetchRetailer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Create retailer
      .addCase(createRetailer.pending, (state) => {
        state.createLoading = true
        state.error = null
      })
      .addCase(createRetailer.fulfilled, (state, action) => {
        state.createLoading = false
        state.data.push(action.payload.data)
        state.error = null
      })
      .addCase(createRetailer.rejected, (state, action) => {
        state.createLoading = false
        state.error = action.payload
      })
      
      // Update retailer
      .addCase(updateRetailer.pending, (state) => {
        state.updateLoading = true
        state.error = null
      })
      .addCase(updateRetailer.fulfilled, (state, action) => {
        state.updateLoading = false
        const index = state.data.findIndex(retailer => retailer.id === action.payload.data.id)
        if (index !== -1) {
          state.data[index] = action.payload.data
        }
        if (state.selectedRetailer && state.selectedRetailer.id === action.payload.data.id) {
          state.selectedRetailer = action.payload.data
        }
        state.error = null
      })
      .addCase(updateRetailer.rejected, (state, action) => {
        state.updateLoading = false
        state.error = action.payload
      })
      
      // Delete retailer
      .addCase(deleteRetailer.pending, (state) => {
        state.deleteLoading = true
        state.error = null
      })
      .addCase(deleteRetailer.fulfilled, (state, action) => {
        state.deleteLoading = false
        state.data = state.data.filter(retailer => retailer.id !== action.payload)
        if (state.selectedRetailer && state.selectedRetailer.id === action.payload) {
          state.selectedRetailer = null
        }
        state.error = null
      })
      .addCase(deleteRetailer.rejected, (state, action) => {
        state.deleteLoading = false
        state.error = action.payload
      })
  }
})

export const { clearError, clearSelectedRetailer, setSelectedRetailer } = retailersSlice.actions

export default retailersSlice.reducer
