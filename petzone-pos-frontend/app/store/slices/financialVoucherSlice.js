import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Helper function to transform backend data to frontend format
const transformVoucherData = (voucher) => {
  return {
    id: voucher.id,
    voucherNo: voucher.voucherNo, // ✅ Backend already returns camelCase
    type: voucher.type,
    category: voucher.category,
    paymentMethod: voucher.paymentMethod, // ✅ Backend already returns camelCase
    amount: voucher.amount,
    description: voucher.description,
    reference: voucher.reference,
    scopeType: voucher.scopeType, // ✅ Backend already returns camelCase
    scopeId: voucher.scopeId, // ✅ Backend already returns camelCase
    userId: voucher.userId, // ✅ Backend already returns camelCase
    userName: voucher.userName, // ✅ Backend already returns camelCase
    userRole: voucher.userRole, // ✅ Backend already returns camelCase
    status: voucher.status,
    approvedBy: voucher.approvedBy, // ✅ Backend already returns camelCase
    approvedAt: voucher.approvedAt, // ✅ Backend already returns camelCase
    notes: voucher.notes,
    createdAt: voucher.createdAt, // ✅ Backend already returns camelCase
    updatedAt: voucher.updatedAt // ✅ Backend already returns camelCase
  };
}

// Helper function to serialize filters for API
const serializeFilters = (filters) => {
  const params = new URLSearchParams()
  
  Object.keys(filters).forEach(key => {
    const value = filters[key]
    if (value !== null && value !== undefined && value !== '') {
      if (key === 'dateFrom' || key === 'dateTo') {
        if (value instanceof Date) {
          params.append(key, value.toISOString().split('T')[0])
        }
      } else {
        params.append(key, value)
      }
    }
  })
  
  return params.toString()
}

// Helper function for consistent error handling
const handleApiError = (error) => {
  return error.response?.data?.message || 
         error.response?.data?.error || 
         error.message || 
         'An unexpected error occurred'
}

// Async thunks for API calls
export const fetchFinancialVouchers = createAsyncThunk(
  'financialVouchers/fetchFinancialVouchers',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const queryString = serializeFilters(filters)
      const response = await api.get(`/financial-vouchers${queryString ? `?${queryString}` : ''}`)
      
      // Transform the response data
      const transformedData = {
        success: response.data.success,
        data: Array.isArray(response.data.data) ? response.data.data.map(transformVoucherData) : [],
        pagination: response.data.pagination
      }
      
      return transformedData
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const fetchFinancialVoucherById = createAsyncThunk(
  'financialVouchers/fetchFinancialVoucherById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/financial-vouchers/${id}`)
      
      return {
        success: response.data.success,
        data: transformVoucherData(response.data.data)
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const createFinancialVoucher = createAsyncThunk(
  'financialVouchers/createFinancialVoucher',
  async (voucherData, { rejectWithValue }) => {
    try {
      const response = await api.post('/financial-vouchers', voucherData)
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: transformVoucherData(response.data.data)
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const updateFinancialVoucher = createAsyncThunk(
  'financialVouchers/updateFinancialVoucher',
  async ({ id, ...updateData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/financial-vouchers/${id}`, updateData)
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: transformVoucherData(response.data.data)
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const approveFinancialVoucher = createAsyncThunk(
  'financialVouchers/approveFinancialVoucher',
  async ({ id, notes }, { rejectWithValue }) => {
    try {
      const payload = notes ? { notes } : {}
      const response = await api.put(`/financial-vouchers/${id}/approve`, payload)
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: transformVoucherData(response.data.data)
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const rejectFinancialVoucher = createAsyncThunk(
  'financialVouchers/rejectFinancialVoucher',
  async ({ id, notes, rejectionReason }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/financial-vouchers/${id}/reject`, { notes, rejectionReason })
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: transformVoucherData(response.data.data)
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const deleteFinancialVoucher = createAsyncThunk(
  'financialVouchers/deleteFinancialVoucher',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/financial-vouchers/${id}`)
      
      return {
        success: response.data.success,
        message: response.data.message,
        id: id
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const fetchFinancialSummary = createAsyncThunk(
  'financialVouchers/fetchFinancialSummary',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const queryString = serializeFilters(filters)
      const response = await api.get(`/financial-vouchers/summary${queryString ? `?${queryString}` : ''}`)
      
      return {
        success: response.data.success,
        data: response.data.data
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const fetchDailySummary = createAsyncThunk(
  'financialVouchers/fetchDailySummary',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const queryString = serializeFilters(filters)
      const response = await api.get(`/financial-vouchers/daily-summary${queryString ? `?${queryString}` : ''}`)
      
      return {
        success: response.data.success,
        data: response.data.data
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const fetchPaymentMethodSummary = createAsyncThunk(
  'financialVouchers/fetchPaymentMethodSummary',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const queryString = serializeFilters(filters)
      const response = await api.get(`/financial-vouchers/payment-method-summary${queryString ? `?${queryString}` : ''}`)
      
      return {
        success: response.data.success,
        data: response.data.data
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const fetchFinancialAccounts = createAsyncThunk(
  'financialVouchers/fetchFinancialAccounts',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const queryString = serializeFilters(filters)
      const response = await api.get(`/financial-vouchers/accounts${queryString ? `?${queryString}` : ''}`)
      
      return {
        success: response.data.success,
        data: response.data.data
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const updateAccountBalance = createAsyncThunk(
  'financialVouchers/updateAccountBalance',
  async ({ id, balance }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/financial-vouchers/accounts/${id}/balance`, { balance })
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

export const createFinancialAccount = createAsyncThunk(
  'financialVouchers/createFinancialAccount',
  async (accountData, { rejectWithValue }) => {
    try {
      const response = await api.post('/financial-vouchers/accounts', accountData)
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      }
    } catch (error) {
      return rejectWithValue(handleApiError(error))
    }
  }
)

// Initial state
const initialState = {
  vouchers: [],
  selectedVoucher: null,
  financialSummary: [],
  dailySummary: [],
  paymentMethodSummary: [],
  financialAccounts: [],
  pagination: {
    page: 1,
    limit: 25,
    total: 0,
    pages: 0
  },
  isLoading: false,
  error: null,
  success: null
}

// Slice
const financialVoucherSlice = createSlice({
  name: 'financialVouchers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearSuccess: (state) => {
      state.success = null
    },
    setSelectedVoucher: (state, action) => {
      state.selectedVoucher = action.payload
    },
    clearSelectedVoucher: (state) => {
      state.selectedVoucher = null
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Fetch vouchers
      .addCase(fetchFinancialVouchers.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFinancialVouchers.fulfilled, (state, action) => {
        state.isLoading = false
        state.vouchers = action.payload.data
        state.pagination = action.payload.pagination
        state.error = null
      })
      .addCase(fetchFinancialVouchers.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Fetch voucher by ID
      .addCase(fetchFinancialVoucherById.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFinancialVoucherById.fulfilled, (state, action) => {
        state.isLoading = false
        state.selectedVoucher = action.payload.data
        state.error = null
      })
      .addCase(fetchFinancialVoucherById.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Create voucher
      .addCase(createFinancialVoucher.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createFinancialVoucher.fulfilled, (state, action) => {
        state.isLoading = false
        state.vouchers.unshift(action.payload.data)
        state.success = action.payload.message
        state.error = null
      })
      .addCase(createFinancialVoucher.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Update voucher
      .addCase(updateFinancialVoucher.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateFinancialVoucher.fulfilled, (state, action) => {
        state.isLoading = false
        const index = state.vouchers.findIndex(voucher => voucher.id === action.payload.data.id)
        if (index !== -1) {
          state.vouchers[index] = action.payload.data
        }
        state.success = action.payload.message
        state.error = null
      })
      .addCase(updateFinancialVoucher.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Approve voucher
      .addCase(approveFinancialVoucher.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(approveFinancialVoucher.fulfilled, (state, action) => {
        state.isLoading = false
        const index = state.vouchers.findIndex(voucher => voucher.id === action.payload.data.id)
        if (index !== -1) {
          state.vouchers[index] = action.payload.data
        }
        state.success = action.payload.message
        state.error = null
      })
      .addCase(approveFinancialVoucher.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Reject voucher
      .addCase(rejectFinancialVoucher.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(rejectFinancialVoucher.fulfilled, (state, action) => {
        state.isLoading = false
        const index = state.vouchers.findIndex(voucher => voucher.id === action.payload.data.id)
        if (index !== -1) {
          state.vouchers[index] = action.payload.data
        }
        state.success = action.payload.message
        state.error = null
      })
      .addCase(rejectFinancialVoucher.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Delete voucher
      .addCase(deleteFinancialVoucher.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteFinancialVoucher.fulfilled, (state, action) => {
        state.isLoading = false
        state.vouchers = state.vouchers.filter(voucher => voucher.id !== action.payload.id)
        state.success = action.payload.message
        state.error = null
      })
      .addCase(deleteFinancialVoucher.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Fetch financial summary
      .addCase(fetchFinancialSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFinancialSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.financialSummary = action.payload.data
        state.error = null
      })
      .addCase(fetchFinancialSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Fetch daily summary
      .addCase(fetchDailySummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchDailySummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.dailySummary = action.payload.data
        state.error = null
      })
      .addCase(fetchDailySummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Fetch payment method summary
      .addCase(fetchPaymentMethodSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchPaymentMethodSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.paymentMethodSummary = action.payload.data
        state.error = null
      })
      .addCase(fetchPaymentMethodSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Fetch financial accounts
      .addCase(fetchFinancialAccounts.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFinancialAccounts.fulfilled, (state, action) => {
        state.isLoading = false
        state.financialAccounts = action.payload.data
        state.error = null
      })
      .addCase(fetchFinancialAccounts.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Update account balance
      .addCase(updateAccountBalance.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateAccountBalance.fulfilled, (state, action) => {
        state.isLoading = false
        const index = state.financialAccounts.findIndex(account => account.id === action.payload.data.id)
        if (index !== -1) {
          state.financialAccounts[index] = action.payload.data
        }
        state.success = action.payload.message
        state.error = null
      })
      .addCase(updateAccountBalance.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Create financial account
      .addCase(createFinancialAccount.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createFinancialAccount.fulfilled, (state, action) => {
        state.isLoading = false
        state.financialAccounts.push(action.payload.data)
        state.success = action.payload.message
        state.error = null
      })
      .addCase(createFinancialAccount.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  }
})

export const { 
  clearError, 
  clearSuccess, 
  setSelectedVoucher, 
  clearSelectedVoucher, 
  resetState 
} = financialVoucherSlice.actions

export default financialVoucherSlice.reducer