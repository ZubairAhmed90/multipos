'use client'

import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  Button,
  Alert,
  Chip,
} from '@mui/material'
import {
  Assessment,
  TrendingUp,
  Inventory,
  AccountBalance,
  ArrowForward,
  ShowChart,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { fetchReportsSummary } from '../../store/slices/reportsSlice'

const ReportsPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()
  const { user } = useSelector((state) => state.auth)
  const { reportsSummary, isLoading, error } = useSelector((state) => state.reports)

  useEffect(() => {
    dispatch(fetchReportsSummary())
  }, [dispatch])

  const handleNavigateToReport = (reportType) => {
    router.push(`/dashboard/reports/${reportType}`)
  }

  const getRoleBasedReports = () => {
    switch (user?.role) {
      case 'ADMIN':
        return [
          {
            id: 'sales',
            title: 'Sales Reports',
            description: 'Detailed sales analytics, performance metrics, and transaction data',
            icon: <TrendingUp sx={{ fontSize: 40 }} />,
            color: 'primary.main',
            stats: { total: '125,000', growth: '+12.5%' }
          },
          {
            id: 'inventory',
            title: 'Inventory Reports',
            description: 'Stock levels, movement tracking, and low stock alerts',
            icon: <Inventory sx={{ fontSize: 40 }} />,
            color: 'warning.main',
            stats: { total: '1,250 items', alerts: '15 low stock' }
          },
          {
            id: 'ledger',
            title: 'Ledger Reports',
            description: 'Financial transactions, account balances, and cash flow',
            icon: <AccountBalance sx={{ fontSize: 40 }} />,
            color: 'success.main',
            stats: { total: '177,000', transactions: '300' }
          },
          {
            id: 'financial',
            title: 'Financial Reports',
            description: 'Comprehensive financial analysis, profitability metrics, and cash flow insights',
            icon: <ShowChart sx={{ fontSize: 40 }} />,
            color: 'info.main',
            stats: { total: '500,000', margin: '18%' }
          },
        ]
      case 'WAREHOUSE_KEEPER':
        return [
          {
            id: 'inventory',
            title: 'Inventory Reports',
            description: 'Stock levels, movement tracking, and low stock alerts for your warehouse',
            icon: <Inventory sx={{ fontSize: 40 }} />,
            color: 'warning.main',
            stats: { 
              total: `${reportsSummary?.totalInventory || 0} items`, 
              alerts: `${reportsSummary?.lowStockItems || 0} low stock` 
            }
          },
          {
            id: 'sales',
            title: 'Sales Reports',
            description: 'Sales performance for your warehouse operations',
            icon: <TrendingUp sx={{ fontSize: 40 }} />,
            color: 'primary.main',
            stats: { 
              total: `${(reportsSummary?.totalRevenue || 0).toLocaleString()}`, 
              growth: `+${reportsSummary?.growthRate || 0}%` 
            }
          },
          {
            id: 'ledger',
            title: 'Ledger Reports',
            description: 'Financial transactions and account balances for your warehouse',
            icon: <AccountBalance sx={{ fontSize: 40 }} />,
            color: 'success.main',
            stats: { 
              total: `${(reportsSummary?.totalLedgerEntries || 0).toLocaleString()}`, 
              transactions: `${reportsSummary?.totalTransactions || 0}` 
            }
          },
        ]
      case 'CASHIER':
        return [
          {
            id: 'sales',
            title: 'Daily Reports',
            description: 'Your daily sales performance and transaction summary',
            icon: <TrendingUp sx={{ fontSize: 40 }} />,
            color: 'primary.main',
            stats: { total: '2,500', transactions: '85' }
          },
        ]
      default:
        return []
    }
  }

  const reports = getRoleBasedReports()

  return (
    <DashboardLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Reports Dashboard
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Access detailed analytics and performance reports
            </Typography>
          </Box>
          <Chip 
            label={`${user?.role ? user.role.replace('_', ' ').toUpperCase() : 'N/A'}`} 
            color="primary" 
            variant="outlined" 
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Total Reports
                    </Typography>
                    <Typography variant="h4">
                      {reportsSummary?.totalReports || reports.length}
                    </Typography>
                  </Box>
                  <Assessment sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Last Updated
                    </Typography>
                    <Typography variant="h6">
                      {reportsSummary?.lastUpdated || '2 min ago'}
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Data Points
                    </Typography>
                    <Typography variant="h4">
                      {reportsSummary?.dataPoints || '15,420'}
                    </Typography>
                  </Box>
                  <Inventory sx={{ fontSize: 40, color: 'info.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Status
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {reportsSummary?.status || 'Active'}
                    </Typography>
                  </Box>
                  <AccountBalance sx={{ fontSize: 40, color: 'success.main' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Report Cards */}
        <Grid container spacing={3}>
          {reports.map((report) => (
            <Grid item xs={12} size={{ xs: 12, md: 6, lg: 4 }} key={report.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ color: report.color, mr: 2 }}>
                      {report.icon}
                    </Box>
                    <Typography variant="h6" component="div">
                      {report.title}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    {report.description}
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" color={report.color}>
                        {report.stats.total}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {report.stats.growth || report.stats.alerts || report.stats.transactions}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
                
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowForward />}
                    onClick={() => handleNavigateToReport(report.id)}
                    sx={{ 
                      backgroundColor: report.color,
                      '&:hover': {
                        backgroundColor: report.color,
                        opacity: 0.9
                      }
                    }}
                  >
                    View Report
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Quick Actions */}
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<Assessment />}>
              Export All Reports
            </Button>
            <Button variant="outlined" startIcon={<TrendingUp />}>
              Schedule Reports
            </Button>
            <Button variant="outlined" startIcon={<Inventory />}>
              Set Alerts
            </Button>
          </Box>
        </Paper>
      </Box>
    </DashboardLayout>
  )
}

export default ReportsPage