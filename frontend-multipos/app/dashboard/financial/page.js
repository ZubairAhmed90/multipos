'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import {
  fetchFinancialSummary,
  fetchSalesSummary,
  fetchLedgerEntries,
  fetchBalanceSummary,
  addDebitEntry,
  addCreditEntry,
  fetchProfitLossReport,
  fetchRevenueAnalytics,
  fetchExpenseAnalytics,
  fetchFinancialForecast,
  fetchCashFlowReport,
  setActiveTab,
  setFilters,
  toggleLedgerForm,
  toggleReportModal,
  clearSelectedData
} from '../../store/slices/financialSlice'

// Validation schemas
const ledgerEntrySchema = yup.object({
  amount: yup.number().required('Amount is required').min(0.01, 'Amount must be greater than 0'),
  description: yup.string().required('Description is required'),
  reference: yup.string(),
  category: yup.string().required('Category is required'),
})

// Form fields configuration
const debitEntryFields = [
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'description', label: 'Description', type: 'textarea', required: true },
  { name: 'reference', label: 'Reference', type: 'text' },
  { 
    name: 'category', 
    label: 'Category', 
    type: 'select', 
    required: true,
    options: [
      { value: 'EXPENSE', label: 'Expense' },
      { value: 'PURCHASE', label: 'Purchase' },
      { value: 'OPERATIONAL', label: 'Operational' },
      { value: 'OTHER', label: 'Other' },
    ]
  },
]

const creditEntryFields = [
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'description', label: 'Description', type: 'textarea', required: true },
  { name: 'reference', label: 'Reference', type: 'text' },
  { 
    name: 'category', 
    label: 'Category', 
    type: 'select', 
    required: true,
    options: [
      { value: 'INCOME', label: 'Income' },
      { value: 'SALES', label: 'Sales' },
      { value: 'REFUND', label: 'Refund' },
      { value: 'OTHER', label: 'Other' },
    ]
  },
]

function FinancialDashboard() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const {
    financialSummary,
    salesSummary,
    ledgerEntries,
    balanceSummary,
    profitLossReport,
    revenueAnalytics,
    expenseAnalytics,
    financialForecast,
    cashFlowReport,
    filters,
    loading,
    error,
    activeTab,
    showLedgerForm,
    showReportModal,
    reportType
  } = useSelector(state => state.financial)

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [selectedScope, setSelectedScope] = useState({
    scopeType: 'BRANCH',
    scopeId: user?.branchId || ''
  })
  const [ledgerEntryType, setLedgerEntryType] = useState('debit')
  const [selectedParty, setSelectedParty] = useState({ partyType: '', partyId: '' })

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchFinancialSummary({ ...selectedScope, ...dateRange }))
    dispatch(fetchSalesSummary({ ...selectedScope, ...dateRange }))
    dispatch(fetchBalanceSummary(selectedScope))
  }, [dispatch, selectedScope, dateRange])

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    dispatch(setFilters(newFilters))
    const updatedFilters = { ...filters, ...newFilters }
    
    // Reload data based on active tab
    switch (activeTab) {
      case 'overview':
        dispatch(fetchFinancialSummary(updatedFilters))
        dispatch(fetchSalesSummary(updatedFilters))
        break
      case 'revenue':
        dispatch(fetchRevenueAnalytics(updatedFilters))
        break
      case 'expenses':
        dispatch(fetchExpenseAnalytics(updatedFilters))
        break
      case 'profit-loss':
        dispatch(fetchProfitLossReport(updatedFilters))
        break
      case 'forecasting':
        dispatch(fetchFinancialForecast(updatedFilters))
        break
      case 'cash-flow':
        dispatch(fetchCashFlowReport(updatedFilters))
        break
    }
  }

  // Handle ledger entry submission
  const handleLedgerEntry = (data) => {
    const entryData = {
      ...selectedScope,
      ...selectedParty,
      entryData: data
    }
    
    if (ledgerEntryType === 'debit') {
      dispatch(addDebitEntry(entryData))
    } else {
      dispatch(addCreditEntry(entryData))
    }
  }

  // Handle date range change
  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange)
    handleFilterChange(newDateRange)
  }

  // Handle scope change
  const handleScopeChange = (newScope) => {
    setSelectedScope(newScope)
    handleFilterChange(newScope)
  }

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Financial Overview</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setLedgerEntryType('debit')
              dispatch(toggleLedgerForm())
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500"
          >
            Add Expense
          </button>
          <button
            onClick={() => {
              setLedgerEntryType('credit')
              dispatch(toggleLedgerForm())
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500"
          >
            Add Income
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">$</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${salesSummary?.totals?.totalSales?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">T</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Transactions</p>
              <p className="text-2xl font-semibold text-gray-900">
                {salesSummary?.totals?.totalTransactions || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">I</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Items Sold</p>
              <p className="text-2xl font-semibold text-gray-900">
                {salesSummary?.totals?.totalItems || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">B</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Account Balance</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${balanceSummary?.totalBalance?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales by Payment Method */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sales by Payment Method</h3>
        <div className="space-y-3">
          {salesSummary?.salesByPaymentMethod?.map((method) => (
            <div key={method._id} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{method._id}</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ 
                      width: `${(method.totalSales / salesSummary.totals.totalSales) * 100}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600">${method.totalSales.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {financialSummary?.recentTransactions?.slice(0, 5).map((transaction) => (
                <tr key={transaction._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Sale
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${transaction.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Sale #{transaction.invoiceNumber}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderRevenueTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Revenue Analytics</h2>
        <button
          onClick={() => {
            setReportType('revenue')
            dispatch(toggleReportModal())
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        >
          Generate Report
        </button>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">R</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${salesSummary?.totals?.totalSales?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Average Transaction</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${salesSummary?.totals?.totalTransactions ? 
                  (salesSummary.totals.totalSales / salesSummary.totals.totalTransactions).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">G</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Growth Rate</p>
              <p className="text-2xl font-semibold text-gray-900">+12.5%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Sales Trend */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Sales Trend (Last 30 Days)</h3>
        <div className="space-y-2">
          {salesSummary?.dailySales?.slice(-7).map((day) => (
            <div key={`${day._id.year}-${day._id.month}-${day._id.day}`} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {new Date(day._id.year, day._id.month - 1, day._id.day).toLocaleDateString()}
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ 
                      width: `${(day.totalSales / Math.max(...salesSummary.dailySales.map(d => d.totalSales))) * 100}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600">${day.totalSales.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderExpensesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Expense Management</h2>
        <button
          onClick={() => {
            setLedgerEntryType('debit')
            dispatch(toggleLedgerForm())
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500"
        >
          Add Expense
        </button>
      </div>

      {/* Expense Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">E</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Expenses</p>
              <p className="text-2xl font-semibold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">C</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Categories</p>
              <p className="text-2xl font-semibold text-gray-900">4</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">M</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Monthly Avg</p>
              <p className="text-2xl font-semibold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Categories */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Expense Categories</h3>
        <div className="space-y-3">
          {['EXPENSE', 'PURCHASE', 'OPERATIONAL', 'OTHER'].map((category) => (
            <div key={category} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{category}</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-red-600 h-2 rounded-full w-0"></div>
                </div>
                <span className="text-sm text-gray-600">$0.00</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderProfitLossTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Profit & Loss Report</h2>
        <button
          onClick={() => {
            setReportType('profit-loss')
            dispatch(toggleReportModal())
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        >
          Generate Report
        </button>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">R</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${salesSummary?.totals?.totalSales?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">E</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Expenses</p>
              <p className="text-2xl font-semibold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">P</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Net Profit</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${salesSummary?.totals?.totalSales?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profit Margin */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profit Margin Analysis</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Gross Profit Margin</span>
            <span className="text-sm text-gray-600">100.0%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Net Profit Margin</span>
            <span className="text-sm text-gray-600">100.0%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Operating Margin</span>
            <span className="text-sm text-gray-600">100.0%</span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderForecastingTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Financial Forecasting</h2>
        <button
          onClick={() => {
            setReportType('forecast')
            dispatch(toggleReportModal())
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        >
          Generate Forecast
        </button>
      </div>

      {/* Forecast Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">F</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Next Month Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">T</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Next Quarter</p>
              <p className="text-2xl font-semibold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">Y</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Next Year</p>
              <p className="text-2xl font-semibold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Chart Placeholder */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Forecast Trend</h3>
        <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Forecast chart will be displayed here</p>
        </div>
      </div>
    </div>
  )

  const renderCashFlowTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Cash Flow Analysis</h2>
        <button
          onClick={() => {
            setReportType('cash-flow')
            dispatch(toggleReportModal())
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        >
          Generate Report
        </button>
      </div>

      {/* Cash Flow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">I</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Cash Inflow</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${salesSummary?.totals?.totalSales?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">O</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Cash Outflow</p>
              <p className="text-2xl font-semibold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">N</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Net Cash Flow</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${salesSummary?.totals?.totalSales?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Categories */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cash Flow by Category</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Operating Activities</span>
            <span className="text-sm text-gray-600">
              ${salesSummary?.totals?.totalSales?.toFixed(2) || '0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Investing Activities</span>
            <span className="text-sm text-gray-600">$0.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Financing Activities</span>
            <span className="text-sm text-gray-600">$0.00</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => handleDateRangeChange({ ...dateRange, startDate: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => handleDateRangeChange({ ...dateRange, endDate: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope Type</label>
              <select
                value={selectedScope.scopeType}
                onChange={(e) => handleScopeChange({ ...selectedScope, scopeType: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="BRANCH">Branch</option>
                <option value="WAREHOUSE">Warehouse</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope ID</label>
              <input
                type="text"
                value={selectedScope.scopeId}
                onChange={(e) => handleScopeChange({ ...selectedScope, scopeId: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter scope ID"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  dispatch(fetchFinancialSummary({ ...selectedScope, ...dateRange }))
                  dispatch(fetchSalesSummary({ ...selectedScope, ...dateRange }))
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'revenue', name: 'Revenue' },
              { id: 'expenses', name: 'Expenses' },
              { id: 'profit-loss', name: 'Profit & Loss' },
              { id: 'forecasting', name: 'Forecasting' },
              { id: 'cash-flow', name: 'Cash Flow' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => dispatch(setActiveTab(tab.id))}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'revenue' && renderRevenueTab()}
        {activeTab === 'expenses' && renderExpensesTab()}
        {activeTab === 'profit-loss' && renderProfitLossTab()}
        {activeTab === 'forecasting' && renderForecastingTab()}
        {activeTab === 'cash-flow' && renderCashFlowTab()}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Ledger Entry Form */}
      {showLedgerForm && (
        <EntityFormDialog
          open={showLedgerForm}
          onClose={() => {
            dispatch(toggleLedgerForm())
            dispatch(clearSelectedData())
          }}
          title={`Add ${ledgerEntryType === 'debit' ? 'Expense' : 'Income'} Entry`}
          fields={ledgerEntryType === 'debit' ? debitEntryFields : creditEntryFields}
          validationSchema={ledgerEntrySchema}
          onSubmit={handleLedgerEntry}
          loading={loading}
          error={error}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Generate {reportType} Report
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                This feature will generate a detailed {reportType} report based on your selected filters.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => dispatch(toggleReportModal())}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Generate report logic here
                    dispatch(toggleReportModal())
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default FinancialDashboard
