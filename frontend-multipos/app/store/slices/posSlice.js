import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for POS Terminal Management
export const fetchPOS = createAsyncThunk(
  'pos/fetchPOS',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/pos')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch POS terminals')
    }
  }
)

export const fetchBranchPOS = createAsyncThunk(
  'pos/fetchBranchPOS',
  async (branchId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/pos/branch/${branchId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch branch POS terminals')
    }
  }
)

export const createPOSTerminal = createAsyncThunk(
  'pos/createPOSTerminal',
  async (posData, { rejectWithValue }) => {
    try {
      const response = await api.post('/pos', posData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create POS terminal')
    }
  }
)

export const updatePOSTerminal = createAsyncThunk(
  'pos/updatePOSTerminal',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/pos/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update POS terminal')
    }
  }
)

export const deletePOSTerminal = createAsyncThunk(
  'pos/deletePOSTerminal',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/pos/${id}`)
      return id
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete POS terminal')
    }
  }
)

export const getPOSDetails = createAsyncThunk(
  'pos/getPOSDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/pos/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch POS details')
    }
  }
)

// Async thunks for POS Inventory Management
export const fetchPOSInventory = createAsyncThunk(
  'pos/fetchPOSInventory',
  async (posId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/pos/${posId}/inventory`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch POS inventory')
    }
  }
)

// Async thunks for Multi-tab Functionality
export const createTab = createAsyncThunk(
  'pos/createTab',
  async ({ posId, tabData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/pos/${posId}/tabs`, tabData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create tab')
    }
  }
)

export const fetchActiveTabs = createAsyncThunk(
  'pos/fetchActiveTabs',
  async (posId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/pos/${posId}/tabs`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch active tabs')
    }
  }
)

export const closeTab = createAsyncThunk(
  'pos/closeTab',
  async ({ posId, tabId }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/pos/${posId}/tabs/${tabId}/close`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to close tab')
    }
  }
)

// Async thunks for Held Bills Management
export const fetchHeldBills = createAsyncThunk(
  'pos/fetchHeldBills',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/pos/hold')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch held bills')
    }
  }
)

export const holdBill = createAsyncThunk(
  'pos/holdBill',
  async (billData, { rejectWithValue }) => {
    try {
      const response = await api.post('/pos/hold', billData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to hold bill')
    }
  }
)

export const resumeBill = createAsyncThunk(
  'pos/resumeBill',
  async (billId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/pos/hold/${billId}/resume`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to resume bill')
    }
  }
)

export const completeBill = createAsyncThunk(
  'pos/completeBill',
  async ({ billId, paymentData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/pos/hold/${billId}/complete`, paymentData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to complete bill')
    }
  }
)

export const deleteHeldBill = createAsyncThunk(
  'pos/deleteHeldBill',
  async (billId, { rejectWithValue }) => {
    try {
      await api.delete(`/pos/hold/${billId}`)
      return billId
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete held bill')
    }
  }
)

const initialState = {
  // POS Terminals
  terminals: [],
  selectedTerminal: null,
  
  // Inventory
  inventory: [],
  inventoryLoading: false,
  inventoryError: null,
  
  // Multi-tab
  activeTabs: [],
  selectedTab: null,
  
  // Held Bills
  heldBills: [],
  selectedHeldBill: null,
  
  // General state
  loading: false,
  error: null,
  
  // UI state
  activeTab: 'terminals', // terminals, inventory, tabs, held-bills
  showInventoryModal: false,
  showTabModal: false,
  showHeldBillModal: false,
}

const posSlice = createSlice({
  name: 'pos',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
      state.inventoryError = null
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload
    },
    setSelectedTerminal: (state, action) => {
      state.selectedTerminal = action.payload
    },
    setSelectedTab: (state, action) => {
      state.selectedTab = action.payload
    },
    setSelectedHeldBill: (state, action) => {
      state.selectedHeldBill = action.payload
    },
    toggleInventoryModal: (state) => {
      state.showInventoryModal = !state.showInventoryModal
    },
    toggleTabModal: (state) => {
      state.showTabModal = !state.showTabModal
    },
    toggleHeldBillModal: (state) => {
      state.showHeldBillModal = !state.showHeldBillModal
    },
    clearSelectedData: (state) => {
      state.selectedTerminal = null
      state.selectedTab = null
      state.selectedHeldBill = null
    }
  },
  extraReducers: (builder) => {
    builder
      // POS Terminals
      .addCase(fetchPOS.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPOS.fulfilled, (state, action) => {
        state.loading = false
        state.terminals = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchPOS.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchBranchPOS.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBranchPOS.fulfilled, (state, action) => {
        state.loading = false
        state.terminals = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchBranchPOS.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createPOSTerminal.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createPOSTerminal.fulfilled, (state, action) => {
        state.loading = false
        const newTerminal = action.payload.data || action.payload
        state.terminals.push(newTerminal)
        state.error = null
      })
      .addCase(createPOSTerminal.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(updatePOSTerminal.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updatePOSTerminal.fulfilled, (state, action) => {
        state.loading = false
        const index = state.terminals.findIndex(terminal => terminal.id === action.payload.id)
        if (index !== -1) {
          state.terminals[index] = action.payload
        }
        state.error = null
      })
      .addCase(updatePOSTerminal.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(deletePOSTerminal.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deletePOSTerminal.fulfilled, (state, action) => {
        state.loading = false
        state.terminals = state.terminals.filter(terminal => terminal.id !== action.payload)
        state.error = null
      })
      .addCase(deletePOSTerminal.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(getPOSDetails.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getPOSDetails.fulfilled, (state, action) => {
        state.loading = false
        state.selectedTerminal = action.payload.data || action.payload
        state.error = null
      })
      .addCase(getPOSDetails.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Inventory
      .addCase(fetchPOSInventory.pending, (state) => {
        state.inventoryLoading = true
        state.inventoryError = null
      })
      .addCase(fetchPOSInventory.fulfilled, (state, action) => {
        state.inventoryLoading = false
        state.inventory = action.payload.data || action.payload
        state.inventoryError = null
      })
      .addCase(fetchPOSInventory.rejected, (state, action) => {
        state.inventoryLoading = false
        state.inventoryError = action.payload
      })
      
      // Multi-tab
      .addCase(createTab.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createTab.fulfilled, (state, action) => {
        state.loading = false
        const newTab = action.payload.data || action.payload
        state.activeTabs.push(newTab)
        state.error = null
      })
      .addCase(createTab.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchActiveTabs.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchActiveTabs.fulfilled, (state, action) => {
        state.loading = false
        state.activeTabs = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchActiveTabs.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(closeTab.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(closeTab.fulfilled, (state, action) => {
        state.loading = false
        state.activeTabs = state.activeTabs.filter(tab => tab.id !== action.payload.id)
        state.error = null
      })
      .addCase(closeTab.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Held Bills
      .addCase(fetchHeldBills.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchHeldBills.fulfilled, (state, action) => {
        state.loading = false
        state.heldBills = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchHeldBills.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(holdBill.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(holdBill.fulfilled, (state, action) => {
        state.loading = false
        const newHeldBill = action.payload.data || action.payload
        state.heldBills.push(newHeldBill)
        state.error = null
      })
      .addCase(holdBill.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(resumeBill.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(resumeBill.fulfilled, (state, action) => {
        state.loading = false
        state.heldBills = state.heldBills.filter(bill => bill.id !== action.payload.id)
        state.error = null
      })
      .addCase(resumeBill.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(completeBill.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(completeBill.fulfilled, (state, action) => {
        state.loading = false
        state.heldBills = state.heldBills.filter(bill => bill.id !== action.payload.id)
        state.error = null
      })
      .addCase(completeBill.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(deleteHeldBill.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteHeldBill.fulfilled, (state, action) => {
        state.loading = false
        state.heldBills = state.heldBills.filter(bill => bill.id !== action.payload)
        state.error = null
      })
      .addCase(deleteHeldBill.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { 
  clearError, 
  setActiveTab, 
  setSelectedTerminal, 
  setSelectedTab, 
  setSelectedHeldBill,
  toggleInventoryModal,
  toggleTabModal,
  toggleHeldBillModal,
  clearSelectedData
} = posSlice.actions

export default posSlice.reducer
