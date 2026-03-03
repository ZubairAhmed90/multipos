import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  timeout: 45000, // Increased timeout to 45 seconds for better reliability
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable credentials for CORS
})

// Flag to prevent multiple refresh attempts
let isRefreshing = false
let failedQueue = []

// Rate limiting protection
const requestQueue = new Map()
const REQUEST_DELAY = 100 // Minimum delay between requests (ms)

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  
  failedQueue = []
}

const AUTH_MESSAGE_KEY = 'authMessage'

// Persist a short-lived auth message so the login screen can show it
const setAuthMessage = (message) => {
  if (typeof window === 'undefined' || !message) return
  try {
    sessionStorage.setItem(AUTH_MESSAGE_KEY, message)
  } catch (storageError) {
    console.warn('Unable to persist auth message', storageError)
  }
}

// Centralized logout + redirect for unauthorized states
const forceLogout = (
  message = 'Your session has expired. Please log in again.',
  error = null
) => {
  try {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  } catch (storageError) {
    console.warn('Unable to clear auth storage', storageError)
  }

  // Reject any queued requests waiting on a refresh
  processQueue(error || new Error('Unauthorized'), null)
  failedQueue = []
  isRefreshing = false

  setAuthMessage(message)

  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Rate limiting protection
    const requestKey = `${config.method}-${config.url}`
    const lastRequestTime = requestQueue.get(requestKey)
    const now = Date.now()
    
    if (lastRequestTime && (now - lastRequestTime) < REQUEST_DELAY) {
      const delay = REQUEST_DELAY - (now - lastRequestTime)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    requestQueue.set(requestKey, Date.now())
    
    // Add auth token if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // ============================================================
    // ADMIN SIMULATION HEADERS
    // If admin has selected a warehouse/branch to simulate,
    // inject the scope headers into every request automatically
    // ============================================================
    if (typeof window !== 'undefined') {
      try {
        const simulation = sessionStorage.getItem('adminSimulation')
        if (simulation) {
          const { scopeType, scopeId } = JSON.parse(simulation)
          if (scopeType && scopeId) {
            config.headers['x-simulate-scope-type'] = scopeType
            config.headers['x-simulate-scope-id'] = String(scopeId)
          }
        }
      } catch (e) {
        // If sessionStorage parse fails, remove corrupted data
        sessionStorage.removeItem('adminSimulation')
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh')
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null
      const sessionExpiredMessage = 'Your session has expired. Please log in again.'

      // If we are already retrying, missing a refresh token, or the refresh call itself failed
      if (originalRequest._retry || isRefreshRequest || !refreshToken) {
        forceLogout(sessionExpiredMessage, error)
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // If already refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const response = await api.post('/auth/refresh', { refreshToken })
        
        const { accessToken: newToken, refreshToken: newRefreshToken } = response.data.data
        
        // Update tokens in localStorage
        localStorage.setItem('accessToken', newToken)
        localStorage.setItem('refreshToken', newRefreshToken)
        
        // Process queued requests
        processQueue(null, newToken)
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
        
      } catch (refreshError) {
        forceLogout(sessionExpiredMessage, refreshError)
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return Promise.reject(new Error('Request timeout. Please check if the backend server is running.'))
    }
    
    // Handle connection errors (no backend server)
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || error.message.includes('ERR_CONNECTION_REFUSED')) {
      return Promise.reject(new Error('Backend server is not running. Please start the backend server.'))
    }
    
    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      // Wait and retry once
      await new Promise(resolve => setTimeout(resolve, 1000))
      return api(originalRequest)
    }
    
    // Handle other errors
    if (error.response?.status === 403) {
    }
    
    if (error.response?.status >= 500) {
      try {
      } catch (logError) {
      }
    }
    
    // Enhanced error logging
    if (error.response) {
      try {
        console.error('Response Error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: error.config?.url,
          method: error.config?.method,
          data: error.response.data || 'Empty response data'
        })
      } catch (logError) {
        console.error('Response Error (simplified):', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: error.config?.url,
          method: error.config?.method
        })
      }
      
      // If response data is empty, provide a more helpful error message
      if (!error.response.data || Object.keys(error.response.data).length === 0) {
        const errorMessage = `Server returned empty response (${error.response.status}: ${error.response.statusText})`
        return Promise.reject(new Error(errorMessage))
      }
    } else if (error.request) {
    } else {
    }
    
    return Promise.reject(error)
  }
)

// Authentication helper methods
export const authAPI = {
  // Login user
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password })
    return response
  },

  // Get current user
  async getCurrentUser() {
    const response = await api.get('/auth/me')
    return response
  },

  // Refresh access token
  async refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }
    
    const response = await api.post('/auth/refresh', { refreshToken })
    return response
  },

  // Logout user
  async logout() {
    try {
      await api.post('/auth/logout')
    } catch (error) {
    } finally {
      // Clear tokens regardless of API response
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      // Clear simulation on logout
      sessionStorage.removeItem('adminSimulation')
    }
  },

  // Set tokens
  setTokens(accessToken, refreshToken) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
    }
  },

  // Clear tokens
  clearTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      // Clear simulation when clearing tokens
      sessionStorage.removeItem('adminSimulation')
    }
  },

  // Get token
  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken')
    }
    return null
  },

  // Check if user is authenticated
  isAuthenticated() {
    const token = this.getToken()
    return !!token
  }
}

export default api