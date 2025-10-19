const express = require('express');
const router = express.Router();
const {
  getFinancialVouchers,
  getFinancialVoucherById,
  createFinancialVoucher,
  updateFinancialVoucher,
  approveFinancialVoucher,
  rejectFinancialVoucher,
  deleteFinancialVoucher,
  getFinancialSummary,
  getDailySummary,
  getPaymentMethodSummary,
  getFinancialAccounts,
  updateAccountBalance,
  createFinancialAccount
} = require('../controllers/financialVoucherController');

const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac'); // ✅ fixed
const { financialVoucherValidation } = require('../middleware/validation');
const { validationResult } = require('express-validator');

// ✅ Apply authentication to all routes
router.use(authenticateToken);

router.get('/', getFinancialVouchers);
router.get('/summary', getFinancialSummary);
router.get('/daily-summary', getDailySummary);
router.get('/payment-method-summary', getPaymentMethodSummary);
router.get('/accounts', getFinancialAccounts);
router.get('/:id', getFinancialVoucherById);



// Create Financial Voucher
router.post('/', requireAdmin, financialVoucherValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
}, createFinancialVoucher);

// Update Financial Voucher
router.put('/:id', requireAdmin, financialVoucherValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
}, updateFinancialVoucher);

// Approve / Reject / Delete
router.put('/:id/approve', requireAdmin, approveFinancialVoucher);
router.put('/:id/reject', requireAdmin, rejectFinancialVoucher);
router.delete('/:id', requireAdmin, deleteFinancialVoucher);

router.post('/accounts', requireAdmin, createFinancialAccount);
router.put('/accounts/:id/balance', requireAdmin, updateAccountBalance);

module.exports = router;
