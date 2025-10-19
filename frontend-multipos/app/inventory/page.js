'use client'

import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as yup from 'yup'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'
import withAuth from '../../components/auth/withAuth'
import ResponsiveLayout from '../../components/layout/ResponsiveLayout'
import EntityFormDialog from '../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../components/crud/ConfirmationDialog'
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../store/slices/inventorySlice'

// Validation schema
const inventorySchema = yup.object({
  name: yup.string().required('Product name is required'),
  category: yup.string().required('Category is required'),
  sku: yup.string().required('SKU is required'),
  sellingPrice: yup.number().required('Price is required').min(0, 'Price must be positive'),
  currentStock: yup.number().required('Stock is required').min(0, 'Stock cannot be negative'),
  minStockLevel: yup.number().required('Minimum stock is required').min(0, 'Minimum stock cannot be negative'),
})

// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Product Name', width: 200 },
  { field: 'category', headerName: 'Category', width: 120 },
  { field: 'sku', headerName: 'SKU', width: 120 },
  { field: 'sellingPrice', headerName: 'Price', width: 100, type: 'number', renderCell: (params) => `${params.value}` },
  { field: 'currentStock', headerName: 'Stock', width: 80, type: 'number' },
  { field: 'minStockLevel', headerName: 'Min Stock', width: 100, type: 'number' },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 120,
    renderCell: (params) => {
      const colors = {
        active: 'green',
        'low-stock': 'orange',
        'out-of-stock': 'red'
      }
      return (
        <span style={{ 
          color: colors[params.value] || 'black',
          fontWeight: 'bold'
        }}>
          {params.value.replace('-', ' ').toUpperCase()}
        </span>
      )
    }
  },
  { field: 'createdAt', headerName: 'Created', width: 120 },
]

// Form fields configuration
const fields = [
  { name: 'name', label: 'Product Name', type: 'text', required: true },
  { 
    name: 'category', 
    label: 'Category', 
    type: 'select', 
    required: true,
    options: [
      { value: 'Electronics', label: 'Electronics' },
      { value: 'Furniture', label: 'Furniture' },
      { value: 'Appliances', label: 'Appliances' },
      { value: 'Office Supplies', label: 'Office Supplies' },
      { value: 'Other', label: 'Other' },
    ]
  },
  { name: 'sku', label: 'SKU', type: 'text', required: true },
  { name: 'sellingPrice', label: 'Selling Price', type: 'number', required: true, step: 0.01 },
  { name: 'currentStock', label: 'Current Stock', type: 'number', required: true },
  { name: 'minStockLevel', label: 'Minimum Stock Level', type: 'number', required: true },
]

function InventoryPage() {
  const dispatch = useDispatch()
  const { data: inventory, loading, error } = useSelector((state) => state.inventory)
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [isEdit, setIsEdit] = useState(false)

  // Load data on component mount
  useEffect(() => {
    dispatch(fetchInventory())
  }, [dispatch])

  // Handle CRUD operations
  const handleAdd = () => {
    setSelectedEntity(null)
    setIsEdit(false)
    setFormDialogOpen(true)
  }

  const handleEdit = (entity) => {
    setSelectedEntity(entity)
    setIsEdit(true)
    setFormDialogOpen(true)
  }

  const handleDeleteClick = (entity) => {
    setSelectedEntity(entity)
    setConfirmationDialogOpen(true)
  }

  const handleFormClose = () => {
    setFormDialogOpen(false)
    setSelectedEntity(null)
    setIsEdit(false)
  }

  const handleConfirmationClose = () => {
    setConfirmationDialogOpen(false)
    setSelectedEntity(null)
  }

  const handleCreate = async (data) => {
    try {
      const result = await dispatch(createInventoryItem(data))
      if (createInventoryItem.fulfilled.match(result)) {
        handleFormClose()
        dispatch(fetchInventory())
      }
    } catch (error) {
      console.error('Error creating inventory item:', error)
    }
  }

  const handleUpdate = async (data) => {
    try {
      const result = await dispatch(updateInventoryItem({ id: selectedEntity.id, data }))
      if (updateInventoryItem.fulfilled.match(result)) {
        handleFormClose()
        dispatch(fetchInventory())
      }
    } catch (error) {
      console.error('Error updating inventory item:', error)
    }
  }

  const handleDelete = async () => {
    try {
      const result = await dispatch(deleteInventoryItem(selectedEntity.id))
      if (deleteInventoryItem.fulfilled.match(result)) {
        handleConfirmationClose()
        dispatch(fetchInventory())
      }
    } catch (error) {
      console.error('Error deleting inventory item:', error)
    }
  }

  const handleFormSubmit = (formData) => {
    if (isEdit) {
      handleUpdate(formData)
    } else {
      handleCreate(formData)
    }
  }

  const getItemStatus = (item) => {
    const currentStock = parseInt(item.currentStock || 0)
    const minStockLevel = parseInt(item.minStockLevel || 0)
    
    if (currentStock === 0) return 'out-of-stock'
    if (currentStock <= minStockLevel) return 'low-stock'
    return 'active'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success'
      case 'low-stock': return 'warning'
      case 'out-of-stock': return 'error'
      default: return 'default'
    }
  }

  return (
    <ResponsiveLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Inventory Management</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            Add Item
          </Button>
        </Box>

        {/* Simple Inventory Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Inventory Items ({inventory?.length || 0})
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Product Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Stock</TableCell>
                      <TableCell align="right">Sold</TableCell>
                      <TableCell align="right">Returned</TableCell>
                      <TableCell align="right">Purchased</TableCell>
                      <TableCell align="right">Min Stock</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(inventory || []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Chip label={item.category} size="small" />
                        </TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell align="right">${parseFloat(item.sellingPrice || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={parseInt(item.currentStock || 0)} 
                            size="small" 
                            color={
                              parseInt(item.currentStock || 0) === 0 ? 'error' : 
                              parseInt(item.currentStock || 0) <= parseInt(item.minStockLevel || 0) ? 'warning' : 'success'
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={parseInt(item.totalSold || 0)} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={parseInt(item.totalReturned || 0)} 
                            size="small" 
                            color="warning"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={parseInt(item.totalPurchased || 0)} 
                            size="small" 
                            color="success"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">{parseInt(item.minStockLevel || 0)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={getItemStatus(item).replace('-', ' ').toUpperCase()} 
                            color={getStatusColor(getItemStatus(item))}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(item)}
                                color="primary"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(item)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

      <EntityFormDialog
          open={formDialogOpen}
          onClose={handleFormClose}
          title={isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}
        fields={fields}
        validationSchema={inventorySchema}
          initialData={selectedEntity}
          isEdit={isEdit}
          onSubmit={handleFormSubmit}
          loading={loading}
          error={error}
      />

      <ConfirmationDialog
          open={confirmationDialogOpen}
          onClose={handleConfirmationClose}
          title="Delete Inventory Item"
          message="Are you sure you want to delete this inventory item? This action cannot be undone."
        onConfirm={handleDelete}
          loading={loading}
        severity="error"
      />
      </Box>
    </ResponsiveLayout>
  )
}

export default withAuth(InventoryPage)
