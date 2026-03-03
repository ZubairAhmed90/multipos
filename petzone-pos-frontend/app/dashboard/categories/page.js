'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material'
import { Add, Edit, Delete, Refresh } from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import api from '../../../utils/axios'

const CategoriesPage = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', status: 'ACTIVE' })
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/categories')
      setCategories(res.data?.data || res.data || [])
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Failed to load categories', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const openCreate = () => {
    setEditing(null)
    setFormData({ name: '', description: '', status: 'ACTIVE' })
    setDialogOpen(true)
  }

  const openEdit = (cat) => {
    setEditing(cat)
    setFormData({
      name: cat.name || '',
      description: cat.description || '',
      status: cat.status || 'ACTIVE'
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setToast({ open: true, message: 'Name is required', severity: 'warning' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, formData)
        setToast({ open: true, message: 'Category updated', severity: 'success' })
      } else {
        await api.post('/categories', formData)
        setToast({ open: true, message: 'Category created', severity: 'success' })
      }
      setDialogOpen(false)
      setEditing(null)
      loadCategories()
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Save failed', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!id) return
    setDeletingId(id)
    try {
      await api.delete(`/categories/${id}`)
      setToast({ open: true, message: 'Category deleted', severity: 'success' })
      loadCategories()
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Delete failed', severity: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditing(null)
  }

  const closeToast = () => setToast(prev => ({ ...prev, open: false }))

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            Categories
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadCategories}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openCreate}
            >
              Add Category
            </Button>
          </Box>
        </Box>

        <Card>
          <CardContent>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell>{cat.name}</TableCell>
                      <TableCell>{cat.description || '-'}</TableCell>
                      <TableCell>{cat.status || '-'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(cat)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(cat.id)}
                            color="error"
                            disabled={deletingId === cat.id}
                          >
                            {deletingId === cat.id ? <CircularProgress size={16} /> : <Delete />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No categories found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={3}
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status || 'ACTIVE'}
                  label="Status"
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={toast.open} autoHideDuration={4000} onClose={closeToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={closeToast} severity={toast.severity || 'info'} variant="filled" sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(CategoriesPage)

