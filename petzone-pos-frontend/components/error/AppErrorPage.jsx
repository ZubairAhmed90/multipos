'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  IconButton,
  Collapse,
  Divider,
  Tooltip
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  ReportProblem as ReportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material'

const AppErrorPage = ({ error, reset }) => {
  const router = useRouter()
  const [showDetails, setShowDetails] = useState(false)

  const handleBack = () => router.back()
  const handleHome = () => router.push('/')
  const handleReload = () => window.location.reload()
  const handleReset = () => typeof reset === 'function' && reset()

  const copyDetails = async () => {
    try {
      const payload = {
        message: error?.message || String(error),
        stack: error?.stack || null,
        time: new Date().toISOString()
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      // A minimal visual feedback - in this simple component we'll use alert
      // Most apps use a snackbar; keep this simple to avoid extra deps here
      // eslint-disable-next-line no-alert
      alert('Error details copied to clipboard')
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Failed to copy error details')
    }
  }

  const mailToSupport = () => {
    const subject = encodeURIComponent('App crash: help needed')
    const body = encodeURIComponent(`Error: ${error?.message || String(error)}\n\nStack:\n${error?.stack || 'n/a'}\n\nURL: ${typeof window !== 'undefined' ? window.location.href : 'n/a'}`)
    window.open(`mailto:support@petzone.pk?subject=${subject}&body=${body}`)
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 920, width: '100%', borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="h4" color="error" sx={{ fontWeight: 700 }}>
                Oops — something went wrong
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The application encountered an unexpected error. You can try going back, reloading the page, or return home.
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Go back">
                <IconButton color="primary" onClick={handleBack} aria-label="Go back">
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Home">
                <IconButton color="primary" onClick={handleHome} aria-label="Home">
                  <HomeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reload page">
                <IconButton color="primary" onClick={handleReload} aria-label="Reload">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
            <Stack spacing={1}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {error?.message ? String(error.message) : 'Unexpected client error'}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                If this keeps happening, please copy the error details and report to support.
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={handleBack}>
                  Back
                </Button>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleReload}>
                  Reload
                </Button>
                <Button variant="outlined" startIcon={<HomeIcon />} onClick={handleHome}>
                  Home
                </Button>
                <Button variant="outlined" startIcon={<CopyIcon />} onClick={copyDetails}>
                  Copy details
                </Button>
                <Button variant="outlined" startIcon={<ReportIcon />} onClick={mailToSupport}>
                  Report
                </Button>
                <Button variant="text" color="secondary" onClick={handleReset}>
                  Try recover
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ minWidth: 320, maxWidth: 520 }}>
              <Button
                onClick={() => setShowDetails(s => !s)}
                startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                {showDetails ? 'Hide technical details' : 'Show technical details'}
              </Button>

              <Collapse in={showDetails} sx={{ mt: 1 }}>
                <Box sx={{ p: 1, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto', maxHeight: 360 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Error</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>{String(error?.message || error)}</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Stack</Typography>
                  <Typography variant="body2">{error?.stack || 'No stack available'}</Typography>
                </Box>
              </Collapse>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

export default AppErrorPage
