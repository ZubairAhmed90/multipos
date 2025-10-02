'use client'

import { useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Rating,
  Alert,
  AlertTitle,
  Divider,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material'
import {
  Send,
  Star,
  ThumbUp,
  ThumbDown,
  BugReport,
  Lightbulb,
  QuestionMark,
  Close,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error,
} from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { handleValidationError } from '../../app/store/slices/errorSlice'

// Feedback types
export const FEEDBACK_TYPES = {
  BUG_REPORT: 'bug_report',
  FEATURE_REQUEST: 'feature_request',
  GENERAL_FEEDBACK: 'general_feedback',
  SUPPORT_REQUEST: 'support_request',
  RATING: 'rating'
}

// Feedback priorities
export const FEEDBACK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
}

// Validation schema
const feedbackSchema = yup.object({
  type: yup.string().required('Feedback type is required'),
  title: yup.string().required('Title is required').min(5, 'Title must be at least 5 characters'),
  description: yup.string().required('Description is required').min(20, 'Description must be at least 20 characters'),
  priority: yup.string().required('Priority is required'),
  rating: yup.number().min(1, 'Please provide a rating').max(5, 'Rating must be between 1 and 5'),
  email: yup.string().email('Invalid email address').optional(),
  allowContact: yup.boolean()
})

// Feedback form component
export default function FeedbackForm({ onClose, onSubmit }) {
  const dispatch = useDispatch()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm({
    resolver: yupResolver(feedbackSchema),
    defaultValues: {
      type: FEEDBACK_TYPES.GENERAL_FEEDBACK,
      title: '',
      description: '',
      priority: FEEDBACK_PRIORITIES.MEDIUM,
      rating: 5,
      email: '',
      allowContact: false
    }
  })

  const watchedType = watch('type')
  const watchedRating = watch('rating')

  const onSubmitForm = async (data) => {
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // In a real application, you would send this to your backend
('Feedback submitted:', data)
      
      setSubmitStatus('success')
      
      if (onSubmit) {
        onSubmit(data)
      }
      
      // Reset form after successful submission
      setTimeout(() => {
        reset()
        setSubmitStatus(null)
        if (onClose) {
          onClose()
        }
      }, 2000)
      
    } catch (error) {
      setSubmitStatus('error')
      dispatch(handleValidationError(errors, { formType: 'feedback' }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case FEEDBACK_TYPES.BUG_REPORT:
        return <BugReport />
      case FEEDBACK_TYPES.FEATURE_REQUEST:
        return <Lightbulb />
      case FEEDBACK_TYPES.SUPPORT_REQUEST:
        return <QuestionMark />
      case FEEDBACK_TYPES.RATING:
        return <Star />
      default:
        return <ThumbUp />
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case FEEDBACK_TYPES.BUG_REPORT:
        return 'Bug Report'
      case FEEDBACK_TYPES.FEATURE_REQUEST:
        return 'Feature Request'
      case FEEDBACK_TYPES.SUPPORT_REQUEST:
        return 'Support Request'
      case FEEDBACK_TYPES.RATING:
        return 'Rating & Review'
      default:
        return 'General Feedback'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case FEEDBACK_PRIORITIES.URGENT:
        return 'error'
      case FEEDBACK_PRIORITIES.HIGH:
        return 'warning'
      case FEEDBACK_PRIORITIES.MEDIUM:
        return 'info'
      case FEEDBACK_PRIORITIES.LOW:
        return 'success'
      default:
        return 'default'
    }
  }

  if (submitStatus === 'success') {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Thank You!
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Your feedback has been submitted successfully. We appreciate your input!
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5">
            Send Feedback
          </Typography>
          {onClose && (
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          )}
        </Box>

        {submitStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>Error</AlertTitle>
            Failed to submit feedback. Please try again.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmitForm)}>
          <Grid container spacing={3}>
            {/* Feedback Type */}
            <Grid item xs={12} md={6}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.type}>
                    <InputLabel>Feedback Type</InputLabel>
                    <Select {...field} label="Feedback Type">
                      <MenuItem value={FEEDBACK_TYPES.GENERAL_FEEDBACK}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ThumbUp />
                          General Feedback
                        </Box>
                      </MenuItem>
                      <MenuItem value={FEEDBACK_TYPES.BUG_REPORT}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BugReport />
                          Bug Report
                        </Box>
                      </MenuItem>
                      <MenuItem value={FEEDBACK_TYPES.FEATURE_REQUEST}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Lightbulb />
                          Feature Request
                        </Box>
                      </MenuItem>
                      <MenuItem value={FEEDBACK_TYPES.SUPPORT_REQUEST}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <QuestionMark />
                          Support Request
                        </Box>
                      </MenuItem>
                      <MenuItem value={FEEDBACK_TYPES.RATING}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Star />
                          Rating & Review
                        </Box>
                      </MenuItem>
                    </Select>
                    {errors.type && (
                      <Typography variant="caption" color="error">
                        {errors.type.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Priority */}
            <Grid item xs={12} md={6}>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.priority}>
                    <InputLabel>Priority</InputLabel>
                    <Select {...field} label="Priority">
                      <MenuItem value={FEEDBACK_PRIORITIES.LOW}>
                        <Chip label="Low" color="success" size="small" />
                      </MenuItem>
                      <MenuItem value={FEEDBACK_PRIORITIES.MEDIUM}>
                        <Chip label="Medium" color="info" size="small" />
                      </MenuItem>
                      <MenuItem value={FEEDBACK_PRIORITIES.HIGH}>
                        <Chip label="High" color="warning" size="small" />
                      </MenuItem>
                      <MenuItem value={FEEDBACK_PRIORITIES.URGENT}>
                        <Chip label="Urgent" color="error" size="small" />
                      </MenuItem>
                    </Select>
                    {errors.priority && (
                      <Typography variant="caption" color="error">
                        {errors.priority.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Title */}
            <Grid item xs={12}>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Title"
                    error={!!errors.title}
                    helperText={errors.title?.message}
                    placeholder="Brief description of your feedback"
                  />
                )}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={4}
                    label="Description"
                    error={!!errors.description}
                    helperText={errors.description?.message}
                    placeholder="Please provide detailed information about your feedback..."
                  />
                )}
              />
            </Grid>

            {/* Rating */}
            {watchedType === FEEDBACK_TYPES.RATING && (
              <Grid item xs={12}>
                <Controller
                  name="rating"
                  control={control}
                  render={({ field }) => (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Overall Rating
                      </Typography>
                      <Rating
                        {...field}
                        size="large"
                        precision={0.5}
                        icon={<Star fontSize="inherit" />}
                        emptyIcon={<Star fontSize="inherit" />}
                      />
                      {errors.rating && (
                        <Typography variant="caption" color="error" display="block">
                          {errors.rating.message}
                        </Typography>
                      )}
                    </Box>
                  )}
                />
              </Grid>
            )}

            {/* Advanced Options */}
            <Grid item xs={12}>
              <Button
                startIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setShowAdvanced(!showAdvanced)}
                size="small"
              >
                Advanced Options
              </Button>
            </Grid>

            <Collapse in={showAdvanced}>
              <Grid item xs={12}>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* Email */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Email (Optional)"
                      type="email"
                      error={!!errors.email}
                      helperText={errors.email?.message || "We'll use this to follow up if needed"}
                    />
                  )}
                />
              </Grid>

              {/* Allow Contact */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="allowContact"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value} />}
                      label="Allow us to contact you for follow-up"
                    />
                  )}
                />
              </Grid>
            </Collapse>

            {/* Submit Button */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => reset()}
                  disabled={isSubmitting}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Send />}
                  disabled={isSubmitting}
                  sx={{ minWidth: 120 }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  )
}

// Feedback summary component
export const FeedbackSummary = ({ feedback }) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getTypeIcon(feedback.type)}
          <Typography variant="h6" sx={{ ml: 1 }}>
            {getTypeLabel(feedback.type)}
          </Typography>
          <Chip
            label={feedback.priority}
            color={getPriorityColor(feedback.priority)}
            size="small"
            sx={{ ml: 'auto' }}
          />
        </Box>
        
        <Typography variant="h6" gutterBottom>
          {feedback.title}
        </Typography>
        
        <Typography variant="body2" color="textSecondary" paragraph>
          {feedback.description}
        </Typography>
        
        {feedback.rating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Rating:</Typography>
            <Rating value={feedback.rating} readOnly size="small" />
          </Box>
        )}
        
        <Typography variant="caption" color="textSecondary">
          Submitted: {new Date(feedback.timestamp).toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  )
}

// Feedback stats component
export const FeedbackStats = ({ stats }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Feedback Statistics
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Feedback
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success">
                {stats.resolved}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Resolved
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning">
                {stats.pending}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Pending
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info">
                {stats.averageRating?.toFixed(1) || 'N/A'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Avg Rating
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
