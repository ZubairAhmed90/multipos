'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import api from '../../utils/axios'
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material'
import {
  TrendingUp,
  ShoppingCart,
  People,
  Inventory,
  Business,
  Warehouse,
  PointOfSale,
  Assessment,
  Add,
  ArrowForward,
  TrendingDown,
  AttachMoney,
  Store,
  Schedule,
  SwapHoriz,
} from '@mui/icons-material'

const StatCard = ({ title, value, icon, color = 'primary', trend, trendValue, subtitle, onClick }) => {
  const theme = useTheme()
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.08)} 0%, ${alpha(theme.palette[color].main, 0.03)} 100%)`,
        border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        borderRadius: '16px',
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 32px ${alpha(theme.palette[color].main, 0.3)}`,
        } : {},
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '60px',
          height: '60px',
          background: `radial-gradient(circle, ${alpha(theme.palette[color].main, 0.1)} 0%, transparent 70%)`,
          borderRadius: '50%',
          transform: 'translate(20px, -20px)',
        }
      }}
      onClick={onClick}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
        <Box>
            <Typography 
              color="textSecondary" 
              gutterBottom 
              variant="body2"
              sx={{ 
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.75rem',
              }}
            >
            {title}
          </Typography>
            <Typography 
              variant="h4" 
              component="h2"
              sx={{ 
                fontWeight: 700,
                color: theme.palette.mode === 'dark' ? '#ffffff' : '#1a1a1a',
                mb: 1,
              }}
            >
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          )}
        </Box>
          <Avatar
            sx={{
              bgcolor: alpha(theme.palette[color].main, 0.1),
              color: theme.palette[color].main,
              width: 56,
              height: 56,
              border: `2px solid ${alpha(theme.palette[color].main, 0.2)}`,
            }}
          >
          {icon}
          </Avatar>
        </Box>
        
        {trend && (
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              icon={trend === 'up' ? <TrendingUp /> : <TrendingDown />}
              label={`${trendValue}%`}
              size="small"
              color={trend === 'up' ? 'success' : 'error'}
              sx={{ 
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
            <Typography variant="body2" color="textSecondary">
              vs last month
            </Typography>
      </Box>
        )}
    </CardContent>
  </Card>
  )
}

const QuickActionCard = ({ title, description, icon, color, href, onClick }) => {
  const theme = useTheme()
  const router = useRouter()
  
  const handleClick = () => {
    if (href) {
      router.push(href)
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <Card 
      sx={{ 
        height: '100%',
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.08)} 0%, ${alpha(theme.palette[color].main, 0.03)} 100%)`,
        border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        borderRadius: '16px',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 32px ${alpha(theme.palette[color].main, 0.3)}`,
        },
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar
            sx={{
              bgcolor: alpha(theme.palette[color].main, 0.1),
              color: theme.palette[color].main,
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {description}
            </Typography>
          </Box>
        </Box>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          size="small"
          endIcon={<ArrowForward />}
          sx={{ 
            color: theme.palette[color].main,
            fontWeight: 600,
            textTransform: 'none',
          }}
        >
          Get Started
        </Button>
      </CardActions>
    </Card>
  )
}

export default function DashboardPage() {
  const theme = useTheme()
  const { user: originalUser } = useSelector((state) => state.auth)
  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [forcedScope, setForcedScope] = useState(null) // allow explicit scopeType/scopeId via query
  const [dashboardData, setDashboardData] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
    lowStockItems: 0,
    pendingTransfers: 0,
    branches: 0,
    warehouses: 0,
    scopeProductCount: 0,
  })
  const [loading, setLoading] = useState(true)

  // Parse URL params to allow admin scope switching (branch/warehouse)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const role = params.get('role')
    const scope = params.get('scope')
    const id = params.get('id')
    const scopeTypeParam = params.get('scopeType')
    const scopeIdParam = params.get('scopeId')

    if (role && scope && id && originalUser?.role === 'ADMIN') {
      setUrlParams({ role, scope, id })
      setIsAdminMode(true)
    } else {
      setUrlParams({})
      setIsAdminMode(false)
    }

    if (scopeTypeParam && scopeIdParam) {
      setForcedScope({
        scopeType: scopeTypeParam.toUpperCase(),
        scopeId: scopeIdParam
      })
    } else {
      setForcedScope(null)
    }
  }, [originalUser])

  const getEffectiveUser = useCallback((baseUser) => {
    if (!baseUser) {
      return null
    }

    if (!isAdminMode || !urlParams.role) {
      return baseUser
    }

    const scopedId = urlParams.id ? parseInt(urlParams.id, 10) : null
    const isBranchScope = urlParams.scope === 'branch'
    const isWarehouseScope = urlParams.scope === 'warehouse'

    return {
      ...baseUser,
      role: urlParams.role.toUpperCase(),
      branchId: isBranchScope ? scopedId : null,
      warehouseId: isWarehouseScope ? scopedId : null,
      branchName: isBranchScope ? `Branch ${urlParams.id}` : baseUser.branchName,
      warehouseName: isWarehouseScope ? `Warehouse ${urlParams.id}` : baseUser.warehouseName,
      isAdminMode: true,
      originalRole: baseUser.role,
      originalUser: baseUser,
    }
  }, [isAdminMode, urlParams])

  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.scope || !urlParams.id) {
      return null
    }

    const scopeType = urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE'
    return {
      scopeType,
      scopeId: urlParams.id,
      scopeName: scopeType === 'BRANCH' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`,
    }
  }, [isAdminMode, urlParams])

  const user = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true)
      
      try {
        if (!user) {
          setDashboardData((prev) => ({ ...prev }))
          return
        }

        let scopeType = scopeInfo?.scopeType || null
        let scopeId = scopeInfo?.scopeId || null

        // Forced scope from query (applies for any role)
        if (forcedScope?.scopeType && forcedScope?.scopeId) {
          scopeType = forcedScope.scopeType
          scopeId = forcedScope.scopeId
        }

        if (!scopeType) {
          if (user.role === 'CASHIER' && user.branchId) {
            scopeType = 'BRANCH'
            scopeId = user.branchId
          } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
            scopeType = 'WAREHOUSE'
            scopeId = user.warehouseId
          }
        }

        const params = {}
        if (scopeType && scopeId) {
          params.scopeType = scopeType
          params.scopeId = scopeId
        }

        const response = await api.get('/dashboard/summary', {
          params,
        })

        const payload = response.data
        const resultData = payload?.data || payload

        if (resultData) {
          // Always sync product count with scoped inventory list so dashboard matches inventory page
          let scopedProductCount = resultData.scopeProductCount
          if (scopeType && scopeId) {
            try {
              const inventoryResponse = await api.get('/inventory', {
                params: {
                  scopeType,
                  scopeId,
                  limit: 'all',
                },
              })

              const inventoryPayload = inventoryResponse.data
              const inventoryData = inventoryPayload?.data || inventoryPayload || []

              if (Array.isArray(inventoryData)) {
                scopedProductCount = inventoryData.length
              } else if (typeof inventoryData === 'object' && inventoryData !== null) {
                const possibleCount = inventoryData.total || inventoryData.count || inventoryData.items?.length || inventoryData.data?.length
                if (typeof possibleCount === 'number') {
                  scopedProductCount = possibleCount
                }
              }
            } catch (inventoryError) {
              // Silent fallback; keep previous values on failure
              console.warn('Failed to fetch scoped inventory count:', inventoryError?.message || inventoryError)
            }
          }

          const finalScopedProductCount =
            scopedProductCount ?? resultData.totalProducts ?? 0

          setDashboardData({
            totalSales: resultData.totalSales || 0,
            totalOrders: resultData.totalOrders || 0,
            totalCustomers: resultData.totalCustomers || 0,
            totalProducts: resultData.totalProducts || 0,
            lowStockItems: resultData.lowStockItems || 0,
            pendingTransfers: resultData.pendingTransfers || 0,
            branches: resultData.branches || 0,
            warehouses: resultData.warehouses || 0,
            scopeProductCount: finalScopedProductCount,
          })
        } else {
          setDashboardData({
            totalSales: 0,
            totalOrders: 0,
            totalCustomers: 0,
            totalProducts: 0,
            lowStockItems: 0,
            pendingTransfers: 0,
            branches: 0,
            warehouses: 0,
            scopeProductCount: 0,
          })
        }
      } catch (error) {
        // Set default values on error
        setDashboardData({
          totalSales: 0,
          totalOrders: 0,
          totalCustomers: 0,
          totalProducts: 0,
          lowStockItems: 0,
          pendingTransfers: 0,
          branches: 0,
          warehouses: 0,
          scopeProductCount: 0,
        })
      } finally {
        setLoading(false)
      }
    }
    
    loadDashboardData()
  }, [user, scopeInfo])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'ADMIN': return 'Administrator'
      case 'WAREHOUSE_KEEPER': return 'Warehouse Keeper'
      case 'CASHIER': return 'Cashier'
      default: return 'User'
    }
  }

  const getRoleSpecificGreeting = (role) => {
    switch (role) {
      case 'ADMIN': return 'Welcome to your Petzone dashboard. Here\'s what\'s happening across your business.'
      case 'WAREHOUSE_KEEPER': return 'Welcome to your warehouse dashboard. Manage inventory and track operations.'
      case 'CASHIER': return 'Welcome to your POS dashboard. Ready to process sales and serve customers.'
      default: return 'Welcome to your Petzone dashboard.'
    }
  }

  const getRoleSpecificStats = (role) => {
    switch (role) {
      case 'ADMIN':
        return [
          { title: "Total Sales", value: loading ? "..." : dashboardData.totalSales > 0 ? `${dashboardData.totalSales.toLocaleString()}` : "No data", icon: <AttachMoney sx={{ fontSize: 28 }} />, color: "success", subtitle: "This month" },
          { title: "Total Orders", value: loading ? "..." : dashboardData.totalOrders > 0 ? dashboardData.totalOrders.toLocaleString() : "No data", icon: <ShoppingCart sx={{ fontSize: 28 }} />, color: "primary", subtitle: "Orders processed" },
          { title: "Customers", value: loading ? "..." : dashboardData.totalCustomers > 0 ? dashboardData.totalCustomers.toLocaleString() : "No data", icon: <People sx={{ fontSize: 28 }} />, color: "info", subtitle: "Active customers" },
          { title: "Products", value: loading ? "..." : dashboardData.totalProducts > 0 ? dashboardData.totalProducts.toLocaleString() : "No data", icon: <Inventory sx={{ fontSize: 28 }} />, color: "warning", subtitle: "In inventory" }
        ]
      case 'WAREHOUSE_KEEPER':
        const warehouseProductCount =
          dashboardData.scopeProductCount ?? dashboardData.totalProducts ?? 0
        return [
          { title: "My Warehouse Items", value: loading ? "..." : warehouseProductCount.toLocaleString(), icon: <Inventory sx={{ fontSize: 28 }} />, color: "primary", subtitle: "Assigned warehouse" },
          { title: "My Warehouse", value: "1", icon: <Warehouse sx={{ fontSize: 28 }} />, color: "secondary", subtitle: "Assigned warehouse" },
          { title: "Low Stock Items", value: loading ? "..." : dashboardData.lowStockItems > 0 ? dashboardData.lowStockItems.toLocaleString() : "0", icon: <TrendingDown sx={{ fontSize: 28 }} />, color: "warning", subtitle: "Need restocking" },
          { title: "Transfers", value: loading ? "..." : dashboardData.pendingTransfers > 0 ? dashboardData.pendingTransfers.toLocaleString() : "0", icon: <SwapHoriz sx={{ fontSize: 28 }} />, color: "info", subtitle: "Pending transfers" }
        ]
      case 'CASHIER':
        const branchProductCount =
          dashboardData.scopeProductCount ?? dashboardData.totalProducts ?? 0
        return [
          { title: "My Products", value: loading ? "..." : branchProductCount.toLocaleString(), icon: <Inventory sx={{ fontSize: 28 }} />, color: "primary", subtitle: "Available in my branch" },
          { title: "Today's Sales", value: loading ? "..." : dashboardData.totalSales > 0 ? `${dashboardData.totalSales.toLocaleString()}` : "No data", icon: <AttachMoney sx={{ fontSize: 28 }} />, color: "success", subtitle: "Current shift" },
          { title: "Orders Today", value: loading ? "..." : dashboardData.totalOrders > 0 ? dashboardData.totalOrders.toLocaleString() : "No data", icon: <ShoppingCart sx={{ fontSize: 28 }} />, color: "info", subtitle: "Processed" },
          { title: "Active Shift", value: "Morning", icon: <Schedule sx={{ fontSize: 28 }} />, color: "secondary", subtitle: "Current shift" }
        ]
      default:
        return []
    }
  }

  const getRoleSpecificQuickActions = (role) => {
    switch (role) {
      case 'ADMIN':
        return [
          { title: "Manage Branches", description: "Add, edit, and manage your business branches", icon: <Business sx={{ fontSize: 24 }} />, color: "primary", href: "/dashboard/branches" },
          { title: "Manage Warehouses", description: "Control inventory and warehouse operations", icon: <Warehouse sx={{ fontSize: 24 }} />, color: "secondary", href: "/dashboard/warehouses" },
          { title: "User Management", description: "Manage users and permissions", icon: <People sx={{ fontSize: 24 }} />, color: "info", href: "/dashboard/admin/users" },
          { title: "Reports & Analytics", description: "View business insights and reports", icon: <Assessment sx={{ fontSize: 24 }} />, color: "warning", href: "/dashboard/reports" }
        ]
      case 'WAREHOUSE_KEEPER':
        return [
          { title: "My Inventory", description: "Manage inventory in your assigned warehouse", icon: <Inventory sx={{ fontSize: 24 }} />, color: "primary", href: "/dashboard/inventory" },
          { title: "My Warehouse", description: "View your assigned warehouse details", icon: <Warehouse sx={{ fontSize: 24 }} />, color: "secondary", href: "/dashboard/warehouses" },
          { title: "Stock Transfers", description: "Process transfers for your warehouse", icon: <SwapHoriz sx={{ fontSize: 24 }} />, color: "info", href: "/dashboard/transfers" },
          { title: "Inventory Reports", description: "View reports for your warehouse", icon: <Assessment sx={{ fontSize: 24 }} />, color: "warning", href: "/dashboard/reports" }
        ]
      case 'CASHIER':
        return [
          { title: "My Products", description: "Manage products in your branch (Admin permission required)", icon: <Inventory sx={{ fontSize: 24 }} />, color: "primary", href: "/dashboard/inventory" },
          { title: "Point of Sale", description: "Process sales and manage transactions", icon: <PointOfSale sx={{ fontSize: 24 }} />, color: "success", href: "/dashboard/pos" },
          { title: "My Sales", description: "View and manage your sales records", icon: <ShoppingCart sx={{ fontSize: 24 }} />, color: "info", href: "/dashboard/sales" },
          { title: "My Customers", description: "Manage customer information", icon: <People sx={{ fontSize: 24 }} />, color: "secondary", href: "/dashboard/customers" }
        ]
      default:
        return []
    }
  }

  return (
    <DashboardLayout>
      <Box>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h4" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              background: theme.palette.mode === 'dark' 
                ? 'linear-gradient(45deg, #ffffff 30%, #e3f2fd 90%)'
                : 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {getGreeting()}, {user?.name || 'User'}!
            </Typography>
          <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 2 }}>
            {getRoleSpecificGreeting(user?.role)}
            </Typography>
          <Chip
            label={getRoleDisplayName(user?.role)}
            color="primary"
              variant="outlined" 
            sx={{ fontWeight: 600 }}
          />
        </Box>
        
        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {getRoleSpecificStats(user?.role).map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <StatCard
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                subtitle={stat.subtitle}
              />
            </Grid>
          ))}
        </Grid>

        {/* Quick Actions */}
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Quick Actions
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {getRoleSpecificQuickActions(user?.role).map((action, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <QuickActionCard
                title={action.title}
                description={action.description}
                icon={action.icon}
                color={action.color}
                href={action.href}
              />
            </Grid>
          ))}
        </Grid>

        {/* System Status */}
        <Paper 
          sx={{ 
            p: 3, 
            borderRadius: '16px',
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(25, 118, 210, 0.03) 100%)',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            {user?.role === 'ADMIN' ? 'System Status' : 
             user?.role === 'WAREHOUSE_KEEPER' ? 'Warehouse Status' : 
             'POS Status'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
            <Typography variant="body2">
              {user?.role === 'ADMIN' ? 'All systems operational' : 
               user?.role === 'WAREHOUSE_KEEPER' ? 'Warehouse operations active' : 
               'POS system ready'}
            </Typography>
          </Box>
          <Typography variant="body2" color="textSecondary">
            Last updated: {new Date().toLocaleString()}
          </Typography>
        </Paper>
      </Box>
    </DashboardLayout>
  )
}