import { Inter } from 'next/font/google'
import './globals.css'
import { CustomThemeProvider } from './theme/ThemeProvider'
import { ReduxProvider } from './store/ReduxProvider'
import RouteProtection from '../components/auth/RouteProtectionSimple'
import AuthInitializer from '../components/auth/AuthInitializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'MultiPOS Frontend',
  description: 'A modern POS frontend built with Next.js 14',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReduxProvider>
          <CustomThemeProvider>
            <AuthInitializer />
            <RouteProtection>
              {children}
            </RouteProtection>
          </CustomThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  )
}
