import performanceOptimizer from './performanceOptimizer'

class ApiCacheService {
  constructor() {
    this.cache = new Map()
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      enableCompression: true,
      enableMetrics: true
    }
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      compressions: 0
    }
  }

  // Generate cache key from request parameters
  generateKey(url, params = {}, method = 'GET') {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key]
        return result
      }, {})
    
    return `${method}:${url}:${JSON.stringify(sortedParams)}`
  }

  // Set cache item
  set(key, data, ttl = this.config.defaultTTL) {
    const cacheItem = {
      data: this.config.enableCompression ? this.compress(data) : data,
      timestamp: Date.now(),
      ttl,
      compressed: this.config.enableCompression
    }

    this.cache.set(key, cacheItem)
    this.metrics.sets++

    // Cleanup if cache is too large
    if (this.cache.size > this.config.maxSize) {
      this.cleanup()
    }
  }

  // Get cache item
  get(key) {
    const cacheItem = this.cache.get(key)
    
    if (!cacheItem) {
      this.metrics.misses++
      return null
    }

    // Check if expired
    if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
      this.cache.delete(key)
      this.metrics.misses++
      return null
    }

    this.metrics.hits++
    
    // Decompress if needed
    return cacheItem.compressed ? this.decompress(cacheItem.data) : cacheItem.data
  }

  // Delete cache item
  delete(key) {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.metrics.deletes++
    }
    return deleted
  }

  // Clear cache by pattern
  clear(pattern = null) {
    if (pattern) {
      let deletedCount = 0
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
          deletedCount++
        }
      }
      this.metrics.deletes += deletedCount
    } else {
      this.cache.clear()
      this.metrics.deletes += this.cache.size
    }
  }

  // Cleanup old cache items
  cleanup() {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    
    // Remove expired items
    entries.forEach(([key, item]) => {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    })

    // If still too large, remove oldest items
    if (this.cache.size > this.config.maxSize) {
      const sortedEntries = entries
        .filter(([key]) => this.cache.has(key))
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const removeCount = Math.floor(sortedEntries.length * 0.2)
      for (let i = 0; i < removeCount; i++) {
        this.cache.delete(sortedEntries[i][0])
      }
    }
  }

  // Compression (simple JSON compression)
  compress(data) {
    try {
      const jsonString = JSON.stringify(data)
      // In a real application, you might use a compression library
      // For now, we'll just return the data as-is
      this.metrics.compressions++
      return jsonString
    } catch (error) {
      console.warn('Compression failed:', error)
      return data
    }
  }

  // Decompression
  decompress(compressedData) {
    try {
      return JSON.parse(compressedData)
    } catch (error) {
      console.warn('Decompression failed:', error)
      return compressedData
    }
  }

  // Cache API response
  async cacheApiResponse(url, params = {}, method = 'GET', ttl = null) {
    const key = this.generateKey(url, params, method)
    
    // Try to get from cache first
    const cached = this.get(key)
    if (cached) {
      return cached
    }

    // If not in cache, make API call
    try {
      const response = await this.makeApiCall(url, params, method)
      this.set(key, response, ttl)
      return response
    } catch (error) {
      // Return cached data if available (even if expired)
      const expiredCached = this.cache.get(key)
      if (expiredCached) {
        console.warn('API call failed, returning expired cached data')
        return expiredCached.compressed ? this.decompress(expiredCached.data) : expiredCached.data
      }
      throw error
    }
  }

  // Make API call (placeholder - would use your actual API service)
  async makeApiCall(url, params, method) {
    // This would use your actual API service
    throw new Error('API service not implemented')
  }

  // Get cache statistics
  getStats() {
    const total = this.metrics.hits + this.metrics.misses
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
      cacheSize: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  // Estimate memory usage
  estimateMemoryUsage() {
    let totalSize = 0
    for (const [key, item] of this.cache) {
      totalSize += key.length * 2 // UTF-16 characters
      totalSize += JSON.stringify(item).length * 2
    }
    return totalSize
  }

  // Preload data
  async preload(urls, params = {}) {
    const promises = urls.map(url => 
      this.cacheApiResponse(url, params, 'GET')
    )
    
    try {
      await Promise.all(promises)
(`Preloaded ${urls.length} API endpoints`)
    } catch (error) {
      console.warn('Preloading failed:', error)
    }
  }

  // Warm up cache
  async warmup(endpoints) {
    const promises = endpoints.map(endpoint => 
      this.cacheApiResponse(
        endpoint.url, 
        endpoint.params || {}, 
        endpoint.method || 'GET',
        endpoint.ttl
      )
    )
    
    try {
      await Promise.all(promises)
(`Cache warmed up with ${endpoints.length} endpoints`)
    } catch (error) {
      console.warn('Cache warmup failed:', error)
    }
  }

  // Cache invalidation strategies
  invalidateByPattern(pattern) {
    this.clear(pattern)
  }

  invalidateByTags(tags) {
    // In a real application, you might have a tagging system
    // For now, we'll clear by pattern
    tags.forEach(tag => {
      this.clear(tag)
    })
  }

  // Cache configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
  }

  // Export cache data
  exportCache() {
    const cacheData = {}
    for (const [key, item] of this.cache) {
      cacheData[key] = {
        data: item.compressed ? this.decompress(item.data) : item.data,
        timestamp: item.timestamp,
        ttl: item.ttl
      }
    }
    return cacheData
  }

  // Import cache data
  importCache(cacheData) {
    for (const [key, item] of Object.entries(cacheData)) {
      this.set(key, item.data, item.ttl)
    }
  }
}

// Create singleton instance
const apiCacheService = new ApiCacheService()

export default apiCacheService
