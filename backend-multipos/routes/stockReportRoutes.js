const express = require('express');
const router = express.Router();
const {
  getStockReports,
  getStockSummary,
  getProductStockHistory,
  getStockReportsByScope,
  getStockReportStatistics
} = require('../controllers/stockReportController');
const auth = require('../middleware/auth');
const { trackStockChange } = require('../middleware/stockTracking');

// Apply authentication middleware to all routes
router.use(auth);
// Note: trackStockChange middleware removed for read-only report routes

// @route   GET /api/stock-reports
// @desc    Get stock reports with filters
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', getStockReports);

// @route   GET /api/stock-reports/summary
// @desc    Get stock summary for all items
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/summary', getStockSummary);

// @route   GET /api/stock-reports/product/:id
// @desc    Get individual product stock history
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/product/:id', getProductStockHistory);

// @route   GET /api/stock-reports/scope/:scopeType/:scopeId
// @desc    Get stock reports by scope (warehouse/branch wise)
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/scope/:scopeType/:scopeId', getStockReportsByScope);

// @route   GET /api/stock-reports/statistics
// @desc    Get stock report statistics
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/statistics', getStockReportStatistics);

module.exports = router;
