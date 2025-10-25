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
  getFinancialVouchersByScope,
  getVoucherApprovalHistory,
  getVoucherItems,
  getFinancialSummary,
  getDailySummary,
  getPaymentMethodSummary,
  getFinancialAccounts,
  updateAccountBalance,
  createFinancialAccount,
  generateVoucherReport
} = require('../controllers/financialVoucherController');

const authenticateToken = require('../middleware/auth');
const { rbac } = require('../middleware/rbac'); // Updated to use rbac middleware
const { financialVoucherValidation } = require('../middleware/validation');
const { validationResult } = require('express-validator');

// ✅ Apply authentication to all routes
router.use(authenticateToken);

// Get vouchers - role-based access
router.get('/', rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getFinancialVouchers);

// Get vouchers by scope - admin only (for role simulation)
router.get('/scope/:scopeType/:scopeId', rbac('ADMIN'), getFinancialVouchersByScope);

// Get voucher by ID - role-based access
router.get('/:id', rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getFinancialVoucherById);

// Get voucher approval history - role-based access
router.get('/:id/approval-history', rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getVoucherApprovalHistory);

// Get voucher items - role-based access
router.get('/:id/items', rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getVoucherItems);

// Summary endpoints - admin only
router.get('/summary', rbac('ADMIN'), getFinancialSummary);
router.get('/daily-summary', rbac('ADMIN'), getDailySummary);
router.get('/payment-method-summary', rbac('ADMIN'), getPaymentMethodSummary);
router.get('/accounts', rbac('ADMIN'), getFinancialAccounts);

// Create Financial Voucher - role-based access
router.post('/', rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), financialVoucherValidation, (req, res, next) => {
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

// Update Financial Voucher - only creator or admin
router.put('/:id', rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), financialVoucherValidation, (req, res, next) => {
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

// Approve / Reject - admin only
router.put('/:id/approve', rbac('ADMIN'), approveFinancialVoucher);
router.put('/:id/reject', rbac('ADMIN'), rejectFinancialVoucher);

// Delete - admin only
router.delete('/:id', rbac('ADMIN'), deleteFinancialVoucher);

// Account management - admin only
router.post('/accounts', rbac('ADMIN'), createFinancialAccount);
router.put('/accounts/:id/balance', rbac('ADMIN'), updateAccountBalance);

// Generate PDF Report - role-based access (cashiers, warehouse keepers, and admins)
router.post('/reports/generate', rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), generateVoucherReport);

module.exports = router;
