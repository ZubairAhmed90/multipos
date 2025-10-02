'use client'

import React from 'react'
import { useSelector } from 'react-redux'
import { usePermissions } from '../../hooks/usePermissions'

/**
 * RoleGuard component for conditional rendering based on user roles
 * @param {Object} props
 * @param {string|string[]} props.allowedRoles - Role(s) that can access this content
 * @param {React.ReactNode} props.children - Content to render if user has permission
 * @param {React.ReactNode} props.fallback - Content to render if user doesn't have permission
 * @param {boolean} props.requireAll - If true, user must have ALL roles (default: false, user needs ANY role)
 * @param {boolean} props.strict - If true, only exact role match (default: false, includes hierarchy)
 */
const RoleGuard = ({ 
  allowedRoles, 
  children, 
  fallback = null,
  requireAll = false,
  strict = false
}) => {
  const { user } = useSelector((state) => state.auth)
  
  if (!user) {
    return fallback
  }
  
  const hasPermission = () => {
    if (!allowedRoles) return true
    
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
    
    if (requireAll) {
      // User must have ALL specified roles
      return roles.every(role => user.role === role)
    } else {
      // User needs ANY of the specified roles
      if (strict) {
        return roles.includes(user.role)
      } else {
        // Include role hierarchy (ADMIN > WAREHOUSE_KEEPER > CASHIER)
        const roleHierarchy = {
          'ADMIN': ['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'],
          'WAREHOUSE_KEEPER': ['WAREHOUSE_KEEPER', 'CASHIER'],
          'CASHIER': ['CASHIER']
        }
        
        const userPermissions = roleHierarchy[user.role] || []
        return roles.some(role => userPermissions.includes(role))
      }
    }
  }
  
  return hasPermission() ? children : fallback
}

export default RoleGuard
