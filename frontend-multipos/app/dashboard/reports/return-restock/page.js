'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
import { useSelector } from 'react-redux'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import api from '../../../../utils/axios'

const columns = [
  { field: 'date', headerName: 'Date', width: 130 },
  { field: 'scopeType', headerName: 'Scope Type', width: 120 },
  { field: 'scopeName', headerName: 'Scope', width: 180 },
  { field: 'invoiceNo', headerName: 'Invoice #', width: 130 },
  { field: 'sku', headerName: 'SKU', width: 120 },
  { field: 'itemName', headerName: 'Item', width: 200 },
  { field: 'returnedQty', headerName: 'Returned', width: 110 },
  { field: 'restockedQty', headerName: 'Restocked', width: 110 },
  { field: 'notRestockedQty', headerName: 'Not Restocked', width: 130 },
  { field: 'status', headerName: 'Status', width: 120 },
  { field: 'performedBy', headerName: 'Performed By', width: 160 },
]

export default function ReturnRestockReportPage() {
  const { user } = useSelector((state) => state.auth)

  const [filters, setFilters] = useState({
    scopeType: 'ALL',
    scopeId: '',
    status: 'ALL',
    search: '',
    from: '',
    to: '',
  })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.scopeType && filters.scopeType !== 'ALL') params.append('scopeType', filters.scopeType)
      if (filters.scopeId) params.append('scopeId', filters.scopeId)
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)
      if (filters.from) params.append('from', filters.from)
      if (filters.to) params.append('to', filters.to)

      const url = `/returns/restock${params.toString() ? `?${params.toString()}` : ''}`
      const res = await api.get(url)
      const data = res.data?.data || []
      // Normalize to grid rows
      setRows(
        data.map((r, idx) => ({
          id: r.id || idx + 1,
          date: r.date || r.created_at || '',
          scopeType: r.scope_type || r.scopeType || '',
          scopeName: r.scope_name || r.scopeName || '',
          invoiceNo: r.invoice_no || r.invoiceNo || '',
          sku: r.sku || '',
          itemName: r.item_name || r.itemName || '',
          returnedQty: Number(r.returned_qty ?? r.returnedQty ?? 0),
          restockedQty: Number(r.restocked_qty ?? r.restockedQty ?? 0),
          notRestockedQty: Number(r.not_restocked_qty ?? r.notRestockedQty ?? ((Number(r.returned_qty ?? 0)) - (Number(r.restocked_qty ?? 0)))),
          status: r.status || ((Number(r.restocked_qty ?? 0) === 0) ? 'PENDING' : (Number(r.restocked_qty ?? 0) < Number(r.returned_qty ?? 0) ? 'PARTIAL' : 'COMPLETED')),
          performedBy: r.performed_by || r.performedBy || '',
        }))
      )
    } catch (err) {
      // If backend route not ready, show friendly hint but don't crash
      setRows([])
      setError('Data not available yet. Please enable the /api/returns/restock endpoint on the backend.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4">Return Restock</Typography>
          <Typography variant="body2" color="text.secondary">Audit returns that were restocked, with scope and date filters.</Typography>
        </Box>

        {error && (
          <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Scope Type</InputLabel>
                <Select
                  label="Scope Type"
                  value={filters.scopeType}
                  onChange={(e) => setFilters({ ...filters, scopeType: e.target.value })}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="BRANCH">Branch</MenuItem>
                  <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label={filters.scopeType === 'WAREHOUSE' ? 'Warehouse ID/Name' : filters.scopeType === 'BRANCH' ? 'Branch ID/Name' : 'Scope'}
                value={filters.scopeId}
                onChange={(e) => setFilters({ ...filters, scopeId: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="PARTIAL">Partial</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="SKU / Item / Invoice / Search"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button variant="outlined" fullWidth onClick={loadData}>Apply</Button>
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 1 }}>
          <Box sx={{ height: 520 }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              slots={{ toolbar: GridToolbar }}
              initialState={{
                pagination: { paginationModel: { page: 0, pageSize: 10 } },
              }}
              pageSizeOptions={[10, 25, 50]}
            />
          </Box>
        </Paper>
      </DashboardLayout>
    </RouteGuard>
  )
}


