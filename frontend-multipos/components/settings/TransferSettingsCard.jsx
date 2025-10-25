'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Grid,
  Divider,
  Alert,
  Button,
  Card,
  CardContent
} from '@mui/material'
import {
  TransferWithinAStation as TransferIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'

const TransferSettingsCard = ({ 
  type, // 'branch' or 'warehouse'
  id, 
  settings, 
  onUpdate, 
  loading = false 
}) => {
  const [localSettings, setLocalSettings] = useState(settings || {})

  const handleSettingChange = (field, value) => {
    const updated = { ...localSettings, [field]: value }
    setLocalSettings(updated)
    onUpdate(field, value)
  }

  const renderBranchSettings = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TransferIcon color="primary" />
          Branch Transfer Settings
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.allowBranchTransfers || false}
              onChange={(e) => handleSettingChange('allowBranchTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Allow Branch Transfers"
        />
      </Grid>

      {/* Branch to Warehouse transfers are not supported */}
      {/* <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.allowBranchToWarehouseTransfers || false}
              onChange={(e) => handleSettingChange('allowBranchToWarehouseTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Allow Branch → Warehouse Transfers"
        />
      </Grid> */}

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.allowBranchToBranchTransfers || false}
              onChange={(e) => handleSettingChange('allowBranchToBranchTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Allow Branch → Branch Transfers"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.requireApprovalForBranchTransfers !== false}
              onChange={(e) => handleSettingChange('requireApprovalForBranchTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Require Admin Approval"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          label="Maximum Transfer Amount"
          type="number"
          value={localSettings.maxTransferAmount || 10000}
          onChange={(e) => handleSettingChange('maxTransferAmount', parseFloat(e.target.value))}
          disabled={loading}
          InputProps={{
            startAdornment: '$'
          }}
        />
      </Grid>

      {/* Email field commented out - will be used in future when email system is implemented */}
      {/* <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          label="Transfer Notification Email"
          type="email"
          value={localSettings.transferNotificationEmail || ''}
          onChange={(e) => handleSettingChange('transferNotificationEmail', e.target.value)}
          disabled={loading}
          placeholder="manager@branch.com"
        />
      </Grid> */}
    </Grid>
  )

  const renderWarehouseSettings = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TransferIcon color="primary" />
          Warehouse Transfer Settings
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.allowWarehouseTransfers || false}
              onChange={(e) => handleSettingChange('allowWarehouseTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Allow Warehouse Transfers"
        />
      </Grid>

      {/* Warehouse to Branch transfers are not supported */}
      {/* <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.allowWarehouseToBranchTransfers || false}
              onChange={(e) => handleSettingChange('allowWarehouseToBranchTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Allow Warehouse → Branch Transfers"
        />
      </Grid> */}

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.allowWarehouseToWarehouseTransfers || false}
              onChange={(e) => handleSettingChange('allowWarehouseToWarehouseTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Allow Warehouse → Warehouse Transfers"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.requireApprovalForWarehouseTransfers !== false}
              onChange={(e) => handleSettingChange('requireApprovalForWarehouseTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Require Admin Approval"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          label="Maximum Transfer Amount"
          type="number"
          value={localSettings.maxTransferAmount || 50000}
          onChange={(e) => handleSettingChange('maxTransferAmount', parseFloat(e.target.value))}
          disabled={loading}
          InputProps={{
            startAdornment: '$'
          }}
        />
      </Grid>

      {/* Email field commented out - will be used in future when email system is implemented */}
      {/* <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          label="Transfer Notification Email"
          type="email"
          value={localSettings.transferNotificationEmail || ''}
          onChange={(e) => handleSettingChange('transferNotificationEmail', e.target.value)}
          disabled={loading}
          placeholder="manager@warehouse.com"
        />
      </Grid> */}

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.autoApproveSmallTransfers || false}
              onChange={(e) => handleSettingChange('autoApproveSmallTransfers', e.target.checked)}
              disabled={loading}
            />
          }
          label="Auto-Approve Small Transfers"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          label="Small Transfer Threshold"
          type="number"
          value={localSettings.smallTransferThreshold || 1000}
          onChange={(e) => handleSettingChange('smallTransferThreshold', parseFloat(e.target.value))}
          disabled={loading || !localSettings.autoApproveSmallTransfers}
          InputProps={{
            startAdornment: '$'
          }}
        />
      </Grid>
    </Grid>
  )

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SettingsIcon color="primary" />
          <Typography variant="h6">
            Transfer Management Settings
          </Typography>
        </Box>

        {type === 'branch' ? renderBranchSettings() : renderWarehouseSettings()}

        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Transfer Rules:</strong><br/>
              • <strong>Branches:</strong> Can only transfer to other branches (Branch → Branch)<br/>
              • <strong>Warehouses:</strong> Can only transfer to other warehouses (Warehouse → Warehouse)<br/>
              • Cross-location transfers (Branch ↔ Warehouse) are not supported
            </Typography>
          </Alert>
        </Box>
      </CardContent>
    </Card>
  )
}

export default TransferSettingsCard
