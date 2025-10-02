const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const { getDashboardAnalytics, getDashboardSummary } = require('../controllers/dashboardController')

// Dashboard analytics endpoint
router.get('/analytics', auth, getDashboardAnalytics)

// Dashboard summary endpoint (lighter version)
router.get('/summary', auth, getDashboardSummary)

module.exports = router