'use client'

import React, { useMemo } from 'react'
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Paper,
  Typography,
  Chip,
  useTheme,
} from '@mui/material'
import {
  DataGrid,
  GridToolbar,
  GridActionsCellItem,
  GridRowParams,
  GridColDef,
} from '@mui/x-data-grid'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'

const EntityTable = ({
  // Data
  data = [],
  loading = false,
  
  // Configuration
  columns = [],
  title = 'Entities',
  entityName = 'entity',
  
  // Actions
  onAdd,
  onEdit,
  onDelete,
  onView,
  onRefresh,
  
  // Customization
  getRowId = (row) => row.id,
  height = 400,
  showToolbar = true,
  showAddButton = true,
  showActions = true,
  customActions = [],
  
  // Styling
  sx = {},
}) => {
  const theme = useTheme()
  
  // Prepare columns with actions
  const columnsWithActions = useMemo(() => {
    const cols = [...columns]
    
    if (showActions && (onEdit || onDelete || onView || customActions.length > 0)) {
      const actions = []
      
      if (onView) {
        actions.push({
          field: 'actions',
          type: 'actions',
          headerName: 'Actions',
          width: 120,
          getActions: (params) => [
            <GridActionsCellItem
              key="view"
              icon={<ViewIcon />}
              label="View"
              onClick={() => onView(params.row)}
              color="info"
            />,
          ],
        })
      }
      
      if (onEdit) {
        actions.push({
          field: 'actions',
          type: 'actions',
          headerName: 'Actions',
          width: 120,
          getActions: (params) => [
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Edit"
              onClick={() => onEdit(params.row)}
              color="primary"
            />,
          ],
        })
      }
      
      if (onDelete) {
        actions.push({
          field: 'actions',
          type: 'actions',
          headerName: 'Actions',
          width: 120,
          getActions: (params) => [
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label="Delete"
              onClick={() => onDelete(params.row)}
              color="error"
            />,
          ],
        })
      }
      
      // Add custom actions
      customActions.forEach((action, index) => {
        actions.push({
          field: 'actions',
          type: 'actions',
          headerName: 'Actions',
          width: 120,
          getActions: (params) => [
            <GridActionsCellItem
              key={`custom-${index}`}
              icon={action.icon}
              label={action.label}
              onClick={() => action.onClick(params.row)}
              color={action.color || 'default'}
            />,
          ],
        })
      })
      
      // Merge all actions into one column
      if (actions.length > 0) {
        const allActions = actions.reduce((acc, action) => {
          return acc.concat(action.getActions({ row: {} }))
        }, [])
        
        cols.push({
          field: 'actions',
          type: 'actions',
          headerName: 'Actions',
          width: Math.max(120, actions.length * 40),
          getActions: (params) => {
            const rowActions = []
            
            if (onView) {
              rowActions.push(
                <GridActionsCellItem
                  key="view"
                  icon={<ViewIcon />}
                  label="View"
                  onClick={() => onView(params.row)}
                  color="info"
                />
              )
            }
            
            if (onEdit) {
              rowActions.push(
                <GridActionsCellItem
                  key="edit"
                  icon={<EditIcon />}
                  label="Edit"
                  onClick={() => onEdit(params.row)}
                  color="primary"
                />
              )
            }
            
            if (onDelete) {
              rowActions.push(
                <GridActionsCellItem
                  key="delete"
                  icon={<DeleteIcon />}
                  label="Delete"
                  onClick={() => onDelete(params.row)}
                  color="error"
                />
              )
            }
            
            customActions.forEach((action, index) => {
              rowActions.push(
                <GridActionsCellItem
                  key={`custom-${index}`}
                  icon={action.icon}
                  label={action.label}
                  onClick={() => action.onClick(params.row)}
                  color={action.color || 'default'}
                />
              )
            })
            
            return rowActions
          },
        })
      }
    }
    
    return cols
  }, [columns, showActions, onEdit, onDelete, onView, customActions])


  return (
    <Paper sx={{ 
      p: 3, 
      borderRadius: '16px',
      background: theme.palette.mode === 'dark'
        ? 'linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(22, 33, 62, 0.8) 100%)'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 249, 255, 0.9) 100%)',
      backdropFilter: 'blur(20px)',
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: theme.palette.mode === 'dark'
        ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
        : '0 8px 32px rgba(102, 126, 234, 0.15), 0 0 0 1px rgba(102, 126, 234, 0.1)',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.1) 0%, transparent 50%)'
          : 'radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.05) 0%, transparent 50%)',
        pointerEvents: 'none',
      },
      ...sx 
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        position: 'relative',
        zIndex: 1,
      }}>
        <Typography 
          variant="h5" 
          component="h2"
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
          {title}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {showAddButton && onAdd && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAdd}
              size="medium"
              sx={{
                borderRadius: '12px',
                background: theme.palette.mode === 'dark'
                  ? 'linear-gradient(45deg, #667eea, #764ba2)'
                  : 'linear-gradient(45deg, #667eea, #764ba2)',
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 16px rgba(102, 126, 234, 0.4)'
                  : '0 4px 16px rgba(102, 126, 234, 0.3)',
                fontWeight: 600,
                textTransform: 'none',
                px: 3,
                py: 1,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 8px 24px rgba(102, 126, 234, 0.5)'
                    : '0 8px 24px rgba(102, 126, 234, 0.4)',
                },
              }}
            >
              Add {entityName}
            </Button>
          )}
          
          {onRefresh && (
            <Tooltip title="Refresh data">
              <IconButton
                onClick={onRefresh}
                size="medium"
                disabled={loading}
                sx={{
                  borderRadius: '12px',
                  background: theme.palette.mode === 'dark'
                    ? 'rgba(102, 126, 234, 0.1)'
                    : 'rgba(102, 126, 234, 0.08)',
                  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.2)'}`,
                  color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(102, 126, 234, 0.8)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: theme.palette.mode === 'dark'
                      ? 'rgba(102, 126, 234, 0.2)'
                      : 'rgba(102, 126, 234, 0.15)',
                    transform: 'scale(1.05)',
                  },
                  '&:disabled': {
                    opacity: 0.5,
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
      
      <Box sx={{ 
        height, 
        width: '100%',
        position: 'relative',
        zIndex: 1,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.mode === 'dark'
          ? 'rgba(26, 26, 46, 0.5)'
          : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
      }}>
        <DataGrid
          rows={data}
          columns={columnsWithActions}
          loading={loading}
          getRowId={getRowId}
          checkboxSelection={false}
          slots={showToolbar ? { toolbar: GridToolbar } : {}}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 },
              sx: {
                background: theme.palette.mode === 'dark'
                  ? 'rgba(102, 126, 234, 0.1)'
                  : 'rgba(102, 126, 234, 0.05)',
                borderRadius: '8px',
                p: 1,
                mb: 1,
              }
            },
          }}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          pageSizeOptions={[5, 10, 25, 50]}
          disableColumnFilter
          disableColumnSelector
          disableDensitySelector
          disableVirtualization
          sx={{
            border: 'none',
            '& .MuiDataGrid-root': {
              border: 'none',
            },
            '& .MuiDataGrid-cell': {
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
            '& .MuiDataGrid-columnHeaders': {
              background: theme.palette.mode === 'dark'
                ? 'rgba(102, 126, 234, 0.1)'
                : 'rgba(102, 126, 234, 0.05)',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
            '& .MuiDataGrid-row': {
              transition: 'all 0.2s ease',
              '&:hover': {
                background: theme.palette.mode === 'dark'
                  ? 'rgba(102, 126, 234, 0.08)'
                  : 'rgba(102, 126, 234, 0.04)',
                transform: 'scale(1.01)',
              },
            },
            '& .MuiDataGrid-footerContainer': {
              background: theme.palette.mode === 'dark'
                ? 'rgba(102, 126, 234, 0.05)'
                : 'rgba(102, 126, 234, 0.02)',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
          }}
          componentsProps={{
            row: {
              'aria-hidden': false,
            },
          }}
        />
      </Box>
    </Paper>
  )
}

export default EntityTable
