import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
export const fetchCompanies = createAsyncThunk(
  'companies/fetchCompanies',
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.type) queryParams.append('type', params.type)
      if (params.status) queryParams.append('status', params.status)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)
      
      const response = await api.get(`/companies?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch companies')
    }
  }
)

export const createCompany = createAsyncThunk(
  'companies/createCompany',
  async (companyData, { rejectWithValue }) => {
    try {
      const response = await api.post('/companies', companyData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create company')
    }
  }
)

export const updateCompany = createAsyncThunk(
  'companies/updateCompany',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/companies/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update company')
    }
  }
)

export const deleteCompany = createAsyncThunk(
  'companies/deleteCompany',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/companies/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete company')
    }
  }
)

const initialState = {
  data: [],
  loading: false,
  error: null,
}

const companiesSlice = createSlice({
  name: 'companies',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCompanies.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createCompany.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createCompany.fulfilled, (state, action) => {
        state.loading = false
        const newCompany = action.payload.data || action.payload
        state.data.push(newCompany)
        state.error = null
      })
      .addCase(createCompany.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(updateCompany.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.loading = false
        const updatedCompany = action.payload.data || action.payload
        const index = state.data.findIndex(company => company.id === updatedCompany.id)
        if (index !== -1) {
          state.data[index] = updatedCompany
        }
        state.error = null
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(deleteCompany.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteCompany.fulfilled, (state, action) => {
        state.loading = false
        const deletedCompany = action.payload.data || action.payload
        state.data = state.data.filter(company => company.id !== deletedCompany.id)
        state.error = null
      })
      .addCase(deleteCompany.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearError } = companiesSlice.actions
export default companiesSlice.reducer
