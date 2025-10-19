import { configureStore } from '@reduxjs/toolkit'
import appSlice from './slices/appSlice'
import authSlice from './slices/authSlice'
import branchesSlice from './slices/branchesSlice'
import warehousesSlice from './slices/warehousesSlice'
import inventorySlice from './slices/inventorySlice'
import salesSlice from './slices/salesSlice'
import returnsSlice from './slices/returnsSlice'
import posSlice from './slices/posSlice'
import shiftsSlice from './slices/shiftsSlice'
import ledgerSlice from './slices/ledgerSlice'
import transfersSlice from './slices/transfersSlice'
import companiesSlice from './slices/companiesSlice'
import billingSlice from './slices/billingSlice'
import hardwareSlice from './slices/hardwareSlice'
import adminUsersSlice from './slices/adminUsersSlice'
import adminSlice from './slices/adminSlice'
import customersSlice from './slices/customersSlice'
import financialSlice from './slices/financialSlice'
import dashboardSlice from './slices/dashboardSlice'
import reportsSlice from './slices/reportsSlice'
import warehouseLedgerSlice from './slices/warehouseLedgerSlice'
import companySalesHistorySlice from './slices/companySalesHistorySlice'
import invoiceDetailsSlice from './slices/invoiceDetailsSlice'
import retailersSlice from './slices/retailersSlice'
import warehouseSalesAnalyticsSlice from './slices/warehouseSalesAnalyticsSlice'
import customerLedgerSlice from './slices/customerLedgerSlice'
import financialVoucherSlice from './slices/financialVoucherSlice'


export const store = configureStore({
  reducer: {
    app: appSlice,
    auth: authSlice,
    branches: branchesSlice,
    warehouses: warehousesSlice,
    inventory: inventorySlice,
    sales: salesSlice,
    returns: returnsSlice,
    pos: posSlice,
    shifts: shiftsSlice,
    ledger: ledgerSlice,
    transfers: transfersSlice,
    companies: companiesSlice,
    billing: billingSlice,
    hardware: hardwareSlice,
    adminUsers: adminUsersSlice,
    admin: adminSlice,
    customers: customersSlice,
    financial: financialSlice,
    dashboard: dashboardSlice,
    reports: reportsSlice,
    warehouseLedger: warehouseLedgerSlice,
    companySalesHistory: companySalesHistorySlice,
    invoiceDetails: invoiceDetailsSlice,
    retailers: retailersSlice,
    warehouseSalesAnalytics: warehouseSalesAnalyticsSlice,
    customerLedger: customerLedgerSlice,
    financialVouchers: financialVoucherSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})


export default store
