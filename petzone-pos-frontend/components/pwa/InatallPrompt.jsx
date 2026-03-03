'use client'

import { useEffect, useState } from 'react'
import { Alert, Box, Button, Slide, Snackbar, Stack, Typography } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showInstalled, setShowInstalled] = useState(false)

  useEffect(() => {
    // Register a lightweight service worker so the app is installable
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const handleBeforeInstall = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setShowPrompt(true)
    }

    const handleInstalled = () => {
      setShowPrompt(false)
      setDeferredPrompt(null)
      setShowInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
      setShowInstalled(true)
    }
    setDeferredPrompt(null)
  }

  if (!showPrompt) {
    return (
      <Snackbar
        open={showInstalled}
        autoHideDuration={3000}
        onClose={() => setShowInstalled(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setShowInstalled(false)}>
          App installed. You can launch it from your desktop or apps list.
        </Alert>
      </Snackbar>
    )
  }

  return (
    <>
      <Slide direction="up" in={showPrompt} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            right: { xs: 16, md: 24 },
            bottom: { xs: 16, md: 24 },
            zIndex: 2000,
            bgcolor: 'background.paper',
            boxShadow: 6,
            borderRadius: 2,
            p: 2.5,
            width: { xs: 'calc(100% - 32px)', sm: 360 },
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              Install Petzone
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add a desktop shortcut for faster access. Works best in Chrome or Edge.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleInstallClick}
                fullWidth
              >
                Install
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={() => setShowPrompt(false)}
              >
                Later
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Slide>

      <Snackbar
        open={showInstalled}
        autoHideDuration={3000}
        onClose={() => setShowInstalled(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setShowInstalled(false)}>
          App installed. You can launch it from your desktop or apps list.
        </Alert>
      </Snackbar>
    </>
  )
}

export default InstallPrompt


