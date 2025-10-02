'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityTable from '../../../components/crud/EntityTable'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import { fetchBilling, createBillingRecord, updateBillingRecord, deleteBillingRecord } from '../../store/slices/billingSlice'

// Validation schema
const billingSchema = yup.object({
  invoiceNumber: yup.string().nullable(),
  clientName: yup.string().required('Client name is required'),
  clientEmail: yup.string().nullable().email('Invalid email format'),
  clientPhone: yup.string().nullable(),
  clientAddress: yup.string().nullable(),
  amount: yup.number().nullable().min(0, 'Amount must be non-negative'),
  tax: yup.number().nullable().min(0, 'Tax must be non-negative'),
  discount: yup.number().nullable().min(0, 'Discount must be non-negative'),
  dueDate: yup.string().nullable(),
  service: yup.string().nullable(),
  description: yup.string().nullable(),
  status: yup.string().nullable(),
  paymentMethod: yup.string().nullable(),
  paymentDate: yup.string().nullable(),
  notes: yup.string().nullable(),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'invoiceNumber', headerName: 'Invoice #', width: 150 },
  { field: 'clientName', headerName: 'Client', width: 200 },
  { field: 'clientEmail', headerName: 'Email', width: 180 },
  { field: 'amount', headerName: 'Amount', width: 100, type: 'number', renderCell: (params) => `$${params.value ? params.value.toFixed(2) : '0.00'}` },
  { field: 'tax', headerName: 'Tax', width: 80, type: 'number', renderCell: (params) => `$${params.value ? params.value.toFixed(2) : '0.00'}` },
  { field: 'discount', headerName: 'Discount', width: 90, type: 'number', renderCell: (params) => `$${params.value ? params.value.toFixed(2) : '0.00'}` },
  { field: 'total', headerName: 'Total', width: 100, type: 'number', renderCell: (params) => `$${params.value ? params.value.toFixed(2) : '0.00'}` },
  { field: 'service', headerName: 'Service', width: 200 },
  { field: 'dueDate', headerName: 'Due Date', width: 120 },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 120,
    renderCell: (params) => {
      const colors = {
        paid: 'green',
        pending: 'orange',
        overdue: 'red',
        cancelled: 'gray'
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
]

// Form fields configuration
const fields = [
  { name: 'invoiceNumber', label: 'Invoice Number', type: 'text', required: false, placeholder: 'Auto-generated if empty' },
  { name: 'clientName', label: 'Client Name', type: 'text', required: true },
  { name: 'clientEmail', label: 'Client Email', type: 'email', required: false },
  { name: 'clientPhone', label: 'Client Phone', type: 'text', required: false },
  { name: 'clientAddress', label: 'Client Address', type: 'textarea', required: false },
  { name: 'amount', label: 'Amount', type: 'number', required: false, step: 0.01, defaultValue: 0 },
  { name: 'tax', label: 'Tax', type: 'number', required: false, step: 0.01, defaultValue: 0 },
  { name: 'discount', label: 'Discount', type: 'number', required: false, step: 0.01, defaultValue: 0 },
  { name: 'dueDate', label: 'Due Date', type: 'date', required: false },
  { name: 'service', label: 'Service', type: 'text', required: false },
  { name: 'description', label: 'Description', type: 'textarea', required: false },
  { 
    name: 'status', 
    label: 'Status', 
    type: 'select', 
    required: false,
    defaultValue: 'pending',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'paid', label: 'Paid' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'cancelled', label: 'Cancelled' },
    ]
  },
  { 
    name: 'paymentMethod', 
    label: 'Payment Method', 
    type: 'select', 
    required: false,
    options: [
      { value: 'CASH', label: 'Cash' },
      { value: 'CARD', label: 'Card' },
      { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
      { value: 'MOBILE_PAYMENT', label: 'Mobile Payment' },
    ]
  },
  { name: 'paymentDate', label: 'Payment Date', type: 'date', required: false },
  { name: 'notes', label: 'Notes', type: 'textarea', required: false },
]

function BillingPage() {
  const dispatch = useDispatch()
  const { data: billing, loading, error } = useSelector((state) => state.billing)
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [isEdit, setIsEdit] = useState(false)

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchBilling())
  }, [dispatch])

  // Transform billing data for form
  const transformBillingForForm = (billingRecord) => {
    if (!billingRecord) return null;
    
    return {
      invoiceNumber: billingRecord.invoiceNumber || null,
      clientName: billingRecord.clientName || null,
      clientEmail: billingRecord.clientEmail || null,
      clientPhone: billingRecord.clientPhone || null,
      clientAddress: billingRecord.clientAddress || null,
      amount: billingRecord.amount || null,
      tax: billingRecord.tax || null,
      discount: billingRecord.discount || null,
      dueDate: billingRecord.dueDate ? billingRecord.dueDate.split('T')[0] : null,
      service: billingRecord.service || null,
      description: billingRecord.description || null,
      status: billingRecord.status || null,
      paymentMethod: billingRecord.paymentMethod || null,
      paymentDate: billingRecord.paymentDate ? billingRecord.paymentDate.split('T')[0] : null,
      notes: billingRecord.notes || null
    };
  };

  // Form dialog handlers
  const handleAdd = () => {
    setSelectedEntity(null)
    setIsEdit(false)
    setFormDialogOpen(true)
  }

  const handleEdit = (entity) => {
    
    // Store the original entity (with ID) for the update
    setSelectedEntity(entity)
    setIsEdit(true)
    setFormDialogOpen(true)
    
  }

  const handleFormClose = () => {
    setFormDialogOpen(false)
    setSelectedEntity(null)
    setIsEdit(false)
  }

  // Confirmation dialog handlers
  const handleDeleteClick = (entity) => {
    setSelectedEntity(entity)
    setConfirmationDialogOpen(true)
  }

  const handleConfirmationClose = () => {
    setConfirmationDialogOpen(false)
    setSelectedEntity(null)
  }

  // Handle CRUD operations
  const handleCreate = async (data) => {
    try {
      
      // Check if data is null or undefined
      if (!data) {
        alert('No data provided for create.');
        return;
      }
      
      // Clean the data - remove empty strings and convert to null
      const cleanedData = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        
        // Skip invoice number if it's empty or auto-generated - let backend generate it
        if (key === 'invoiceNumber' && (value === '' || value === undefined || value === null || value.startsWith('INV-1758131176193'))) {
          return; // Skip this field entirely
        }
        
        if (value === '' || value === undefined) {
          cleanedData[key] = null;
        } else if (key === 'dueDate' || key === 'paymentDate') {
          // Convert date to YYYY-MM-DD format
          if (value && typeof value === 'string') {
            // Handle different date formats
            let dateStr = value;
            if (dateStr.includes('/')) {
              // Convert DD/MM/YYYY to YYYY-MM-DD
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
              // Convert DD-MM-YYYY to YYYY-MM-DD
              const parts = dateStr.split('-');
              if (parts.length === 3 && parts[0].length === 2) {
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
            cleanedData[key] = dateStr;
          } else {
            cleanedData[key] = value;
          }
        } else {
          cleanedData[key] = value;
        }
      });
      
      
      const result = await dispatch(createBillingRecord(cleanedData))
      if (createBillingRecord.fulfilled.match(result)) {
        handleFormClose()
        dispatch(fetchBilling()) // Refresh data
      } else if (createBillingRecord.rejected.match(result)) {
('Frontend: Create rejected:', result.payload);
        alert('Failed to create billing record: ' + result.payload)
      }
    } catch (error) {
      console.error('Frontend: Create error:', error);
      alert('Error creating billing record: ' + error.message)
    }
  }

  const handleUpdate = async (data) => {
    try {
('Frontend: Starting billing update...');
('Frontend: Selected entity ID:', selectedEntity?.id);
('Frontend: Raw form data:', data);
('Frontend: Data type:', typeof data);
('Frontend: Data keys:', Object.keys(data || {}));
      
      // Validate data before sending
      if (!selectedEntity?.id) {
        throw new Error('No billing record selected for update');
      }
      
      // Check if data is null or undefined
      if (!data) {
('Frontend: No data provided, skipping update');
        alert('No data provided for update.');
        return;
      }
      
      // Clean the data - remove empty strings and convert to null
      const cleanedData = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (value === '' || value === undefined) {
          cleanedData[key] = null;
        } else if (key === 'dueDate' || key === 'paymentDate') {
          // Convert date to YYYY-MM-DD format
          if (value && typeof value === 'string') {
            // Handle different date formats
            let dateStr = value;
            if (dateStr.includes('/')) {
              // Convert DD/MM/YYYY to YYYY-MM-DD
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
              // Convert DD-MM-YYYY to YYYY-MM-DD
              const parts = dateStr.split('-');
              if (parts.length === 3 && parts[0].length === 2) {
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
            cleanedData[key] = dateStr;
          } else {
            cleanedData[key] = value;
          }
        } else {
          cleanedData[key] = value;
        }
      });
      
      
      // Check if cleaned data is empty
      if (Object.keys(cleanedData).length === 0) {
('Frontend: No data to update, skipping API call');
        alert('No changes detected. Please make some changes before saving.');
        return;
      }
      
('Frontend: About to dispatch updateBillingRecord...');
('Frontend: Sending ID:', selectedEntity.id);
('Frontend: Sending data:', cleanedData);
      const result = await dispatch(updateBillingRecord({ id: selectedEntity.id, data: cleanedData }))
      
('Frontend: Update result:', result);
      
      if (updateBillingRecord.fulfilled.match(result)) {
('Frontend: Update successful');
        handleFormClose()
        dispatch(fetchBilling()) // Refresh data
      } else if (updateBillingRecord.rejected.match(result)) {
('Frontend: Update rejected:', result.payload);
        alert('Failed to update billing record: ' + result.payload)
      }
    } catch (error) {
      console.error('Frontend: Update error:', error);
      alert('Error updating billing record: ' + error.message)
    }
  }

  const handleDelete = async () => {
    try {
      const result = await dispatch(deleteBillingRecord(selectedEntity.id))
      if (deleteBillingRecord.fulfilled.match(result)) {
        handleConfirmationClose()
        dispatch(fetchBilling()) // Refresh data
      } else if (deleteBillingRecord.rejected.match(result)) {
        alert('Failed to delete billing record: ' + result.payload)
      }
    } catch (error) {
      alert('Error deleting billing record: ' + error.message)
    }
  }

  // Combined form submit handler
  const handleFormSubmit = (formData) => {
('Frontend: handleFormSubmit called with:', formData);
('Frontend: Form data type:', typeof formData);
('Frontend: Form data keys:', Object.keys(formData || {}));
('Frontend: Is edit mode:', isEdit);
    
    if (isEdit) {
      handleUpdate(formData)
    } else {
      handleCreate(formData)
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'MANAGER', 'CASHIER']}>
      <DashboardLayout>
        <EntityTable
          data={billing || []}
          loading={loading}
          columns={columns}
          title="Billing Management"
          entityName="Billing Record"
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          error={error}
        />

        <EntityFormDialog
          open={formDialogOpen}
          onClose={handleFormClose}
          title={isEdit ? 'Edit Billing Record' : 'Add Billing Record'}
          fields={fields}
          validationSchema={billingSchema}
          initialData={isEdit ? transformBillingForForm(selectedEntity) : selectedEntity}
          isEdit={isEdit}
          onSubmit={handleFormSubmit}
          loading={loading}
          error={error}
        />

        <ConfirmationDialog
          open={confirmationDialogOpen}
          onClose={handleConfirmationClose}
          title="Delete Billing Record"
          message="Are you sure you want to delete this billing record? This action cannot be undone."
          onConfirm={handleDelete}
          loading={loading}
          severity="error"
        />
      </DashboardLayout>
    </RouteGuard>
  )
}

export default BillingPage
