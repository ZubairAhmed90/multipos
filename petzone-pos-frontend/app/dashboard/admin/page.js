'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import {
  fetchSystemDashboard,
  fetchAllBranches,
  fetchAllUsers,
  updateUser,
  fetchAllInventories,
  updateAnyInventory,
  fetchAllCompanies,
  fetchAllSales,
  fetchAllLedgers,
  setActiveTab,
  setFilters,
  setSelectedBranch,
  setSelectedUser,
  setSelectedInventory,
  setSelectedCompany,
  setSelectedSale,
  setSelectedLedger,
  setSelectedItems,
  toggleUserForm,
  toggleBranchForm,
  toggleInventoryForm,
  toggleCompanyForm,
  clearSelectedData
} from '../../store/slices/adminSlice'

// Validation schemas
const userUpdateSchema = yup.object({
  role: yup.string().required('Role is required'),
  branchId: yup.string(),
  warehouseId: yup.string(),
  status: yup.string().required('Status is required'),
})

const inventoryUpdateSchema = yup.object({
  name: yup.string().required('Name is required'),
  sku: yup.string().required('SKU is required'),
  barcode: yup.string(),
  category: yup.string().required('Category is required'),
  quantity: yup.number().min(0, 'Quantity must be non-negative').required('Quantity is required'),
  minLevel: yup.number().min(0, 'Min level must be non-negative').required('Min level is required'),
  purchasePrice: yup.number().min(0, 'Purchase price must be non-negative').required('Purchase price is required'),
  salePrice: yup.number().min(0, 'Sale price must be non-negative').required('Sale price is required'),
})

// Form fields configuration
const userUpdateFields = [
  { 
    name: 'role', 
    label: 'Role', 
    type: 'select', 
    required: true,
    options: [
      { value: 'ADMIN', label: 'Admin' },
      { value: 'WAREHOUSE_KEEPER', label: 'Warehouse Keeper' },
      { value: 'CASHIER', label: 'Cashier' },
    ]
  },
  { name: 'branchId', label: 'Branch ID', type: 'text' },
  { name: 'warehouseId', label: 'Warehouse ID', type: 'text' },
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

const inventoryUpdateFields = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'sku', label: 'SKU', type: 'text', required: true },
  { name: 'barcode', label: 'Barcode', type: 'text' },
  { name: 'category', label: 'Category', type: 'text', required: true },
  { name: 'quantity', label: 'Quantity', type: 'number', required: true },
  { name: 'minLevel', label: 'Min Level', type: 'number', required: true },
  { name: 'purchasePrice', label: 'Purchase Price', type: 'number', required: true },
  { name: 'salePrice', label: 'Sale Price', type: 'number', required: true },
]

const branchSettingsFields = [
  { name: 'openAccount', label: 'Open Account', type: 'checkbox' },
  { name: 'allowCashierInventoryEdit', label: 'Allow Cashier Inventory Edit', type: 'checkbox' },
  { name: 'allowWarehouseInventoryEdit', label: 'Allow Warehouse Inventory Edit', type: 'checkbox' },
  { name: 'allowWarehouseKeeperCompanyAdd', label: 'Allow Warehouse Keeper Company Add', type: 'checkbox' },
  { name: 'allowReturnsByCashier', label: 'Allow Returns by Cashier', type: 'checkbox' },
  { name: 'allowReturnsByWarehouseKeeper', label: 'Allow Returns by Warehouse Keeper', type: 'checkbox' },
  { name: 'autoProvisionPOS', label: 'Auto Provision POS', type: 'checkbox' },
  { name: 'autoProvisionInventory', label: 'Auto Provision Inventory', type: 'checkbox' },
  { name: 'autoProvisionLedger', label: 'Auto Provision Ledger', type: 'checkbox' },
]

function AdminDashboard() {
  const dispatch = useDispatch()
  const {
    systemDashboard,
    branches,
    selectedBranch,
    users,
    selectedUser,
    inventories,
    selectedInventory,
    companies,
    selectedCompany,
    sales,
    selectedSale,
    ledgers,
    selectedLedger,
    filters,
    pagination,
    loading,
    error,
    activeTab,
    showUserForm,
    showBranchForm,
    showInventoryForm,
    showCompanyForm,
    selectedItems
  } = useSelector(state => state.admin)

  const [editingUser, setEditingUser] = useState(null)
  const [editingInventory, setEditingInventory] = useState(null)
  const [editingBranch, setEditingBranch] = useState(null)

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchSystemDashboard())
    dispatch(fetchAllBranches())
    dispatch(fetchAllUsers())
    dispatch(fetchAllInventories())
    dispatch(fetchAllCompanies())
    dispatch(fetchAllSales())
    dispatch(fetchAllLedgers())
  }, [dispatch])

  // Handle user update
  const handleUpdateUser = (data) => {
    dispatch(updateUser({ userId: editingUser._id, userData: data }))
    setEditingUser(null)
  }

  // Handle inventory update
  const handleUpdateInventory = (data) => {
    dispatch(updateAnyInventory({ inventoryId: editingInventory._id, inventoryData: data }))
    setEditingInventory(null)
  }

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    dispatch(setFilters({ [filterType]: value }))
    
    // Refetch data based on filter
    switch (activeTab) {
      case 'users':
        dispatch(fetchAllUsers({ [filterType]: value }))
        break
      case 'inventory':
        dispatch(fetchAllInventories({ [filterType]: value }))
        break
      case 'companies':
        dispatch(fetchAllCompanies({ [filterType]: value }))
        break
      case 'sales':
        dispatch(fetchAllSales({ [filterType]: value }))
        break
      case 'ledgers':
        dispatch(fetchAllLedgers({ [filterType]: value }))
        break
      default:
        break
    }
  }

  const renderDashboardTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">System Dashboard</h2>
      
      {systemDashboard && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">B</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Branches</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {systemDashboard.overview?.totalBranches || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">W</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Warehouses</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {systemDashboard.overview?.totalWarehouses || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">U</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Users</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {systemDashboard.overview?.totalUsers || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">I</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Inventory</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {systemDashboard.overview?.totalInventoryItems || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Sales</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Total Sales: {systemDashboard.overview?.monthlySales || 0}</p>
                <p className="text-sm text-gray-600">Revenue: {systemDashboard.overview?.monthlySalesTotal?.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Yearly Sales</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Total Sales: {systemDashboard.overview?.yearlySales || 0}</p>
                <p className="text-sm text-gray-600">Revenue: {systemDashboard.overview?.yearlySalesTotal?.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Total Companies: {systemDashboard.overview?.totalCompanies || 0}</p>
                <p className="text-sm text-gray-600">Total Sales: {systemDashboard.overview?.totalSales || 0}</p>
              </div>
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <h3 className="text-lg font-medium text-gray-900 p-6 border-b">Recent Sales</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cashier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {systemDashboard.recentSales?.map((sale) => (
                    <tr key={sale._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.branch?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.company?.name || 'Walk-in'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.cashierId?.username || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.total?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock Items */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <h3 className="text-lg font-medium text-gray-900 p-6 border-b">Low Stock Items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Level</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {systemDashboard.lowStockItems?.map((item) => (
                    <tr key={item._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.scope?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.minLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <div className="flex space-x-2">
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="WAREHOUSE_KEEPER">Warehouse Keeper</option>
            <option value="CASHIER">Cashier</option>
          </select>
          <button
            onClick={() => dispatch(toggleUserForm())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.username}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.branchId?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      user.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setEditingUser(user)
                        dispatch(toggleUserForm())
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
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

  const renderBranchesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Branch Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => dispatch(toggleBranchForm())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            Add Branch
          </button>
        </div>
      </div>

      {/* Branches Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {branches.map((branch) => (
                <tr key={branch._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{branch.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {branch.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {branch.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {branch.linkedWarehouse?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setEditingBranch(branch)
                        dispatch(toggleBranchForm())
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
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

  const renderInventoryTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
        <div className="flex space-x-2">
          <select
            value={filters.scopeType}
            onChange={(e) => handleFilterChange('scopeType', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Scopes</option>
            <option value="BRANCH">Branch</option>
            <option value="WAREHOUSE">Warehouse</option>
          </select>
          <button
            onClick={() => dispatch(toggleInventoryForm())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            Add Item
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventories.map((inventory) => (
                <tr key={inventory._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{inventory.name}</div>
                    <div className="text-sm text-gray-500">{inventory.barcode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {inventory.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {inventory.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      inventory.quantity <= inventory.minLevel ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {inventory.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {inventory.salePrice?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {inventory.scope?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setEditingInventory(inventory)
                        dispatch(toggleInventoryForm())
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
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

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard' },
              { id: 'users', name: 'Users' },
              { id: 'branches', name: 'Branches' },
              { id: 'inventory', name: 'Inventory' },
              { id: 'companies', name: 'Companies' },
              { id: 'sales', name: 'Sales' },
              { id: 'ledgers', name: 'Ledgers' },
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
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'branches' && renderBranchesTab()}
        {activeTab === 'inventory' && renderInventoryTab()}

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
      {showUserForm && (
        <EntityFormDialog
          open={showUserForm}
          onClose={() => {
            dispatch(toggleUserForm())
            setEditingUser(null)
          }}
          title={editingUser ? 'Edit User' : 'Add New User'}
          fields={userUpdateFields}
          validationSchema={userUpdateSchema}
          initialData={editingUser}
          isEdit={!!editingUser}
          onSubmit={handleUpdateUser}
          loading={loading}
          error={error}
        />
      )}

      {showInventoryForm && (
        <EntityFormDialog
          open={showInventoryForm}
          onClose={() => {
            dispatch(toggleInventoryForm())
            setEditingInventory(null)
          }}
          title={editingInventory ? 'Edit Inventory Item' : 'Add New Inventory Item'}
          fields={inventoryUpdateFields}
          validationSchema={inventoryUpdateSchema}
          initialData={editingInventory}
          isEdit={!!editingInventory}
          onSubmit={handleUpdateInventory}
          loading={loading}
          error={error}
        />
      )}

    </DashboardLayout>
    </RouteGuard>
  )
}

export default AdminDashboard
