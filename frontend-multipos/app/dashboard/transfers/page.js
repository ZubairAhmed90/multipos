'use client'

import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as yup from 'yup'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import useEntityCRUD from '../../../hooks/useEntityCRUD'
import { fetchTransfers, createTransfer, updateTransfer, deleteTransfer } from '../../store/slices/transfersSlice'

// Validation schema
const transferSchema = yup.object({
  transferNumber: yup.string().required('Transfer number is required'),
  fromWarehouse: yup.string().required('From warehouse is required'),
  toWarehouse: yup.string().required('To warehouse is required'),
  product: yup.string().required('Product is required'),
  quantity: yup.number().required('Quantity is required').min(1, 'Quantity must be at least 1'),
  status: yup.string().required('Status is required'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'transferNumber', headerName: 'Transfer #', width: 150 },
  { field: 'fromWarehouse', headerName: 'From', width: 200 },
  { field: 'toWarehouse', headerName: 'To', width: 200 },
  { field: 'product', headerName: 'Product', width: 200 },
  { field: 'quantity', headerName: 'Quantity', width: 100, type: 'number' },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 120,
    renderCell: (params) => {
      const colors = {
        completed: 'green',
        pending: 'orange',
        'in-transit': 'blue',
        cancelled: 'red'
      }
      return (
        <span style={{
          color: colors[params.value] || 'black',
          fontWeight: 'bold'
        }}>
          {params.value ? params.value.replace('-', ' ').toUpperCase() : 'N/A'}
        </span>
      )
    }
  },
  { field: 'date', headerName: 'Date', width: 120 },
]

// Form fields configuration
const fields = [
  { name: 'transferNumber', label: 'Transfer Number', type: 'text', required: true },
  { name: 'fromWarehouse', label: 'From Warehouse', type: 'text', required: true },
  { name: 'toWarehouse', label: 'To Warehouse', type: 'text', required: true },
  { name: 'product', label: 'Product', type: 'text', required: true },
  { name: 'quantity', label: 'Quantity', type: 'number', required: true },
  { 
    name: 'status', 
    label: 'Status', 
    type: 'select', 
    required: true,
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'in-transit', label: 'In Transit' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ]
  },
]

function TransfersPage() {
  const dispatch = useDispatch()
  const crud = useEntityCRUD('transfers', 'transfer')

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchTransfers())
  }, [dispatch])

  // Handle CRUD operations
  const handleCreate = (data) => {
    dispatch(createTransfer(data))
  }

  const handleUpdate = (data) => {
    dispatch(updateTransfer({ id: crud.selectedEntity.id, data }))
  }

  const handleDelete = () => {
    dispatch(deleteTransfer(crud.selectedEntity.id))
  }

  return (
    <DashboardLayout>
      <EntityTable
        data={crud.data}
        loading={crud.loading}
        columns={columns}
        title="Transfers Management"
        entityName="Transfer"
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
        validationSchema={transferSchema}
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

export default TransfersPage
