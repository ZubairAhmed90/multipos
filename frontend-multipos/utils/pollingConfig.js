import { 
  fetchDashboardData, 
  fetchSalesData, 
  fetchInventoryData, 
  fetchFinancialData 
} from '../app/store/slices/dashboardSlice'
import { 
  fetchSalesReports, 
  fetchInventoryReports, 
  fetchLedgerReports,
  fetchReportsSummary 
} from '../app/store/slices/reportsSlice'
import { 
  fetchActiveShift, 
  fetchShifts 
} from '../app/store/slices/shiftsSlice'
import { fetchSettings } from '../app/store/slices/settingsSlice'

// Polling configurations for different user roles
export const POLLING_CONFIGS = {
  admin: {
    pollingConfigs: [
      {
        key: 'dashboard',
        fetchAction: fetchDashboardData,
        interval: 30000, // 30 seconds
        dependencies: []
      },
      {
        key: 'sales',
        fetchAction: fetchSalesData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'inventory',
        fetchAction: fetchInventoryData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'financial',
        fetchAction: fetchFinancialData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'reportsSummary',
        fetchAction: fetchReportsSummary,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'settings',
        fetchAction: fetchSettings,
        interval: 60000, // 1 minute
        dependencies: []
      }
    ]
  },
  
  warehouse_keeper: {
    pollingConfigs: [
      {
        key: 'dashboard',
        fetchAction: fetchDashboardData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'inventory',
        fetchAction: fetchInventoryData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'sales',
        fetchAction: fetchSalesData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'reportsSummary',
        fetchAction: fetchReportsSummary,
        interval: 30000,
        dependencies: []
      }
    ]
  },
  
  cashier: {
    pollingConfigs: [
      {
        key: 'dashboard',
        fetchAction: fetchDashboardData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'sales',
        fetchAction: fetchSalesData,
        interval: 30000,
        dependencies: []
      },
      {
        key: 'activeShift',
        fetchAction: fetchActiveShift,
        interval: 30000,
        dependencies: ['userId'] // Will be passed dynamically
      },
      {
        key: 'shifts',
        fetchAction: fetchShifts,
        interval: 30000,
        dependencies: ['userId'] // Will be passed dynamically
      }
    ]
  },
  
  default: {
    pollingConfigs: [
      {
        key: 'dashboard',
        fetchAction: fetchDashboardData,
        interval: 30000,
        dependencies: []
      }
    ]
  }
}

// Helper function to get polling config for a specific role
export const getPollingConfig = (role) => {
  return POLLING_CONFIGS[role] || POLLING_CONFIGS.default
}

// Helper function to create dynamic polling configs with user-specific data
export const createDynamicPollingConfig = (role, userId) => {
  const baseConfig = getPollingConfig(role)
  
  return {
    ...baseConfig,
    pollingConfigs: baseConfig.pollingConfigs.map(config => {
      if (config.dependencies.includes('userId')) {
        return {
          ...config,
          fetchAction: () => config.fetchAction({ cashierId: userId })
        }
      }
      return config
    })
  }
}

export default POLLING_CONFIGS
