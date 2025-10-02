'use client'

import React from 'react'
import { usePermissions } from '../../hooks/usePermissions'

/**
 * PermissionCheck component for conditional rendering based on permissions
 * @param {Object} props
 * @param {string} props.permission - Permission to check
 * @param {string} props.action - Action to perform (create, read, update, delete)
 * @param {string} props.resource - Resource type (inventory, sales, users, etc.)
 * @param {string|string[]} props.roles - Role(s) to check
 * @param {React.ReactNode} props.children - Content to render if user has permission
 * @param {React.ReactNode} props.fallback - Content to render if user doesn't have permission
 * @param {boolean} props.strict - If true, only exact role match
 */
const PermissionCheck = ({ 
  permission,
  action,
  resource,
  roles,
  children, 
  fallback = null,
  strict = false
}) => {
  const { 
    hasPermission, 
    canPerformAction, 
    hasRole, 
    hasRoleHierarchy,
    isAdmin 
  } = usePermissions()
  
  const hasAccess = () => {
    // Admin has all permissions
    if (isAdmin) return true
    
    // Check specific permission
    if (permission) {
      const result = hasPermission(permission)
      return result
    }
    
    // Check action on resource
    if (action && resource) {
      return canPerformAction(action, resource)
    }
    
    // Check role-based access
    if (roles) {
      return strict ? hasRole(roles) : hasRoleHierarchy(roles)
    }
    
    return false
  }
  
  return hasAccess() ? children : fallback
}

export default PermissionCheck
