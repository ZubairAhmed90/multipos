/**
 * Environment configuration utilities
 */

// Environment detection
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'
export const isTest = process.env.NODE_ENV === 'test'

// Environment variables with defaults
export const config = {
  // API Configuration
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
  API_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000,
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://localhost:3306/multipos',
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // CORS Configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',
  
  // Monitoring
  ENABLE_MONITORING: process.env.ENABLE_MONITORING === 'true',
  MONITORING_INTERVAL: parseInt(process.env.MONITORING_INTERVAL) || 30000,
  
  // Polling
  POLLING_INTERVAL: parseInt(process.env.POLLING_INTERVAL) || 5000,
  POLLING_ENABLED: process.env.POLLING_ENABLED !== 'false',
  
  // Performance
  ENABLE_PERFORMANCE_MONITORING: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
  PERFORMANCE_THRESHOLD: parseInt(process.env.PERFORMANCE_THRESHOLD) || 1000,
  
  // Security
  ENABLE_SECURITY_HEADERS: process.env.ENABLE_SECURITY_HEADERS !== 'false',
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret',
  
  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/gif'],
  
  // Email Configuration
  SMTP_HOST: process.env.SMTP_HOST || 'localhost',
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@example.com',
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  
  // Feature Flags
  FEATURES: {
    ENABLE_REAL_TIME_UPDATES: process.env.ENABLE_REAL_TIME_UPDATES !== 'false',
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
    ENABLE_NOTIFICATIONS: process.env.ENABLE_NOTIFICATIONS !== 'false',
    ENABLE_REPORTS: process.env.ENABLE_REPORTS !== 'false',
    ENABLE_EXPORT: process.env.ENABLE_EXPORT !== 'false',
    ENABLE_IMPORT: process.env.ENABLE_IMPORT !== 'false'
  }
}

// Environment-specific configurations
export const environmentConfig = {
  development: {
    ...config,
    LOG_LEVEL: 'debug',
    ENABLE_MONITORING: true,
    ENABLE_PERFORMANCE_MONITORING: true
  },
  
  production: {
    ...config,
    LOG_LEVEL: 'warn',
    ENABLE_MONITORING: true,
    ENABLE_PERFORMANCE_MONITORING: false
  },
  
  test: {
    ...config,
    LOG_LEVEL: 'error',
    ENABLE_MONITORING: false,
    ENABLE_PERFORMANCE_MONITORING: false,
    POLLING_ENABLED: false
  }
}

// Get current environment configuration
export const getCurrentConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  return environmentConfig[env] || environmentConfig.development
}

// Configuration validation
export const validateConfig = () => {
  const currentConfig = getCurrentConfig()
  const errors = []
  
  // Required fields
  const requiredFields = [
    'API_BASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ]
  
  requiredFields.forEach(field => {
    if (!currentConfig[field]) {
      errors.push(`Missing required configuration: ${field}`)
    }
  })
  
  // Validate URLs
  try {
    new URL(currentConfig.API_BASE_URL)
  } catch (error) {
    errors.push(`Invalid API_BASE_URL: ${currentConfig.API_BASE_URL}`)
  }
  
  // Validate numeric fields
  const numericFields = [
    'API_TIMEOUT',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'MONITORING_INTERVAL',
    'POLLING_INTERVAL',
    'PERFORMANCE_THRESHOLD',
    'MAX_FILE_SIZE'
  ]
  
  numericFields.forEach(field => {
    if (isNaN(currentConfig[field]) || currentConfig[field] < 0) {
      errors.push(`Invalid numeric configuration: ${field}`)
    }
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Configuration utilities
export const configUtils = {
  // Get configuration value with fallback
  get: (key, fallback = null) => {
    const currentConfig = getCurrentConfig()
    return currentConfig[key] !== undefined ? currentConfig[key] : fallback
  },
  
  // Check if feature is enabled
  isFeatureEnabled: (feature) => {
    const currentConfig = getCurrentConfig()
    return currentConfig.FEATURES[feature] === true
  },
  
  // Get API configuration
  getApiConfig: () => {
    const currentConfig = getCurrentConfig()
    return {
      baseURL: currentConfig.API_BASE_URL,
      timeout: currentConfig.API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  },
  
  // Get database configuration
  getDatabaseConfig: () => {
    const currentConfig = getCurrentConfig()
    return {
      url: currentConfig.DATABASE_URL,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    }
  },
  
  // Get Redis configuration
  getRedisConfig: () => {
    const currentConfig = getCurrentConfig()
    return {
      url: currentConfig.REDIS_URL,
      password: currentConfig.REDIS_PASSWORD
    }
  }
}

export default config