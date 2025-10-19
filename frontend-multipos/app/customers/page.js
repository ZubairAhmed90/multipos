'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import withAuth from '../../components/auth/withAuth'
import DashboardLayout from '../../components/layout/DashboardLayout'
import EntityFormDialog from '../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../components/crud/ConfirmationDialog'
import {
  fetchCustomers,
  fetchCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerTransactions,
  searchCustomers,
  getCustomerBalance,
  setActiveTab,
  setSelectedCustomer,
  setSearchTerm,
  setFilters,
  toggleCustomerForm,
  toggleTransactionModal,
  toggleAnalyticsModal,
  toggleDeleteConfirmation,
  clearSelectedData,
  clearSearchResults
} from '../store/slices/customersSlice'

// Validation schemas
const customerSchema = yup.object({
  name: yup.string().required('Customer name is required'),
  email: yup.string().email('Invalid email format').required('Email is required'),
  phone: yup.string().required('Phone number is required'),
  address: yup.string().required('Address is required'),
  customerType: yup.string().required('Customer type is required'),
  status: yup.string().required('Status is required'),
})

// Form fields configuration
const customerFields = [
  { name: 'name', label: 'Customer Name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone Number', type: 'text', required: true },
  { name: 'address', label: 'Address', type: 'textarea', required: true },
  { 
    name: 'customerType', 
    label: 'Customer Type', 
    type: 'select', 
    required: true,
    options: [
      { value: 'INDIVIDUAL', label: 'Individual' },
      { value: 'BUSINESS', label: 'Business' },
      { value: 'WHOLESALE', label: 'Wholesale' },
    ]
  },
  { 
    name: 'status', 
    label: 'Status', 
    type: 'select', 
    required: true,
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'INACTIVE', label: 'Inactive' },
      { value: 'SUSPENDED', label: 'Suspended' },
    ]
  },
]

function CustomersPage() {
  const dispatch = useDispatch()
  const {
    customers,
    selectedCustomer,
    customerTransactions,
    customerBalance,
    searchResults,
    searchTerm,
    filters,
    pagination,
    loading,
    error,
    activeTab,
    showCustomerForm,
    showTransactionModal,
    showAnalyticsModal,
    showDeleteConfirmation
  } = useSelector(state => state.customers)

  const [editingCustomer, setEditingCustomer] = useState(null)
  const [deleteCustomerId, setDeleteCustomerId] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchCustomers())
  }, [dispatch])

  // Handle Customer CRUD operations
  const handleCreateCustomer = (data) => {
    dispatch(createCustomer(data))
  }

  const handleUpdateCustomer = (data) => {
    dispatch(updateCustomer({ customerId: editingCustomer.id, data }))
    setEditingCustomer(null)
  }

  const handleDeleteCustomer = (customerId) => {
    dispatch(deleteCustomer(customerId))
    setDeleteCustomerId(null)
  }

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer)
    dispatch(toggleCustomerForm())
  }

  // Handle search functionality
  const handleSearch = (term) => {
    setSearchInput(term)
    if (term.length > 2) {
      dispatch(searchCustomers(term))
      setShowSearchResults(true)
    } else {
      setShowSearchResults(false)
      dispatch(clearSearchResults())
    }
  }

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    dispatch(setFilters({ [filterType]: value }))
    dispatch(fetchCustomers({ ...filters, [filterType]: value }))
  }

  // Handle customer selection
  const handleSelectCustomer = (customer) => {
    dispatch(setSelectedCustomer(customer))
    dispatch(fetchCustomer(customer.id))
    dispatch(fetchCustomerTransactions({ customerId: customer.id }))
    dispatch(getCustomerBalance(customer.id))
  }

  const renderCustomersTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
        <button
          onClick={() => dispatch(toggleCustomerForm())}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        >
          Add Customer
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      handleSelectCustomer(customer)
                      setShowSearchResults(false)
                      setSearchInput('')
                    }}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                  >
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-gray-600">{customer.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={filters.customerType}
            onChange={(e) => handleFilterChange('customerType', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="BUSINESS">Business</option>
            <option value="WHOLESALE">Wholesale</option>
          </select>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasBalance}
              onChange={(e) => handleFilterChange('hasBalance', e.target.checked)}
              className="mr-2"
            />
            Has Balance
          </label>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{customer.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{customer.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {customer.customerType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      customer.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      customer.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                    {customer.balance || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleSelectCustomer(customer)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditCustomer(customer)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteCustomerId(customer.id)
                        dispatch(toggleDeleteConfirmation())
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderTransactionsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Customer Transactions</h2>
        {selectedCustomer && (
          <div className="text-sm text-gray-600">
            Customer: <span className="font-medium">{selectedCustomer.name}</span>
          </div>
        )}
      </div>

      {!selectedCustomer ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">Please select a customer to view their transactions.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customerTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.balance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Customer Analytics</h2>
      </div>

      {/* Customer Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">C</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Customers</p>
              <p className="text-2xl font-semibold text-gray-900">{customers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Customers</p>
              <p className="text-2xl font-semibold text-gray-900">
                {customers.filter(c => c.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">B</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Business Customers</p>
              <p className="text-2xl font-semibold text-gray-900">
                {customers.filter(c => c.customerType === 'BUSINESS').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">$</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Balance</p>
              <p className="text-2xl font-semibold text-gray-900">
                {customers.reduce((sum, c) => sum + (c.balance || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Type Distribution */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Type Distribution</h3>
        <div className="space-y-3">
          {['INDIVIDUAL', 'BUSINESS', 'WHOLESALE'].map((type) => {
            const count = customers.filter(c => c.customerType === type).length
            const percentage = customers.length > 0 ? (count / customers.length) * 100 : 0
            return (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{type}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{count}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'customers', name: 'Customer Management' },
              { id: 'transactions', name: 'Transactions' },
              { id: 'analytics', name: 'Analytics' },
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
        {activeTab === 'customers' && renderCustomersTab()}
        {activeTab === 'transactions' && renderTransactionsTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}

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

      {/* Modals */}
      {showCustomerForm && (
        <EntityFormDialog
          open={showCustomerForm}
          onClose={() => {
            dispatch(toggleCustomerForm())
            setEditingCustomer(null)
          }}
          title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          fields={customerFields}
          validationSchema={customerSchema}
          initialData={editingCustomer}
          isEdit={!!editingCustomer}
          onSubmit={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
          loading={loading}
          error={error}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && (
        <ConfirmationDialog
          open={showDeleteConfirmation}
          onClose={() => {
            dispatch(toggleDeleteConfirmation())
            setDeleteCustomerId(null)
          }}
          title="Delete Customer"
          message="Are you sure you want to delete this customer? This action cannot be undone."
          onConfirm={() => handleDeleteCustomer(deleteCustomerId)}
          loading={loading}
          severity="error"
        />
      )}
    </DashboardLayout>
  )
}

export default CustomersPage
