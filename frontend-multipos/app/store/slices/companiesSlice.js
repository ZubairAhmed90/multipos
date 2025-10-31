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

export const fetchCompanyDetails = createAsyncThunk(
  'companies/fetchCompanyDetails',
  async (companyId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/companies/${companyId}/details`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch company details')
    }
  }
)

export const exportCompaniesReport = createAsyncThunk(
  'companies/exportCompaniesReport',
  async ({ format = 'excel', params = {} } = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.scopeType) queryParams.append('scopeType', params.scopeType)
      if (params.scopeId) queryParams.append('scopeId', params.scopeId)
      if (params.status) queryParams.append('status', params.status)
      if (params.transactionType) queryParams.append('transactionType', params.transactionType)
      if (format) queryParams.append('format', format)

      const url = `/companies/export?${queryParams.toString()}`

      if (format === 'pdf') {
        const response = await api.get(url, { responseType: 'text' })
        return { format, data: response.data }
      }

      const response = await api.get(url)
      return { format, data: response.data?.data || response.data }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export companies')
    }
  }
)

export const exportCompanyDetailsReport = createAsyncThunk(
  'companies/exportCompanyDetailsReport',
  async ({ companyId, format = 'excel' }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (format) queryParams.append('format', format)

      const url = `/companies/${companyId}/export?${queryParams.toString()}`

      if (format === 'pdf') {
        const response = await api.get(url, { responseType: 'text' })
        return { format, data: response.data }
      }

      const response = await api.get(url)
      return { format, data: response.data?.data || response.data }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export company details')
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
  summary: null,
  loading: false,
  error: null,
  detail: null,
  detailLoading: false,
  exportLoading: false,
  exportError: null,
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
        state.summary = action.payload.summary || null
        state.error = null
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchCompanyDetails.pending, (state) => {
        state.detailLoading = true
        state.error = null
      })
      .addCase(fetchCompanyDetails.fulfilled, (state, action) => {
        state.detailLoading = false
        state.detail = action.payload.data || action.payload
      })
      .addCase(fetchCompanyDetails.rejected, (state, action) => {
        state.detailLoading = false
        state.error = action.payload
      })
      .addCase(exportCompaniesReport.pending, (state) => {
        state.exportLoading = true
        state.exportError = null
      })
      .addCase(exportCompaniesReport.fulfilled, (state) => {
        state.exportLoading = false
      })
      .addCase(exportCompaniesReport.rejected, (state, action) => {
        state.exportLoading = false
        state.exportError = action.payload
      })
      .addCase(exportCompanyDetailsReport.pending, (state) => {
        state.exportLoading = true
        state.exportError = null
      })
      .addCase(exportCompanyDetailsReport.fulfilled, (state) => {
        state.exportLoading = false
      })
      .addCase(exportCompanyDetailsReport.rejected, (state, action) => {
        state.exportLoading = false
        state.exportError = action.payload
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
