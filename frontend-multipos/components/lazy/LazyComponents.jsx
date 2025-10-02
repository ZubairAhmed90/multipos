'use client'

import { useState, useEffect, useRef, Suspense, lazy, useMemo } from 'react'
import {
  Box,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Skeleton,
  Fade,
  Slide,
} from '@mui/material'
import Image from 'next/image'
import { useIntersectionObserver } from '../../hooks/usePerformance'

// Lazy loading wrapper component
export const LazyWrapper = ({ 
  children, 
  fallback = <CircularProgress />,
  threshold = 0.1,
  rootMargin = '50px',
  animation = 'fade'
}) => {
  const { ref, isIntersecting, hasIntersected } = useIntersectionObserver({
    threshold,
    rootMargin
  })

  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (isIntersecting && !isLoaded) {
      setIsLoaded(true)
    }
  }, [isIntersecting, isLoaded])

  const renderContent = () => {
    if (!hasIntersected) {
      return <Box ref={ref} sx={{ minHeight: 200 }} />
    }

    if (!isLoaded) {
      return fallback
    }

    return (
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    )
  }

  const getAnimationProps = () => {
    switch (animation) {
      case 'fade':
        return {
          in: isLoaded,
          timeout: 300
        }
      case 'slide':
        return {
          in: isLoaded,
          direction: 'up',
          timeout: 300
        }
      default:
        return {}
    }
  }

  return (
    <Box ref={ref}>
      {animation === 'fade' ? (
        <Fade {...getAnimationProps()}>
          <Box>{renderContent()}</Box>
        </Fade>
      ) : animation === 'slide' ? (
        <Slide {...getAnimationProps()}>
          <Box>{renderContent()}</Box>
        </Slide>
      ) : (
        renderContent()
      )}
    </Box>
  )
}

// Lazy image component
export const LazyImage = ({ 
  src, 
  alt, 
  width, 
  height, 
  placeholder = <Skeleton variant="rectangular" width={width} height={height} />,
  ...props 
}) => {
  const { ref, isIntersecting } = useIntersectionObserver()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (isIntersecting && src) {
      const img = new Image()
      img.onload = () => setLoaded(true)
      img.onerror = () => setError(true)
      img.src = src
    }
  }, [isIntersecting, src])

  return (
    <Box ref={ref} sx={{ position: 'relative', width, height }}>
      {!loaded && !error && placeholder}
      {loaded && (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          {...props}
        />
      )}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.100',
            color: 'grey.500'
          }}
        >
          <Typography variant="caption">Failed to load image</Typography>
        </Box>
      )}
    </Box>
  )
}

// Lazy component loader
export const LazyComponent = ({ 
  importFunc, 
  fallback = <CircularProgress />,
  errorFallback = <Alert severity="error">Failed to load component</Alert>
}) => {
  const [Component, setComponent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    importFunc()
      .then(module => {
        setComponent(() => module.default)
        setLoading(false)
      })
      .catch(err => {
        setError(err)
        setLoading(false)
      })
  }, [importFunc])

  if (loading) return fallback
  if (error) return errorFallback
  if (!Component) return null

  return <Component />
}

// Virtual list component for large datasets
export const VirtualList = ({ 
  items, 
  itemHeight, 
  containerHeight, 
  renderItem,
  overscan = 5 
}) => {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef(null)

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    )
    
    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      index: startIndex + index,
      top: (startIndex + index) * itemHeight
    }))
  }, [items, itemHeight, containerHeight, scrollTop, overscan])

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop)
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <Box sx={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item) => (
          <Box
            key={item.index}
            sx={{
              position: 'absolute',
              top: item.top,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {renderItem(item)}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// Lazy table component
export const LazyTable = ({ 
  data, 
  columns, 
  rowHeight = 50,
  containerHeight = 400,
  ...props 
}) => {
  const renderRow = (item) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: rowHeight,
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: 2
      }}
    >
      {columns.map((column, index) => (
        <Box
          key={index}
          sx={{
            flex: column.flex || 1,
            minWidth: column.minWidth || 100
          }}
        >
          {column.render ? column.render(item[column.field], item) : item[column.field]}
        </Box>
      ))}
    </Box>
  )

  return (
    <VirtualList
      items={data}
      itemHeight={rowHeight}
      containerHeight={containerHeight}
      renderItem={renderRow}
      {...props}
    />
  )
}

// Lazy chart component
export const LazyChart = ({ 
  data, 
  type = 'line',
  width = 400,
  height = 300,
  ...props 
}) => {
  const [ChartComponent, setChartComponent] = useState(null)
  const [loading, setLoading] = useState(true)
  const { ref, isIntersecting } = useIntersectionObserver()

  useEffect(() => {
    if (isIntersecting) {
      // Dynamically import chart library
      import('recharts').then((recharts) => {
        setChartComponent(() => recharts.LineChart)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    }
  }, [isIntersecting])

  if (!isIntersecting) {
    return <Box ref={ref} sx={{ width, height }} />
  }

  if (loading) {
    return (
      <Box sx={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!ChartComponent) {
    return (
      <Alert severity="error" sx={{ width, height }}>
        Failed to load chart component
      </Alert>
    )
  }

  return (
    <Box sx={{ width, height }}>
      <ChartComponent width={width} height={height} data={data} {...props}>
        {/* Chart content would go here */}
      </ChartComponent>
    </Box>
  )
}

// Lazy form component
export const LazyForm = ({ 
  fields, 
  onSubmit,
  validationSchema,
  ...props 
}) => {
  const [FormComponent, setFormComponent] = useState(null)
  const [loading, setLoading] = useState(true)
  const { ref, isIntersecting } = useIntersectionObserver()

  useEffect(() => {
    if (isIntersecting) {
      // Dynamically import form library
      import('react-hook-form').then(() => {
        setFormComponent(() => LazyFormComponent)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    }
  }, [isIntersecting])

  if (!isIntersecting) {
    return <Box ref={ref} sx={{ minHeight: 200 }} />
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!FormComponent) {
    return (
      <Alert severity="error">
        Failed to load form component
      </Alert>
    )
  }

  return (
    <FormComponent
      fields={fields}
      onSubmit={onSubmit}
      validationSchema={validationSchema}
      {...props}
    />
  )
}

// Placeholder form component
const LazyFormComponent = ({ fields, onSubmit, validationSchema, ...props }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Lazy Form Component
        </Typography>
        <Typography variant="body2" color="textSecondary">
          This form component is loaded lazily to improve performance.
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }}>
          Submit Form
        </Button>
      </CardContent>
    </Card>
  )
}

// Lazy route component
export const LazyRoute = ({ 
  path, 
  component: Component,
  fallback = <CircularProgress />,
  ...props 
}) => {
  const [LazyComponent, setLazyComponent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (Component) {
      setLazyComponent(() => Component)
      setLoading(false)
    }
  }, [Component])

  if (loading) return fallback
  if (!LazyComponent) return null

  return (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  )
}

const LazyComponents = {
  LazyWrapper,
  LazyImage,
  LazyComponent,
  VirtualList,
  LazyTable,
  LazyChart,
  LazyForm,
  LazyRoute
}

export default LazyComponents
