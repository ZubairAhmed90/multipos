/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router is enabled by default in Next.js 13.4+
  experimental: {
    // Ensure proper module resolution
    esmExternals: true,
  },
  // Enable strict mode for better error handling
  reactStrictMode: true,
  // Ensure proper transpilation
  transpilePackages: ['@mui/material', '@mui/icons-material', '@mui/x-data-grid'],
  // Redirect outdated dashboard paths to new locations
  async redirects() {
    return [
      { source: '/dashboard/warehouse-billing', destination: '/warehouse-billing', permanent: true },
      { source: '/dashboard/pos', destination: '/pos', permanent: true },
      { source: '/dashboard/pos/terminal', destination: '/pos/terminal', permanent: true },
    ]
  },

  // Add webpack configuration for better module resolution
  webpack: (config, { isServer }) => {
    // Add resolve extensions
    config.resolve.extensions = ['.js', '.jsx', '.ts', '.tsx', '.json']
    
    // Add resolve alias for better path resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, '.'),
      '@components': require('path').resolve(__dirname, 'components'),
      '@hooks': require('path').resolve(__dirname, 'hooks'),
      '@store': require('path').resolve(__dirname, 'app/store'),
      '@utils': require('path').resolve(__dirname, 'utils'),
      '@public': require('path').resolve(__dirname, 'public'),
    }
    
    return config
  },
}

module.exports = nextConfig
