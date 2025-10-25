import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for purchase orders
export const fetchPurchaseOrders = createAsyncThunk(
  'purchaseOrders/fetchPurchaseOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      
      // Add all parameters to query string
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
          queryParams.append(key, params[key])
        }
      })
      
      const response = await api.get(`/purchase-orders?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const fetchPurchaseOrder = createAsyncThunk(
  'purchaseOrders/fetchPurchaseOrder',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/purchase-orders/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const createPurchaseOrder = createAsyncThunk(
  'purchaseOrders/createPurchaseOrder',
  async (orderData, { rejectWithValue }) => {
    try {
      const response = await api.post('/purchase-orders', orderData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const updatePurchaseOrderStatus = createAsyncThunk(
  'purchaseOrders/updatePurchaseOrderStatus',
  async ({ id, status, actualDelivery }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/purchase-orders/${id}/status`, {
        status,
        actualDelivery
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const deletePurchaseOrder = createAsyncThunk(
  'purchaseOrders/deletePurchaseOrder',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/purchase-orders/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const fetchSuppliers = createAsyncThunk(
  'purchaseOrders/fetchSuppliers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      
      // Add all parameters to query string
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
          queryParams.append(key, params[key])
        }
      })
      
      const response = await api.get(`/purchase-orders/suppliers?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

// Initial state
const initialState = {
  data: [],
  suppliers: [],
  currentOrder: null,
  loading: false,
  suppliersLoading: false,
  error: null,
  suppliersError: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  },
  filters: {
    supplierId: '',
    scopeType: '',
    scopeId: '',
    status: '',
    orderDateFrom: '',
    orderDateTo: '',
    search: ''
  }
}

// Purchase orders slice
const purchaseOrdersSlice = createSlice({
  name: 'purchaseOrders',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
      state.suppliersError = null
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearFilters: (state) => {
      state.filters = {
        supplierId: '',
        scopeType: '',
        scopeId: '',
        status: '',
        orderDateFrom: '',
        orderDateTo: '',
        search: ''
      }
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    clearCurrentOrder: (state) => {
      state.currentOrder = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch purchase orders
      .addCase(fetchPurchaseOrders.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPurchaseOrders.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || []
        state.pagination = {
          page: action.payload.page || 1,
          limit: action.payload.limit || 20,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0
        }
      })
      .addCase(fetchPurchaseOrders.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch single purchase order
      .addCase(fetchPurchaseOrder.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPurchaseOrder.fulfilled, (state, action) => {
        state.loading = false
        state.currentOrder = action.payload.data
      })
      .addCase(fetchPurchaseOrder.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Create purchase order
      .addCase(createPurchaseOrder.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createPurchaseOrder.fulfilled, (state, action) => {
        state.loading = false
        state.data.unshift(action.payload.data)
      })
      .addCase(createPurchaseOrder.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update purchase order status
      .addCase(updatePurchaseOrderStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updatePurchaseOrderStatus.fulfilled, (state, action) => {
        state.loading = false
        const index = state.data.findIndex(order => order.id === action.payload.data.id)
        if (index !== -1) {
          state.data[index] = action.payload.data
        }
        if (state.currentOrder && state.currentOrder.id === action.payload.data.id) {
          state.currentOrder = action.payload.data
        }
      })
      .addCase(updatePurchaseOrderStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Delete purchase order
      .addCase(deletePurchaseOrder.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deletePurchaseOrder.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter(order => order.id !== action.payload.id)
      })
      .addCase(deletePurchaseOrder.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch suppliers
      .addCase(fetchSuppliers.pending, (state) => {
        state.suppliersLoading = true
        state.suppliersError = null
      })
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.suppliersLoading = false
        state.suppliers = action.payload.data || []
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        state.suppliersLoading = false
        state.suppliersError = action.payload
      })
  }
})

export const {
  clearError,
  setFilters,
  clearFilters,
  setPagination,
  clearCurrentOrder
} = purchaseOrdersSlice.actions

export default purchaseOrdersSlice.reducer
