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
  Stack,
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
    <Paper
      sx={{
        p: 2.5,
        borderRadius: '16px',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, rgba(22, 25, 45, 0.92) 0%, rgba(15, 23, 42, 0.92) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(247, 249, 255, 0.96) 100%)',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 10px 30px rgba(0,0,0,0.35)'
          : '0 10px 30px rgba(102, 126, 234, 0.18)',
        overflow: 'hidden',
        position: 'relative',
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box>
          <Typography
            variant="h6"
            component="h2"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.3px',
              color: theme.palette.text.primary,
            }}
          >
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.2 }}>
            Manage your {entityName}s efficiently
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {onRefresh && (
            <Tooltip title="Refresh data">
              <IconButton
                onClick={onRefresh}
                size="small"
                disabled={loading}
                sx={{
                  borderRadius: '10px',
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.primary.main,
                    borderColor: theme.palette.primary.main,
                  },
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {showAddButton && onAdd && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAdd}
              size="small"
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                px: 2,
                py: 1,
              }}
            >
              Add {entityName}
            </Button>
          )}
        </Stack>
      </Box>

      <Box
        sx={{
          height,
          width: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          background: theme.palette.background.paper,
        }}
      >
        <DataGrid
          rows={data}
          columns={columnsWithActions}
          loading={loading}
          getRowId={getRowId}
          checkboxSelection={false}
          disableRowSelectionOnClick
          slots={showToolbar ? { toolbar: GridToolbar } : {}}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 400 },
              sx: {
                background: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(102, 126, 234, 0.04)',
                borderBottom: `1px solid ${theme.palette.divider}`,
                px: 1,
              },
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
            '& .MuiDataGrid-columnHeaders': {
              background: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(102, 126, 234, 0.06)',
              color: theme.palette.text.primary,
              fontWeight: 600,
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
            '& .MuiDataGrid-cell': {
              borderColor: theme.palette.divider,
            },
            '& .MuiDataGrid-row': {
              transition: 'all 0.2s ease',
              '&:hover': {
                background: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(102, 126, 234, 0.05)',
              },
            },
            '& .MuiDataGrid-footerContainer': {
              background: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(102, 126, 234, 0.03)',
              borderTop: `1px solid ${theme.palette.divider}`,
            },
          }}
        />
      </Box>
    </Paper>
  )
}

export default EntityTable
