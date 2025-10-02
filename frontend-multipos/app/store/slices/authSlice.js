import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authAPI } from '../../../utils/axios'

// Async thunks for API calls
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(email, password)
      
      // FIX: Access nested data object
      const { accessToken, refreshToken, user } = response.data.data 
      
      // Store tokens using new naming convention
      authAPI.setTokens(accessToken, refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
      
      return { accessToken, refreshToken, user }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Login failed')
    }
  }
)

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.refreshAccessToken()
      const { accessToken, refreshToken } = response.data.data
      
      // Update both tokens
      authAPI.setTokens(accessToken, refreshToken)
      
      return { accessToken, refreshToken }
    } catch (error) {
      // Clear tokens on refresh failure
      authAPI.clearTokens()
      return rejectWithValue(error.response?.data?.message || error.message || 'Token refresh failed')
    }
  }
)

const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      // Clear tokens and user data
      authAPI.clearTokens()
      
      // Reset state
      state.user = null
      state.token = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    },
    initializeAuth: (state) => {
      // Prevent multiple initializations
      if (state.isLoading) {
        return
      }
      
      // Set loading state during initialization
      state.isLoading = true
      
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        state.isLoading = false
        return
      }
      
      try {
        // Get all auth data from localStorage
        const accessToken = localStorage.getItem('accessToken')
        const refreshToken = localStorage.getItem('refreshToken')
        const userData = localStorage.getItem('user')
        
        
        if (accessToken && refreshToken && userData) {
          // Parse user data
          const user = JSON.parse(userData)
          
          // Set all state at once - ensure all fields are set
          state.token = accessToken
          state.refreshToken = refreshToken
          state.user = user
          state.isAuthenticated = true
          
        } else {
          // No valid auth data - clear everything
          state.isAuthenticated = false
          state.user = null
          state.token = null
          state.refreshToken = null
          
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        // Clear everything on error
        authAPI.clearTokens()
        state.isAuthenticated = false
        state.user = null
        state.token = null
        state.refreshToken = null
      }
      
      // Clear loading state immediately
      state.isLoading = false
    },
    setUser: (state, action) => {
      state.user = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.token = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        state.user = action.payload.user
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.error = action.payload
      })
      
      // Register
      
      // Refresh Token
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        state.isAuthenticated = true
      })
      .addCase(refreshToken.rejected, (state) => {
        state.isAuthenticated = false
        state.token = null
        state.refreshToken = null
        state.user = null
      })
  },
})

export const { logout, clearError, initializeAuth, setUser } = authSlice.actions
export default authSlice.reducer
