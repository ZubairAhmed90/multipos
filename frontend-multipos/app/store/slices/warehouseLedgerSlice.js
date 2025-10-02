import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks for warehouse ledger accounts
export const fetchWarehouseLedgerAccounts = createAsyncThunk(
  'warehouseLedger/fetchAccounts',
  async ({ warehouseId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/warehouse-ledger/accounts/${warehouseId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch warehouse ledger accounts')
    }
  }
)

export const createWarehouseLedgerAccount = createAsyncThunk(
  'warehouseLedger/createAccount',
  async (accountData, { rejectWithValue }) => {
    try {
      const response = await api.post('/warehouse-ledger/accounts', accountData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create warehouse ledger account')
    }
  }
)

export const updateWarehouseLedgerAccount = createAsyncThunk(
  'warehouseLedger/updateAccount',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/warehouse-ledger/accounts/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update warehouse ledger account')
    }
  }
)

export const deleteWarehouseLedgerAccount = createAsyncThunk(
  'warehouseLedger/deleteAccount',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/warehouse-ledger/accounts/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete warehouse ledger account')
    }
  }
)

// Async thunks for warehouse ledger entries
export const fetchWarehouseLedgerEntries = createAsyncThunk(
  'warehouseLedger/fetchEntries',
  async ({ warehouseId, ledgerId, type, startDate, endDate }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()
      if (ledgerId) params.append('ledgerId', ledgerId)
      if (type) params.append('type', type)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      
      const response = await api.get(`/warehouse-ledger/entries/${warehouseId}?${params}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch warehouse ledger entries')
    }
  }
)

export const createWarehouseLedgerEntry = createAsyncThunk(
  'warehouseLedger/createEntry',
  async (entryData, { rejectWithValue }) => {
    try {
      const response = await api.post('/warehouse-ledger/entries', entryData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create warehouse ledger entry')
    }
  }
)

export const updateWarehouseLedgerEntry = createAsyncThunk(
  'warehouseLedger/updateEntry',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/warehouse-ledger/entries/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update warehouse ledger entry')
    }
  }
)

export const deleteWarehouseLedgerEntry = createAsyncThunk(
  'warehouseLedger/deleteEntry',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/warehouse-ledger/entries/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete warehouse ledger entry')
    }
  }
)

// Async thunk for warehouse balance summary
export const fetchWarehouseBalanceSummary = createAsyncThunk(
  'warehouseLedger/fetchBalanceSummary',
  async ({ warehouseId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/warehouse-ledger/balance-summary/${warehouseId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch warehouse balance summary')
    }
  }
)

const warehouseLedgerSlice = createSlice({
  name: 'warehouseLedger',
  initialState: {
    accounts: [],
    entries: [],
    balanceSummary: null,
    selectedAccount: null,
    selectedEntry: null,
    accountsLoading: false,
    entriesLoading: false,
    balanceLoading: false,
    accountsError: null,
    entriesError: null,
    balanceError: null,
  },
  reducers: {
    setSelectedAccount: (state, action) => {
      state.selectedAccount = action.payload
    },
    setSelectedEntry: (state, action) => {
      state.selectedEntry = action.payload
    },
    clearErrors: (state) => {
      state.accountsError = null
      state.entriesError = null
      state.balanceError = null
    },
  },
  extraReducers: (builder) => {
    // Fetch accounts
    builder
      .addCase(fetchWarehouseLedgerAccounts.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(fetchWarehouseLedgerAccounts.fulfilled, (state, action) => {
        state.accountsLoading = false
        state.accounts = action.payload.data || []
      })
      .addCase(fetchWarehouseLedgerAccounts.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })

    // Create account
    builder
      .addCase(createWarehouseLedgerAccount.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(createWarehouseLedgerAccount.fulfilled, (state, action) => {
        state.accountsLoading = false
        state.accounts.push(action.payload.data)
      })
      .addCase(createWarehouseLedgerAccount.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })

    // Update account
    builder
      .addCase(updateWarehouseLedgerAccount.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(updateWarehouseLedgerAccount.fulfilled, (state, action) => {
        state.accountsLoading = false
        const index = state.accounts.findIndex(account => account.id === action.payload.data.id)
        if (index !== -1) {
          state.accounts[index] = action.payload.data
        }
      })
      .addCase(updateWarehouseLedgerAccount.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })

    // Delete account
    builder
      .addCase(deleteWarehouseLedgerAccount.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(deleteWarehouseLedgerAccount.fulfilled, (state, action) => {
        state.accountsLoading = false
        state.accounts = state.accounts.filter(account => account.id !== action.payload.id)
      })
      .addCase(deleteWarehouseLedgerAccount.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })

    // Fetch entries
    builder
      .addCase(fetchWarehouseLedgerEntries.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(fetchWarehouseLedgerEntries.fulfilled, (state, action) => {
        state.entriesLoading = false
        state.entries = action.payload.data || []
      })
      .addCase(fetchWarehouseLedgerEntries.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })

    // Create entry
    builder
      .addCase(createWarehouseLedgerEntry.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(createWarehouseLedgerEntry.fulfilled, (state, action) => {
        state.entriesLoading = false
        state.entries.unshift(action.payload.data)
      })
      .addCase(createWarehouseLedgerEntry.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })

    // Update entry
    builder
      .addCase(updateWarehouseLedgerEntry.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(updateWarehouseLedgerEntry.fulfilled, (state, action) => {
        state.entriesLoading = false
        const index = state.entries.findIndex(entry => entry.id === action.payload.data.id)
        if (index !== -1) {
          state.entries[index] = action.payload.data
        }
      })
      .addCase(updateWarehouseLedgerEntry.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })

    // Delete entry
    builder
      .addCase(deleteWarehouseLedgerEntry.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(deleteWarehouseLedgerEntry.fulfilled, (state, action) => {
        state.entriesLoading = false
        state.entries = state.entries.filter(entry => entry.id !== action.payload.id)
      })
      .addCase(deleteWarehouseLedgerEntry.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })

    // Fetch balance summary
    builder
      .addCase(fetchWarehouseBalanceSummary.pending, (state) => {
        state.balanceLoading = true
        state.balanceError = null
      })
      .addCase(fetchWarehouseBalanceSummary.fulfilled, (state, action) => {
        state.balanceLoading = false
        state.balanceSummary = action.payload.data
      })
      .addCase(fetchWarehouseBalanceSummary.rejected, (state, action) => {
        state.balanceLoading = false
        state.balanceError = action.payload
      })
  },
})

export const { setSelectedAccount, setSelectedEntry, clearErrors } = warehouseLedgerSlice.actions
export default warehouseLedgerSlice.reducer











