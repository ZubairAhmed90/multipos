import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Helper function to transform nested user data
const transformUserData = (data) => {
  if (data && data.user) {
    const transformed = {
      ...data.user,
      // Keep any additional properties from the parent object
      ...Object.keys(data).filter(key => key !== 'user').reduce((acc, key) => {
        acc[key] = data[key]
        return acc
      }, {})
    }
    return transformed
  }
  return data
}

// Helper function to transform array of user data
const transformUsersData = (usersData) => {
  if (Array.isArray(usersData) && usersData.length > 0 && usersData[0].user) {
    return usersData.map(item => transformUserData(item))
  }
  return usersData
}

// Async thunks
export const fetchAdminUsers = createAsyncThunk(
  'adminUsers/fetchAdminUsers',
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
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch admin users')
    }
  }
)

export const createAdminUser = createAsyncThunk(
  'adminUsers/createAdminUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await api.post('/admin/users', userData)
      return response.data
    } catch (error) {
      // Handle validation errors
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || 'Validation failed'
        const errors = error.response?.data?.errors || []
        
        if (errors.length > 0) {
          const errorDetails = errors.map(err => `${err.path}: ${err.msg}`).join(', ')
          return rejectWithValue(`${errorMessage}: ${errorDetails}`)
        }
        
        return rejectWithValue(errorMessage)
      }
      
      return rejectWithValue(error.response?.data?.message || 'Failed to create admin user')
    }
  }
)

export const updateAdminUser = createAsyncThunk(
  'adminUsers/updateAdminUser',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/admin/users/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update admin user')
    }
  }
)

export const deleteAdminUser = createAsyncThunk(
  'adminUsers/deleteAdminUser',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/admin/users/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete admin user')
    }
  }
)

const initialState = {
  data: [],
  loading: false,
  error: null,
}

const adminUsersSlice = createSlice({
  name: 'adminUsers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminUsers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        state.loading = false
        
        // Handle different data structures
        let usersData = action.payload.data || action.payload
        
        // Transform the data using helper function
        usersData = transformUsersData(usersData)
        
        state.data = usersData
        state.error = null
      })
      .addCase(fetchAdminUsers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createAdminUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createAdminUser.fulfilled, (state, action) => {
        state.loading = false
        
        let newUser = action.payload.data || action.payload
        
        // Apply the same data transformation using helper function
        newUser = transformUserData(newUser)
        
        state.data.push(newUser)
        state.error = null
      })
      .addCase(createAdminUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(updateAdminUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateAdminUser.fulfilled, (state, action) => {
        state.loading = false
        const updatedUser = action.payload.data || action.payload
        const index = state.data.findIndex(user => user.id === updatedUser.id)
        if (index !== -1) {
          state.data[index] = { ...state.data[index], ...updatedUser }
        }
        state.error = null
      })
      .addCase(updateAdminUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(deleteAdminUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteAdminUser.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter(user => user.id !== action.payload)
        state.error = null
      })
      .addCase(deleteAdminUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError } = adminUsersSlice.actions
export default adminUsersSlice.reducer
