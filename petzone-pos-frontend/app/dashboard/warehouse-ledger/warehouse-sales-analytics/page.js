'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Menu,
  ListItemIcon,
  Pagination,
  Drawer,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BusinessIcon from '@mui/icons-material/Business';
import PieChartIcon from '@mui/icons-material/PieChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import RouteGuard from '../../../../components/auth/RouteGuard';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { fetchRetailers } from '../../../store/slices/retailersSlice';
import {
  fetchWarehouseSalesAnalytics,
  exportWarehouseSalesAnalytics,
  setFilters,
  clearFilters,
  setSelectedSale,
  clearSelectedSale,
  updatePagination
} from '../../../store/slices/warehouseSalesAnalyticsSlice';

const WarehouseSalesAnalyticsPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { data: retailers, loading: retailersLoading } = useSelector((state) => state.retailers);
  const { 
    data, 
    loading, 
    error, 
    filters, 
    selectedSale, 
    exportLoading, 
    exportError 
  } = useSelector((state) => state.warehouseSalesAnalytics);

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [saleDetailsOpen, setSaleDetailsOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});

  // Memoize warehouse ID to prevent unnecessary re-renders
  const warehouseId = useMemo(() => {
    return user?.warehouseId || user?.warehouse_id;
  }, [user?.warehouseId, user?.warehouse_id]);

  // Fetch data when component mounts or filters change
  useEffect(() => {
    if (warehouseId && user?.role === 'WAREHOUSE_KEEPER') {
      dispatch(fetchRetailers({ warehouseId }));
      dispatch(fetchWarehouseSalesAnalytics({ warehouseId, ...filters }));
    }
  }, [dispatch, warehouseId, user?.role, filters]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    dispatch(setFilters({ [key]: value }));
  };

  // Handle pagination
  const handlePageChange = (event, page) => {
    const offset = (page - 1) * filters.limit;
    dispatch(updatePagination({ offset }));
    dispatch(fetchWarehouseSalesAnalytics({ 
      warehouseId, 
      ...filters, 
      offset, 
      limit: filters.limit 
    }));
  };

  // Export functions
  const handleExportClick = (event) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportMenuAnchor(null);
  };

  const exportToCSV = async () => {
    setExportMenuAnchor(null);
    try {
      await dispatch(exportWarehouseSalesAnalytics({ 
        warehouseId, 
        format: 'csv', 
        ...filters 
      }));
    } catch (error) {
    }
  };

  const exportToJSON = async () => {
    setExportMenuAnchor(null);
    try {
      const result = await dispatch(exportWarehouseSalesAnalytics({ 
        warehouseId, 
        format: 'json', 
        ...filters 
      }));
      if (result.payload.success) {
        const dataStr = JSON.stringify(result.payload.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `warehouse-sales-analytics-${warehouseId}-${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
    }
  };

  // Clear filters
  const clearAllFilters = () => {
    dispatch(clearFilters());
  };

  // View sale details
  const viewSaleDetails = (sale) => {
    dispatch(setSelectedSale(sale));
    setSaleDetailsOpen(true);
  };

  // Close sale details
  const closeSaleDetails = () => {
    setSaleDetailsOpen(false);
    dispatch(clearSelectedSale());
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Payment method colors
  const getPaymentMethodColor = (method) => {
    const colors = {
      'CASH': 'success',
      'CREDIT': 'warning',
      'BANK_TRANSFER': 'info',
      'CARD': 'primary',
      'CHEQUE': 'secondary',
      'MOBILE_PAYMENT': 'default'
    };
    return colors[method] || 'default';
  };

  // Active filters check
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'limit' || key === 'offset') return false;
    return value !== 'all' && value !== '';
  });

  if (!user || !warehouseId) {
    return (
      <RouteGuard>
        <DashboardLayout>
          <Box p={3}>
            <Alert severity="error">
              Warehouse ID not found. Please contact your administrator.
            </Alert>
          </Box>
        </DashboardLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard>
      <DashboardLayout>
        <Box p={3}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" component="h1">
              <DashboardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Warehouse Sales Analytics
            </Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                onClick={() => setFilterDrawerOpen(true)}
              >
                Filters
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportClick}
                disabled={exportLoading}
              >
                {exportLoading ? <CircularProgress size={20} /> : 'Export'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => dispatch(fetchWarehouseSalesAnalytics({ warehouseId, ...filters }))}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          {/* Summary Cards */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <TableChartIcon color="primary" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h6">{data.summary.totalSales}</Typography>
                      <Typography color="textSecondary">Total Sales</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <BusinessIcon color="success" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h6">{formatCurrency(data.summary.totalAmount)}</Typography>
                      <Typography color="textSecondary">Total Amount</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <PieChartIcon color="info" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h6">{formatCurrency(data.summary.averageSaleAmount)}</Typography>
                      <Typography color="textSecondary">Average Sale</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <BusinessIcon color="warning" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h6">{data.retailerBreakdown.length}</Typography>
                      <Typography color="textSecondary">Retailers</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Payment Method Breakdown */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Payment Method Breakdown
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="success.main">
                    Cash
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(data.summary.cashAmount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="warning.main">
                    Credit
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(data.summary.creditAmount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="info.main">
                    Bank Transfer
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(data.summary.bankTransferAmount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="primary.main">
                    Card
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(data.summary.cardAmount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="secondary.main">
                    Cheque
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(data.summary.chequeAmount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="default">
                    Mobile
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(data.summary.mobilePaymentAmount)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Retailer Breakdown */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Retailers
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Retailer</TableCell>
                    <TableCell>Sales Count</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Average Amount</TableCell>
                    <TableCell>Last Sale</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.retailerBreakdown.slice(0, 10).map((retailer) => (
                    <TableRow key={retailer.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {retailer.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{retailer.salesCount}</TableCell>
                      <TableCell>{formatCurrency(retailer.totalAmount)}</TableCell>
                      <TableCell>{formatCurrency(retailer.averageAmount)}</TableCell>
                      <TableCell>{formatDate(retailer.lastSaleDate)}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => handleFilterChange('retailerId', retailer.id)}
                        >
                          Filter
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Sales List */}
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Sales Details ({data.pagination.totalCount} total)
              </Typography>
              {hasActiveFilters && (
                <Chip
                  label="Filters Active"
                  color="primary"
                  variant="outlined"
                  onDelete={clearAllFilters}
                />
              )}
            </Box>

            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Retailer</TableCell>
                        <TableCell>Payment Method</TableCell>
                        <TableCell>Payment Terms</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Created By</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{sale.saleNumber}</TableCell>
                          <TableCell>{formatDate(sale.createdAt)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap>
                              {sale.retailer?.name || 'No Retailer'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={sale.paymentMethod.replace('_', ' ')}
                              color={getPaymentMethodColor(sale.paymentMethod)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {sale.paymentMethod === 'CREDIT' && sale.paymentTerms ? (
                              <Typography variant="body2">
                                {sale.paymentTerms}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="textSecondary">
                                -
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(sale.total)}</TableCell>
                          <TableCell>{sale.createdByUsername}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => viewSaleDetails(sale)}
                              title="View Details"
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination */}
                {data.pagination.total > 1 && (
                  <Box display="flex" justifyContent="center" mt={2}>
                    <Pagination
                      count={data.pagination.total}
                      page={data.pagination.current}
                      onChange={handlePageChange}
                      color="primary"
                    />
                  </Box>
                )}
              </>
            )}
          </Paper>

          {/* Filter Drawer */}
          <Drawer
            anchor="right"
            open={filterDrawerOpen}
            onClose={() => setFilterDrawerOpen(false)}
          >
            <Box sx={{ width: 300, p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Filters
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Typography variant="subtitle1" gutterBottom>
                Retailer
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Retailer</InputLabel>
                <Select
                  value={filters.retailerId}
                  label="Retailer"
                  onChange={(e) => handleFilterChange('retailerId', e.target.value)}
                >
                  <MenuItem value="all">All Retailers</MenuItem>
                  {retailers.map((retailer) => (
                    <MenuItem key={retailer.id} value={retailer.id}>
                      {retailer.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="subtitle1" gutterBottom>
                Payment Method
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={filters.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                >
                  <MenuItem value="all">All Methods</MenuItem>
                  <MenuItem value="CASH">Cash</MenuItem>
                  <MenuItem value="CREDIT">Credit</MenuItem>
                  <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                  <MenuItem value="CARD">Card</MenuItem>
                  <MenuItem value="CHEQUE">Cheque</MenuItem>
                  <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="subtitle1" gutterBottom>
                Invoice Number
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Invoice Number"
                value={filters.invoiceNo}
                onChange={(e) => handleFilterChange('invoiceNo', e.target.value)}
                sx={{ mb: 2 }}
                placeholder="Search by invoice number"
              />

              <Typography variant="subtitle1" gutterBottom>
                Date Range
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box sx={{ mb: 2 }}>
                  <DatePicker
                    label="Start Date"
                    value={filters.startDate ? new Date(filters.startDate) : null}
                    onChange={(date) => handleFilterChange('startDate', date?.toISOString().split('T')[0] || '')}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    sx={{ mb: 1 }}
                  />
                  <DatePicker
                    label="End Date"
                    value={filters.endDate ? new Date(filters.endDate) : null}
                    onChange={(date) => handleFilterChange('endDate', date?.toISOString().split('T')[0] || '')}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Box>
              </LocalizationProvider>

              <Box display="flex" gap={1} mt={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => setFilterDrawerOpen(false)}
                >
                  Apply Filters
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={clearAllFilters}
                >
                  Clear All
                </Button>
              </Box>
            </Box>
          </Drawer>

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
            <MenuItem onClick={exportToJSON}>
              <ListItemIcon>
                <DownloadIcon fontSize="small" />
              </ListItemIcon>
              Export as JSON
            </MenuItem>
          </Menu>

          {/* Sale Details Dialog */}
          <Dialog
            open={saleDetailsOpen}
            onClose={closeSaleDetails}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Sale Details - {selectedSale?.saleNumber}
            </DialogTitle>
            <DialogContent>
              {selectedSale && (
                <Box>
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Invoice Number
                      </Typography>
                      <Typography variant="body1">
                        {selectedSale.saleNumber}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Sale Date
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(selectedSale.createdAt)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Retailer
                      </Typography>
                      <Typography variant="body1">
                        {selectedSale.retailer?.name || 'No Retailer'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Payment Method
                      </Typography>
                      <Chip
                        label={selectedSale.paymentMethod.replace('_', ' ')}
                        color={getPaymentMethodColor(selectedSale.paymentMethod)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Total Amount
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(selectedSale.total)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Created By
                      </Typography>
                      <Typography variant="body1">
                        {selectedSale.createdByUsername}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="h6" gutterBottom>
                    Items Sold
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Quantity</TableCell>
                          <TableCell>Unit Price</TableCell>
                          <TableCell>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedSale.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.itemSku}</TableCell>
                            <TableCell>{item.itemCategory}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => window.print()}>Print</Button>
              <Button onClick={closeSaleDetails}>Close</Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  );
};

export default WarehouseSalesAnalyticsPage;
