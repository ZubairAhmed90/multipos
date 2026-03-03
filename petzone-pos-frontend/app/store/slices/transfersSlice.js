import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
export const fetchTransfers = createAsyncThunk(
  'transfers/fetchTransfers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      
      // Add all possible parameters
      if (params.status) queryParams.append('status', params.status)
      if (params.transferType) queryParams.append('transferType', params.transferType)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.search) queryParams.append('search', params.search)
      if (params.fromBranchId) queryParams.append('fromBranchId', params.fromBranchId)
      if (params.fromWarehouseId) queryParams.append('fromWarehouseId', params.fromWarehouseId)
      if (params.toBranchId) queryParams.append('toBranchId', params.toBranchId)
      if (params.toWarehouseId) queryParams.append('toWarehouseId', params.toWarehouseId)
      // Add role-based filtering parameters
      if (params.cashierBranchId) queryParams.append('cashierBranchId', params.cashierBranchId)
      if (params.warehouseKeeperWarehouseId) queryParams.append('warehouseKeeperWarehouseId', params.warehouseKeeperWarehouseId)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const url = `/transfers?${queryParams.toString()}`
      console.log('🔍 Frontend API call:', url)
      const response = await api.get(url)
      console.log('🔍 Frontend API response:', response.data)
      return response.data
    } catch (error) {
      console.error('🔍 Frontend API error:', error)
      console.error('🔍 Error response:', error.response?.data)
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

export const fetchTransferStatistics = createAsyncThunk(
  'transfers/fetchTransferStatistics',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.fromWarehouseId) queryParams.append('fromWarehouseId', params.fromWarehouseId)
      
      const response = await api.get(`/transfers/statistics?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch transfer statistics')
    }
  }
)

export const updateTransferStatus = createAsyncThunk(
  'transfers/updateTransferStatus',
  async ({ transferId, status, notes }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/transfers/${transferId}/status`, { status, notes })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update transfer status')
    }
  }
)

const initialState = {
  transfers: [],
  currentTransfer: null,
  statistics: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  }
}

const transfersSlice = createSlice({
  name: 'transfers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearCurrentTransfer: (state) => {
      state.currentTransfer = null
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransfers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTransfers.fulfilled, (state, action) => {
        state.loading = false
        state.transfers = action.payload.data || action.payload.transfers || []
        state.pagination = action.payload.pagination || state.pagination
        state.error = null
        
        console.log('✅ Transfers loaded:', {
          count: state.transfers.length,
          data: state.transfers,
          pagination: state.pagination
        })
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
        state.transfers.unshift(newTransfer)
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
        const index = state.transfers.findIndex(transfer => transfer.id === updatedTransfer.id)
        if (index !== -1) {
          state.transfers[index] = updatedTransfer
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
        const index = state.transfers.findIndex(transfer => transfer.id === approvedTransfer.id)
        if (index !== -1) {
          state.transfers[index] = approvedTransfer
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
        const index = state.transfers.findIndex(transfer => transfer.id === rejectedTransfer.id)
        if (index !== -1) {
          state.transfers[index] = rejectedTransfer
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
        const index = state.transfers.findIndex(transfer => transfer.id === completedTransfer.id)
        if (index !== -1) {
          state.transfers[index] = completedTransfer
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
        const index = state.transfers.findIndex(transfer => transfer.id === cancelledTransfer.id)
        if (index !== -1) {
          state.transfers[index] = cancelledTransfer
        }
        state.error = null
      })
      .addCase(cancelTransfer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch transfer statistics
      .addCase(fetchTransferStatistics.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTransferStatistics.fulfilled, (state, action) => {
        state.loading = false
        state.statistics = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchTransferStatistics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update transfer status
      .addCase(updateTransferStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateTransferStatus.fulfilled, (state, action) => {
        state.loading = false
        const updatedTransfer = action.payload.data || action.payload
        const index = state.transfers.findIndex(t => t.id === updatedTransfer.id)
        if (index !== -1) {
          state.transfers[index] = updatedTransfer
        }
        if (state.currentTransfer && state.currentTransfer.id === updatedTransfer.id) {
          state.currentTransfer = updatedTransfer
        }
        state.error = null
      })
      .addCase(updateTransferStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError, clearCurrentTransfer, setPagination } = transfersSlice.actions
export default transfersSlice.reducer
