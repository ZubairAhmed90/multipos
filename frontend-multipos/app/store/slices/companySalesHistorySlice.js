import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunk to fetch company sales history
export const fetchCompanySalesHistory = createAsyncThunk(
  'companySalesHistory/fetchCompanySalesHistory',
  async ({ companyId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/sales/company/${companyId}`, { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch company sales history')
    }
  }
)

const initialState = {
  data: null,
  loading: false,
  error: null
}

const companySalesHistorySlice = createSlice({
  name: 'companySalesHistory',
  initialState,
  reducers: {
    clearCompanySalesHistory: (state) => {
      state.data = null
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanySalesHistory.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCompanySalesHistory.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data
        state.error = null
      })
      .addCase(fetchCompanySalesHistory.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.data = null
      })
  }
})

export const { clearCompanySalesHistory, clearError } = companySalesHistorySlice.actions
export default companySalesHistorySlice.reducer
