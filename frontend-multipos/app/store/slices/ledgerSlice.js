import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// ===== LEDGER ACCOUNTS (Chart of Accounts) =====
export const fetchLedgerAccounts = createAsyncThunk(
  'ledger/fetchAccounts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.status) queryParams.append('status', params.status)
      if (params.accountType) queryParams.append('accountType', params.accountType)
      
      const response = await api.get(`/ledger/accounts?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch ledger accounts')
    }
  }
)

export const createLedgerAccount = createAsyncThunk(
  'ledger/createAccount',
  async (accountData, { rejectWithValue }) => {
    try {
      const response = await api.post('/ledger/accounts', accountData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create ledger account')
    }
  }
)

export const updateLedgerAccount = createAsyncThunk(
  'ledger/updateAccount',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/ledger/accounts/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update ledger account')
    }
  }
)

export const deleteLedgerAccount = createAsyncThunk(
  'ledger/deleteAccount',
  async (accountId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/ledger/accounts/${accountId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete ledger account')
    }
  }
)

// ===== LEDGER ENTRIES (Transactions) =====
export const fetchLedgerEntries = createAsyncThunk(
  'ledger/fetchEntries',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.ledgerId) queryParams.append('ledgerId', params.ledgerId)
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.partyType) queryParams.append('partyType', params.partyType)
      if (params.partyId) queryParams.append('partyId', params.partyId)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.type) queryParams.append('type', params.type)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      
      let url = '/ledger/entries'
      if (params.scopeType && params.scopeId && params.partyType && params.partyId) {
        url = `/ledger/${params.scopeType}/${params.scopeId}/${params.partyType}/${params.partyId}/entries`
      }
      
      const response = await api.get(`${url}?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch ledger entries')
    }
  }
)

export const createLedgerEntry = createAsyncThunk(
  'ledger/createEntry',
  async (entryData, { rejectWithValue }) => {
    try {
      const { accountId, type, amount, description, reference, referenceId } = entryData
      
      // Use the new simpler endpoint
      const url = `/ledger/account/${accountId}/entry`
      
      const response = await api.post(url, {
        type,
        amount,
        description,
        reference,
        referenceId
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create ledger entry')
    }
  }
)

export const updateLedgerEntry = createAsyncThunk(
  'ledger/updateEntry',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/ledger/entries/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update ledger entry')
    }
  }
)

export const deleteLedgerEntry = createAsyncThunk(
  'ledger/deleteEntry',
  async (entryId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/ledger/entries/${entryId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete ledger entry')
    }
  }
)

// ===== BALANCE SUMMARY =====
export const fetchBalanceSummary = createAsyncThunk(
  'ledger/fetchBalanceSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get(`/ledger/balance/${params.scopeType}/${params.scopeId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch balance summary')
    }
  }
)

// ===== INITIAL STATE =====
const initialState = {
  // Accounts
  accounts: [],
  accountsLoading: false,
  accountsError: null,
  
  // Entries
  entries: [],
  entriesLoading: false,
  entriesError: null,
  
  // Balance Summary
  balanceSummary: null,
  balanceLoading: false,
  balanceError: null,
  
  // UI State
  selectedAccount: null,
  selectedEntry: null,
  
  // Pagination
  accountsPagination: {
    page: 1,
    limit: 10,
    total: 0
  },
  entriesPagination: {
    page: 1,
    limit: 20,
    total: 0
  }
}

// ===== SLICE =====
const ledgerSlice = createSlice({
  name: 'ledger',
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.accountsError = null
      state.entriesError = null
      state.balanceError = null
    },
    setSelectedAccount: (state, action) => {
      state.selectedAccount = action.payload
    },
    setSelectedEntry: (state, action) => {
      state.selectedEntry = action.payload
    },
    setAccountsPagination: (state, action) => {
      state.accountsPagination = { ...state.accountsPagination, ...action.payload }
    },
    setEntriesPagination: (state, action) => {
      state.entriesPagination = { ...state.entriesPagination, ...action.payload }
    }
  },
  extraReducers: (builder) => {
    builder
      // ===== ACCOUNTS =====
      .addCase(fetchLedgerAccounts.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(fetchLedgerAccounts.fulfilled, (state, action) => {
        state.accountsLoading = false
        state.accounts = action.payload.data || action.payload
        state.accountsError = null
      })
      .addCase(fetchLedgerAccounts.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })
      .addCase(createLedgerAccount.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(createLedgerAccount.fulfilled, (state, action) => {
        state.accountsLoading = false
        const newAccount = action.payload.data || action.payload
        state.accounts.unshift(newAccount)
        state.accountsError = null
      })
      .addCase(createLedgerAccount.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })
      .addCase(updateLedgerAccount.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(updateLedgerAccount.fulfilled, (state, action) => {
        state.accountsLoading = false
        const updatedAccount = action.payload.data || action.payload
        const index = state.accounts.findIndex(account => account.id === updatedAccount.id)
        if (index !== -1) {
          state.accounts[index] = updatedAccount
        }
        state.accountsError = null
      })
      .addCase(updateLedgerAccount.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })
      .addCase(deleteLedgerAccount.pending, (state) => {
        state.accountsLoading = true
        state.accountsError = null
      })
      .addCase(deleteLedgerAccount.fulfilled, (state, action) => {
        state.accountsLoading = false
        state.accounts = state.accounts.filter(account => account.id !== action.meta.arg)
        state.accountsError = null
      })
      .addCase(deleteLedgerAccount.rejected, (state, action) => {
        state.accountsLoading = false
        state.accountsError = action.payload
      })
      
      // ===== ENTRIES =====
      .addCase(fetchLedgerEntries.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(fetchLedgerEntries.fulfilled, (state, action) => {
        state.entriesLoading = false
        state.entries = action.payload.data || action.payload
        state.entriesError = null
      })
      .addCase(fetchLedgerEntries.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })
      .addCase(createLedgerEntry.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(createLedgerEntry.fulfilled, (state, action) => {
        state.entriesLoading = false
        const newEntry = action.payload.data || action.payload
        state.entries.unshift(newEntry)
        state.entriesError = null
      })
      .addCase(createLedgerEntry.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })
      .addCase(updateLedgerEntry.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(updateLedgerEntry.fulfilled, (state, action) => {
        state.entriesLoading = false
        const updatedEntry = action.payload.data || action.payload
        const index = state.entries.findIndex(entry => entry.id === updatedEntry.id)
        if (index !== -1) {
          state.entries[index] = updatedEntry
        }
        state.entriesError = null
      })
      .addCase(updateLedgerEntry.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })
      .addCase(deleteLedgerEntry.pending, (state) => {
        state.entriesLoading = true
        state.entriesError = null
      })
      .addCase(deleteLedgerEntry.fulfilled, (state, action) => {
        state.entriesLoading = false
        state.entries = state.entries.filter(entry => entry.id !== action.meta.arg)
        state.entriesError = null
      })
      .addCase(deleteLedgerEntry.rejected, (state, action) => {
        state.entriesLoading = false
        state.entriesError = action.payload
      })
      
      // ===== BALANCE SUMMARY =====
      .addCase(fetchBalanceSummary.pending, (state) => {
        state.balanceLoading = true
        state.balanceError = null
      })
      .addCase(fetchBalanceSummary.fulfilled, (state, action) => {
        state.balanceLoading = false
        state.balanceSummary = action.payload.data || action.payload
        state.balanceError = null
      })
      .addCase(fetchBalanceSummary.rejected, (state, action) => {
        state.balanceLoading = false
        state.balanceError = action.payload
      })
  }
})

export const {
  clearErrors,
  setSelectedAccount,
  setSelectedEntry,
  setAccountsPagination,
  setEntriesPagination
} = ledgerSlice.actions

export default ledgerSlice.reducer



