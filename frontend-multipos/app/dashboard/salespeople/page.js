'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  GetApp as ExportIcon,
  FileDownload as DownloadIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon
} from '@mui/icons-material'
import { useSelector } from 'react-redux'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import api from '../../../utils/axios'
import SalespersonForm from '../../../components/salesperson/SalespersonForm'

const SalespeoplePage = () => {
  const { user } = useSelector((state) => state.auth)
  const [salespeople, setSalespeople] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedSalesperson, setSelectedSalesperson] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [salespersonToDelete, setSalespersonToDelete] = useState(null)
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null)
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  // Load salespeople and warehouses
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load salespeople
      const salespeopleResponse = await api.get('/salespeople')
      if (salespeopleResponse.data.success) {
        setSalespeople(salespeopleResponse.data.data)
      }

      // Load warehouses (only for admin)
      if (user?.role === 'ADMIN') {
        const warehousesResponse = await api.get('/warehouses')
        if (warehousesResponse.data.success) {
          setWarehouses(warehousesResponse.data.data)
        }
      } else if (user?.role === 'WAREHOUSE_KEEPER') {
        // For warehouse keepers, set their warehouse
        console.log('🔧 Setting warehouses for warehouse keeper:', {
          id: user.warehouseId,
          name: user.warehouseName,
          code: user.warehouseCode
        })
        setWarehouses([{
          id: user.warehouseId,
          name: user.warehouseName,
          code: user.warehouseCode
        }])
      }

    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Debug warehouses state changes
  useEffect(() => {
    console.log('🔧 Warehouses state changed:', warehouses)
  }, [warehouses])

  const handleAddSalesperson = () => {
    setSelectedSalesperson(null)
    setFormOpen(true)
  }

  const handleEditSalesperson = (salesperson) => {
    setSelectedSalesperson(salesperson)
    setFormOpen(true)
  }

  const handleDeleteSalesperson = (salesperson) => {
    setSalespersonToDelete(salesperson)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/salespeople/${salespersonToDelete.id}`)
      setSalespeople(prev => prev.filter(sp => sp.id !== salespersonToDelete.id))
      setDeleteDialogOpen(false)
      setSalespersonToDelete(null)
    } catch (err) {
      console.error('Error deleting salesperson:', err)
      setError(err.response?.data?.message || 'Failed to delete salesperson')
    }
  }

  const handleFormSave = (savedSalesperson) => {
    if (selectedSalesperson) {
      // Update existing
      setSalespeople(prev => prev.map(sp => 
        sp.id === savedSalesperson.id ? savedSalesperson : sp
      ))
    } else {
      // Add new
      setSalespeople(prev => [...prev, savedSalesperson])
    }
    setFormOpen(false)
    setSelectedSalesperson(null)
  }

  // Filter salespeople based on search term and warehouse filter
  const filteredSalespeople = salespeople.filter(salesperson => {
    const matchesSearch = !searchTerm || 
    salesperson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    salesperson.phone.includes(searchTerm) ||
    salesperson.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesWarehouse = warehouseFilter === 'all' || 
      salesperson.warehouse_id === parseInt(warehouseFilter)
    
    return matchesSearch && matchesWarehouse
  })

  // Calculate statistics
  const salespeopleStats = React.useMemo(() => {
    const totalSalespeople = salespeople.length
    const activeSalespeople = salespeople.filter(sp => sp.status === 'ACTIVE').length
    const averageCommission = 0 // Removed commission calculation
    const warehouseCount = new Set(salespeople.map(sp => sp.warehouse_id)).size

    return {
      totalSalespeople,
      activeSalespeople,
      averageCommission,
      warehouseCount
    }
  }, [salespeople])

  // Export functions
  const generateCSV = (salespeopleData) => {
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Warehouse', 'Status', 'Created At']
    const rows = salespeopleData.map(sp => [
      sp.id,
      sp.name,
      sp.phone,
      sp.email || 'N/A',
      sp.warehouse_name || 'N/A',
      sp.status,
      new Date(sp.created_at).toLocaleDateString()
    ])
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const generateExcel = async (salespeopleData) => {
    try {
      const XLSX = await import('xlsx')
      
      const excelData = salespeopleData.map(sp => ({
        'ID': sp.id,
        'Name': sp.name,
        'Phone': sp.phone,
        'Email': sp.email || 'N/A',
        'Warehouse': sp.warehouse_name || 'N/A',
        'Status': sp.status,
        'Created At': new Date(sp.created_at).toLocaleDateString()
      }))
      
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Salespeople Data')
      
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      return excelBuffer
    } catch (error) {
      console.warn('XLSX library not available, falling back to CSV format:', error)
      return generateCSV(salespeopleData)
    }
  }

  const generatePDF = (salespeopleData) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salespeople Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .status-active { color: #28a745; }
            .status-inactive { color: #dc3545; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Salespeople Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>Total Records: ${salespeopleData.length}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p>Total Salespeople: ${salespeopleData.length}</p>
            <p>Active Salespeople: ${salespeopleData.filter(sp => sp.status === 'ACTIVE').length}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Warehouse</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${salespeopleData.map(sp => `
                <tr>
                  <td>${sp.id}</td>
                  <td>${sp.name}</td>
                  <td>${sp.phone}</td>
                  <td>${sp.email || 'N/A'}</td>
                  <td>${sp.warehouse_name || 'N/A'}</td>
                  <td class="status-${sp.status.toLowerCase()}">${sp.status}</td>
                  <td>${new Date(sp.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    return htmlContent
  }

  const downloadFile = (content, filename, mimeType) => {
    if (mimeType === 'application/pdf') {
      const printWindow = window.open('', '_blank')
      printWindow.document.write(content)
      printWindow.document.close()
      printWindow.print()
      return
    }

    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleExportClick = (event) => {
    setExportMenuAnchor(event.currentTarget)
  }

  const handleExportClose = () => {
    setExportMenuAnchor(null)
  }

  const exportToCSV = () => {
    const csvContent = generateCSV(filteredSalespeople)
    downloadFile(csvContent, `salespeople-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
    handleExportClose()
  }

  const exportToExcel = async () => {
    try {
      const excelContent = await generateExcel(filteredSalespeople)
      downloadFile(excelContent, `salespeople-${new Date().toISOString().split('T')[0]}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
    }
    handleExportClose()
  }

  const exportToPDF = () => {
    const pdfContent = generatePDF(filteredSalespeople)
    downloadFile(pdfContent, `salespeople-${new Date().toISOString().split('T')[0]}.html`, 'application/pdf')
    handleExportClose()
  }

  const canManageSalespeople = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_KEEPER'

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
        <PermissionCheck roles={['ADMIN', 'WAREHOUSE_KEEPER']}>
    <Box sx={{ p: 3 }}>
            {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
            Salespeople Management
          </Typography>
            </Box>

            {/* Salespeople Statistics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Salespeople
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.totalSalespeople}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Active Salespeople
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.activeSalespeople}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Warehouses
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.warehouseCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Warehouses Covered
                    </Typography>
                    <Typography variant="h5" component="div">
                      {salespeopleStats.warehouseCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Salespeople Table */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Salespeople
          </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadData}
                    disabled={loading}
                    sx={{ minWidth: 120 }}
                  >
                    Refresh
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<ExportIcon />}
                    onClick={handleExportClick}
                    sx={{ minWidth: 120 }}
                  >
                    Export
                  </Button>
        {canManageSalespeople && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSalesperson}
          >
            Add Salesperson
          </Button>
        )}
                </Box>
      </Box>

              {/* Search and Filter Section */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <FilterIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="subtitle2">Search & Filters</Typography>
                  </Box>
                  
                  <Grid container spacing={2} alignItems="center">
                    {/* Search Input */}
                    <Grid item xs={12} md={6}>
          <TextField
            fullWidth
                        size="small"
                        label="Search Salespeople"
                        placeholder="Search by name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
                          endAdornment: searchTerm && (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setSearchTerm('')}
                                edge="end"
                              >
                                <ClearIcon />
                              </IconButton>
                            </InputAdornment>
                          )
            }}
          />
        </Grid>

                    {/* Warehouse Filter */}
                    {user?.role === 'ADMIN' && (
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Warehouse</InputLabel>
                          <Select
                            value={warehouseFilter}
                            label="Warehouse"
                            onChange={(e) => setWarehouseFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Warehouses</MenuItem>
                            {warehouses.map((warehouse) => (
                              <MenuItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>
            </CardContent>
          </Card>

      {/* Salespeople Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Salesperson</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Contact</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Warehouse</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSalespeople.map((salesperson) => (
              <TableRow key={salesperson.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="primary" />
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {salesperson.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {salesperson.id}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <PhoneIcon fontSize="small" color="action" />
                      <Typography variant="body2">{salesperson.phone}</Typography>
                    </Box>
                    {salesperson.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">{salesperson.email}</Typography>
                      </Box>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2">{salesperson.warehouse_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {salesperson.warehouse_code}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={salesperson.status}
                    color={salesperson.status === 'ACTIVE' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEditSalesperson(salesperson)}
                        disabled={!canManageSalespeople}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSalesperson(salesperson)}
                        disabled={!canManageSalespeople || user?.role !== 'ADMIN'}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredSalespeople.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No salespeople found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try adjusting your search terms' : 'Add your first salesperson to get started'}
          </Typography>
        </Box>
      )}
            </Box>

      {/* Salesperson Form */}
      <SalespersonForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setSelectedSalesperson(null)
        }}
        salesperson={selectedSalesperson}
        onSave={handleFormSave}
        warehouses={warehouses}
        userRole={user?.role}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Salesperson</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{salespersonToDelete?.name}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportClose}
      >
        <MenuItem onClick={exportToCSV}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={exportToExcel}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as Excel
        </MenuItem>
        <MenuItem onClick={exportToPDF}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          Export as PDF
        </MenuItem>
      </Menu>
    </Box>
        </PermissionCheck>
      </RouteGuard>
    </DashboardLayout>
  )
}

export default withAuth(SalespeoplePage)
