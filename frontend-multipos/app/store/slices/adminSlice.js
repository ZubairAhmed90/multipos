import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for Admin Management
export const fetchSystemDashboard = createAsyncThunk(
  'admin/fetchSystemDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/admin/dashboard')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch system dashboard')
    }
  }
)

export const fetchAllBranches = createAsyncThunk(
  'admin/fetchAllBranches',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/admin/branches')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch branches')
    }
  }
)

export const updateBranchSettings = createAsyncThunk(
  'admin/updateBranchSettings',
  async ({ branchId, settings }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/admin/branches/${branchId}/settings`, settings)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update branch settings')
    }
  }
)

export const bulkUpdateBranchSettings = createAsyncThunk(
  'admin/bulkUpdateBranchSettings',
  async ({ branchIds, settings }, { rejectWithValue }) => {
    try {
      const response = await api.put('/admin/branches/bulk-settings', { branchIds, settings })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to bulk update branch settings')
    }
  }
)

export const fetchAllUsers = createAsyncThunk(
  'admin/fetchAllUsers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.role) queryParams.append('role', params.role)
      if (params.branchId) queryParams.append('branchId', params.branchId)
      if (params.warehouseId) queryParams.append('warehouseId', params.warehouseId)
      if (params.status) queryParams.append('status', params.status)
      
      const response = await api.get(`/admin/users?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users')
    }
  }
)

export const updateUser = createAsyncThunk(
  'admin/updateUser',
  async ({ userId, userData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/admin/users/${userId}`, userData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update user')
    }
  }
)

export const fetchAllInventories = createAsyncThunk(
  'admin/fetchAllInventories',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.branchId) queryParams.append('branchId', params.branchId)
      if (params.warehouseId) queryParams.append('warehouseId', params.warehouseId)
      if (params.category) queryParams.append('category', params.category)
      
      const response = await api.get(`/admin/inventories?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch inventories')
    }
  }
)

export const updateAnyInventory = createAsyncThunk(
  'admin/updateAnyInventory',
  async ({ inventoryId, inventoryData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/admin/inventories/${inventoryId}`, inventoryData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update inventory')
    }
  }
)

export const fetchAllCompanies = createAsyncThunk(
  'admin/fetchAllCompanies',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.branchId) queryParams.append('branchId', params.branchId)
      if (params.warehouseId) queryParams.append('warehouseId', params.warehouseId)
      
      const response = await api.get(`/admin/companies?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch companies')
    }
  }
)

export const fetchAllSales = createAsyncThunk(
  'admin/fetchAllSales',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.branchId) queryParams.append('branchId', params.branchId)
      if (params.warehouseId) queryParams.append('warehouseId', params.warehouseId)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.status) queryParams.append('status', params.status)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/admin/sales?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch sales')
    }
  }
)

export const fetchAllLedgers = createAsyncThunk(
  'admin/fetchAllLedgers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.branchId) queryParams.append('branchId', params.branchId)
      if (params.fiscalYear) queryParams.append('fiscalYear', params.fiscalYear)
      
      const response = await api.get(`/admin/ledgers?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch ledgers')
    }
  }
)

const initialState = {
  // System Dashboard
  systemDashboard: null,
  
  // Branch Management
  branches: [],
  selectedBranch: null,
  
  // User Management
  users: [],
  selectedUser: null,
  
  // Inventory Management
  inventories: [],
  selectedInventory: null,
  
  // Company Management
  companies: [],
  selectedCompany: null,
  
  // Sales Management
  sales: [],
  selectedSale: null,
  
  // Ledger Management
  ledgers: [],
  selectedLedger: null,
  
  // Filters and Parameters
  filters: {
    role: '',
    branchId: '',
    warehouseId: '',
    scopeType: '',
    status: '',
    category: '',
    startDate: '',
    endDate: '',
    fiscalYear: '',
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
  activeTab: 'dashboard', // dashboard, users, branches, inventory, companies, sales, ledgers, settings
  showUserForm: false,
  showBranchForm: false,
  showInventoryForm: false,
  showCompanyForm: false,
  showSettingsModal: false,
  showBulkSettingsModal: false,
  selectedItems: [],
}

const adminSlice = createSlice({
  name: 'admin',
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
    setSelectedBranch: (state, action) => {
      state.selectedBranch = action.payload
    },
    setSelectedUser: (state, action) => {
      state.selectedUser = action.payload
    },
    setSelectedInventory: (state, action) => {
      state.selectedInventory = action.payload
    },
    setSelectedCompany: (state, action) => {
      state.selectedCompany = action.payload
    },
    setSelectedSale: (state, action) => {
      state.selectedSale = action.payload
    },
    setSelectedLedger: (state, action) => {
      state.selectedLedger = action.payload
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    setSelectedItems: (state, action) => {
      state.selectedItems = action.payload
    },
    toggleUserForm: (state) => {
      state.showUserForm = !state.showUserForm
    },
    toggleBranchForm: (state) => {
      state.showBranchForm = !state.showBranchForm
    },
    toggleInventoryForm: (state) => {
      state.showInventoryForm = !state.showInventoryForm
    },
    toggleCompanyForm: (state) => {
      state.showCompanyForm = !state.showCompanyForm
    },
    toggleSettingsModal: (state) => {
      state.showSettingsModal = !state.showSettingsModal
    },
    toggleBulkSettingsModal: (state) => {
      state.showBulkSettingsModal = !state.showBulkSettingsModal
    },
    clearSelectedData: (state) => {
      state.selectedBranch = null
      state.selectedUser = null
      state.selectedInventory = null
      state.selectedCompany = null
      state.selectedSale = null
      state.selectedLedger = null
      state.selectedItems = []
    }
  },
  extraReducers: (builder) => {
    builder
      // System Dashboard
      .addCase(fetchSystemDashboard.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSystemDashboard.fulfilled, (state, action) => {
        state.loading = false
        state.systemDashboard = action.payload
        state.error = null
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchSystemDashboard.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch All Branches
      .addCase(fetchAllBranches.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllBranches.fulfilled, (state, action) => {
        state.loading = false
        state.branches = action.payload.data
        state.error = null
      })
      .addCase(fetchAllBranches.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update Branch Settings
      .addCase(updateBranchSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateBranchSettings.fulfilled, (state, action) => {
        state.loading = false
        const index = state.branches.findIndex(branch => branch._id === action.payload._id)
        if (index !== -1) {
          state.branches[index] = action.payload
        }
        state.error = null
      })
      .addCase(updateBranchSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Bulk Update Branch Settings
      .addCase(bulkUpdateBranchSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(bulkUpdateBranchSettings.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        state.showBulkSettingsModal = false
        state.selectedItems = []
      })
      .addCase(bulkUpdateBranchSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch All Users
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false
        state.users = action.payload.data
        state.error = null
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update User
      .addCase(updateUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false
        const index = state.users.findIndex(user => user._id === action.payload._id)
        if (index !== -1) {
          state.users[index] = action.payload
        }
        state.error = null
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch All Inventories
      .addCase(fetchAllInventories.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllInventories.fulfilled, (state, action) => {
        state.loading = false
        state.inventories = action.payload.data
        state.error = null
      })
      .addCase(fetchAllInventories.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update Any Inventory
      .addCase(updateAnyInventory.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateAnyInventory.fulfilled, (state, action) => {
        state.loading = false
        const index = state.inventories.findIndex(inventory => inventory._id === action.payload._id)
        if (index !== -1) {
          state.inventories[index] = action.payload
        }
        state.error = null
      })
      .addCase(updateAnyInventory.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch All Companies
      .addCase(fetchAllCompanies.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllCompanies.fulfilled, (state, action) => {
        state.loading = false
        state.companies = action.payload.data
        state.error = null
      })
      .addCase(fetchAllCompanies.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch All Sales
      .addCase(fetchAllSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllSales.fulfilled, (state, action) => {
        state.loading = false
        state.sales = action.payload.data
        state.pagination = {
          page: action.payload.page,
          total: action.payload.total,
          totalPages: action.payload.pages
        }
        state.error = null
      })
      .addCase(fetchAllSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch All Ledgers
      .addCase(fetchAllLedgers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllLedgers.fulfilled, (state, action) => {
        state.loading = false
        state.ledgers = action.payload.data
        state.error = null
      })
      .addCase(fetchAllLedgers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { 
  clearError, 
  setLastUpdated,
  setActiveTab,
  setSelectedBranch,
  setSelectedUser,
  setSelectedInventory,
  setSelectedCompany,
  setSelectedSale,
  setSelectedLedger,
  setFilters,
  setPagination,
  setSelectedItems,
  toggleUserForm,
  toggleBranchForm,
  toggleInventoryForm,
  toggleCompanyForm,
  toggleSettingsModal,
  toggleBulkSettingsModal,
  clearSelectedData
} = adminSlice.actions

export default adminSlice.reducer
