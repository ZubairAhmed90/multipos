const express = require('express');
const router = express.Router();
const customerLedgerController = require('../controllers/customerLedgerController');
const auth = require('../middleware/auth');

// @route   GET /api/customer-ledger/customers
// @desc    Get all customers with their transaction summaries
// @access  Private (Admin, Cashier, Warehouse Keeper)
router.get('/customers', auth, customerLedgerController.getAllCustomersWithSummaries);

// @route   GET /api/customer-ledger/:customerId
// @desc    Get comprehensive customer ledger
// @access  Private (Admin, Cashier, Warehouse Keeper)
router.get('/:customerId', auth, customerLedgerController.getCustomerLedger);

// @route   GET /api/customer-ledger/:customerId/export
// @desc    Export customer ledger to PDF
// @access  Private (Admin, Cashier, Warehouse Keeper)
router.get('/:customerId/export', auth, customerLedgerController.exportCustomerLedger);

module.exports = router;


