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
  fetchShifts,
  fetchShift,
  createShift,
  updateShift,
  deleteShift,
  fetchCurrentShift,
  fetchBranchShifts,
  assignUserToShift,
  removeUserFromShift,
  validatePOSAccess,
  startShift,
  endShift,
  fetchActiveShift,
  fetchRecentShiftSessions,
  setActiveTab,
  setSelectedShift,
  toggleShiftForm,
  toggleAssignmentForm,
  toggleReportModal,
  clearSelectedData
} from '../../store/slices/shiftsSlice'
import { fetchAllUsers } from '../../store/slices/adminSlice'

// Validation schemas
const shiftSchema = yup.object({
  name: yup.string().required('Shift name is required'),
  startTime: yup.string().required('Start time is required'),
  endTime: yup.string().required('End time is required'),
  branchId: yup.string().required('Branch is required'),
})

const assignmentSchema = yup.object({
  userId: yup.string().required('User is required'),
  assignedBy: yup.string().required('Assigned by is required'),
})

// Form fields configuration
const shiftFields = [
  { name: 'name', label: 'Shift Name', type: 'text', required: true },
  { name: 'startTime', label: 'Start Time', type: 'time', required: true },
  { name: 'endTime', label: 'End Time', type: 'time', required: true },
  { 
    name: 'branchId', 
    label: 'Branch', 
    type: 'select', 
    required: true,
    options: [
      { value: '1', label: 'Main Branch' },
      { value: '2', label: 'Branch 2' },
    ]
  },
]

// Dynamic assignment fields will be created in component

function ShiftsPage() {
  const dispatch = useDispatch()
  const { user, isAuthenticated } = useSelector((state) => state.auth)
  const {
    shifts,
    currentShift,
    activeShift,
    recentShiftSessions,
    selectedShift,
    branchShifts,
    userAssignments,
    posAccessValid,
    posAccessMessage,
    loading,
    error,
    activeTab,
    showShiftForm,
    showAssignmentForm,
    showReportModal
  } = useSelector((state) => state.shifts)
  const { users } = useSelector((state) => state.admin)

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [initialCash, setInitialCash] = useState('')
  const [finalCash, setFinalCash] = useState('')
  const [editingShift, setEditingShift] = useState(null)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationData, setConfirmationData] = useState(null)

  // Create dynamic assignment fields with real users
  const assignmentFields = [
    { 
      name: 'userId', 
      label: 'User', 
      type: 'select', 
      required: true,
      options: users?.map(user => ({
        value: user.id?.toString() || user._id?.toString(),
        label: `${user.username} (${user.role})`
      })) || []
    },
    { name: 'assignedBy', label: 'Assigned By', type: 'text', required: true },
  ]

  // Load data on component mount
  useEffect(() => {
    if (user && user.id && isAuthenticated) {
      dispatch(fetchShifts())
      dispatch(fetchCurrentShift())
      dispatch(fetchActiveShift({ cashierId: user.id }))
      dispatch(fetchRecentShiftSessions({ limit: 5 }))
      dispatch(validatePOSAccess())
      
      // Only fetch all users if user is admin or warehouse keeper (for user assignment)
      if (user.role === 'ADMIN' || user.role === 'WAREHOUSE_KEEPER') {
        dispatch(fetchAllUsers())
      }
    }
  }, [dispatch, user, isAuthenticated])

  // Load branch shifts when branch is selected
  useEffect(() => {
    if (selectedBranchId) {
      dispatch(fetchBranchShifts(selectedBranchId))
    }
  }, [selectedBranchId, dispatch])

  // Handle Shift CRUD operations
  const handleCreateShift = (data) => {
    dispatch(createShift(data))
    dispatch(toggleShiftForm())
  }

  const handleUpdateShift = (data) => {
    dispatch(updateShift({ shiftId: editingShift.id, data }))
    dispatch(toggleShiftForm())
    setEditingShift(null)
  }

  const handleDeleteShift = (shiftId) => {
    dispatch(deleteShift(shiftId))
    setShowConfirmation(false)
  }

  const handleEditShift = (shift) => {
    setEditingShift(shift)
    dispatch(toggleShiftForm())
  }

  // Handle User Assignment operations
  const handleAssignUser = (data) => {
    dispatch(assignUserToShift({ 
      shiftId: selectedShift.id, 
      userId: data.userId, 
      assignedBy: user.id 
    }))
    dispatch(toggleAssignmentForm())
  }

  const handleRemoveUser = (userId) => {
    dispatch(removeUserFromShift({ 
      shiftId: selectedShift.id, 
      userId 
    }))
  }

  // Handle Shift Start/End operations
  const handleStartShift = () => {
    if (user?.id && initialCash) {
      // For now, use shift ID 1 as default - in a real app, this would be selected from available shifts
      dispatch(startShift({ 
        shiftId: 1, // This should be selected from available shifts
        initialCash: parseFloat(initialCash) 
      }))
      setShowStartDialog(false)
      setInitialCash('')
    }
  }

  const handleEndShift = () => {
    if (activeShift?.id && finalCash) {
      dispatch(endShift({ 
        sessionId: activeShift.id, 
        finalCash: parseFloat(finalCash) 
      }))
      setShowEndDialog(false)
      setFinalCash('')
    }
  }

  const renderShiftsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Shift Management</h2>
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
            onClick={() => dispatch(toggleShiftForm())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            Create Shift
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.startTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.endTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shift.branch?.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      shift.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shift.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEditShift(shift)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedShift(shift)
                        dispatch(toggleAssignmentForm())
                      }}
                      className="text-green-600 hover:text-green-900"
                    >
                      Assign Users
                    </button>
                    <button
                      onClick={() => {
                        setConfirmationData({ type: 'delete', id: shift.id })
                        setShowConfirmation(true)
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

  const renderAssignmentsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">User Assignments</h2>
        <button
          onClick={() => dispatch(toggleAssignmentForm())}
          disabled={!selectedShift}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
        >
          Assign User
        </button>
      </div>

      {selectedShift && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-blue-900">Selected Shift: {selectedShift.name}</h3>
          <p className="text-blue-700">Time: {selectedShift.startTime} - {selectedShift.endTime}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userAssignments.map((assignment) => (
                <tr key={`${assignment.shiftId}-${assignment.userId}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assignment.user?.username || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assignment.shift?.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assignment.assignedBy?.username || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assignment.assignedAt}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleRemoveUser(assignment.userId)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Remove
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

  const renderCashierTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Cashier Operations</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => dispatch(validatePOSAccess())}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:ring-2 focus:ring-purple-500"
          >
            Validate POS Access
          </button>
        </div>
      </div>

      {/* POS Access Status */}
      <div className={`p-4 rounded-md ${posAccessValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <h3 className={`text-lg font-medium ${posAccessValid ? 'text-green-900' : 'text-red-900'}`}>
          POS Access Status
        </h3>
        <p className={posAccessValid ? 'text-green-700' : 'text-red-700'}>
          {posAccessMessage || (posAccessValid ? 'Access granted' : 'Access denied')}
        </p>
      </div>

      {/* Current Shift Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Shift Status</h3>
          {activeShift ? (
            <div className="space-y-2">
              {('activeShift data:', activeShift)}
              <p className="text-sm text-gray-600">Status: <span className="text-green-600 font-medium">Active</span></p>
              <p className="text-sm text-gray-600">Started: {new Date(activeShift.actual_start_time).toLocaleString()}</p>
              <p className="text-sm text-gray-600">Initial Cash: {activeShift.initial_cash}</p>
              <p className="text-sm text-gray-600">Current Cash: {activeShift.initial_cash}</p>
              <p className="text-sm text-gray-600">Total Sales: {activeShift.total_sales || 0}</p>
            </div>
          ) : (
            <p className="text-gray-500">No active shift</p>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Shift Actions</h3>
          <div className="space-y-3">
            {!activeShift ? (
              <button
                onClick={() => setShowStartDialog(true)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500"
              >
                Start Shift
              </button>
            ) : (
              <button
                onClick={() => setShowEndDialog(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500"
              >
                End Shift
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shift History */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Shifts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Initial Cash</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Cash</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentShiftSessions.length > 0 ? recentShiftSessions.map((session) => (
                <tr key={session.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(session.actual_start_time).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.actual_end_time ? new Date(session.actual_end_time).toLocaleString() : 'Active'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.initial_cash || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.final_cash || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{session.total_sales || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      session.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status === 'ACTIVE' ? 'Active' : 'Completed'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                    No recent shift sessions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
      <DashboardLayout>
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'shifts', name: 'Shift Management' },
              { id: 'assignments', name: 'User Assignments' },
              { id: 'cashier', name: 'Cashier Operations' },
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
        {activeTab === 'shifts' && renderShiftsTab()}
        {activeTab === 'assignments' && renderAssignmentsTab()}
        {activeTab === 'cashier' && renderCashierTab()}

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
      {showShiftForm && (
        <EntityFormDialog
          open={showShiftForm}
          onClose={() => {
            dispatch(toggleShiftForm())
            setEditingShift(null)
          }}
          title={editingShift ? 'Edit Shift' : 'Create Shift'}
          fields={shiftFields}
          validationSchema={shiftSchema}
          initialData={editingShift}
          isEdit={!!editingShift}
          onSubmit={editingShift ? handleUpdateShift : handleCreateShift}
          loading={loading}
          error={error}
        />
      )}

      {showAssignmentForm && (
        <EntityFormDialog
          open={showAssignmentForm}
          onClose={() => {
            dispatch(toggleAssignmentForm())
            setEditingAssignment(null)
          }}
          title="Assign User to Shift"
          fields={assignmentFields}
          validationSchema={assignmentSchema}
          initialData={editingAssignment}
          isEdit={!!editingAssignment}
          onSubmit={handleAssignUser}
          loading={loading}
          error={error}
        />
      )}

      {/* Start Shift Dialog */}
      <div className={`fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 ${showStartDialog ? 'block' : 'hidden'}`}>
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Start New Shift</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Cash Amount</label>
              <input
                type="number"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter initial cash amount"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the amount of cash in the drawer at the start of your shift</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowStartDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleStartShift}
                disabled={!initialCash || loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
              >
                Start Shift
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* End Shift Dialog */}
      <div className={`fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 ${showEndDialog ? 'block' : 'hidden'}`}>
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-medium text-gray-900 mb-4">End Current Shift</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Final Cash Amount</label>
              <input
                type="number"
                value={finalCash}
                onChange={(e) => setFinalCash(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter final cash amount"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the amount of cash in the drawer at the end of your shift</p>
            </div>
            {activeShift && (
              <div className="mb-4 p-3 bg-gray-100 rounded-md">
                <p className="text-sm text-gray-600">Initial Cash: {activeShift.initial_cash}</p>
                <p className="text-sm text-gray-600">Total Sales: {activeShift.total_sales || 0}</p>
                <p className="text-sm text-gray-600">Expected Cash: {(parseFloat(activeShift.initial_cash) + (parseFloat(activeShift.total_sales) || 0)).toFixed(2)}</p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEndDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEndShift}
                disabled={!finalCash || loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 disabled:bg-gray-400"
              >
                End Shift
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <ConfirmationDialog
          open={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          title="Confirm Action"
          message={`Are you sure you want to ${confirmationData?.type} this item?`}
          onConfirm={() => {
            if (confirmationData?.type === 'delete') {
              handleDeleteShift(confirmationData.id)
            }
          }}
          loading={loading}
          severity="error"
        />
      )}
    </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(ShiftsPage)