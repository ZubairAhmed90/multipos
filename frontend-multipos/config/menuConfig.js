import {
  Dashboard,
  Business,
  Warehouse,
  Category,
  ShoppingCart,
  PointOfSale,
  Schedule,
  AccountBalance,
  SwapHoriz,
  Assessment,
  BusinessCenter,
  Receipt,
  Devices,
  People,
  Settings,
  Store,
  Person,
  TrendingUp,
  Inventory,
  Assignment,
  BarChart,
  PieChart,
  Timeline,
  AdminPanelSettings,
  LocalShipping,
  ShoppingBag,
  PersonAdd,
} from '@mui/icons-material'

// Centralized menu configuration organized by sections
export const menuConfig = [
  // MAIN SECTION
  {
    id: 'main',
    label: 'MAIN',
    isSection: true,
    order: 1,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Dashboard />,
    path: '/dashboard',
    roles: ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
    order: 2,
    section: 'main',
  },
  {
    id: 'company',
    label: 'Company',
    icon: <BusinessCenter />,
    path: null,
    roles: ['ADMIN', 'WAREHOUSE_KEEPER'],
    order: 3,
    section: 'main',
    isGroup: true,
    children: [
      {
        id: 'branches',
        label: 'Branches',
        icon: <Business />,
        path: '/dashboard/branches',
        roles: ['ADMIN'],
        order: 1,
      },
      {
        id: 'companies',
        label: 'Companies',
        icon: <BusinessCenter />,
        path: '/dashboard/companies',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER'],
        order: 2,
      },
      {
        id: 'retailers',
        label: 'Retailers',
        icon: <Store />,
        path: '/dashboard/retailers',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER'],
        order: 3,
      },
    ],
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: <People />,
    path: null,
    roles: ['ADMIN'],
    order: 4,
    section: 'main',
    isGroup: true,
    children: [
      {
        id: 'users',
        label: 'Users',
        icon: <People />,
        path: '/dashboard/admin/users',
        roles: ['ADMIN'],
        order: 1,
      },
      {
        id: 'simplified-settings',
        label: 'Settings',
        icon: <Settings />,
        path: '/dashboard/admin/simplified-settings',
        roles: ['ADMIN'],
        order: 2,
      },
      {
        id: 'admin-inventory-sales',
        label: 'Inventory & Sales Overview',
        icon: <Assessment />,
        path: '/dashboard/admin/inventory-sales',
        roles: ['ADMIN'],
        order: 3,
      },
      {
        id: 'salespeople',
        label: 'Salesperson Management',
        icon: <PersonAdd />,
        path: '/dashboard/salespeople',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER'],
        order: 4,
      },
    ],
  },

  // SALES SECTION
  {
    id: 'sales-section',
    label: 'SALES',
    isSection: true,
    order: 5,
    roles: ['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: <ShoppingCart />,
    path: null,
    roles: ['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'],
    order: 6,
    section: 'sales',
    isGroup: true,
    children: [
      {
        id: 'pos',
        label: 'POS',
        icon: <PointOfSale />,
        path: '/dashboard/pos',
        roles: ['ADMIN', 'CASHIER'],
        order: 1,
      },
      {
        id: 'sales-management',
        label: 'Sales Management',
        icon: <ShoppingCart />,
        path: '/dashboard/sales',
        roles: ['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'],
        order: 2,
      },
      {
        id: 'returns',
        label: 'Returns',
        icon: <Receipt />,
        path: '/dashboard/returns',
        roles: ['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'],
        order: 3,
      },
      {
        id: 'shifts',
        label: 'Shifts',
        icon: <Schedule />,
        path: '/dashboard/shifts',
        roles: ['ADMIN'],
        order: 4,
      },
      {
        id: 'sales-ledger',
        label: 'Sales Ledger Management',
        icon: <AccountBalance />,
        path: '/dashboard/sales/ledger',
        roles: ['ADMIN', 'CASHIER'],
        order: 5,
      },
      {
        id: 'customer-ledger',
        label: 'Customer Ledger',
        icon: <Person />,
        path: '/dashboard/customer-ledger',
        roles: ['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'],
        order: 6,
      },
    ],
  },

  // WAREHOUSE SECTION (Hidden for CASHIER)
  {
    id: 'warehouse-section',
    label: 'WAREHOUSE',
    isSection: true,
    order: 7,
    roles: ['WAREHOUSE_KEEPER', 'ADMIN'], // Exclude CASHIER
  },
  {
    id: 'warehouse-billing',
    label: 'Warehouse Billing',
    icon: <Receipt />,
    path: '/dashboard/warehouse-billing',
    roles: ['WAREHOUSE_KEEPER', 'ADMIN'],
    order: 8,
    section: 'warehouse',
  },
  {
    id: 'warehouse-ledger',
    label: 'Warehouse Ledger',
    icon: <AccountBalance />,
    path: '/dashboard/warehouse-ledger',
    roles: ['WAREHOUSE_KEEPER'],
    order: 9,
    section: 'warehouse',
  },
  {
    id: 'warehouse-sales-analytics',
    label: 'Sales Analytics',
    icon: <Assessment />,
    path: '/dashboard/warehouse-ledger/warehouse-sales-analytics',
    roles: ['WAREHOUSE_KEEPER'],
    order: 10,
    section: 'warehouse',
  },

  // INVENTORY SECTION
  {
    id: 'inventory-section',
    label: 'INVENTORY',
    isSection: true,
    order: 9,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Inventory />,
    path: null,
    roles: ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
    order: 10,
    section: 'inventory',
    isGroup: true,
    children: [
      {
        id: 'inventory-management',
        label: 'Inventory Management',
        icon: <Category />,
        path: '/dashboard/inventory',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
        order: 1,
      },
      {
        id: 'warehouses',
        label: 'Warehouses',
        icon: <Warehouse />,
        path: '/dashboard/warehouses',
        roles: ['ADMIN'],
        order: 2,
      },
      {
        id: 'other-warehouses-inventory',
        label: 'Other Warehouses',
        icon: <Warehouse />,
        path: '/dashboard/other-warehouses-inventory',
        roles: ['WAREHOUSE_KEEPER'],
        order: 3,
      },
      {
        id: 'other-branches-inventory',
        label: 'Other Branches',
        icon: <Store />,
        path: '/dashboard/other-branches-inventory',
        roles: ['CASHIER'],
        order: 4,
      },
      {
        id: 'transfers',
        label: 'Transfers',
        icon: <SwapHoriz />,
        path: '/dashboard/transfers',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER'],
        order: 5,
      },
    ],
  },

  // REPORTS SECTION
  {
    id: 'reports-section',
    label: 'REPORTS',
    isSection: true,
    order: 11,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart />,
    path: '/dashboard/reports',
    roles: ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
    order: 10,
    section: 'reports',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <Assessment />,
    path: null,
    roles: ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
    order: 11,
    section: 'reports',
    isGroup: true,
    children: [
      {
        id: 'reports-all',
        label: 'All Reports',
        icon: <BarChart />,
        path: '/dashboard/reports',
        roles: ['ADMIN'],
        order: 1,
      },
      {
        id: 'reports-sales',
        label: 'Sales Reports',
        icon: <TrendingUp />,
        path: '/dashboard/reports/sales',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
        order: 2,
      },
      {
        id: 'reports-inventory',
        label: 'Inventory Reports',
        icon: <Inventory />,
        path: '/dashboard/reports/inventory',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER'],
        order: 3,
      },
      {
        id: 'reports-stock',
        label: 'Stock Reports',
        icon: <Assessment />,
        path: '/dashboard/stock-reports',
        roles: ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
        order: 4,
      },
      {
        id: 'reports-financial',
        label: 'Financial Vouchers',
        icon: <AccountBalance />,
        path: '/dashboard/financial-vouchers',
        roles: ['ADMIN'],
        order: 5,
      },
      {
        id: 'reports-ledger',
        label: 'Ledger Reports',
        icon: <AccountBalance />,
        path: '/dashboard/reports/ledger',
        roles: ['ADMIN'],
        order: 6,
      },
      {
        id: 'reports-daily',
        label: 'Daily Reports',
        icon: <Timeline />,
        path: '/dashboard/reports/daily',
        roles: ['CASHIER'],
        order: 6,
      },
      {
        id: 'reports-financial',
        label: 'Financial Reports',
        icon: <PieChart />,
        path: '/dashboard/reports/financial',
        roles: ['ADMIN'],
        order: 7,
      },
    ],
  },

  // SYSTEM SECTION (Hidden for CASHIER)
  {
    id: 'system-section',
    label: 'SYSTEM',
    isSection: true,
    order: 14,
    roles: ['ADMIN'], // Exclude CASHIER and WAREHOUSE_KEEPER
  },
  {
    id: 'ledger',
    label: 'Ledger',
    icon: <AccountBalance />,
    path: '/dashboard/ledger',
    roles: ['ADMIN'],
    order: 15,
    section: 'system',
  },
  {
    id: 'warehouse-ledger-admin',
    label: 'Warehouse Ledgers',
    icon: <AccountBalance />,
    path: '/dashboard/admin/warehouse-ledgers',
    roles: ['ADMIN'],
    order: 17,
    section: 'system',
  },
  {
    id: 'hardware',
    label: 'Hardware',
    icon: <Devices />,
    path: '/dashboard/hardware',
    roles: ['ADMIN'],
    order: 17,
    section: 'system',
  },
]

// Helper function to get menu items for a specific role
export const getMenuItemsForRole = (role) => {
  if (!role) return []
  
  return menuConfig
    .filter(item => {
      // Include section headers only if role has access
      if (item.isSection) {
        return !item.roles || item.roles.includes(role)
      }
      
      // Include items that the role has access to
      if (item.roles && item.roles.includes(role)) return true
      
      return false
    })
    .map(item => {
      if (item.isGroup && item.children) {
        return {
          ...item,
          children: item.children.filter(child => child.roles.includes(role))
        }
      }
      return item
    })
    .sort((a, b) => a.order - b.order)
}

// Helper function to check if a path is accessible for a role
export const isPathAccessibleForRole = (path, role) => {
  if (!role || !path) return false
  
  // Allow access to root paths for authenticated users
  if (path === '/' || path === '/dashboard') {
    return true
  }
  
  // Check direct menu items
  const directMatch = menuConfig.find(item => item.path === path && item.roles.includes(role))
  if (directMatch) return true
  
  // Check nested menu items
  const nestedMatch = menuConfig.find(item => 
    item.isGroup && 
    item.children && 
    item.children.some(child => child.path === path && child.roles.includes(role))
  )
  if (nestedMatch) return true
  
  // Check sub-paths (e.g., /dashboard/pos/terminal should be accessible if /dashboard/pos is accessible)
  const subPathMatch = menuConfig.find(item => {
    if (item.path && path.startsWith(item.path + '/') && item.roles.includes(role)) {
      return true
    }
    if (item.isGroup && item.children) {
      return item.children.some(child => 
        child.path && path.startsWith(child.path + '/') && child.roles.includes(role)
      )
    }
    return false
  })
  
  return !!subPathMatch
}

// Helper function to get all accessible paths for a role
export const getAllAccessiblePathsForRole = (role) => {
  if (!role) return []
  
  const paths = []
  
  menuConfig.forEach(item => {
    if (item.roles.includes(role)) {
      if (item.path) {
        paths.push(item.path)
      }
      if (item.isGroup && item.children) {
        item.children.forEach(child => {
          if (child.roles.includes(role) && child.path) {
            paths.push(child.path)
          }
        })
      }
    }
  })
  
  return paths
}

// Helper function to get menu item by path
export const getMenuItemByPath = (path) => {
  // Check direct menu items
  let item = menuConfig.find(item => item.path === path)
  if (item) return item
  
  // Check nested menu items
  for (const group of menuConfig) {
    if (group.isGroup && group.children) {
      item = group.children.find(child => child.path === path)
      if (item) return item
    }
  }
  
  return null
}

// Helper function to get breadcrumb path for navigation
export const getBreadcrumbPath = (path) => {
  const item = getMenuItemByPath(path)
  if (!item) return []
  
  // If it's a nested item, include parent
  for (const group of menuConfig) {
    if (group.isGroup && group.children) {
      const child = group.children.find(child => child.path === path)
      if (child) {
        return [group, child]
      }
    }
  }
  
  return [item]
}

export default menuConfig
