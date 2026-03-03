'use client'

import { usePathname } from 'next/navigation'
import { useSelector } from 'react-redux'
import {
  Box,
  Breadcrumbs,
  Typography,
  Link,
  Chip,
} from '@mui/material'
import {
  Home,
  NavigateNext,
} from '@mui/icons-material'
import { getBreadcrumbPath } from '../../config/menuConfig'

const BreadcrumbNavigation = () => {
  const pathname = usePathname()
  const { user } = useSelector((state) => state.auth)
  const breadcrumbItems = getBreadcrumbPath(pathname)

  // Don't show breadcrumbs on login/register pages
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  // Don't show breadcrumbs if no items found
  if (!breadcrumbItems || breadcrumbItems.length === 0) {
    return null
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs 
        separator={<NavigateNext fontSize="small" />}
        aria-label="breadcrumb"
      >
        <Link
          href="/dashboard"
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            textDecoration: 'none',
            color: 'text.secondary'
          }}
        >
          <Home sx={{ mr: 0.5, fontSize: 16 }} />
          Dashboard
        </Link>
        
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1
          
          if (isLast) {
            return (
              <Typography 
                key={item.id} 
                color="text.primary"
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {item.icon}
                <Box component="span" sx={{ ml: 0.5 }}>
                  {item.label}
                </Box>
              </Typography>
            )
          }
          
          return (
            <Link
              key={item.id}
              href={item.path}
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                textDecoration: 'none',
                color: 'text.secondary'
              }}
            >
              {item.icon}
              <Box component="span" sx={{ ml: 0.5 }}>
                {item.label}
              </Box>
            </Link>
          )
        })}
      </Breadcrumbs>
      
      {/* Role indicator */}
      {user?.role && (
        <Box sx={{ mt: 1 }}>
          <Chip 
            label={`Role: ${user.role.replace('_', ' ').toUpperCase()}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
      )}
    </Box>
  )
}

export default BreadcrumbNavigation
