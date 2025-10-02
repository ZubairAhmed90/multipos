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
    }
    
    return config
  },
}

module.exports = nextConfig
