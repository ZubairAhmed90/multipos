import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for Customer Management
export const fetchCustomers = createAsyncThunk(
  'customers/fetchCustomers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.status) queryParams.append('status', params.status)
      if (params.customerType) queryParams.append('customerType', params.customerType)
      if (params.search) queryParams.append('search', params.search)
      if (params.hasBalance !== undefined) queryParams.append('hasBalance', params.hasBalance)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/customers?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customers')
    }
  }
)

export const fetchCustomer = createAsyncThunk(
  'customers/fetchCustomer',
  async (customerId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/customers/${customerId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customer')
    }
  }
)

export const createCustomer = createAsyncThunk(
  'customers/createCustomer',
  async (customerData, { rejectWithValue }) => {
    try {
      const response = await api.post('/customers', customerData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create customer')
    }
  }
)

export const updateCustomer = createAsyncThunk(
  'customers/updateCustomer',
  async ({ customerId, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/customers/${customerId}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update customer')
    }
  }
)

export const deleteCustomer = createAsyncThunk(
  'customers/deleteCustomer',
  async (customerId, { rejectWithValue }) => {
    try {
      await api.delete(`/customers/${customerId}`)
      return customerId
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete customer')
    }
  }
)

export const fetchCustomerTransactions = createAsyncThunk(
  'customers/fetchCustomerTransactions',
  async ({ customerId, params = {} }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.transactionType) queryParams.append('transactionType', params.transactionType)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/customers/${customerId}/transactions?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customer transactions')
    }
  }
)

export const searchCustomers = createAsyncThunk(
  'customers/searchCustomers',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const response = await api.get(`/customers?search=${encodeURIComponent(searchTerm)}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to search customers')
    }
  }
)

export const getCustomerBalance = createAsyncThunk(
  'customers/getCustomerBalance',
  async (customerId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/customers/${customerId}`)
      return response.data.balanceSummary
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get customer balance')
    }
  }
)

const initialState = {
  // Customer data
  customers: [],
  selectedCustomer: null,
  customerTransactions: [],
  customerBalance: null,
  
  // Search and filtering
  searchResults: [],
  searchTerm: '',
  filters: {
    status: 'ACTIVE',
    customerType: '',
    hasBalance: false,
  },
  
  // Pagination
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  
  // General state
  loading: false,
  error: null,
  lastUpdated: null,
  
  // UI state
  activeTab: 'customers', // customers, transactions, analytics
  showCustomerForm: false,
  showTransactionModal: false,
  showAnalyticsModal: false,
  showDeleteConfirmation: false,
}

const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString()
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload
    },
    setSelectedCustomer: (state, action) => {
      state.selectedCustomer = action.payload
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    toggleCustomerForm: (state) => {
      state.showCustomerForm = !state.showCustomerForm
    },
    toggleTransactionModal: (state) => {
      state.showTransactionModal = !state.showTransactionModal
    },
    toggleAnalyticsModal: (state) => {
      state.showAnalyticsModal = !state.showAnalyticsModal
    },
    toggleDeleteConfirmation: (state) => {
      state.showDeleteConfirmation = !state.showDeleteConfirmation
    },
    clearSelectedData: (state) => {
      state.selectedCustomer = null
      state.customerTransactions = []
      state.customerBalance = null
    },
    clearSearchResults: (state) => {
      state.searchResults = []
      state.searchTerm = ''
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch customers
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false
        state.customers = action.payload.data || action.payload
        state.error = null
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch single customer
      .addCase(fetchCustomer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCustomer.fulfilled, (state, action) => {
        state.loading = false
        state.selectedCustomer = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchCustomer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Create customer
      .addCase(createCustomer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createCustomer.fulfilled, (state, action) => {
        state.loading = false
        const newCustomer = action.payload.data || action.payload
        state.customers.push(newCustomer)
        state.error = null
        state.showCustomerForm = false
      })
      .addCase(createCustomer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update customer
      .addCase(updateCustomer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        state.loading = false
        const updatedCustomer = action.payload.data || action.payload
        const index = state.customers.findIndex(customer => customer.id === updatedCustomer.id)
        if (index !== -1) {
          state.customers[index] = updatedCustomer
        }
        if (state.selectedCustomer && state.selectedCustomer.id === updatedCustomer.id) {
          state.selectedCustomer = updatedCustomer
        }
        state.error = null
        state.showCustomerForm = false
      })
      .addCase(updateCustomer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Delete customer
      .addCase(deleteCustomer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        state.loading = false
        state.customers = state.customers.filter(customer => customer.id !== action.payload)
        state.error = null
        state.showDeleteConfirmation = false
      })
      .addCase(deleteCustomer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch customer transactions
      .addCase(fetchCustomerTransactions.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCustomerTransactions.fulfilled, (state, action) => {
        state.loading = false
        state.customerTransactions = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchCustomerTransactions.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Search customers
      .addCase(searchCustomers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(searchCustomers.fulfilled, (state, action) => {
        state.loading = false
        state.searchResults = action.payload.data || action.payload
        state.error = null
      })
      .addCase(searchCustomers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Get customer balance
      .addCase(getCustomerBalance.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getCustomerBalance.fulfilled, (state, action) => {
        state.loading = false
        state.customerBalance = action.payload.data || action.payload
        state.error = null
      })
      .addCase(getCustomerBalance.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { 
  clearError, 
  setLastUpdated,
  setActiveTab,
  setSelectedCustomer,
  setSearchTerm,
  setFilters,
  setPagination,
  toggleCustomerForm,
  toggleTransactionModal,
  toggleAnalyticsModal,
  toggleDeleteConfirmation,
  clearSelectedData,
  clearSearchResults
} = customersSlice.actions

export default customersSlice.reducer
