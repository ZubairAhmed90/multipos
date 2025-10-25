import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

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

export const createInventoryItem = createAsyncThunk(
  'inventory/createInventoryItem',
  async (itemData, { rejectWithValue }) => {
    try {
      const response = await api.post('/inventory', itemData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to create inventory item')
    }
  }
)

export const updateInventoryItem = createAsyncThunk(
  'inventory/updateInventoryItem',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/inventory/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update inventory item')
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
      return rejectWithValue(error.message || 'Failed to delete inventory item')
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
  loading: false,
  error: null,
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
        state.error = null
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
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
