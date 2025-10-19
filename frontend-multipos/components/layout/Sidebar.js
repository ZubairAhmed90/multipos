'use client'

import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useRouter, usePathname } from 'next/navigation'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Collapse,
  Chip,
  Box,
  Divider,
  useTheme,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  ExpandLess,
  ExpandMore,
  Business,
  Warehouse,
} from '@mui/icons-material'
import { getMenuItemsForRole } from '../../config/menuConfig'
import { usePermissions } from '../../hooks/usePermissions'

const drawerWidth = 280
const collapsedDrawerWidth = 70

const Sidebar = ({ mobileOpen, sidebarOpen = true, sidebarCollapsed = false, onDrawerToggle, isMobile }) => {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useSelector((state) => state.auth)
  const [expandedMenus, setExpandedMenus] = useState({})
  const [contextMenu, setContextMenu] = useState(null)
  const [contextMenuPath, setContextMenuPath] = useState(null)
  
  const { 
    hasPermission, 
    currentBranch: userBranch, 
    currentWarehouse: userWarehouse 
  } = usePermissions()

  const handleNavigation = (path) => {
    router.push(path)
    
    if (isMobile) {
      onDrawerToggle()
    }
  }

  const handleContextMenu = (event, path) => {
    event.preventDefault()
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
    })
    setContextMenuPath(path)
  }

  const handleCloseContextMenu = () => {
    setContextMenu(null)
    setContextMenuPath(null)
  }

  const handleOpenInNewTab = () => {
    if (contextMenuPath) {
      window.open(contextMenuPath, '_blank')
    }
    handleCloseContextMenu()
  }

  const handleMenuToggle = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }))
  }

  const renderSectionHeader = (item) => {
    if (sidebarCollapsed) return null
    
    return (
      <Box key={item.id} sx={{ px: 2, py: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.mode === 'dark' ? '#888888' : '#666666',
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {item.label}
        </Typography>
      </Box>
    )
  }

  const renderMenuItem = (item) => {
    // Handle section headers
    if (item.isSection) {
      return renderSectionHeader(item)
    }

    // Handle group items with children
    if (item.isGroup && item.children) {
      const isExpanded = expandedMenus[item.id] || false
      
      const groupItem = (
        <div key={item.id}>
          <ListItem disablePadding sx={{ px: sidebarCollapsed ? 0 : 1 }}>
            <ListItemButton 
              onClick={() => !sidebarCollapsed && handleMenuToggle(item.id)}
              sx={{
                minHeight: 36,
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                px: sidebarCollapsed ? 1 : 1.5,
                py: 0.25,
                mb: 0.25,
                mx: 1,
                background: expandedMenus[item.id] 
                  ? theme.palette.mode === 'dark' ? '#2a2a2a' : '#f0f0f0'
                  : 'transparent',
                '&:hover': {
                  background: theme.palette.mode === 'dark'
                    ? '#2a2a2a'
                    : '#f5f5f5',
                },
              }}
            >
              <ListItemIcon sx={{ 
                minWidth: sidebarCollapsed ? 'auto' : 36,
                justifyContent: 'center',
                color: expandedMenus[item.id] 
                  ? theme.palette.mode === 'dark' ? '#bb86fc' : '#7c3aed'
                  : '#1976d2',
                fontSize: '18px',
                '& .MuiSvgIcon-root': {
                  fontSize: '18px',
                },
              }}>
                {item.icon}
              </ListItemIcon>
              {!sidebarCollapsed && (
                <>
                  <ListItemText 
                    primary={item.label}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        color: theme.palette.mode === 'dark' ? '#ffffff' : '#333333',
                      }
                    }}
                  />
                  <Box sx={{ 
                    color: '#1976d2',
                    transition: 'transform 0.2s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </Box>
                </>
              )}
            </ListItemButton>
          </ListItem>
          {!sidebarCollapsed && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding sx={{ px: 1 }}>
                {item.children.map((child) => (
                  <ListItem key={child.id} disablePadding>
                    <ListItemButton 
                      sx={{ 
                        pl: 3.5,
                        pr: 1.5,
                        minHeight: 32,
                        borderRadius: '6px',
                        transition: 'all 0.2s ease',
                        mb: 0.25,
                        mx: 1,
                        py: 0.25,
                        '&:hover': {
                          background: theme.palette.mode === 'dark'
                            ? '#2a2a2a'
                            : '#f5f5f5',
                        },
                      }}
                      onClick={() => handleNavigation(child.path)}
                      onContextMenu={(e) => handleContextMenu(e, child.path)}
                    >
                      <ListItemIcon sx={{ 
                        minWidth: 32,
                        justifyContent: 'center',
                        color: '#1976d2',
                        fontSize: '16px',
                        '& .MuiSvgIcon-root': {
                          fontSize: '16px',
                        },
                      }}>
                        {child.icon}
                      </ListItemIcon>
                      <ListItemText 
                        primary={child.label}
                        sx={{
                          '& .MuiListItemText-primary': {
                            fontSize: '0.85rem',
                            color: theme.palette.mode === 'dark' ? '#cccccc' : '#666666',
                          }
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          )}
        </div>
      )

      // Wrap with tooltip if collapsed
      if (sidebarCollapsed) {
        return (
          <Tooltip 
            key={item.id}
            title={item.label} 
            placement="right"
            arrow
            enterDelay={300}
            leaveDelay={100}
          >
            {groupItem}
          </Tooltip>
        )
      }

      return groupItem
    }
    
    // Handle regular menu items
    const menuItem = (
      <ListItem key={item.id} disablePadding sx={{ px: sidebarCollapsed ? 0 : 1 }}>
        <ListItemButton 
          onClick={() => handleNavigation(item.path)}
          onContextMenu={(e) => handleContextMenu(e, item.path)}
          sx={{
            minHeight: 36,
            borderRadius: '6px',
            transition: 'all 0.2s ease',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            px: sidebarCollapsed ? 1 : 1.5,
            py: 0.25,
            mb: 0.25,
            mx: 1,
            background: pathname === item.path 
              ? theme.palette.mode === 'dark' ? '#2a2a2a' : '#f0f0f0'
              : 'transparent',
            '&:hover': {
              background: theme.palette.mode === 'dark'
                ? '#2a2a2a'
                : '#f5f5f5',
            },
          }}
        >
          <ListItemIcon sx={{ 
            minWidth: sidebarCollapsed ? 'auto' : 36,
            justifyContent: 'center',
            color: pathname === item.path 
              ? theme.palette.mode === 'dark' ? '#bb86fc' : '#7c3aed'
              : '#1976d2',
            fontSize: '18px',
            '& .MuiSvgIcon-root': {
              fontSize: '18px',
            },
          }}>
            {item.icon}
          </ListItemIcon>
          {!sidebarCollapsed && (
            <ListItemText 
              primary={item.label}
              sx={{
                '& .MuiListItemText-primary': {
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  color: theme.palette.mode === 'dark' ? '#ffffff' : '#333333',
                }
              }}
            />
          )}
        </ListItemButton>
      </ListItem>
    )

    // Wrap with tooltip if collapsed
    if (sidebarCollapsed) {
      return (
        <Tooltip 
          key={item.id}
          title={item.label} 
          placement="right"
          arrow
          enterDelay={300}
          leaveDelay={100}
        >
          {menuItem}
        </Tooltip>
      )
    }

    return menuItem
  }

  const menuItems = getMenuItemsForRole(user?.role)

  const drawer = (
    <Box sx={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: theme.palette.mode === 'dark'
        ? 'linear-gradient(180deg, rgba(147, 51, 234, 0.9) 0%, rgba(79, 70, 229, 0.9) 100%)'
        : 'linear-gradient(180deg, rgba(147, 51, 234, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%)',
      backdropFilter: 'blur(20px)',
      borderRight: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(147, 51, 234, 0.3)' : 'rgba(147, 51, 234, 0.2)'}`,
      position: 'relative',
      boxShadow: theme.palette.mode === 'dark'
        ? '0 8px 32px rgba(147, 51, 234, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
        : '0 8px 32px rgba(147, 51, 234, 0.15), 0 0 0 1px rgba(147, 51, 234, 0.1)',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at 20% 20%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)'
          : 'radial-gradient(circle at 20% 20%, rgba(147, 51, 234, 0.05) 0%, transparent 50%)',
        pointerEvents: 'none',
      },
    }}>
      <Toolbar sx={{ 
        minHeight: '64px !important',
        px: sidebarCollapsed ? 1 : 2,
        position: 'relative',
        zIndex: 1,
        flexShrink: 0,
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
      }}>
        {sidebarCollapsed ? (
          <Box sx={{ 
            width: 40,
            height: 40,
            borderRadius: '8px',
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(147, 51, 234, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 'bold',
            color: theme.palette.mode === 'dark' ? '#bb86fc' : '#7c3aed',
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(187, 134, 252, 0.3)' : 'rgba(124, 58, 237, 0.3)'}`,
          }}>
            M
          </Box>
        ) : (
          <Typography 
            variant="h6" 
            noWrap 
            component="div"
            sx={{
              fontWeight: 600,
              letterSpacing: '0.5px',
              background: theme.palette.mode === 'dark' 
                ? 'linear-gradient(45deg, #ffffff 30%, #e3f2fd 90%)'
                : 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            MultiPOS
          </Typography>
        )}
      </Toolbar>
      
      <List sx={{ 
        px: sidebarCollapsed ? 0 : 1,
        py: 0.5,
        position: 'relative',
        zIndex: 1,
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: theme.palette.mode === 'dark' 
            ? 'rgba(147, 51, 234, 0.3)' 
            : 'rgba(147, 51, 234, 0.2)',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: theme.palette.mode === 'dark' 
            ? 'rgba(147, 51, 234, 0.5)' 
            : 'rgba(147, 51, 234, 0.3)',
        },
      }}>
        {menuItems.map((item) => renderMenuItem(item))}
      </List>
    </Box>
  )

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth,
            touchAction: 'pan-y',
          },
        }}
      >
        {drawer}
      </Drawer>
      
      {/* Desktop drawer */}
      <Drawer
        variant="persistent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: sidebarCollapsed ? collapsedDrawerWidth : drawerWidth,
            transition: 'width 0.3s ease',
            overflowX: 'hidden',
          },
        }}
        open={sidebarOpen || sidebarCollapsed}
      >
        {drawer}
      </Drawer>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        PaperProps={{
          sx: {
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            minWidth: 160,
          }
        }}
      >
        <MenuItem onClick={handleOpenInNewTab} sx={{ fontSize: '0.9rem' }}>
          Open in new tab
        </MenuItem>
      </Menu>
    </>
  )
}

export default Sidebar