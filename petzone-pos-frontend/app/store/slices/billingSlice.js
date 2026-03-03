import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks - REMOVED all scope validation
export const fetchBilling = createAsyncThunk(
  'billing/fetchBilling',
  async (params = {}, { rejectWithValue }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers
      const queryParams = new URLSearchParams()

      if (params.status) queryParams.append('status', params.status)
      if (params.clientName) queryParams.append('clientName', params.clientName)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)

      // ❌ REMOVED manual scope append - now handled by axios headers
      const response = await api.get(`/billing?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch billing records')
    }
  }
)

export const createBillingRecord = createAsyncThunk(
  'billing/createBillingRecord',
  async (billingData, { rejectWithValue }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers
      console.log('[BillingSlice] createBillingRecord - Request data:', billingData)

      const response = await api.post('/billing', billingData)
      return response.data
    } catch (error) {
      if (error.response?.status === 500) {
        return rejectWithValue('Server error occurred. Please try again or contact support.')
      } else if (error.response?.status === 400) {
        return rejectWithValue(error.response?.data?.message || 'Invalid data provided.')
      } else if (error.response?.status === 404) {
        return rejectWithValue('Billing record not found.')
      } else if (error.response?.status === 403) {
        return rejectWithValue('Access denied. You may not have permission for this scope.')
      } else {
        return rejectWithValue(error.response?.data?.message || 'Failed to create billing record')
      }
    }
  }
)

export const updateBillingRecord = createAsyncThunk(
  'billing/updateBillingRecord',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers
      console.log('[BillingSlice] updateBillingRecord - Request data:', { id, data })

      const response = await api.put(`/billing/${id}`, data)
      return response.data
    } catch (error) {
      if (error.response?.status === 500) {
        return rejectWithValue('Server error occurred. Please try again or contact support.')
      } else if (error.response?.status === 400) {
        return rejectWithValue(error.response?.data?.message || 'Invalid data provided.')
      } else if (error.response?.status === 404) {
        return rejectWithValue('Billing record not found.')
      } else if (error.response?.status === 403) {
        return rejectWithValue('Access denied. You may not have permission for this scope.')
      } else {
        return rejectWithValue(error.response?.data?.message || 'Failed to update billing record')
      }
    }
  }
)

export const deleteBillingRecord = createAsyncThunk(
  'billing/deleteBillingRecord',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/billing/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete billing record')
    }
  }
)

const initialState = {
  data: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  }
}

const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearBillingData: (state) => {
      state.data = []
      state.pagination = {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchBilling
      .addCase(fetchBilling.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBilling.fulfilled, (state, action) => {
        state.loading = false
        
        const payload = action.payload || {}
        const data = payload.data || payload
        
        state.data = data
        state.error = null
        
        // Update pagination if available
        state.pagination = {
          page: payload.page || action.meta?.arg?.page || 1,
          limit: payload.limit || action.meta?.arg?.limit || data?.length || 50,
          total: payload.count ?? payload.total ?? data?.length ?? 0,
          totalPages: payload.totalPages || 
            Math.max(1, Math.ceil((payload.count ?? data?.length ?? 0) / (payload.limit || data?.length || 50)))
        }
      })
      .addCase(fetchBilling.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // createBillingRecord
      .addCase(createBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createBillingRecord.fulfilled, (state, action) => {
        state.loading = false
        const newBillingRecord = action.payload.data || action.payload
        state.data = [newBillingRecord, ...state.data] // Add to beginning
        state.error = null
      })
      .addCase(createBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // updateBillingRecord
      .addCase(updateBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateBillingRecord.fulfilled, (state, action) => {
        state.loading = false

        const updated = action.payload.data || action.payload
        const index = state.data.findIndex((billing) => billing.id === updated.id)

        if (index !== -1) {
          state.data[index] = updated
        }

        state.error = null
      })
      .addCase(updateBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // deleteBillingRecord
      .addCase(deleteBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteBillingRecord.fulfilled, (state, action) => {
        state.loading = false
        // Assuming the API returns the deleted ID or the response contains the ID
        const deletedId = action.payload?.id || action.meta?.arg
        state.data = state.data.filter((billing) => billing.id !== deletedId)
        state.error = null
      })
      .addCase(deleteBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { clearError, clearBillingData } = billingSlice.actions
export default billingSlice.reducer