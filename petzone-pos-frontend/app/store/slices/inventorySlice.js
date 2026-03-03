import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Sanitize payloads: remove undefined properties and convert undefined array elements to null
const sanitizePayload = (value) => {
  if (value === undefined) return null
  if (value === null) return null
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : (typeof v === 'object' && v !== null ? sanitizePayload(v) : v)))
  }
  if (typeof value === 'object') {
    const res = {}
    Object.keys(value).forEach((k) => {
      const v = value[k]
      if (v === undefined) return // drop undefined properties
      res[k] = (typeof v === 'object' && v !== null) ? sanitizePayload(v) : v
    })
    return res
  }
  return value
}

// Async thunks
export const fetchInventory = createAsyncThunk(
  'inventory/fetchInventory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/inventory', { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch inventory')
    }
  }
)

export const fetchCrossBranchInventory = createAsyncThunk(
  'inventory/fetchCrossBranchInventory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/inventory/cross-branch', { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch cross-branch inventory')
    }
  }
)

export const fetchCrossWarehouseInventory = createAsyncThunk(
  'inventory/fetchCrossWarehouseInventory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/inventory/cross-warehouse', { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch cross-warehouse inventory')
    }
  }
)

export const createInventoryItem = createAsyncThunk(
  'inventory/createInventoryItem',
  async (itemData, { rejectWithValue }) => {
    try {
      console.log('[inventorySlice] createInventoryItem - sending payload:', itemData)
      const response = await api.post('/inventory', itemData)
      console.log('[inventorySlice] createInventoryItem - response:', response?.data)
      return response.data
    } catch (error) {
      console.error('[inventorySlice] createInventoryItem - error:', error?.response?.data || error.message || error)
      const status = error.response?.status
      const apiMessage = error.response?.data?.message
      const apiError = error.response?.data?.error
      const validationErrors = error.response?.data?.errors
      const defaultMessage = 'Failed to create inventory item'

      if (status === 403) {
        const permissionMessage = apiMessage || 'Permission denied: please ask an admin to enable inventory edit for this scope.'
        return rejectWithValue({ message: permissionMessage, status, errors: validationErrors, apiError })
      }

      return rejectWithValue({ message: apiMessage || error.message || defaultMessage, status, errors: validationErrors, apiError })
    }
  }
)

export const updateInventoryItem = createAsyncThunk(
  'inventory/updateInventoryItem',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const payload = sanitizePayload(data)
      const response = await api.put(`/inventory/${id}`, payload)
      return response.data
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message
      const apiError = error.response?.data?.error
      const validationErrors = error.response?.data?.errors
      const defaultMessage = 'Failed to update inventory item'

      if (status === 403) {
        const permissionMessage = apiMessage || 'Permission denied: please ask an admin to enable inventory edit for this scope.'
        return rejectWithValue({ message: permissionMessage, status, errors: validationErrors, apiError })
      }

      return rejectWithValue({ message: apiMessage || error.message || defaultMessage, status, errors: validationErrors, apiError })
    }
  }
)

export const deleteInventoryItem = createAsyncThunk(
  'inventory/deleteInventoryItem',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/inventory/${id}`)
      return id
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message
      const defaultMessage = 'Failed to delete inventory item'

      if (status === 403) {
        const permissionMessage = apiMessage || 'Permission denied: please ask an admin to enable inventory delete for this scope.'
        return rejectWithValue({ message: permissionMessage, status })
      }

      return rejectWithValue({ message: apiMessage || error.message || defaultMessage, status })
    }
  }
)

export const getInventoryItem = createAsyncThunk(
  'inventory/getInventoryItem',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/inventory/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch inventory item')
    }
  }
)

const initialState = {
  data: [],
  total: 0,
  loading: false,
  error: null,
  crossBranchData: [],
  crossBranchLoading: false,
  crossBranchError: null,
  crossWarehouseData: [],
  crossWarehouseLoading: false,
  crossWarehouseError: null,
}

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch inventory
      .addCase(fetchInventory.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || action.payload
        state.total = action.payload.total ?? (action.payload.data?.length ?? state.data.length)
        state.error = null
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch cross-branch inventory
      .addCase(fetchCrossBranchInventory.pending, (state) => {
        state.crossBranchLoading = true
        state.crossBranchError = null
      })
      .addCase(fetchCrossBranchInventory.fulfilled, (state, action) => {
        state.crossBranchLoading = false
        state.crossBranchData = action.payload.data || action.payload
        state.crossBranchError = null
      })
      .addCase(fetchCrossBranchInventory.rejected, (state, action) => {
        state.crossBranchLoading = false
        state.crossBranchError = action.payload
      })

      // Fetch cross-warehouse inventory
      .addCase(fetchCrossWarehouseInventory.pending, (state) => {
        state.crossWarehouseLoading = true
        state.crossWarehouseError = null
      })
      .addCase(fetchCrossWarehouseInventory.fulfilled, (state, action) => {
        state.crossWarehouseLoading = false
        state.crossWarehouseData = action.payload.data || action.payload
        state.crossWarehouseError = null
      })
      .addCase(fetchCrossWarehouseInventory.rejected, (state, action) => {
        state.crossWarehouseLoading = false
        state.crossWarehouseError = action.payload
      })
      
      // Create inventory item
      .addCase(createInventoryItem.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createInventoryItem.fulfilled, (state, action) => {
        state.loading = false
        const newItem = action.payload.data || action.payload
        state.data.push(newItem)
        state.error = null
      })
      .addCase(createInventoryItem.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update inventory item
      .addCase(updateInventoryItem.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateInventoryItem.fulfilled, (state, action) => {
        state.loading = false
        const updatedItem = action.payload.data || action.payload
        const index = state.data.findIndex(item => item.id === updatedItem.id)
        if (index !== -1) {
          state.data[index] = updatedItem
        }
        state.error = null
      })
      .addCase(updateInventoryItem.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Delete inventory item
      .addCase(deleteInventoryItem.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteInventoryItem.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter(item => item.id !== action.payload)
        state.error = null
      })
      .addCase(deleteInventoryItem.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Get single inventory item
      .addCase(getInventoryItem.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getInventoryItem.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        // Update or add the item to the data array
        const index = state.data.findIndex(item => item.id === action.payload.id)
        if (index !== -1) {
          state.data[index] = action.payload
        } else {
          state.data.push(action.payload)
        }
      })
      .addCase(getInventoryItem.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError } = inventorySlice.actions
export default inventorySlice.reducer
