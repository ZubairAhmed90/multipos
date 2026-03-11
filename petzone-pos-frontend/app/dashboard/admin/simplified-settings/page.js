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
    AlertTitle,
    TextField
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

  // ==================== BRANCH SETTINGS COMPONENT ====================
  const SimplifiedBranchSettings = ({ branches, onBranchesChange }) => {
    const [error, setError] = useState(null);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [editingSettings, setEditingSettings] = useState({});
    const [changedSettings, setChangedSettings] = useState({});
    const [saving, setSaving] = useState(false);

    const loadBranchSettings = async (branchId) => {
      try {
        const response = await api.get(`/branches/${branchId}/settings`);
        return response.data.data.settings;
      } catch (err) {
        console.error('Failed to load branch settings:', err);
        throw err;
      }
    };

    const handleEditSettings = async (branch) => {
      console.log('Opening settings for branch:', branch.name, branch.id);
      setSelectedBranch(branch);
      setChangedSettings({});
      
      try {
        const settings = await loadBranchSettings(branch.id);
        console.log('Fresh branch settings from API:', settings);
        setEditingSettings(settings);
        setSettingsDialogOpen(true);
      } catch (err) {
        console.error('Failed to load branch settings:', err);
        setError('Failed to load branch settings. Please try again.');
      }
    };

    const handleSettingChange = (key) => (event) => {
      const newValue = event.target.checked;
      
      setEditingSettings(prev => ({
        ...prev,
        [key]: newValue
      }));
      
      setChangedSettings(prev => ({
        ...prev,
        [key]: newValue
      }));
    };

    const handleNumberChange = (key) => (event) => {
      const value = parseFloat(event.target.value) || 0;
      
      setEditingSettings(prev => ({
        ...prev,
        [key]: value
      }));  
      
      setChangedSettings(prev => ({
        ...prev,
        [key]: value
      }));
    };

const handleSaveSettings = async () => {
  if (!selectedBranch) return;
  if (Object.keys(changedSettings).length === 0) {
    setSettingsDialogOpen(false);
    return;
  }

  setSaving(true);
  try {
    await api.put(`/branches/${selectedBranch.id}/settings`, {
      settings: editingSettings  // ← send full UI state
    });

    const refreshResponse = await api.get('/branches');
    onBranchesChange(refreshResponse.data.data || []);
    setChangedSettings({});
    setSettingsDialogOpen(false);
    setError(null);
  } catch (err) {
    setError('Failed to save branch settings');
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

// ONLY the settingsConfig array inside SimplifiedBranchSettings component

const settingsConfig = [
  { type: 'section', section: 'Cashier Permissions' },
  {
    key: 'allowCashierInventoryAdd',
    label: 'Allow Cashier Inventory Add',
    description: 'Cashiers can add NEW inventory items',
    type: 'switch'
  },
  {
    key: 'allowCashierInventoryEdit',
    label: 'Allow Cashier Inventory Edit',
    description: 'Cashiers can EDIT existing inventory items',
    type: 'switch'
  },
  {
    key: 'allowCashierSalesEdit',
    label: 'Allow Cashier Sales Edit',
    description: 'Cashiers can add/edit sales (if off: view only)',
    type: 'switch'
  },
  {
    key: 'allowCashierSalesDelete',
    label: 'Allow Cashier Sales Delete',
    description: 'Cashiers can delete sales (requires sales edit permission)',
    type: 'switch'
  },
  {
    key: 'allowCashierReturns',
    label: 'Allow Cashier Returns',
    description: 'Cashiers can process returns',
    type: 'switch'
  },
  {
    key: 'allowCashierCustomers',
    label: 'Allow Cashier Customers',
    description: 'Cashiers can manage customers',
    type: 'switch'
  },
  {
    key: 'allowCashierPOS',
    label: 'Allow Cashier POS',
    description: 'Cashiers can use POS system',
    type: 'switch'
  },
  {
    key: 'allowCashierLedger',
    label: 'Allow Cashier Ledger',
    description: 'Cashiers can access ledger',
    type: 'switch'
  },
  {
    key: 'openAccountSystem',
    label: 'Open Account System',
    description: 'Enable open account functionality',
    type: 'switch'
  },

  { type: 'section', section: 'Customer Management' },
  {
    key: 'allowCashierCustomerEdit',
    label: 'Allow Cashier Customer Edit',
    description: 'Cashiers can edit customer name and phone number',
    type: 'switch'
  },

  { type: 'section', section: 'Company Management' },
  {
    key: 'allowCompanyCreate',
    label: 'Allow Company Creation',
    description: 'Branch users can add new companies',
    type: 'switch'
  },
  {
    key: 'allowCompanyEdit',
    label: 'Allow Company Edit',
    description: 'Branch users can edit existing companies',
    type: 'switch'
  },
  {
    key: 'allowCompanyDelete',
    label: 'Allow Company Delete',
    description: 'Branch users can delete companies',
    type: 'switch'
  },

  { type: 'section', section: 'Transfer Settings' },
  {
    key: 'allowBranchTransfers',
    label: 'Allow Branch Transfers',
    description: 'Allow transfers from this branch',
    type: 'switch'
  },
  {
    key: 'allowBranchToBranchTransfers',
    label: 'Allow Branch to Branch Transfers',
    description: 'Allow transfers from branch to other branches',
    type: 'switch'
  },
  {
    key: 'allowBranchToWarehouseTransfers',
    label: 'Allow Branch to Warehouse Transfers',
    description: 'Allow transfers from branch to warehouse',
    type: 'switch'
  },
  {
    key: 'requireApprovalForBranchTransfers',
    label: 'Require Approval for Branch Transfers',
    description: 'Require admin approval for branch transfers',
    type: 'switch'
  },
  {
    key: 'maxTransferAmount',
    label: 'Maximum Transfer Amount',
    description: 'Maximum amount allowed for transfers',
    type: 'number'
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
            Configure cashier permissions, company management, and transfer settings for each branch
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
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
          <DialogContent dividers>
            {selectedBranch && (
              <Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Branch Code: {selectedBranch.code}
                </Typography>
                
                <Grid container spacing={3}>
                  {settingsConfig.map((setting, index) => {
                    if (setting.type === 'section') {
                      return (
                        <Grid item xs={12} key={`section-${index}`}>
                          <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                            {setting.section}
                          </Typography>
                        </Grid>
                      );
                    }
                    
                    return (
                      <Grid item xs={12} md={6} key={setting.key}>
                        <Card variant="outlined">
                          <CardContent>
                            {setting.type === 'switch' ? (
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
                            ) : (
                              <Box>
                                <Typography variant="body1" gutterBottom>
                                  {setting.label}
                                </Typography>
                                <TextField
                                  type="number"
                                  value={editingSettings[setting.key] || ''}
                                  onChange={handleNumberChange(setting.key)}
                                  size="small"
                                  fullWidth
                                  helperText={setting.description}
                                />
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
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

  // ==================== WAREHOUSE SETTINGS COMPONENT ====================
  const SimplifiedWarehouseSettings = ({ warehouses, onWarehousesChange }) => {
    const [error, setError] = useState(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [editingSettings, setEditingSettings] = useState({});
    const [changedSettings, setChangedSettings] = useState({});
    const [saving, setSaving] = useState(false);

    const loadWarehouseSettings = async (warehouseId) => {
      try {
        const response = await api.get(`/warehouses/${warehouseId}/settings`);
        return response.data.data.settings;
      } catch (err) {
        console.error('Failed to load warehouse settings:', err);
        throw err;
      }
    };

    const handleEditSettings = async (warehouse) => {
      console.log('Opening settings for warehouse:', warehouse.name, warehouse.id);
      setSelectedWarehouse(warehouse);
      setChangedSettings({});
      
      try {
        const settings = await loadWarehouseSettings(warehouse.id);
        console.log('Fresh warehouse settings from API:', settings);
        setEditingSettings(settings);
        setSettingsDialogOpen(true);
      } catch (err) {
        console.error('Failed to load warehouse settings:', err);
        setError('Failed to load warehouse settings. Please try again.');
      }
    };

    const handleSettingChange = (key) => (event) => {
      const newValue = event.target.checked;
      
      setEditingSettings(prev => ({
        ...prev,
        [key]: newValue
      }));
      
      setChangedSettings(prev => ({
        ...prev,
        [key]: newValue
      }));
    };

    const handleNumberChange = (key) => (event) => {
      const value = parseFloat(event.target.value) || 0;
      
      setEditingSettings(prev => ({
        ...prev,
        [key]: value
      }));
      
      setChangedSettings(prev => ({
        ...prev,
        [key]: value
      }));
    };

const handleSaveSettings = async () => {
  if (!selectedWarehouse) return;
  if (Object.keys(changedSettings).length === 0) {
    setSettingsDialogOpen(false);
    return;
  }

  setSaving(true);
  try {
    await api.put(`/warehouses/${selectedWarehouse.id}/settings`, {
      settings: editingSettings
    });

    const refreshResponse = await api.get('/warehouses');
    onWarehousesChange(refreshResponse.data.data || []);
    setChangedSettings({});
    setSettingsDialogOpen(false);
    setError(null);
  } catch (err) {
    setError('Failed to save warehouse settings');
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

    // Warehouse settings configuration with granular permissions
// Replace ONLY the settingsConfig array inside SimplifiedWarehouseSettings component

const settingsConfig = [
  { type: 'section', section: 'Basic Warehouse Operations' },
  {
    key: 'allowWarehouseInventoryAdd',
    label: 'Allow Warehouse Inventory Add',
    description: 'Warehouse keepers can add NEW inventory items',
    type: 'switch'
  },
  {
    key: 'allowWarehouseInventoryEdit',
    label: 'Allow Warehouse Inventory Edit',
    description: 'Warehouse keepers can EDIT existing inventory items',
    type: 'switch'
  },
  {
    key: 'allowWarehouseReturns',
    label: 'Allow Warehouse Returns',
    description: 'Warehouse keepers can process returns',
    type: 'switch'
  },
  {
    key: 'allowWarehouseSales',
    label: 'Allow Warehouse Sales Management',
    description: 'Warehouse keepers can view and manage sales',
    type: 'switch'
  },
  {
    key: 'allowWarehouseLedgerEdit',
    label: 'Allow Ledger Edit',
    description: 'Enable warehouse keeper to edit ledger accounts and entries',
    type: 'switch'
  },
  {
    key: 'requireApprovalForTransfers',
    label: 'Require Approval for Transfers',
    description: 'Transfers need approval before processing',
    type: 'switch'
  },
  {
    key: 'autoStockAlerts',
    label: 'Auto Stock Alerts',
    description: 'Enable automatic stock level alerts',
    type: 'switch'
  },

  { type: 'section', section: 'Company Management' },
  {
    key: 'allowCompanyCreate',
    label: 'Allow Company Creation',
    description: 'Warehouse keepers can add new companies',
    type: 'switch'
  },
  {
    key: 'allowCompanyEdit',
    label: 'Allow Company Edit',
    description: 'Warehouse keepers can edit existing companies',
    type: 'switch'
  },
  {
    key: 'allowCompanyDelete',
    label: 'Allow Company Delete',
    description: 'Warehouse keepers can delete companies',
    type: 'switch'
  },

  { type: 'section', section: 'Retailer Management' },
  {
    key: 'allowRetailerCreate',
    label: 'Allow Retailer Creation',
    description: 'Warehouse keepers can add new retailers',
    type: 'switch'
  },
  {
    key: 'allowRetailerEdit',
    label: 'Allow Retailer Edit',
    description: 'Warehouse keepers can edit existing retailers',
    type: 'switch'
  },
  {
    key: 'allowRetailerDelete',
    label: 'Allow Retailer Delete',
    description: 'Warehouse keepers can delete retailers',
    type: 'switch'
  },
  {
    key: 'allowRetailerCustomerEdit',
    label: 'Allow Retailer/Customer Edit',
    description: 'Warehouse keepers can edit retailer and customer name/phone',
    type: 'switch'
  },

  { type: 'section', section: 'Transfer Settings' },
  {
    key: 'allowWarehouseTransfers',
    label: 'Allow Warehouse Transfers',
    description: 'Allow transfers from this warehouse',
    type: 'switch'
  },
  {
    key: 'allowWarehouseToWarehouseTransfers',
    label: 'Allow Warehouse to Warehouse Transfers',
    description: 'Allow transfers from warehouse to other warehouses',
    type: 'switch'
  },
  {
    key: 'allowWarehouseToBranchTransfers',
    label: 'Allow Warehouse to Branch Transfers',
    description: 'Allow transfers from warehouse to branch',
    type: 'switch'
  },
  {
    key: 'requireApprovalForWarehouseTransfers',
    label: 'Require Approval for Warehouse Transfers',
    description: 'Require admin approval for warehouse transfers',
    type: 'switch'
  },
  {
    key: 'maxTransferAmount',
    label: 'Maximum Transfer Amount',
    description: 'Maximum amount allowed for transfers',
    type: 'number'
  },
  {
    key: 'autoApproveSmallTransfers',
    label: 'Auto-Approve Small Transfers',
    description: 'Auto-approve transfers under threshold',
    type: 'switch'
  },
  {
    key: 'smallTransferThreshold',
    label: 'Small Transfer Threshold',
    description: 'Amount threshold for auto-approval',
    type: 'number'
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
            Configure granular permissions for warehouse keepers
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
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
          <DialogContent dividers>
            {selectedWarehouse && (
              <Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Warehouse Code: {selectedWarehouse.code}
                </Typography>
                
                <Grid container spacing={3}>
                  {settingsConfig.map((setting, index) => {
                    if (setting.type === 'section') {
                      return (
                        <Grid item xs={12} key={`section-${index}`}>
                          <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                            {setting.section}
                          </Typography>
                        </Grid>
                      );
                    }
                    
                    return (
                      <Grid item xs={12} md={6} key={setting.key}>
                        <Card variant="outlined">
                          <CardContent>
                            {setting.type === 'switch' ? (
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
                            ) : (
                              <Box>
                                <Typography variant="body1" gutterBottom>
                                  {setting.label}
                                </Typography>
                                <TextField
                                  type="number"
                                  value={editingSettings[setting.key] || ''}
                                  onChange={handleNumberChange(setting.key)}
                                  size="small"
                                  fullWidth
                                  helperText={setting.description}
                                />
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
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

  // ==================== MAIN SETTINGS PAGE ====================
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
        console.error('Refresh error:', err);
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
                    System Settings
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
                Configure granular permissions for branches and warehouses
              </Typography>

              {/* Status indicators */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip
                  icon={<CheckCircle />}
                  label="Granular Permissions System"
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