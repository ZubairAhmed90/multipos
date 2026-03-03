import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import errorHandler from '../../../utils/errorHandler'

// Async thunk for handling errors
export const handleError = createAsyncThunk(
  'errors/handleError',
  async ({ error, context = {} }, { rejectWithValue }) => {
    try {
      const errorDetails = errorHandler.handleError(error, context)
      return errorDetails
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to handle error')
    }
  }
)

// Async thunk for handling API errors
export const handleApiError = createAsyncThunk(
  'errors/handleApiError',
  async ({ error, apiContext = {} }, { rejectWithValue }) => {
    try {
      const errorDetails = errorHandler.handleApiError(error, apiContext)
      return errorDetails
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to handle API error')
    }
  }
)

// Async thunk for handling validation errors
export const handleValidationError = createAsyncThunk(
  'errors/handleValidationError',
  async ({ errors, formContext = {} }, { rejectWithValue }) => {
    try {
      const errorDetails = errorHandler.handleValidationError(errors, formContext)
      return errorDetails
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to handle validation error')
    }
  }
)

const initialState = {
  errors: [],
  currentError: null,
  errorStats: {
    totalErrors: 0,
    errorsByType: {},
    errorsBySeverity: {},
    recentErrors: []
  },
  isLoading: false,
  error: null
}

const errorSlice = createSlice({
  name: 'errors',
  initialState,
  reducers: {
    addError: (state, action) => {
      const errorDetails = action.payload
      state.errors.push(errorDetails)
      state.currentError = errorDetails
      
      // Update stats
      state.errorStats.totalErrors += 1
      state.errorStats.errorsByType[errorDetails.type] = 
        (state.errorStats.errorsByType[errorDetails.type] || 0) + 1
      state.errorStats.errorsBySeverity[errorDetails.severity] = 
        (state.errorStats.errorsBySeverity[errorDetails.severity] || 0) + 1
      
      // Keep only last 50 errors
      if (state.errors.length > 50) {
        state.errors = state.errors.slice(-50)
      }
      
      // Update recent errors (last 10)
      state.errorStats.recentErrors = state.errors.slice(-10)
    },
    
    clearError: (state, action) => {
      const errorId = action.payload
      if (errorId) {
        state.errors = state.errors.filter(error => error.timestamp !== errorId)
      } else {
        state.currentError = null
      }
    },
    
    clearAllErrors: (state) => {
      state.errors = []
      state.currentError = null
      state.errorStats = {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        recentErrors: []
      }
    },
    
    dismissError: (state, action) => {
      const errorId = action.payload
      state.errors = state.errors.filter(error => error.timestamp !== errorId)
      if (state.currentError?.timestamp === errorId) {
        state.currentError = null
      }
    },
    
    setCurrentError: (state, action) => {
      state.currentError = action.payload
    },
    
    updateErrorStats: (state) => {
      state.errorStats.totalErrors = state.errors.length
      state.errorStats.errorsByType = {}
      state.errorStats.errorsBySeverity = {}
      
      state.errors.forEach(error => {
        state.errorStats.errorsByType[error.type] = 
          (state.errorStats.errorsByType[error.type] || 0) + 1
        state.errorStats.errorsBySeverity[error.severity] = 
          (state.errorStats.errorsBySeverity[error.severity] || 0) + 1
      })
      
      state.errorStats.recentErrors = state.errors.slice(-10)
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle error
      .addCase(handleError.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(handleError.fulfilled, (state, action) => {
        state.isLoading = false
        const errorDetails = action.payload
        state.errors.push(errorDetails)
        state.currentError = errorDetails
        
        // Update stats
        state.errorStats.totalErrors += 1
        state.errorStats.errorsByType[errorDetails.type] = 
          (state.errorStats.errorsByType[errorDetails.type] || 0) + 1
        state.errorStats.errorsBySeverity[errorDetails.severity] = 
          (state.errorStats.errorsBySeverity[errorDetails.severity] || 0) + 1
        
        // Keep only last 50 errors
        if (state.errors.length > 50) {
          state.errors = state.errors.slice(-50)
        }
        
        // Update recent errors
        state.errorStats.recentErrors = state.errors.slice(-10)
        state.error = null
      })
      .addCase(handleError.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Handle API error
      .addCase(handleApiError.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(handleApiError.fulfilled, (state, action) => {
        state.isLoading = false
        const errorDetails = action.payload
        state.errors.push(errorDetails)
        state.currentError = errorDetails
        
        // Update stats
        state.errorStats.totalErrors += 1
        state.errorStats.errorsByType[errorDetails.type] = 
          (state.errorStats.errorsByType[errorDetails.type] || 0) + 1
        state.errorStats.errorsBySeverity[errorDetails.severity] = 
          (state.errorStats.errorsBySeverity[errorDetails.severity] || 0) + 1
        
        // Keep only last 50 errors
        if (state.errors.length > 50) {
          state.errors = state.errors.slice(-50)
        }
        
        // Update recent errors
        state.errorStats.recentErrors = state.errors.slice(-10)
        state.error = null
      })
      .addCase(handleApiError.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Handle validation error
      .addCase(handleValidationError.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(handleValidationError.fulfilled, (state, action) => {
        state.isLoading = false
        const errorDetails = action.payload
        state.errors.push(errorDetails)
        state.currentError = errorDetails
        
        // Update stats
        state.errorStats.totalErrors += 1
        state.errorStats.errorsByType[errorDetails.type] = 
          (state.errorStats.errorsByType[errorDetails.type] || 0) + 1
        state.errorStats.errorsBySeverity[errorDetails.severity] = 
          (state.errorStats.errorsBySeverity[errorDetails.severity] || 0) + 1
        
        // Keep only last 50 errors
        if (state.errors.length > 50) {
          state.errors = state.errors.slice(-50)
        }
        
        // Update recent errors
        state.errorStats.recentErrors = state.errors.slice(-10)
        state.error = null
      })
      .addCase(handleValidationError.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  }
})

export const { 
  addError, 
  clearError, 
  clearAllErrors, 
  dismissError, 
  setCurrentError, 
  updateErrorStats 
} = errorSlice.actions

export default errorSlice.reducer
