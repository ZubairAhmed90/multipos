const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper, requireCashier } = require('../middleware/rbac');
const { checkWarehouseKeeperCompanyPermission } = require('../middleware/branchPermissions');
const { validateBilling, validateBillingUpdate } = require('../middleware/validation');

// ===== CRUD ROUTES FOR BILLING RECORDS =====

// @route   GET /api/billing
// @desc    Get all billing records
// @access  Private (Admin, Manager, Cashier)
router.get('/', 
  auth, 
  billingController.getBillingRecords
);

// @route   POST /api/billing
// @desc    Create billing record
// @access  Private (Admin, Manager, Cashier)
router.post('/', 
  auth, 
  validateBilling,
  billingController.createBillingRecord
);

// @route   PUT /api/billing/:id
// @desc    Update billing record
// @access  Private (Admin, Manager, Cashier)
router.put('/:id', 
  auth, 
  validateBillingUpdate,
  billingController.updateBillingRecord
);

// @route   DELETE /api/billing/:id
// @desc    Delete billing record
// @access  Private (Admin, Manager)
router.delete('/:id', 
  auth, 
  requireAdmin,
  billingController.deleteBillingRecord
);

// ===== WAREHOUSE BILLING ROUTES =====

// @route   POST /api/billing/generate
// @desc    Generate bill/invoice from warehouse
// @access  Private (Admin, Warehouse Keeper)
router.post('/generate', 
  auth, 
  requireWarehouseKeeper, 
  checkWarehouseKeeperCompanyPermission, 
  billingController.generateBill
);

// @route   POST /api/billing/:saleId/print
// @desc    Print invoice/receipt
// @access  Private (Admin, Warehouse Keeper)
router.post('/:saleId/print', 
  auth, 
  requireWarehouseKeeper, 
  billingController.printInvoice
);

// @route   GET /api/billing/history
// @desc    Get billing history
// @access  Private (Admin, Warehouse Keeper)
router.get('/history', 
  auth, 
  billingController.getBillingHistory
);

module.exports = router;

