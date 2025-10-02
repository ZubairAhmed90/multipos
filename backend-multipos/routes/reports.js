const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const auth = require('../middleware/auth');

// @route   GET /api/reports/summary
// @desc    Get reports summary
// @access  Private (Admin, Warehouse Keeper)
router.get('/summary', 
  auth, 
  reportsController.getReportsSummary
);

// @route   GET /api/reports/sales
// @desc    Get sales reports
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/sales', 
  auth, 
  reportsController.getSalesReports
);

// @route   GET /api/reports/inventory
// @desc    Get inventory reports
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/inventory', 
  auth, 
  reportsController.getInventoryReports
);

// @route   GET /api/reports/ledger
// @desc    Get ledger reports
// @access  Private (Admin, Warehouse Keeper)
router.get('/ledger', 
  auth, 
  reportsController.getLedgerReports
);

// @route   GET /api/reports/financial
// @desc    Get financial reports
// @access  Private (Admin)
router.get('/financial', 
  auth, 
  reportsController.getFinancialReports
);

module.exports = router;


