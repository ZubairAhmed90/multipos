const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { validateSale, validateReturn } = require('../middleware/validation');
const { requireShiftAccessForSales } = require('../middleware/shiftAccess');
const { checkCashierSalesPermission } = require('../middleware/salesPermissions');
const {
  createSale,
  getSales,
  getSale,
  updateSale,
  deleteSale,
  createSalesReturn,
  getSalesReturns,
  getCompanySalesHistory,
  getInvoiceDetails
} = require('../controllers/salesController');

// Sales routes
router.route('/')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getSales)
  .post(auth, rbac('ADMIN', 'CASHIER'), requireShiftAccessForSales, checkCashierSalesPermission, validateSale, createSale);

// Returns routes (must be before /:id route)
router.route('/returns')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getSalesReturns)
  .post(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), validateReturn, createSalesReturn);

// Company sales history route (must be before /:id route)
router.route('/company/:companyId')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getCompanySalesHistory);

// Invoice details route (must be before /:id route)
router.route('/invoice/:invoiceId')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getInvoiceDetails);

router.route('/:id')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getSale)
  .put(auth, rbac('ADMIN', 'CASHIER'), checkCashierSalesPermission, updateSale)
  .delete(auth, rbac('ADMIN', 'CASHIER'), checkCashierSalesPermission, deleteSale);

module.exports = router;
