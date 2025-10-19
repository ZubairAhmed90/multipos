'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
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
  Tooltip
} from '@mui/material'
import {
  AccountBalance as BalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import withAuth from '../../../../components/auth/withAuth'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import RouteGuard from '../../../../components/auth/RouteGuard'
import {
  fetchWarehouseLedgerAccounts,
  fetchWarehouseLedgerEntries,
  fetchWarehouseBalanceSummary
} from '../../../store/slices/warehouseLedgerSlice'
import { fetchWarehouses } from '../../../store/slices/warehousesSlice'
import { fetchCompanies } from '../../../store/slices/companiesSlice'

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`warehouse-ledger-tabpanel-${index}`}
      aria-labelledby={`warehouse-ledger-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function AdminWarehouseLedgersPage() {
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState(0)
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  
  const { data: warehouses, loading: warehousesLoading, error: warehousesError } = useSelector((state) => state.warehouses)
  const { data: companies, loading: companiesLoading, error: companiesError } = useSelector((state) => state.companies)
  const {
    accounts,
    entries,
    balanceSummary,
    accountsLoading,
    entriesLoading,
    balanceLoading,
    accountsError,
    entriesError,
    balanceError
  } = useSelector((state) => state.warehouseLedger)

  // Load warehouses on mount
  useEffect(() => {
    dispatch(fetchWarehouses())
  }, [dispatch])

  // Load companies when warehouse is selected
  useEffect(() => {
    if (selectedWarehouse) {
      dispatch(fetchCompanies({
        scopeType: 'WAREHOUSE',
        scopeId: selectedWarehouse
      }))
    } else {
      // Clear companies when no warehouse is selected
      setSelectedCompany('')
    }
  }, [dispatch, selectedWarehouse])

  // Load ledger data when warehouse is selected
  useEffect(() => {
    if (selectedWarehouse) {
      dispatch(fetchWarehouseLedgerAccounts({ warehouseId: selectedWarehouse }))
      dispatch(fetchWarehouseLedgerEntries({ warehouseId: selectedWarehouse }))
      dispatch(fetchWarehouseBalanceSummary({ warehouseId: selectedWarehouse }))
    }
  }, [dispatch, selectedWarehouse])

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue)
  }

  const handleRefresh = () => {
    if (selectedWarehouse) {
      dispatch(fetchWarehouseLedgerAccounts({ warehouseId: selectedWarehouse }))
      dispatch(fetchWarehouseLedgerEntries({ warehouseId: selectedWarehouse }))
      dispatch(fetchWarehouseBalanceSummary({ warehouseId: selectedWarehouse }))
    }
  }

  const SummaryCard = ({ title, value, icon, color = 'primary' }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={color}>
              {value.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ color: `${color}.main` }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )

  const renderAccountsTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Warehouse Chart of Accounts
      </Typography>
      
      {accountsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {accountsError}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Account Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts && accounts.length > 0 ? accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{account.accountName}</TableCell>
                <TableCell>
                  <Chip 
                    label={account.accountType} 
                    color={account.accountType === 'asset' ? 'success' : 
                           account.accountType === 'liability' ? 'error' : 
                           account.accountType === 'equity' ? 'info' : 
                           account.accountType === 'revenue' ? 'warning' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  {(parseFloat(account.balance) || 0).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={account.status} 
                    color={account.status === 'ACTIVE' ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{account.description}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {accountsLoading ? 'Loading accounts...' : 'No accounts found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )

  const renderEntriesTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Transaction Entries
      </Typography>
      
      {entriesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {entriesError}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Account</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries && entries.length > 0 ? (
              entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Chip 
                    label={entry.type} 
                    color={entry.type === 'DEBIT' ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  {(parseFloat(entry.amount) || 0).toFixed(2)}
                </TableCell>
                <TableCell>{entry.description}</TableCell>
                <TableCell>{entry.reference}</TableCell>
                <TableCell>{entry.account_name}</TableCell>
              </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {entriesLoading ? 'Loading entries...' : 'No entries found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )

  const renderSummaryTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Balance Summary
      </Typography>
      
      {balanceError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {balanceError}
        </Alert>
      )}

      {balanceSummary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={2}>
            <SummaryCard
              title="Total Assets"
              value={balanceSummary.totalAssets || 0}
              icon={<BalanceIcon sx={{ fontSize: 40 }} />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <SummaryCard
              title="Total Liabilities"
              value={balanceSummary.totalLiabilities || 0}
              icon={<TrendingDownIcon sx={{ fontSize: 40 }} />}
              color="error"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <SummaryCard
              title="Total Equity"
              value={balanceSummary.totalEquity || 0}
              icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <SummaryCard
              title="Total Revenue"
              value={balanceSummary.totalRevenue || 0}
              icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <SummaryCard
              title="Total Expenses"
              value={balanceSummary.totalExpenses || 0}
              icon={<TrendingDownIcon sx={{ fontSize: 40 }} />}
              color="error"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <SummaryCard
              title="Net Income"
              value={balanceSummary.netIncome || 0}
              icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
              color={balanceSummary.netIncome >= 0 ? 'success' : 'error'}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  )

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" gutterBottom>
              Warehouse Ledger Management
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={!selectedWarehouse}
              sx={{ textTransform: 'none' }}
            >
              Refresh
            </Button>
          </Box>

          {/* Warehouse Selection */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Select Warehouse
              </Typography>
              
              {warehousesError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Error loading warehouses: {warehousesError}
                </Alert>
              )}
              <FormControl fullWidth sx={{ maxWidth: 400 }}>
                <InputLabel>Warehouse</InputLabel>
                <Select
                  value={selectedWarehouse}
                  onChange={(e) => {
                    setSelectedWarehouse(e.target.value)
                    setSelectedCompany('') // Clear company selection when warehouse changes
                  }}
                  label="Warehouse"
                >
                  {warehouses && warehouses.length > 0 ? warehouses.map((warehouse) => (
                    <MenuItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </MenuItem>
                  )) : (
                    <MenuItem disabled>
                      {warehousesLoading ? 'Loading warehouses...' : 'No warehouses found'}
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          {/* Company Selection */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Filter by Company (Optional)
                {selectedWarehouse && (
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    Showing companies for selected warehouse
                    {companies && companies.length > 0 && (
                      <span> ({companies.length} companies found)</span>
                    )}
                  </Typography>
                )}
              </Typography>
              
              {companiesError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Error loading companies: {companiesError}
                </Alert>
              )}
              <FormControl fullWidth sx={{ maxWidth: 400 }}>
                <InputLabel>Company</InputLabel>
                <Select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  label="Company"
                  disabled={!selectedWarehouse}
                >
                  <MenuItem value="">
                    <em>All Companies</em>
                  </MenuItem>
                  {!selectedWarehouse ? (
                    <MenuItem disabled>
                      Please select a warehouse first
                    </MenuItem>
                  ) : companies && companies.length > 0 ? (
                    companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name} ({company.code}) - {company.transactionType}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>
                      {companiesLoading ? 'Loading companies...' : 'No companies found for this warehouse'}
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          {!selectedWarehouse && (
            <Alert severity="info">
              Please select a warehouse to view its ledger information.
            </Alert>
          )}

          {selectedWarehouse && (
            <>
              {/* Loading Indicator */}
              {(accountsLoading || entriesLoading || balanceLoading) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <CircularProgress />
                </Box>
              )}

              {/* Tabs */}
              <Paper sx={{ mb: 3 }}>
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab 
                    label="Chart of Accounts" 
                    sx={{ textTransform: 'none', fontSize: '1rem' }}
                  />
                  <Tab 
                    label="Transaction Entries" 
                    sx={{ textTransform: 'none', fontSize: '1rem' }}
                  />
                  <Tab 
                    label="Balance Summary" 
                    sx={{ textTransform: 'none', fontSize: '1rem' }}
                  />
                </Tabs>
              </Paper>

              {/* Tab Content */}
              <Paper sx={{ p: 3 }}>
                <TabPanel value={activeTab} index={0}>
                  {renderAccountsTab()}
                </TabPanel>
                <TabPanel value={activeTab} index={1}>
                  {renderEntriesTab()}
                </TabPanel>
                <TabPanel value={activeTab} index={2}>
                  {renderSummaryTab()}
                </TabPanel>
              </Paper>
            </>
          )}
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(AdminWarehouseLedgersPage)


