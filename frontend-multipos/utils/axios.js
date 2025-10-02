import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 30000, // Increased timeout to 30 seconds for better reliability
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
    
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', config.method?.toUpperCase(), config.url)
    }
    
    return config
  },
  (error) => {
    console.error('Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log('API Response:', response.status, response.config.url)
    }
    
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
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
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }
        
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
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        processQueue(refreshError, null)
        
        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Request timeout - Backend server may be slow or unavailable')
      return Promise.reject(new Error('Request timeout. Please check if the backend server is running.'))
    }
    
    // Handle connection errors (no backend server)
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || error.message.includes('ERR_CONNECTION_REFUSED')) {
      console.error('Backend server not available')
      return Promise.reject(new Error('Backend server is not running. Please start the backend server.'))
    }
    
    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      console.warn('Rate limited - retrying after delay')
      // Wait and retry once
      await new Promise(resolve => setTimeout(resolve, 1000))
      return api(originalRequest)
    }
    
    // Handle other errors
    if (error.response?.status === 403) {
      console.error('Access forbidden')
    }
    
    if (error.response?.status >= 500) {
      try {
        console.error('Server error:', error.response.data)
        console.error('Server error details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: error.config?.url,
          method: error.config?.method,
          data: error.response.data
        })
      } catch (logError) {
        console.error('Server error (simplified):', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: error.config?.url,
          method: error.config?.method
        })
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
        console.error('Empty response detected:', errorMessage)
        return Promise.reject(new Error(errorMessage))
      }
    } else if (error.request) {
      console.error('Request Error:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method
      })
    } else {
      console.error('Error:', error.message)
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
      console.error('Logout error:', error)
    } finally {
      // Clear tokens regardless of API response
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
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
