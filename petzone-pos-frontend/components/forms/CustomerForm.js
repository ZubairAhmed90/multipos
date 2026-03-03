'use client'

import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
} from '@mui/material'

const schema = yup.object({
  name: yup.string()
    .trim()
    .min(2, 'Name must be between 2 and 100 characters')
    .max(100, 'Name must be between 2 and 100 characters')
    .required('Name is required'),
  email: yup.string()
    .email('Please provide a valid email address')
    .required('Email is required'),
  phone: yup.string()
    .nullable()
    .transform((value) => value === '' ? null : value)
    .test('phone-format', 'Please provide a valid phone number', function(value) {
      if (!value) return true // Allow empty/null values
      return /^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/\s/g, ''))
    }),
  address: yup.string()
    .trim()
    .max(200, 'Address must not exceed 200 characters')
    .nullable()
    .transform((value) => value === '' ? null : value),
  city: yup.string()
    .trim()
    .max(50, 'City must not exceed 50 characters')
    .nullable()
    .transform((value) => value === '' ? null : value),
  state: yup.string()
    .trim()
    .max(50, 'State must not exceed 50 characters')
    .nullable()
    .transform((value) => value === '' ? null : value),
  zipCode: yup.string()
    .trim()
    .max(10, 'ZIP code must not exceed 10 characters')
    .nullable()
    .transform((value) => value === '' ? null : value),
  customerType: yup.string()
    .oneOf(['INDIVIDUAL', 'BUSINESS', 'RETAILER', 'WHOLESALER'], 'Customer type must be INDIVIDUAL, BUSINESS, RETAILER, or WHOLESALER')
    .nullable()
    .transform((value) => value === '' ? null : value),
  creditLimit: yup.number()
    .min(0, 'Credit limit must be a positive number')
    .nullable()
    .transform((value) => value === '' ? null : value),
  paymentTerms: yup.string()
    .oneOf(['CASH', 'NET_15', 'NET_30', 'NET_60'], 'Payment terms must be CASH, NET_15, NET_30, or NET_60')
    .nullable()
    .transform((value) => value === '' ? null : value),
  notes: yup.string()
    .trim()
    .max(500, 'Notes must not exceed 500 characters')
    .nullable()
    .transform((value) => value === '' ? null : value),
})

export default function CustomerForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: yupResolver(schema),
  })

  const onSubmit = (data) => {
    // Here you would typically dispatch a Redux action or make an API call
    toast.success('Customer data submitted successfully!')
    reset()
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Add New Customer
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            This form demonstrates React Hook Form with Yup validation
          </Typography>
          
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Customer Name"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Email"
              type="email"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Phone"
              {...register('phone')}
              error={!!errors.phone}
              helperText={errors.phone?.message}
              sx={{ mb: 3 }}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button type="submit" variant="contained">
                Add Customer
              </Button>
              <Button type="button" variant="outlined" onClick={() => reset()}>
                Reset
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
