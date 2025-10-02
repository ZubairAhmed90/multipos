import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for Shift Management
export const fetchShifts = createAsyncThunk(
  'shifts/fetchShifts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.branchId) queryParams.append('branchId', params.branchId)
      if (params.isActive !== undefined) queryParams.append('isActive', params.isActive)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      
      const response = await api.get(`/shifts?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch shifts')
    }
  }
)

export const fetchShift = createAsyncThunk(
  'shifts/fetchShift',
  async (shiftId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/shifts/${shiftId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch shift')
    }
  }
)

export const createShift = createAsyncThunk(
  'shifts/createShift',
  async (shiftData, { rejectWithValue }) => {
    try {
      const response = await api.post('/shifts', shiftData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create shift')
    }
  }
)

export const updateShift = createAsyncThunk(
  'shifts/updateShift',
  async ({ shiftId, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/shifts/${shiftId}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update shift')
    }
  }
)

export const deleteShift = createAsyncThunk(
  'shifts/deleteShift',
  async (shiftId, { rejectWithValue }) => {
    try {
      await api.delete(`/shifts/${shiftId}`)
      return shiftId
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete shift')
    }
  }
)

export const fetchCurrentShift = createAsyncThunk(
  'shifts/fetchCurrentShift',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/shifts/current')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch current shift')
    }
  }
)

export const fetchBranchShifts = createAsyncThunk(
  'shifts/fetchBranchShifts',
  async (branchId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/shifts/branch/${branchId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch branch shifts')
    }
  }
)

export const assignUserToShift = createAsyncThunk(
  'shifts/assignUserToShift',
  async ({ shiftId, userId, assignedBy }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/shifts/${shiftId}/assign-user`, {
        userId,
        assignedBy
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to assign user to shift')
    }
  }
)

export const removeUserFromShift = createAsyncThunk(
  'shifts/removeUserFromShift',
  async ({ shiftId, userId }, { rejectWithValue }) => {
    try {
      await api.delete(`/shifts/${shiftId}/assign-user/${userId}`)
      return { shiftId, userId }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove user from shift')
    }
  }
)

export const validatePOSAccess = createAsyncThunk(
  'shifts/validatePOSAccess',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/shifts/validate-pos-access')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to validate POS access')
    }
  }
)

// Legacy functions for backward compatibility
export const startShift = createAsyncThunk(
  'shifts/startShift',
  async ({ shiftId, initialCash }, { rejectWithValue }) => {
    try {
      const response = await api.post('/shifts/start-session', {
        shiftId,
        initialCash
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to start shift')
    }
  }
)

export const endShift = createAsyncThunk(
  'shifts/endShift',
  async ({ sessionId, finalCash }, { rejectWithValue }) => {
    try {
      const response = await api.post('/shifts/end-session', {
        sessionId,
        finalCash
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to end shift')
    }
  }
)

export const fetchActiveShift = createAsyncThunk(
  'shifts/fetchActiveShift',
  async ({ cashierId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/shifts/active/${cashierId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch active shift')
    }
  }
)

export const fetchRecentShiftSessions = createAsyncThunk(
  'shifts/fetchRecentShiftSessions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/shifts/recent-sessions?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch recent shift sessions')
    }
  }
)

const initialState = {
  // Shift data
  shifts: [],
  currentShift: null,
  activeShift: null,
  recentShiftSessions: [],
  selectedShift: null,
  
  // Branch shifts
  branchShifts: [],
  
  // User assignments
  userAssignments: [],
  
  // POS access validation
  posAccessValid: false,
  posAccessMessage: '',
  
  // General state
  loading: false,
  error: null,
  lastUpdated: null,
  
  // UI state
  activeTab: 'shifts', // shifts, assignments, reports
  showShiftForm: false,
  showAssignmentForm: false,
  showReportModal: false,
}

const shiftsSlice = createSlice({
  name: 'shifts',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString()
    },
    clearActiveShift: (state) => {
      state.activeShift = null
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload
    },
    setSelectedShift: (state, action) => {
      state.selectedShift = action.payload
    },
    toggleShiftForm: (state) => {
      state.showShiftForm = !state.showShiftForm
    },
    toggleAssignmentForm: (state) => {
      state.showAssignmentForm = !state.showAssignmentForm
    },
    toggleReportModal: (state) => {
      state.showReportModal = !state.showReportModal
    },
    clearSelectedData: (state) => {
      state.selectedShift = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch shifts
      .addCase(fetchShifts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchShifts.fulfilled, (state, action) => {
        state.loading = false
        state.shifts = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchShifts.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch single shift
      .addCase(fetchShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchShift.fulfilled, (state, action) => {
        state.loading = false
        state.selectedShift = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Create shift
      .addCase(createShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createShift.fulfilled, (state, action) => {
        state.loading = false
        const newShift = action.payload.data || action.payload
        state.shifts.push(newShift)
        state.error = null
      })
      .addCase(createShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update shift
      .addCase(updateShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateShift.fulfilled, (state, action) => {
        state.loading = false
        const updatedShift = action.payload.data || action.payload
        const index = state.shifts.findIndex(shift => shift.id === updatedShift.id)
        if (index !== -1) {
          state.shifts[index] = updatedShift
        }
        state.error = null
      })
      .addCase(updateShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Delete shift
      .addCase(deleteShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteShift.fulfilled, (state, action) => {
        state.loading = false
        state.shifts = state.shifts.filter(shift => shift.id !== action.payload)
        state.error = null
      })
      .addCase(deleteShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch current shift
      .addCase(fetchCurrentShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCurrentShift.fulfilled, (state, action) => {
        state.loading = false
        state.currentShift = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchCurrentShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch branch shifts
      .addCase(fetchBranchShifts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBranchShifts.fulfilled, (state, action) => {
        state.loading = false
        state.branchShifts = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchBranchShifts.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Assign user to shift
      .addCase(assignUserToShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(assignUserToShift.fulfilled, (state, action) => {
        state.loading = false
        state.userAssignments.push(action.payload)
        state.error = null
      })
      .addCase(assignUserToShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Remove user from shift
      .addCase(removeUserFromShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeUserFromShift.fulfilled, (state, action) => {
        state.loading = false
        state.userAssignments = state.userAssignments.filter(
          assignment => !(assignment.shiftId === action.payload.shiftId && assignment.userId === action.payload.userId)
        )
        state.error = null
      })
      .addCase(removeUserFromShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Validate POS access
      .addCase(validatePOSAccess.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(validatePOSAccess.fulfilled, (state, action) => {
        state.loading = false
        state.posAccessValid = action.payload?.valid || false
        state.posAccessMessage = action.payload?.message || 'POS access validation failed'
        state.error = null
      })
      .addCase(validatePOSAccess.rejected, (state, action) => {
        state.loading = false
        state.posAccessValid = false
        state.posAccessMessage = action.payload || 'POS access validation failed'
        state.error = action.payload || 'POS access validation failed'
      })
      
      // Legacy: Start shift
      .addCase(startShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(startShift.fulfilled, (state, action) => {
        state.loading = false
        state.activeShift = action.payload?.data || action.payload
        state.posAccessValid = true
        state.posAccessMessage = 'POS access granted'
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(startShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Legacy: End shift
      .addCase(endShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(endShift.fulfilled, (state, action) => {
        state.loading = false
        state.activeShift = null
        state.posAccessValid = false
        state.posAccessMessage = 'No active shift session found. Please start a shift to access POS.'
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(endShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Legacy: Fetch active shift
      .addCase(fetchActiveShift.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchActiveShift.fulfilled, (state, action) => {
        state.loading = false
        state.activeShift = action.payload?.data || null
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchActiveShift.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch recent shift sessions
      .addCase(fetchRecentShiftSessions.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRecentShiftSessions.fulfilled, (state, action) => {
        state.loading = false
        state.recentShiftSessions = action.payload?.data || []
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchRecentShiftSessions.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { 
  clearError, 
  setLastUpdated, 
  clearActiveShift,
  setActiveTab,
  setSelectedShift,
  toggleShiftForm,
  toggleAssignmentForm,
  toggleReportModal,
  clearSelectedData
} = shiftsSlice.actions

export default shiftsSlice.reducer
