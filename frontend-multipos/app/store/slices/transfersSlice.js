import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
export const fetchTransfers = createAsyncThunk(
  'transfers/fetchTransfers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.status) queryParams.append('status', params.status)
      if (params.fromScopeType) queryParams.append('fromScopeType', params.fromScopeType)
      if (params.fromScopeId) queryParams.append('fromScopeId', params.fromScopeId)
      if (params.toScopeType) queryParams.append('toScopeType', params.toScopeType)
      if (params.toScopeId) queryParams.append('toScopeId', params.toScopeId)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/transfers?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch transfers')
    }
  }
)

export const createTransfer = createAsyncThunk(
  'transfers/createTransfer',
  async (transferData, { rejectWithValue }) => {
    try {
      const response = await api.post('/transfers', transferData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create transfer')
    }
  }
)

export const updateTransfer = createAsyncThunk(
  'transfers/updateTransfer',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/transfers/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update transfer')
    }
  }
)

export const deleteTransfer = createAsyncThunk(
  'transfers/deleteTransfer',
  async (transferId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/transfers/${transferId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete transfer')
    }
  }
)

export const approveTransfer = createAsyncThunk(
  'transfers/approveTransfer',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.put(`/transfers/${id}/approve`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to approve transfer')
    }
  }
)

export const rejectTransfer = createAsyncThunk(
  'transfers/rejectTransfer',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.put(`/transfers/${id}/reject`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject transfer')
    }
  }
)

export const completeTransfer = createAsyncThunk(
  'transfers/completeTransfer',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.put(`/transfers/${id}/complete`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to complete transfer')
    }
  }
)

export const cancelTransfer = createAsyncThunk(
  'transfers/cancelTransfer',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.put(`/transfers/${id}/cancel`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel transfer')
    }
  }
)

const initialState = {
  data: [],
  loading: false,
  error: null,
}

const transfersSlice = createSlice({
  name: 'transfers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransfers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTransfers.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchTransfers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createTransfer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createTransfer.fulfilled, (state, action) => {
        state.loading = false
        const newTransfer = action.payload.data || action.payload
        state.data.push(newTransfer)
        state.error = null
      })
      .addCase(createTransfer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(updateTransfer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateTransfer.fulfilled, (state, action) => {
        state.loading = false
        const updatedTransfer = action.payload.data || action.payload
        const index = state.data.findIndex(transfer => transfer._id === updatedTransfer._id)
        if (index !== -1) {
          state.data[index] = updatedTransfer
        }
        state.error = null
      })
      .addCase(updateTransfer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(approveTransfer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(approveTransfer.fulfilled, (state, action) => {
        state.loading = false
        const approvedTransfer = action.payload.data || action.payload
        const index = state.data.findIndex(transfer => transfer._id === approvedTransfer._id)
        if (index !== -1) {
          state.data[index] = approvedTransfer
        }
        state.error = null
      })
      .addCase(approveTransfer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(rejectTransfer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(rejectTransfer.fulfilled, (state, action) => {
        state.loading = false
        const rejectedTransfer = action.payload.data || action.payload
        const index = state.data.findIndex(transfer => transfer._id === rejectedTransfer._id)
        if (index !== -1) {
          state.data[index] = rejectedTransfer
        }
        state.error = null
      })
      .addCase(rejectTransfer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(completeTransfer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(completeTransfer.fulfilled, (state, action) => {
        state.loading = false
        const completedTransfer = action.payload.data || action.payload
        const index = state.data.findIndex(transfer => transfer._id === completedTransfer._id)
        if (index !== -1) {
          state.data[index] = completedTransfer
        }
        state.error = null
      })
      .addCase(completeTransfer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(cancelTransfer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(cancelTransfer.fulfilled, (state, action) => {
        state.loading = false
        const cancelledTransfer = action.payload.data || action.payload
        const index = state.data.findIndex(transfer => transfer._id === cancelledTransfer._id)
        if (index !== -1) {
          state.data[index] = cancelledTransfer
        }
        state.error = null
      })
      .addCase(cancelTransfer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError } = transfersSlice.actions
export default transfersSlice.reducer
