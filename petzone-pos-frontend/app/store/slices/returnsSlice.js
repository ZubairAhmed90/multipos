import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for returns
export const fetchReturns = createAsyncThunk(
  'returns/fetchReturns',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/sales/returns', { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch returns')
    }
  }
)

export const createReturn = createAsyncThunk(
  'returns/createReturn',
  async (returnData, { rejectWithValue }) => {
    try {
      const response = await api.post('/sales/returns', returnData)
      return response.data
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message
      const defaultMessage = 'Failed to create return'

      if (status === 403) {
        const permissionMessage = apiMessage || 'Permission denied: please ask an admin to enable returns for this scope.'
        return rejectWithValue({ message: permissionMessage, status })
      }

      return rejectWithValue({ message: apiMessage || error.message || defaultMessage, status })
    }
  }
)

export const updateReturn = createAsyncThunk(
  'returns/updateReturn',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/sales/returns/${id}`, data)
      return response.data
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message
      const defaultMessage = 'Failed to update return'

      if (status === 403) {
        const permissionMessage = apiMessage || 'Permission denied: please ask an admin to enable returns for this scope.'
        return rejectWithValue({ message: permissionMessage, status })
      }

      return rejectWithValue({ message: apiMessage || error.message || defaultMessage, status })
    }
  }
)

export const deleteReturn = createAsyncThunk(
  'returns/deleteReturn',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/sales/returns/${id}`)
      return id
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message
      const defaultMessage = 'Failed to delete return'

      if (status === 403) {
        const permissionMessage = apiMessage || 'Permission denied: please ask an admin to enable returns for this scope.'
        return rejectWithValue({ message: permissionMessage, status })
      }

      return rejectWithValue({ message: apiMessage || error.message || defaultMessage, status })
    }
  }
)

const initialState = {
  data: [],
  total: 0,
  loading: false,
  error: null,
}

const returnsSlice = createSlice({
  name: 'returns',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearReturns: (state) => {
      state.data = []
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch returns
      .addCase(fetchReturns.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchReturns.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || action.payload
        state.total = action.payload.total ?? (action.payload.data?.length ?? state.data.length)
        state.error = null
      })
      .addCase(fetchReturns.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Create return
      .addCase(createReturn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createReturn.fulfilled, (state, action) => {
        state.loading = false
        const newReturn = action.payload.data || action.payload
        state.data.push(newReturn)
        state.error = null
      })
      .addCase(createReturn.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Update return
      .addCase(updateReturn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateReturn.fulfilled, (state, action) => {
        state.loading = false
        const index = state.data.findIndex(returnItem => returnItem.id === action.payload.id)
        if (index !== -1) {
          state.data[index] = action.payload
        }
        state.error = null
      })
      .addCase(updateReturn.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      // Delete return
      .addCase(deleteReturn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteReturn.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter(returnItem => returnItem.id !== action.payload)
        state.error = null
      })
      .addCase(deleteReturn.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { clearError, clearReturns } = returnsSlice.actions
export default returnsSlice.reducer
