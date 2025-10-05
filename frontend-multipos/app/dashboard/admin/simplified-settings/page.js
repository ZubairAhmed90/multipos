'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  AlertTitle
} from '@mui/material';
import { Business, Warehouse, Edit, Settings, Refresh, CheckCircle, Info } from '@mui/icons-material';
import api from '../../../../utils/axios';
import RouteGuard from '../../../../components/auth/RouteGuard';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import withAuth from '../../../../components/auth/withAuth';

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simplified-settings-tabpanel-${index}`}
      aria-labelledby={`simplified-settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Simplified Branch Settings Component
const SimplifiedBranchSettings = ({ branches, onBranchesChange }) => {
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState({});
  const [saving, setSaving] = useState(false);

  const loadBranchSettings = async (branchId) => {
    try {
      const response = await api.get(`/branches/${branchId}/settings`);
      return response.data.data.settings;
    } catch (err) {
      return {
        allowCashierInventoryEdit: false,
        allowCashierSalesEdit: false,
        allowCashierSalesDelete: false,
        allowCashierReturns: false,
        allowCashierCustomers: false,
        allowCashierPOS: false,
        allowCashierLedger: false,
        openAccountSystem: false
      };
    }
  };

  const handleEditSettings = async (branch) => {
    setSelectedBranch(branch);
    const settings = await loadBranchSettings(branch.id);
    setEditingSettings(settings);
    setSettingsDialogOpen(true);
  };

  const handleSettingChange = (key) => (event) => {
    setEditingSettings(prev => ({
      ...prev,
      [key]: event.target.checked
    }));
  };

  const handleSaveSettings = async () => {
    if (!selectedBranch) return;
    
    setSaving(true);
    try {
      await api.put(`/branches/${selectedBranch.id}/settings`, {
        settings: editingSettings
      });
      
      onBranchesChange(prev => prev.map(branch => 
        branch.id === selectedBranch.id 
          ? { ...branch, settings: editingSettings }
          : branch
      ));
      
      setSettingsDialogOpen(false);
      setError(null);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getSettingsSummary = (branch) => {
    const settings = branch.settings || {};
    const enabled = Object.values(settings).filter(Boolean).length;
    const total = Object.keys(settings).length;
    const percentage = total > 0 ? Math.round((enabled / total) * 100) : 0;
    
    return { enabled, total, percentage };
  };

  const settingsConfig = [
    {
      key: 'allowCashierInventoryEdit',
      label: 'Allow Cashier Inventory Edit',
      description: 'Cashiers can add/edit inventory items'
    },
    {
      key: 'allowCashierSalesEdit',
      label: 'Allow Cashier Sales Edit',
      description: 'Cashiers can add/edit sales (if off: view only)'
    },
    {
      key: 'allowCashierSalesDelete',
      label: 'Allow Cashier Sales Delete',
      description: 'Cashiers can delete sales (requires sales edit permission)'
    },
    {
      key: 'allowCashierReturns',
      label: 'Allow Cashier Returns',
      description: 'Cashiers can process returns'
    },
    {
      key: 'allowCashierCustomers',
      label: 'Allow Cashier Customers',
      description: 'Cashiers can manage customers'
    },
    {
      key: 'allowCashierPOS',
      label: 'Allow Cashier POS',
      description: 'Cashiers can use POS system'
    },
    {
      key: 'allowCashierLedger',
      label: 'Allow Cashier Ledger',
      description: 'Cashiers can access ledger'
    },
    {
      key: 'openAccountSystem',
      label: 'Open Account System',
      description: 'Enable open account functionality'
    }
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Business sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" component="h2">
            Branch Settings
          </Typography>
        </Box>
        <Typography variant="body2" color="textSecondary">
          Simple true/false settings for each branch
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Branch</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Settings Enabled</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branches.map((branch) => {
              const summary = getSettingsSummary(branch);
              return (
                <TableRow key={branch.id}>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {branch.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={branch.code} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {summary.enabled}/{summary.total} ({summary.percentage}%)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => handleEditSettings(branch)}
                    >
                      Edit Settings
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Settings />
            <Typography variant="h6">
              Edit Settings for {selectedBranch?.name}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedBranch && (
            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Branch Code: {selectedBranch.code}
              </Typography>
              
              <Grid container spacing={3}>
                {settingsConfig.map((setting) => (
                  <Grid item xs={12} md={6} key={setting.key}>
                    <Card>
                      <CardContent>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editingSettings[setting.key] || false}
                              onChange={handleSettingChange(setting.key)}
                              color="primary"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1" component="div">
                                {setting.label}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {setting.description}
                              </Typography>
                            </Box>
                          }
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save Settings'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Simplified Warehouse Settings Component
const SimplifiedWarehouseSettings = ({ warehouses, onWarehousesChange }) => {
  const [error, setError] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState({});
  const [saving, setSaving] = useState(false);

  const loadWarehouseSettings = async (warehouseId) => {
    try {
      const response = await api.get(`/warehouses/${warehouseId}/settings`);
      return response.data.data.settings;
    } catch (err) {
      return {
        allowWarehouseInventoryEdit: false,
        allowWarehouseReturns: false,
        allowWarehouseCompanies: false,
        allowWarehouseCompanyCRUD: false,
        requireApprovalForTransfers: true,
        autoStockAlerts: false,
        allowWarehouseLedgerEdit: false
      };
    }
  };

  const handleEditSettings = async (warehouse) => {
    setSelectedWarehouse(warehouse);
    const settings = await loadWarehouseSettings(warehouse.id);
    setEditingSettings(settings);
    setSettingsDialogOpen(true);
  };

  const handleSettingChange = (key) => (event) => {
    setEditingSettings(prev => ({
      ...prev,
      [key]: event.target.checked
    }));
  };

  const handleSaveSettings = async () => {
    if (!selectedWarehouse) return;
    
    setSaving(true);
    try {
      await api.put(`/warehouses/${selectedWarehouse.id}/settings`, {
        settings: editingSettings
      });
      
      onWarehousesChange(prev => prev.map(warehouse => 
        warehouse.id === selectedWarehouse.id 
          ? { ...warehouse, settings: editingSettings }
          : warehouse
      ));
      
      setSettingsDialogOpen(false);
      setError(null);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getSettingsSummary = (warehouse) => {
    const settings = warehouse.settings || {};
    const enabled = Object.values(settings).filter(Boolean).length;
    const total = Object.keys(settings).length;
    const percentage = total > 0 ? Math.round((enabled / total) * 100) : 0;
    
    return { enabled, total, percentage };
  };

  const settingsConfig = [
    {
      key: 'allowWarehouseInventoryEdit',
      label: 'Allow Warehouse Inventory Edit',
      description: 'Warehouse keepers can edit inventory'
    },
    {
      key: 'allowWarehouseReturns',
      label: 'Allow Warehouse Returns',
      description: 'Warehouse keepers can process returns'
    },
    {
      key: 'allowWarehouseSales',
      label: 'Allow Warehouse Sales Management',
      description: 'Warehouse keepers can view and manage sales'
    },
    {
      key: 'allowWarehouseCompanyCRUD',
      label: 'Allow Company CRUD Operations',
      description: 'Warehouse keepers can add, edit, and delete companies (ledger and invoice viewing always available)'
    },
    {
      key: 'requireApprovalForTransfers',
      label: 'Require Approval for Transfers',
      description: 'Transfers need approval before processing'
    },
    {
      key: 'allowWarehouseLedgerEdit',
      label: 'Allow Ledger Edit',
      description: 'Enable warehouse keeper to edit ledger accounts and entries'
    }
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Warehouse sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" component="h2">
            Warehouse Settings
          </Typography>
        </Box>
        <Typography variant="body2" color="textSecondary">
          Simple true/false settings for each warehouse
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Warehouse</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Settings Enabled</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warehouses.map((warehouse) => {
              const summary = getSettingsSummary(warehouse);
              return (
                <TableRow key={warehouse.id}>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {warehouse.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={warehouse.code} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {summary.enabled}/{summary.total} ({summary.percentage}%)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => handleEditSettings(warehouse)}
                    >
                      Edit Settings
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Settings />
            <Typography variant="h6">
              Edit Settings for {selectedWarehouse?.name}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedWarehouse && (
            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Warehouse Code: {selectedWarehouse.code}
              </Typography>
              
              <Grid container spacing={3}>
                {settingsConfig.map((setting) => (
                  <Grid item xs={12} md={6} key={setting.key}>
                    <Card>
                      <CardContent>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editingSettings[setting.key] || false}
                              onChange={handleSettingChange(setting.key)}
                              color="primary"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1" component="div">
                                {setting.label}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {setting.description}
                              </Typography>
                            </Box>
                          }
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save Settings'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Main Simplified Settings Page
const SimplifiedSettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [branchesRes, warehousesRes] = await Promise.all([
        api.get('/branches'),
        api.get('/warehouses')
      ]);
      setBranches(branchesRes.data.data || []);
      setWarehouses(warehousesRes.data.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Settings sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h4" component="h1">
                  Simplified Settings
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Tooltip title="Refresh Settings">
                  <IconButton onClick={handleRefresh} disabled={loading}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            <Typography variant="body1" color="textSecondary" paragraph>
              Simple true/false settings for branches and warehouses. Clean, robust, and easy to manage.
            </Typography>

            {/* Status indicators */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip
                icon={<CheckCircle />}
                label="Simplified System"
                color="success"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<Info />}
                label={`${branches.length} Branches, ${warehouses.length} Warehouses`}
                color="info"
                variant="outlined"
                size="small"
              />
            </Box>
          </Box>

          {/* Loading indicator */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Error alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>Error Loading Settings</AlertTitle>
              {error}
            </Alert>
          )}

          {/* Main content */}
          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={handleTabChange} aria-label="simplified settings tabs">
                <Tab
                  icon={<Business />}
                  label="Branch Settings"
                  id="simplified-settings-tab-0"
                  aria-controls="simplified-settings-tabpanel-0"
                />
                <Tab
                  icon={<Warehouse />}
                  label="Warehouse Settings"
                  id="simplified-settings-tab-1"
                  aria-controls="simplified-settings-tabpanel-1"
                />
              </Tabs>
            </Box>

            {/* Tab panels */}
            <TabPanel value={activeTab} index={0}>
              <SimplifiedBranchSettings branches={branches} onBranchesChange={setBranches} />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <SimplifiedWarehouseSettings warehouses={warehouses} onWarehousesChange={setWarehouses} />
            </TabPanel>
          </Paper>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  );
};

export default withAuth(SimplifiedSettingsPage);
