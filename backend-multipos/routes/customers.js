const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const auth = require('../middleware/auth');
const { requireCashier, requireAdmin } = require('../middleware/rbac');
const { validateCustomer } = require('../middleware/validation');

// @route   POST /api/customers
// @desc    Create new customer
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.post('/', auth, requireCashier, validateCustomer, customerController.createCustomer);

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.get('/', auth, requireCashier, customerController.getCustomers);

// @route   GET /api/customers/:id
// @desc    Get single customer
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.get('/:id', auth, requireCashier, customerController.getCustomer);

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.put('/:id', auth, requireCashier, validateCustomer, customerController.updateCustomer);

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, customerController.deleteCustomer);

// @route   GET /api/customers/:id/transactions
// @desc    Get customer transactions
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.get('/:id/transactions', auth, requireCashier, customerController.getCustomerTransactions);

module.exports = router;
