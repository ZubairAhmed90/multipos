import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for branch settings
export const fetchBranchSettings = createAsyncThunk(
  'branches/fetchSettings',
  async (branchId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/branches/${branchId}/settings`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch branch settings')
    }
  }
)

export const updateBranchSettings = createAsyncThunk(
  'branches/updateSettings',
  async ({ branchId, settings }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/branches/${branchId}/settings`, { settings })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update branch settings')
    }
  }
)

export const fetchAllBranches = createAsyncThunk(
  'branches/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/branches')
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch branches')
    }
  }
)

// Alias for fetchBranches
export const fetchBranches = fetchAllBranches

export const createBranch = createAsyncThunk(
  'branches/create',
  async (branchData, { rejectWithValue }) => {
    try {
      const response = await api.post('/branches', branchData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create branch')
    }
  }
)

export const updateBranch = createAsyncThunk(
  'branches/update',
  async ({ branchId, branchData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/branches/${branchId}`, branchData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update branch')
    }
  }
)

export const deleteBranch = createAsyncThunk(
  'branches/delete',
  async (branchId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/branches/${branchId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete branch')
    }
  }
)

const initialState = {
  branches: [],
  data: [], // For useEntityCRUD compatibility
  currentBranch: null,
  branchSettings: null,
  isLoading: false,
  loading: false, // For useEntityCRUD compatibility
  error: null,
}

const branchesSlice = createSlice({
  name: 'branches',
  initialState,
  reducers: {
    setCurrentBranch: (state, action) => {
      state.currentBranch = action.payload
    },
    setBranchSettings: (state, action) => {
      state.branchSettings = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    clearBranches: (state) => {
      state.branches = []
      state.currentBranch = null
      state.branchSettings = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch branch settings
      .addCase(fetchBranchSettings.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchBranchSettings.fulfilled, (state, action) => {
        state.isLoading = false
        const branchData = action.payload.data || action.payload
        state.branchSettings = branchData.settings
        state.currentBranch = branchData
      })
      .addCase(fetchBranchSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Update branch settings
      .addCase(updateBranchSettings.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateBranchSettings.fulfilled, (state, action) => {
        state.isLoading = false
        const updatedBranch = action.payload.data || action.payload
        
        // Update the specific branch in the branches array
        const branchIndex = state.branches.findIndex(branch => branch.id === updatedBranch.id)
        if (branchIndex !== -1) {
          state.branches[branchIndex] = updatedBranch
          state.data[branchIndex] = updatedBranch // For useEntityCRUD compatibility
        }
        
        // Update branch settings and current branch
        state.branchSettings = updatedBranch.settings
        if (state.currentBranch) {
          state.currentBranch.settings = updatedBranch.settings
        }
        
        state.error = null
      })
      .addCase(updateBranchSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Fetch all branches
      .addCase(fetchAllBranches.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAllBranches.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        state.branches = action.payload.data || action.payload
        state.data = action.payload.data || action.payload // For useEntityCRUD compatibility
      })
      .addCase(fetchAllBranches.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Create branch
      .addCase(createBranch.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createBranch.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        const newBranch = action.payload.data || action.payload
        state.branches.push(newBranch)
        state.data.push(newBranch) // For useEntityCRUD compatibility
        state.error = null
      })
      .addCase(createBranch.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Update branch
      .addCase(updateBranch.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateBranch.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        const updatedBranch = action.payload.data || action.payload
        const index = state.branches.findIndex(branch => branch.id === updatedBranch.id)
        if (index !== -1) {
          state.branches[index] = updatedBranch
          state.data[index] = updatedBranch // For useEntityCRUD compatibility
        }
        state.error = null
      })
      .addCase(updateBranch.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Delete branch
      .addCase(deleteBranch.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteBranch.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        state.branches = state.branches.filter(branch => branch.id !== action.payload)
        state.data = state.data.filter(branch => branch.id !== action.payload) // For useEntityCRUD compatibility
        state.error = null
      })
      .addCase(deleteBranch.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

export const { 
  setCurrentBranch, 
  setBranchSettings, 
  clearError, 
  clearBranches 
} = branchesSlice.actions

export default branchesSlice.reducer