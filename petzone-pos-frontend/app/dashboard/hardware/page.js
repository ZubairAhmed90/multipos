'use client'

import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../hooks/useEntityCRUD'
import { fetchHardwareDevices, registerHardwareDevice, updateDeviceStatus, deleteHardwareDevice } from '../../store/slices/hardwareSlice'

// Validation schema
const hardwareSchema = yup.object({
  name: yup.string().required('Device name is required'),
  type: yup.string().required('Device type is required'),
  deviceId: yup.string().required('Device ID is required'),
  scopeType: yup.string().required('Scope type is required'),
  scopeId: yup.string().required('Scope Name is required'),
  terminalId: yup.string().optional(),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Device Name', width: 200 },
  { field: 'type', headerName: 'Type', width: 150 },
  { field: 'deviceId', headerName: 'Device ID', width: 150 },
  { field: 'scopeType', headerName: 'Scope Type', width: 120 },
  { field: 'scopeId', headerName: 'Scope ID', width: 100 },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 120,
    renderCell: (params) => {
      const colors = {
        ONLINE: 'green',
        OFFLINE: 'red',
        MAINTENANCE: 'orange',
        ERROR: 'red'
      }
      return (
        <span style={{ 
          color: colors[params.value] || 'black',
          fontWeight: 'bold'
        }}>
          {params.value}
        </span>
      )
    }
  },
  { field: 'lastActivity', headerName: 'Last Activity', width: 150 },
]

// Form fields configuration
const fields = [
  { name: 'name', label: 'Device Name', type: 'text', required: true },
  { 
    name: 'type', 
    label: 'Device Type', 
    type: 'select', 
    required: true,
    options: [
      { value: 'BARCODE_SCANNER', label: 'Barcode Scanner' },
      { value: 'RECEIPT_PRINTER', label: 'Receipt Printer' },
      { value: 'CASH_DRAWER', label: 'Cash Drawer' },
      { value: 'WEIGHING_SCALE', label: 'Weighing Scale' },
      { value: 'CUSTOMER_DISPLAY', label: 'Customer Display' },
      { value: 'OTHER', label: 'Other' },
    ]
  },
  { name: 'deviceId', label: 'Device ID', type: 'text', required: true },
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
  { name: 'scopeId', label: 'Scope Name', type: 'text', required: true },
  { name: 'terminalId', label: 'Terminal ID', type: 'text', required: false },
]

function HardwarePage() {
  const dispatch = useDispatch()
  const crud = useEntityCRUD('hardware', 'hardware device')
  
  // Get hardware devices from Redux state
  const hardwareDevices = useSelector(state => state.hardware?.devices || [])

  // Load data on component mount - fetch all devices for admin
  useEffect(() => {
    dispatch(fetchHardwareDevices({ scopeType: 'ALL', scopeId: 'ALL' }))
  }, [dispatch])

  // Handle CRUD operations
  const handleCreate = (data) => {
    dispatch(registerHardwareDevice(data))
  }

  const handleUpdate = (data) => {
    dispatch(updateDeviceStatus({ deviceId: crud.selectedEntity.deviceId, status: data.status }))
  }

  const handleDelete = () => {
    dispatch(deleteHardwareDevice(crud.selectedEntity.id))
  }

  return (
    <DashboardLayout>
      <EntityTable
        data={Array.isArray(hardwareDevices) ? hardwareDevices : []}
        loading={crud.loading}
        columns={columns}
        title="Hardware Management"
        entityName="Hardware Device"
        onAdd={crud.handleAdd}
        onEdit={crud.handleEdit}
        onDelete={crud.handleDeleteClick}
        error={crud.error}
      />

      <EntityFormDialog
        open={crud.formDialogOpen}
        onClose={crud.handleFormClose}
        title={crud.dialogTitle}
        fields={fields}
        validationSchema={hardwareSchema}
        initialData={crud.selectedEntity}
        isEdit={crud.isEdit}
        onSubmit={crud.handleFormSubmit}
        loading={crud.loading}
        error={crud.error}
      />

      <ConfirmationDialog
        open={crud.confirmationDialogOpen}
        onClose={crud.handleConfirmationClose}
        title={crud.confirmationTitle}
        message={crud.confirmationMessage}
        onConfirm={handleDelete}
        loading={crud.loading}
        severity="error"
      />
    </DashboardLayout>
  )
}

export default HardwarePage
