import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for Hardware Management
export const fetchHardwareDevices = createAsyncThunk(
  'hardware/fetchHardwareDevices',
  async ({ scopeType, scopeId }, { rejectWithValue }) => {
    try {
      let response
      if (scopeType === 'ALL' && scopeId === 'ALL') {
        // Fetch all devices for admin
        response = await api.get('/hardware/devices/all')
      } else {
        response = await api.get(`/hardware/devices/${scopeType}/${scopeId}`)
      }
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch hardware devices')
    }
  }
)

// Alias for fetchHardware
export const fetchHardware = fetchHardwareDevices

export const registerHardwareDevice = createAsyncThunk(
  'hardware/registerHardwareDevice',
  async (deviceData, { rejectWithValue }) => {
    try {
      const response = await api.post('/hardware/devices/register', deviceData)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to register hardware device')
    }
  }
)

// Alias for createHardwareDevice
export const createHardwareDevice = registerHardwareDevice

export const updateDeviceStatus = createAsyncThunk(
  'hardware/updateDeviceStatus',
  async ({ deviceId, status }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/hardware/devices/${deviceId}/status`, { status })
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update device status')
    }
  }
)

// Alias for updateHardwareDevice
export const updateHardwareDevice = updateDeviceStatus

export const deleteHardwareDevice = createAsyncThunk(
  'hardware/deleteHardwareDevice',
  async (deviceId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/hardware/devices/${deviceId}`)
      return { id: deviceId }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete hardware device')
    }
  }
)

export const fetchHardwareSessions = createAsyncThunk(
  'hardware/fetchHardwareSessions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.terminalId) queryParams.append('terminalId', params.terminalId)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/hardware/sessions?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch hardware sessions')
    }
  }
)

export const fetchLatestEvents = createAsyncThunk(
  'hardware/fetchLatestEvents',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.terminalId) queryParams.append('terminalId', params.terminalId)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/hardware/events/latest?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch latest events')
    }
  }
)

export const fetchEventsSince = createAsyncThunk(
  'hardware/fetchEventsSince',
  async ({ since, ...params }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('since', since)
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.terminalId) queryParams.append('terminalId', params.terminalId)
      
      const response = await api.get(`/hardware/events/since?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch events since timestamp')
    }
  }
)

export const fetchHardwareStatus = createAsyncThunk(
  'hardware/fetchHardwareStatus',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      
      const response = await api.get(`/hardware/status?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch hardware status')
    }
  }
)

// Hardware Operations
export const scanBarcode = createAsyncThunk(
  'hardware/scanBarcode',
  async (scanData, { rejectWithValue }) => {
    try {
      const response = await api.post('/hardware/scan', scanData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to scan barcode')
    }
  }
)

export const printReceipt = createAsyncThunk(
  'hardware/printReceipt',
  async (printData, { rejectWithValue }) => {
    try {
      const response = await api.post('/hardware/print-receipt', printData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to print receipt')
    }
  }
)

export const openCashDrawer = createAsyncThunk(
  'hardware/openCashDrawer',
  async (drawerData, { rejectWithValue }) => {
    try {
      const response = await api.post('/hardware/open-cashdrawer', drawerData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to open cash drawer')
    }
  }
)

export const getWeight = createAsyncThunk(
  'hardware/getWeight',
  async (weightData, { rejectWithValue }) => {
    try {
      const response = await api.post('/hardware/scale', weightData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get weight')
    }
  }
)

const initialState = {
  // Device Management
  devices: [],
  selectedDevice: null,
  
  // Sessions and Events
  sessions: [],
  latestEvents: [],
  eventsSince: [],
  
  // Hardware Status
  hardwareStatus: null,
  
  // Device Operations
  scannedItem: null,
  printResult: null,
  drawerResult: null,
  weightResult: null,
  
  // Filters and Parameters
  filters: {
    scopeType: 'BRANCH',
    scopeId: '',
    terminalId: '',
    deviceType: '',
    status: '',
  },
  
  // Pagination
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  
  // General state
  loading: false,
  error: null,
  lastUpdated: null,
  
  // UI state
  activeTab: 'devices', // devices, sessions, events, control, status
  showDeviceForm: false,
  showControlPanel: false,
  showEventModal: false,
  pollingInterval: null,
  lastEventTimestamp: null,
}

const hardwareSlice = createSlice({
  name: 'hardware',
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
    setSelectedDevice: (state, action) => {
      state.selectedDevice = action.payload
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    toggleDeviceForm: (state) => {
      state.showDeviceForm = !state.showDeviceForm
    },
    toggleControlPanel: (state) => {
      state.showControlPanel = !state.showControlPanel
    },
    toggleEventModal: (state) => {
      state.showEventModal = !state.showEventModal
    },
    setPollingInterval: (state, action) => {
      state.pollingInterval = action.payload
    },
    setLastEventTimestamp: (state, action) => {
      state.lastEventTimestamp = action.payload
    },
    clearSelectedData: (state) => {
      state.selectedDevice = null
      state.scannedItem = null
      state.printResult = null
      state.drawerResult = null
      state.weightResult = null
    },
    addNewEvent: (state, action) => {
      state.latestEvents.unshift(action.payload)
      if (state.latestEvents.length > 50) {
        state.latestEvents = state.latestEvents.slice(0, 50)
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Hardware Devices
      .addCase(fetchHardwareDevices.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchHardwareDevices.fulfilled, (state, action) => {
        state.loading = false
        state.devices = action.payload
        state.error = null
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchHardwareDevices.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Register Hardware Device
      .addCase(registerHardwareDevice.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(registerHardwareDevice.fulfilled, (state, action) => {
        state.loading = false
        state.devices.push(action.payload)
        state.error = null
        state.showDeviceForm = false
      })
      .addCase(registerHardwareDevice.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Update Device Status
      .addCase(updateDeviceStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateDeviceStatus.fulfilled, (state, action) => {
        state.loading = false
        const index = state.devices.findIndex(device => device.deviceId === action.payload.deviceId)
        if (index !== -1) {
          state.devices[index] = action.payload
        }
        state.error = null
      })
      .addCase(updateDeviceStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Delete Hardware Device
      .addCase(deleteHardwareDevice.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteHardwareDevice.fulfilled, (state, action) => {
        state.loading = false
        state.devices = state.devices.filter(device => device.id !== action.payload.id)
        state.error = null
      })
      .addCase(deleteHardwareDevice.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch Hardware Sessions
      .addCase(fetchHardwareSessions.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchHardwareSessions.fulfilled, (state, action) => {
        state.loading = false
        state.sessions = action.payload.data
        state.pagination = action.payload.pagination
        state.error = null
      })
      .addCase(fetchHardwareSessions.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch Latest Events
      .addCase(fetchLatestEvents.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLatestEvents.fulfilled, (state, action) => {
        state.loading = false
        state.latestEvents = action.payload.data
        state.error = null
      })
      .addCase(fetchLatestEvents.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch Events Since
      .addCase(fetchEventsSince.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchEventsSince.fulfilled, (state, action) => {
        state.loading = false
        state.eventsSince = action.payload.data
        state.error = null
      })
      .addCase(fetchEventsSince.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch Hardware Status
      .addCase(fetchHardwareStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchHardwareStatus.fulfilled, (state, action) => {
        state.loading = false
        state.hardwareStatus = action.payload
        state.error = null
      })
      .addCase(fetchHardwareStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Scan Barcode
      .addCase(scanBarcode.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(scanBarcode.fulfilled, (state, action) => {
        state.loading = false
        state.scannedItem = action.payload
        state.error = null
      })
      .addCase(scanBarcode.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Print Receipt
      .addCase(printReceipt.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(printReceipt.fulfilled, (state, action) => {
        state.loading = false
        state.printResult = action.payload
        state.error = null
      })
      .addCase(printReceipt.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Open Cash Drawer
      .addCase(openCashDrawer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(openCashDrawer.fulfilled, (state, action) => {
        state.loading = false
        state.drawerResult = action.payload
        state.error = null
      })
      .addCase(openCashDrawer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Get Weight
      .addCase(getWeight.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getWeight.fulfilled, (state, action) => {
        state.loading = false
        state.weightResult = action.payload
        state.error = null
      })
      .addCase(getWeight.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { 
  clearError, 
  setLastUpdated,
  setActiveTab,
  setSelectedDevice,
  setFilters,
  setPagination,
  toggleDeviceForm,
  toggleControlPanel,
  toggleEventModal,
  setPollingInterval,
  setLastEventTimestamp,
  clearSelectedData,
  addNewEvent
} = hardwareSlice.actions

export default hardwareSlice.reducer
