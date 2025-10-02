'use client'

import { useSelector } from 'react-redux'
import { isPathAccessibleForRole, getAllAccessiblePathsForRole } from '../config/menuConfig'

/**
 * Custom hook for permission checking and role-based access control
 * @returns {Object} Permission utilities and user context
 */
export const usePermissions = () => {
  const { user } = useSelector((state) => state.auth)
  const { branchSettings } = useSelector((state) => state.branches || { branchSettings: null })
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })

  /**
   * Check if user has specific role(s)
   * @param {string|string[]} roles - Role(s) to check
   * @param {boolean} requireAll - If true, user must have ALL roles
   * @returns {boolean}
   */
  const hasRole = (roles, requireAll = false) => {
    if (!user) return false
    
    const roleArray = Array.isArray(roles) ? roles : [roles]
    
    if (requireAll) {
      return roleArray.every(role => user.role === role)
    } else {
      return roleArray.includes(user.role)
    }
  }

  /**
   * Check if user has permission based on role hierarchy
   * @param {string|string[]} roles - Role(s) to check
   * @returns {boolean}
   */
  const hasRoleHierarchy = (roles) => {
    if (!user) return false
    
    const roleArray = Array.isArray(roles) ? roles : [roles]
    
    // Role hierarchy: ADMIN > MANAGER > WAREHOUSE_KEEPER > CASHIER
    const roleHierarchy = {
      'ADMIN': ['ADMIN', 'MANAGER', 'WAREHOUSE_KEEPER', 'CASHIER'],
      'MANAGER': ['MANAGER', 'WAREHOUSE_KEEPER', 'CASHIER'],
      'WAREHOUSE_KEEPER': ['WAREHOUSE_KEEPER', 'CASHIER'],
      'CASHIER': ['CASHIER']
    }
    
    const userPermissions = roleHierarchy[user.role] || []
    return roleArray.some(role => userPermissions.includes(role))
  }

  /**
   * Check branch-specific permissions
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    if (!user) return false
    
    // Admin has all permissions
    if (user.role === 'ADMIN') return true
    
    // Check branch-specific permissions (CASHIER ONLY)
    switch (permission) {
      case 'CASHIER_INVENTORY_EDIT':
        const cashierResult = branchSettings?.allowCashierInventoryEdit || false
        return cashierResult
      case 'WAREHOUSE_INVENTORY_EDIT':
        const warehouseResult = warehouseSettings?.allowWarehouseInventoryEdit || false
        return warehouseResult
      case 'CASHIER_RETURNS':
        return branchSettings?.allowReturnsByCashier || false
      case 'OPEN_ACCOUNT':
        return branchSettings?.openAccount || false
      default:
        return false
    }
  }

  /**
   * Check if user can access a specific path
   * @param {string} path - Path to check
   * @returns {boolean}
   */
  const canAccessPath = (path) => {
    if (!user) return false
    return isPathAccessibleForRole(path, user.role)
  }

  /**
   * Check if user can access specific branch
   * @param {string} branchId - Branch ID to check
   * @returns {boolean}
   */
  const canAccessBranch = (branchId) => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return user.branchId === branchId
  }

  /**
   * Check if user can access specific warehouse
   * @param {string} warehouseId - Warehouse ID to check
   * @returns {boolean}
   */
  const canAccessWarehouse = (warehouseId) => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return user.warehouseId === warehouseId
  }

  /**
   * Check if user can perform action on resource
   * @param {string} action - Action to perform (create, read, update, delete)
   * @param {string} resource - Resource type (inventory, sales, users, etc.)
   * @returns {boolean}
   */
  const canPerformAction = (action, resource) => {
    if (!user) return false
    
    // Admin can do everything
    if (user.role === 'ADMIN') return true
    
    const permissions = {
      // Inventory permissions
      'inventory': {
        'read': ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
        'create': ['ADMIN', 'WAREHOUSE_KEEPER'],
        'update': ['ADMIN', 'WAREHOUSE_KEEPER'],
        'delete': ['ADMIN', 'WAREHOUSE_KEEPER']
      },
      // Sales permissions
      'sales': {
        'read': ['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'],
        'create': ['ADMIN', 'CASHIER'],
        'update': ['ADMIN', 'CASHIER'],
        'delete': ['ADMIN']
      },
      // User permissions
      'users': {
        'read': ['ADMIN'],
        'create': ['ADMIN'],
        'update': ['ADMIN'],
        'delete': ['ADMIN']
      },
      // Branch permissions
      'branches': {
        'read': ['ADMIN', 'WAREHOUSE_KEEPER'],
        'create': ['ADMIN'],
        'update': ['ADMIN'],
        'delete': ['ADMIN']
      },
      // Warehouse permissions
      'warehouses': {
        'read': ['ADMIN', 'WAREHOUSE_KEEPER'],
        'create': ['ADMIN'],
        'update': ['ADMIN'],
        'delete': ['ADMIN']
      }
    }
    
    const resourcePermissions = permissions[resource]
    if (!resourcePermissions) return false
    
    const actionRoles = resourcePermissions[action]
    if (!actionRoles) return false
    
    return actionRoles.includes(user.role)
  }

  /**
   * Get user's accessible paths
   * @returns {string[]}
   */
  const getAccessiblePaths = () => {
    if (!user) return []
    
    const roleHierarchy = {
      'ADMIN': ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
      'WAREHOUSE_KEEPER': ['WAREHOUSE_KEEPER', 'CASHIER'],
      'CASHIER': ['CASHIER']
    }
    
    const userRoles = roleHierarchy[user.role] || []
    const paths = []
    
    // Get paths for all user roles
    userRoles.forEach(role => {
      const rolePaths = getAllAccessiblePathsForRole(role)
      paths.push(...rolePaths)
    })
    
    return [...new Set(paths)] // Remove duplicates
  }

  return {
    // User context
    user,
    isAuthenticated: !!user,
    
    // Role checks
    hasRole,
    hasRoleHierarchy,
    isAdmin: user?.role === 'ADMIN',
    isManager: user?.role === 'MANAGER',
    isWarehouseKeeper: user?.role === 'WAREHOUSE_KEEPER',
    isCashier: user?.role === 'CASHIER',
    
    // Permission checks
    hasPermission,
    canAccessPath,
    canAccessBranch,
    canAccessWarehouse,
    canPerformAction,
    
    // Utility functions
    getAccessiblePaths,
    
    // Branch context
    branchSettings,
    currentBranch: user?.branchId,
    currentWarehouse: user?.warehouseId
  }
}
