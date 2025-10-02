const express = require('express');
const router = express.Router();
const creditDebitController = require('../controllers/creditDebitController');
const auth = require('../middleware/auth');
const { requireCashier, requireAdmin } = require('../middleware/rbac');
const { validateCreditDebitTransaction } = require('../middleware/validation');

// @route   POST /api/credit-debit
// @desc    Create credit/debit transaction
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.post('/', auth, requireCashier, validateCreditDebitTransaction, creditDebitController.createTransaction);

// @route   GET /api/credit-debit
// @desc    Get all credit/debit transactions
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.get('/', auth, requireCashier, creditDebitController.getTransactions);

// @route   GET /api/credit-debit/summary
// @desc    Get branch/warehouse summary
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.get('/summary', auth, requireCashier, creditDebitController.getSummary);

// @route   GET /api/credit-debit/customer-balances
// @desc    Get customer balance report
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.get('/customer-balances', auth, requireCashier, creditDebitController.getCustomerBalances);

// @route   GET /api/credit-debit/:id
// @desc    Get single transaction
// @access  Private (Cashier, Warehouse Keeper, Admin)
router.get('/:id', auth, requireCashier, creditDebitController.getTransaction);

// @route   PUT /api/credit-debit/:id
// @desc    Update transaction
// @access  Private (Admin only)
router.put('/:id', auth, requireAdmin, validateCreditDebitTransaction, creditDebitController.updateTransaction);

// @route   DELETE /api/credit-debit/:id
// @desc    Delete transaction
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, creditDebitController.deleteTransaction);

module.exports = router;
