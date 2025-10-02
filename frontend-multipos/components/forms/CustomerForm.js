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
  name: yup.string().required('Name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  phone: yup.string().required('Phone is required'),
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
