'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../../../../utils/axios'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Download as DownloadIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingIcon,
  Inventory as InventoryIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import PermissionCheck from '../../../../components/auth/PermissionCheck'

const TransferReportsPage = () => {
  const { user: originalUser } = useSelector((state) => state.auth)
  
  // URL-based role switching (same as POS terminal)
  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)
  
  // Parse URL parameters for role simulation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const role = params.get('role')
      const scope = params.get('scope')
      const id = params.get('id')
      
      if (role && scope && id && originalUser?.role === 'ADMIN') {
        setUrlParams({ role, scope, id })
        setIsAdminMode(true)
      } else {
        setUrlParams({})
        setIsAdminMode(false)
      }
    }
  }, [originalUser])
  
  // Get effective user based on URL parameters
  const getEffectiveUser = useCallback((originalUser) => {
    if (!isAdminMode || !urlParams.role) {
      return originalUser
    }
    
    return {
      ...originalUser,
      role: urlParams.role.toUpperCase(),
      branchId: urlParams.scope === 'branch' ? parseInt(urlParams.id) : null,
      warehouseId: urlParams.scope === 'warehouse' ? parseInt(urlParams.id) : null,
      branchName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : null,
      warehouseName: urlParams.scope === 'warehouse' ? `Warehouse ${urlParams.id}` : null,
      isAdminMode: true,
      originalRole: originalUser.role,
      originalUser: originalUser
    }
  }, [isAdminMode, urlParams])
  
  // Get scope info
  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.role) {
      return null
    }
    
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`
    }
  }, [isAdminMode, urlParams])
  
  const user = getEffectiveUser(originalUser)
  const scopeInfo = getScopeInfo()
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    transferType: 'all',
    scopeType: 'all',
    scopeId: 'all'
  })

  // Load report data
  const loadReportData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      
      // Add filters
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.transferType !== 'all') params.append('transferType', filters.transferType)
      if (filters.scopeType !== 'all') params.append('fromScopeType', filters.scopeType)
      if (filters.scopeId !== 'all') params.append('fromScopeId', filters.scopeId)

      const response = await api.get(`/transfers?${params.toString()}`)
      
      if (response.data.success) {
        setReportData(response.data.data)
      }
    } catch (err) {
      console.error('Error loading report data:', err)
      setError(err.response?.data?.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) return

    const headers = [
      'Transfer #', 'Type', 'From', 'To', 'Status', 'Initiated By', 'Approved By',
      'Created Date', 'Expected Date', 'Actual Date', 'Notes'
    ]

    const csvContent = [
      headers.join(','),
      ...reportData.map(transfer => [
        transfer.transfer_no,
        transfer.transfer_type,
        transfer.from_scope_type === 'BRANCH' ? transfer.from_branch_name : transfer.from_warehouse_name,
        transfer.to_scope_type === 'BRANCH' ? transfer.to_branch_name : transfer.to_warehouse_name,
        transfer.status,
        transfer.initiated_by_name,
        transfer.approved_by_name || '',
        new Date(transfer.created_at).toLocaleDateString(),
        transfer.expected_date || '',
        transfer.actual_date || '',
        transfer.notes || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transfer-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Export to PDF
  const handleExportPDF = () => {
    // This would typically use a PDF generation library like jsPDF
    // For now, we'll use the browser's print functionality
    window.print()
  }

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'PENDING': 'warning',
      'APPROVED': 'info',
      'IN_TRANSIT': 'primary',
      'COMPLETED': 'success',
      'REJECTED': 'error',
      'CANCELLED': 'default'
    }
    return colors[status] || 'default'
  }

  // Get transfer type display
  const getTransferTypeDisplay = (type) => {
    const types = {
      'BRANCH_TO_BRANCH': 'Branch → Branch',
      'WAREHOUSE_TO_WAREHOUSE': 'Warehouse → Warehouse',
      'BRANCH_TO_WAREHOUSE': 'Branch → Warehouse',
      'WAREHOUSE_TO_BRANCH': 'Warehouse → Branch'
    }
    return types[type] || type
  }

  // Calculate summary statistics
  const calculateSummary = () => {
    if (!reportData) return null

    const total = reportData.length
    const pending = reportData.filter(t => t.status === 'PENDING').length
    const approved = reportData.filter(t => t.status === 'APPROVED').length
    const inTransit = reportData.filter(t => t.status === 'IN_TRANSIT').length
    const completed = reportData.filter(t => t.status === 'COMPLETED').length
    const rejected = reportData.filter(t => t.status === 'REJECTED').length

    return { total, pending, approved, inTransit, completed, rejected }
  }

  const summary = calculateSummary()

  // Render summary cards
  const renderSummaryCards = () => {
    if (!summary) return null

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Transfers
                  </Typography>
                  <Typography variant="h4">
                    {summary.total}
                  </Typography>
                </Box>
                <InventoryIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Pending
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {summary.pending}
                  </Typography>
                </Box>
                <TrendingIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Approved
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {summary.approved}
                  </Typography>
                </Box>
                <CheckCircleIcon color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    In Transit
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {summary.inTransit}
                  </Typography>
                </Box>
                <SendIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {summary.completed}
                  </Typography>
                </Box>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Rejected
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {summary.rejected}
                  </Typography>
                </Box>
                <CheckCircleIcon color="error" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  // Render detailed report table
  const renderDetailedReport = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )
    }

    if (!reportData || reportData.length === 0) {
      return (
        <Alert severity="info" sx={{ m: 2 }}>
          No transfer data found for the selected filters.
        </Alert>
      )
    }

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Transfer #</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Initiated By</TableCell>
              <TableCell>Approved By</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Expected</TableCell>
              <TableCell>Actual</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reportData.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {transfer.transfer_no}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {getTransferTypeDisplay(transfer.transfer_type)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {transfer.from_scope_type === 'BRANCH' 
                      ? transfer.from_branch_name 
                      : transfer.from_warehouse_name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {transfer.to_scope_type === 'BRANCH' 
                      ? transfer.to_branch_name 
                      : transfer.to_warehouse_name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={transfer.status} 
                    color={getStatusColor(transfer.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {transfer.initiated_by_name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {transfer.approved_by_name || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(transfer.created_at).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {transfer.expected_date ? new Date(transfer.expected_date).toLocaleDateString() : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {transfer.actual_date ? new Date(transfer.actual_date).toLocaleDateString() : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {transfer.notes || '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  return (
    <DashboardLayout>
      <RouteGuard>
        <PermissionCheck allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
          <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                Transfer Reports
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadReportData}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportCSV}
                  disabled={!reportData || reportData.length === 0}
                >
                  Export CSV
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={handleExportPDF}
                  disabled={!reportData || reportData.length === 0}
                >
                  Print PDF
                </Button>
              </Box>
            </Box>

            {/* Summary Cards */}
            {renderSummaryCards()}

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Report Filters
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="End Date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      label="Status"
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="APPROVED">Approved</MenuItem>
                      <MenuItem value="IN_TRANSIT">In Transit</MenuItem>
                      <MenuItem value="COMPLETED">Completed</MenuItem>
                      <MenuItem value="REJECTED">Rejected</MenuItem>
                      <MenuItem value="CANCELLED">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Transfer Type</InputLabel>
                    <Select
                      value={filters.transferType}
                      label="Transfer Type"
                      onChange={(e) => handleFilterChange('transferType', e.target.value)}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="BRANCH_TO_BRANCH">Branch → Branch</MenuItem>
                      <MenuItem value="WAREHOUSE_TO_WAREHOUSE">Warehouse → Warehouse</MenuItem>
                      <MenuItem value="BRANCH_TO_WAREHOUSE">Branch → Warehouse</MenuItem>
                      <MenuItem value="WAREHOUSE_TO_BRANCH">Warehouse → Branch</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            {/* Detailed Report */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Detailed Transfer Report
              </Typography>
              {renderDetailedReport()}
            </Paper>
          </Box>
        </PermissionCheck>
      </RouteGuard>
    </DashboardLayout>
  )
}

export default TransferReportsPage
