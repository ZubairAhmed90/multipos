import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../../utils/axios';

// Async thunks
export const fetchWarehouseSalesAnalytics = createAsyncThunk(
  'warehouseSalesAnalytics/fetchAnalytics',
  async (params, { rejectWithValue }) => {
    try {
      const { warehouseId, ...queryParams } = params;
      const queryString = new URLSearchParams();
      
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryString.append(key, value);
        }
      });

      const url = queryString.toString() 
        ? `/warehouse-sales-analytics/${warehouseId}/analytics?${queryString}`
        : `/warehouse-sales-analytics/${warehouseId}/analytics`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch warehouse sales analytics');
    }
  }
);

export const exportWarehouseSalesAnalytics = createAsyncThunk(
  'warehouseSalesAnalytics/exportAnalytics',
  async (params, { rejectWithValue }) => {
    try {
      const { warehouseId, format = 'csv', ...queryParams } = params;
      const queryString = new URLSearchParams();
      
      queryString.append('format', format);
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryString.append(key, value);
        }
      });

      const url = `/warehouse-sales-analytics/${warehouseId}/analytics/export?${queryString}`;
      
      if (format === 'csv') {
        const response = await api.get(url, { responseType: 'blob' });
        
        // Create download link
        const blob = new Blob([response.data], { type: 'text/csv' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `warehouse-sales-analytics-${warehouseId}-${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        return { success: true, message: 'Export completed successfully' };
      } else {
        const response = await api.get(url);
        return response.data;
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export warehouse sales analytics');
    }
  }
);

// Initial state
const initialState = {
  data: {
    sales: [],
    summary: {
      totalSales: 0,
      totalAmount: 0,
      cashAmount: 0,
      creditAmount: 0,
      bankTransferAmount: 0,
      cardAmount: 0,
      chequeAmount: 0,
      mobilePaymentAmount: 0,
      totalTax: 0,
      totalDiscount: 0,
      averageSaleAmount: 0
    },
    retailerBreakdown: [],
    pagination: {
      current: 1,
      total: 1,
      limit: 100,
      offset: 0,
      count: 0,
      totalCount: 0
    }
  },
  loading: false,
  error: null,
  filters: {
    retailerId: 'all',
    paymentMethod: 'all',
    startDate: '',
    endDate: '',
    invoiceNo: '',
    limit: 100,
    offset: 0
  },
  selectedSale: null,
  exportLoading: false,
  exportError: null
};

// Slice
const warehouseSalesAnalyticsSlice = createSlice({
  name: 'warehouseSalesAnalytics',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.data.pagination.offset = 0; // Reset to first page when filters change
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.data.pagination.offset = 0;
    },
    setSelectedSale: (state, action) => {
      state.selectedSale = action.payload;
    },
    clearSelectedSale: (state) => {
      state.selectedSale = null;
    },
    updatePagination: (state, action) => {
      state.data.pagination = { ...state.data.pagination, ...action.payload };
      state.filters.offset = action.payload.offset || 0;
    },
    clearError: (state) => {
      state.error = null;
      state.exportError = null;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Fetch Warehouse Sales Analytics
      .addCase(fetchWarehouseSalesAnalytics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouseSalesAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) {
          state.data = action.payload.data;
          state.error = null;
        } else {
         state.error = action.payload.message || 'Failed to fetch warehouse sales analytics';
        }
      })
      .addCase(fetchWarehouseSalesAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch warehouse sales analytics';
      })
      // Export Warehouse Sales Analytics
      .addCase(exportWarehouseSalesAnalytics.pending, (state) => {
        state.exportLoading = true;
        state.exportError = null;
      })
      .addCase(exportWarehouseSalesAnalytics.fulfilled, (state, action) => {
        state.exportLoading = false;
        state.exportError = null;
      })
      .addCase(exportWarehouseSalesAnalytics.rejected, (state, action) => {
        state.exportLoading = false;
        state.exportError = action.payload || 'Failed to export warehouse sales analytics';
      });
  }
});

export const {
  setFilters,
  clearFilters,
  setSelectedSale,
  clearSelectedSale,
  updatePagination,
  clearError,
  setLoading,
  resetState
} = warehouseSalesAnalyticsSlice.actions;

export default warehouseSalesAnalyticsSlice.reducer;
