'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import { Link } from '@mui/material'
import { PointOfSale as TerminalIcon } from '@mui/icons-material'
import {
  fetchPOS,
  fetchBranchPOS,
  createPOSTerminal,
  updatePOSTerminal,
  deletePOSTerminal,
  fetchPOSInventory,
  createTab,
  fetchActiveTabs,
  closeTab,
  fetchHeldBills,
  holdBill,
  resumeBill,
  completeBill,
  deleteHeldBill,
  setActiveTab,
  toggleInventoryModal
} from '../../store/slices/posSlice'

// Validation schemas
const posSchema = yup.object({
  name: yup.string().required('POS name is required'),
  code: yup.string().required('POS code is required'),
  scopeType: yup.string().required('Scope type is required'),
  scopeId: yup.string().required('Scope ID is required'),
})

const tabSchema = yup.object({
  tabNumber: yup.number().required('Tab number is required'),
  customerName: yup.string(),
  notes: yup.string(),
})

const heldBillSchema = yup.object({
  billNumber: yup.string().required('Bill number is required'),
  customerName: yup.string(),
  total: yup.number().min(0, 'Total must be positive'),
})

// Form fields configuration
const terminalFields = [
  { name: 'name', label: 'POS Name', type: 'text', required: true },
  { name: 'code', label: 'POS Code', type: 'text', required: true },
  { 
    name: 'scopeType', 
    label: 'Scope Type', 
    type: 'select', 
    required: true,
    options: [
      { value: 'BRANCH', label: 'Branch' },
      { value: 'WAREHOUSE', label: 'Warehouse' },
    ]
  },
  { name: 'scopeId', label: 'Scope ID', type: 'text', required: true },
]

const tabFields = [
  { name: 'tabNumber', label: 'Tab Number', type: 'number', required: true },
  { name: 'customerName', label: 'Customer Name', type: 'text', required: false },
  { name: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const heldBillFields = [
  { name: 'billNumber', label: 'Bill Number', type: 'text', required: true },
  { name: 'customerName', label: 'Customer Name', type: 'text', required: false },
  { name: 'total', label: 'Total Amount', type: 'number', required: true },
  { name: 'notes', label: 'Notes', type: 'textarea', required: false },
]

function POSPage() {
  const dispatch = useDispatch()
  const {
    terminals,
    inventory,
    inventoryLoading,
    inventoryError,
    activeTabs,
    heldBills,
    loading,
    error,
    activeTab,
    showInventoryModal
  } = useSelector(state => state.pos)

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedPOSId, setSelectedPOSId] = useState('')
  const [showTerminalForm, setShowTerminalForm] = useState(false)
  const [showTabForm, setShowTabForm] = useState(false)
  const [showHeldBillForm, setShowHeldBillForm] = useState(false)
  const [editingTerminal, setEditingTerminal] = useState(null)
  const [editingTab, setEditingTab] = useState(null)
  const [editingHeldBill, setEditingHeldBill] = useState(null)

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchPOS())
    dispatch(fetchHeldBills())
  }, [dispatch])

  // Load branch POS when branch is selected
  useEffect(() => {
    if (selectedBranchId) {
      dispatch(fetchBranchPOS(selectedBranchId))
    }
  }, [selectedBranchId, dispatch])

  // Load active tabs when POS is selected
  useEffect(() => {
    if (selectedPOSId) {
      dispatch(fetchActiveTabs(selectedPOSId))
    }
  }, [selectedPOSId, dispatch])

  // Handle POS Terminal CRUD operations
  const handleCreateTerminal = (data) => {
    dispatch(createPOSTerminal(data))
    setShowTerminalForm(false)
  }

  const handleUpdateTerminal = (data) => {
    dispatch(updatePOSTerminal({ id: editingTerminal.id, data }))
    setShowTerminalForm(false)
    setEditingTerminal(null)
  }

  const handleDeleteTerminal = (id) => {
    dispatch(deletePOSTerminal(id))
  }

  const handleEditTerminal = (terminal) => {
    setEditingTerminal(terminal)
    setShowTerminalForm(true)
  }

  // Handle Tab operations
  const handleCreateTab = (data) => {
    dispatch(createTab({ posId: selectedPOSId, tabData: data }))
    setShowTabForm(false)
  }

  const handleCloseTab = (tabId) => {
    dispatch(closeTab({ posId: selectedPOSId, tabId }))
  }

  const handleEditTab = (tab) => {
    setEditingTab(tab)
    setShowTabForm(true)
  }

  // Handle Held Bill operations
  const handleHoldBill = (data) => {
    dispatch(holdBill(data))
    setShowHeldBillForm(false)
  }

  const handleResumeBill = (billId) => {
    dispatch(resumeBill(billId))
  }

  const handleCompleteBill = (billId, paymentData) => {
    dispatch(completeBill({ billId, paymentData }))
  }

  const handleDeleteHeldBill = (billId) => {
    dispatch(deleteHeldBill(billId))
  }

  const handleEditHeldBill = (bill) => {
    setEditingHeldBill(bill)
    setShowHeldBillForm(true)
  }

  // Handle Inventory operations
  const handleViewInventory = (posId) => {
    dispatch(fetchPOSInventory(posId))
    dispatch(toggleInventoryModal())
  }

  const renderTerminalsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">POS Terminals</h2>
        <div className="flex space-x-4">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Branches</option>
            <option value="1">Main Branch</option>
            <option value="2">Branch 2</option>
          </select>
          <button
            onClick={() => setShowTerminalForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            Add POS Terminal
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">POS Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {terminals.map((terminal) => (
                <tr key={terminal.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{terminal.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{terminal.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{terminal.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{terminal.scopeType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{terminal.scopeId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{terminal.createdAt}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEditTerminal(terminal)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleViewInventory(terminal.id)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Inventory
                    </button>
                    <button
                      onClick={() => handleDeleteTerminal(terminal.id)}
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

  const renderTabsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Active Tabs</h2>
        <div className="flex space-x-4">
          <select
            value={selectedPOSId}
            onChange={(e) => setSelectedPOSId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select POS Terminal</option>
            {terminals.map((terminal) => (
              <option key={terminal.id} value={terminal.id}>
                {terminal.name} ({terminal.code})
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowTabForm(true)}
            disabled={!selectedPOSId}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
          >
            Create Tab
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tab ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tab #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTabs.map((tab) => (
                <tr key={tab.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tab.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tab.tabNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tab.customerName || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tab.subtotal || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tab.tax || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tab.total || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tab.createdAt}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEditTab(tab)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleCloseTab(tab.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Close
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

  const renderHeldBillsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Held Bills</h2>
        <button
          onClick={() => setShowHeldBillForm(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:ring-2 focus:ring-orange-500"
        >
          Hold Bill
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Held At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {heldBills.map((bill) => (
                <tr key={bill.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.billNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.customerName || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.total || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.heldAt}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEditHeldBill(bill)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleResumeBill(bill.id)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleCompleteBill(bill.id, {})}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => handleDeleteHeldBill(bill.id)}
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

  const renderInventoryModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">POS Inventory</h3>
            <button
              onClick={() => dispatch(toggleInventoryModal())}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {inventoryLoading ? (
            <div className="text-center py-4">Loading inventory...</div>
          ) : inventoryError ? (
            <div className="text-red-600 py-4">Error: {inventoryError}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.price}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <RouteGuard allowedRoles={['ADMIN', 'MANAGER', 'CASHIER']}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Terminal Access */}
          <div className="grid grid-cols-1 gap-6">
            {/* Multi-Tab Terminal */}
            <div className="bg-gradient-to-r from-green-500 to-teal-600 text-white p-6 rounded-lg shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">POS Terminal</h2>
                  <p className="text-green-100">Multi-tab terminal for multiple simultaneous sales</p>
                </div>
                <Link 
                  href="/dashboard/pos/terminal" 
                  className="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <TerminalIcon />
                  Open Terminal
                </Link>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'terminals', name: 'POS Terminals' },
              { id: 'tabs', name: 'Active Tabs' },
              { id: 'held-bills', name: 'Held Bills' },
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
        {activeTab === 'terminals' && renderTerminalsTab()}
        {activeTab === 'tabs' && renderTabsTab()}
        {activeTab === 'held-bills' && renderHeldBillsTab()}

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
      {showTerminalForm && (
        <EntityFormDialog
          open={showTerminalForm}
          onClose={() => {
            setShowTerminalForm(false)
            setEditingTerminal(null)
          }}
          title={editingTerminal ? 'Edit POS Terminal' : 'Create POS Terminal'}
          fields={terminalFields}
          validationSchema={posSchema}
          initialData={editingTerminal}
          isEdit={!!editingTerminal}
          onSubmit={editingTerminal ? handleUpdateTerminal : handleCreateTerminal}
          loading={loading}
          error={error}
        />
      )}

      {showTabForm && (
      <EntityFormDialog
          open={showTabForm}
          onClose={() => {
            setShowTabForm(false)
            setEditingTab(null)
          }}
          title={editingTab ? 'Edit Tab' : 'Create Tab'}
          fields={tabFields}
          validationSchema={tabSchema}
          initialData={editingTab}
          isEdit={!!editingTab}
          onSubmit={editingTab ? handleCreateTab : handleCreateTab}
          loading={loading}
          error={error}
        />
      )}

      {showHeldBillForm && (
        <EntityFormDialog
          open={showHeldBillForm}
          onClose={() => {
            setShowHeldBillForm(false)
            setEditingHeldBill(null)
          }}
          title={editingHeldBill ? 'Edit Held Bill' : 'Hold Bill'}
          fields={heldBillFields}
          validationSchema={heldBillSchema}
          initialData={editingHeldBill}
          isEdit={!!editingHeldBill}
          onSubmit={editingHeldBill ? handleHoldBill : handleHoldBill}
          loading={loading}
          error={error}
        />
      )}

      {/* Inventory Modal */}
      {showInventoryModal && renderInventoryModal()}
    </DashboardLayout>
    </RouteGuard>
  )
}

export default POSPage
