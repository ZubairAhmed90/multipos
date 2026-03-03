import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
export const fetchWarehouses = createAsyncThunk(
  'warehouses/fetchWarehouses',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/warehouses', params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch warehouses')
    }
  }
)

export const createWarehouse = createAsyncThunk(
  'warehouses/createWarehouse',
  async (warehouseData, { rejectWithValue }) => {
    try {
      const response = await api.post('/warehouses', warehouseData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create warehouse')
    }
  }
)

// Async thunk for fetching warehouse settings
export const fetchWarehouseSettings = createAsyncThunk(
  'warehouses/fetchSettings',
  async (warehouseId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/warehouses/${warehouseId}/settings`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch warehouse settings')
    }
  }
)

export const updateWarehouseSettings = createAsyncThunk(
  'warehouses/updateSettings',
  async ({ warehouseId, settings }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/warehouses/${warehouseId}/settings`, { settings })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update warehouse settings')
    }
  }
)

export const updateWarehouse = createAsyncThunk(
  'warehouses/updateWarehouse',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/warehouses/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update warehouse')
    }
  }
)

export const deleteWarehouse = createAsyncThunk(
  'warehouses/deleteWarehouse',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/warehouses/${id}`)
      return id
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete warehouse')
    }
  }
)

export const getWarehouse = createAsyncThunk(
  'warehouses/getWarehouse',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/warehouses/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch warehouse')
    }
  }
)

const initialState = {
  data: [],
  loading: false,
  error: null,
  warehouseSettings: null,
  currentWarehouse: null,
}

const warehousesSlice = createSlice({
  name: 'warehouses',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setWarehouseSettings: (state, action) => {
      state.warehouseSettings = action.payload
    },
    clearWarehouses: (state) => {
      state.data = []
      state.currentWarehouse = null
      state.warehouseSettings = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch warehouse settings
      .addCase(fetchWarehouseSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchWarehouseSettings.fulfilled, (state, action) => {
        state.loading = false
        const warehouseData = action.payload.data || action.payload
        state.warehouseSettings = warehouseData.settings
        state.currentWarehouse = warehouseData
      })
      .addCase(fetchWarehouseSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch warehouses
      .addCase(fetchWarehouses.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchWarehouses.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchWarehouses.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Create warehouse
      .addCase(createWarehouse.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createWarehouse.fulfilled, (state, action) => {
        state.loading = false
        const newWarehouse = action.payload.data || action.payload
        state.data.push(newWarehouse)
        state.error = null
      })
      .addCase(createWarehouse.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update warehouse
      .addCase(updateWarehouse.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        state.loading = false
        const updatedWarehouse = action.payload.data || action.payload
        const index = state.data.findIndex(warehouse => warehouse.id === updatedWarehouse.id)
        if (index !== -1) {
          state.data[index] = updatedWarehouse
        }
        state.error = null
      })
      .addCase(updateWarehouse.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update warehouse settings
      .addCase(updateWarehouseSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateWarehouseSettings.fulfilled, (state, action) => {
        state.loading = false
        const updatedWarehouse = action.payload.data || action.payload
        const index = state.data.findIndex(warehouse => warehouse.id === updatedWarehouse.id)
        if (index !== -1) {
          state.data[index] = updatedWarehouse
        }
        state.error = null
      })
      .addCase(updateWarehouseSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Delete warehouse
      .addCase(deleteWarehouse.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteWarehouse.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter(warehouse => warehouse.id !== action.payload)
        state.error = null
      })
      .addCase(deleteWarehouse.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Get single warehouse
      .addCase(getWarehouse.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getWarehouse.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        const warehouseData = action.payload.data || action.payload
        const index = state.data.findIndex(warehouse => warehouse.id === warehouseData.id)
        if (index !== -1) {
          state.data[index] = warehouseData
        } else {
          state.data.push(warehouseData)
        }
      })
      .addCase(getWarehouse.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError, setWarehouseSettings, clearWarehouses } = warehousesSlice.actions
export default warehousesSlice.reducer
