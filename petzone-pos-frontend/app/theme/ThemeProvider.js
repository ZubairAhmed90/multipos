'use client'

import { createTheme, ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useState, createContext, useContext, useEffect } from 'react'

const ColorModeContext = createContext({ toggleColorMode: () => {} })

export function CustomThemeProvider({ children }) {
  const [mode, setMode] = useState('light')
  
  const colorMode = {
    toggleColorMode: () => {
      setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'))
    },
  }

  const theme = createTheme({
    palette: {
      mode,
      ...(mode === 'light'
        ? {
            primary: {
              main: '#1976d2',
            },
            secondary: {
              main: '#dc004e',
            },
          }
        : {
            primary: {
              main: '#90caf9',
            },
            secondary: {
              main: '#f48fb1',
            },
          }),
    },
  })

  // Prevent mouse wheel from changing number inputs globally by blurring focused number inputs
  useEffect(() => {
    const onWheel = (e) => {
      try {
        const active = document.activeElement
        if (active && active.tagName === 'INPUT' && active.type === 'number') {
          active.blur()
        }
      } catch (err) {
        // ignore
      }
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

export const useColorMode = () => useContext(ColorModeContext)
