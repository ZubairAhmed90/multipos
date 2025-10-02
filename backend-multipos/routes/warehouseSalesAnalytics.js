const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

const {
  getWarehouseSalesAnalytics,
  exportWarehouseSalesAnalytics
} = require('../controllers/warehouseSalesAnalyticsController');

// @route   GET /api/warehouse-sales/:warehouseId/analytics
// @desc    Get comprehensive warehouse sales analytics
// @access  Private (Admin, Warehouse Keeper)
router.get('/:warehouseId/analytics', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getWarehouseSalesAnalytics);

// @route   GET /api/warehouse-sales/:warehouseId/analytics/export
// @desc    Export warehouse sales analytics data
// @access  Private (Admin, Warehouse Keeper)
router.get('/:warehouseId/analytics/export', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), exportWarehouseSalesAnalytics);

module.exports = router;
