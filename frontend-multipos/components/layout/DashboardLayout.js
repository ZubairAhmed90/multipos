'use client'

import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { logout } from '../../app/store/slices/authSlice'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  CssBaseline,
} from '@mui/material'
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Brightness4,
  Brightness7,
} from '@mui/icons-material'
import { useColorMode } from '../../app/theme/ThemeProvider'
import Sidebar from './Sidebar'

const DashboardLayout = ({ children }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)
  
  const dispatch = useDispatch()
  const router = useRouter()
  const { user } = useSelector((state) => state.auth)
  const { toggleColorMode } = useColorMode()

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen)
    } else {
      // On desktop, toggle between collapsed and expanded states
      if (sidebarCollapsed) {
        setSidebarCollapsed(false)
        setSidebarOpen(true)
      } else if (sidebarOpen) {
        setSidebarCollapsed(true)
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
  }

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    dispatch(logout())
    router.push('/login')
    handleProfileMenuClose()
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.9) 0%, rgba(79, 70, 229, 0.9) 100%)'
            : 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%)',
          backdropFilter: 'blur(20px)',
          color: theme.palette.mode === 'dark' ? '#ffffff' : '#4c1d95',
          borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(147, 51, 234, 0.3)' : 'rgba(147, 51, 234, 0.2)'}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(147, 51, 234, 0.3)'
            : '0 8px 32px rgba(147, 51, 234, 0.15)',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            MultiPOS Dashboard
          </Typography>
          
          <IconButton color="inherit" onClick={toggleColorMode}>
            {theme.palette.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
          
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <AccountCircle />
          </IconButton>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {user?.username || user?.name || user?.email || 'User'}
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Sidebar 
        mobileOpen={mobileOpen}
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        onDrawerToggle={handleDrawerToggle}
        isMobile={isMobile}
      />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { 
            xs: '100%',
            md: sidebarCollapsed ? 'calc(100% - 70px)' : sidebarOpen ? 'calc(100% - 280px)' : '100%'
          },
          ml: { 
            xs: 0,
            md: sidebarCollapsed ? '70px' : sidebarOpen ? '280px' : 0
          },
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(15, 15, 15, 0.8) 0%, rgba(26, 26, 46, 0.8) 100%)'
            : 'linear-gradient(135deg, rgba(147, 51, 234, 0.05) 0%, rgba(79, 70, 229, 0.05) 100%)',
          backdropFilter: 'blur(20px)',
          minHeight: '100vh',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}

export default DashboardLayout

