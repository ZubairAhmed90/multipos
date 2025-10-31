const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { validateSale, validateSaleUpdate, validateReturn } = require('../middleware/validation');
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
  getSalesReturn,
  updateSalesReturn,
  getCompanySalesHistory,
  getInvoiceDetails,
  searchProducts,
  searchSales,
  getInvoiceStats,
  getNextInvoiceNumber,
  getSalespersonInvoiceStats,
  searchOutstandingPayments,
  clearOutstandingPayment
} = require('../controllers/salesController');

// Sales routes
router.route('/')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getSales)
  .post(auth, rbac('ADMIN', 'CASHIER'), requireShiftAccessForSales, checkCashierSalesPermission, validateSale, createSale);

// Returns routes (must be before /:id route)
router.route('/returns')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getSalesReturns)
  .post(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), validateReturn, createSalesReturn);

// Individual return routes
router.route('/returns/:id')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getSalesReturn)
  .put(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), updateSalesReturn);

// Company sales history route (must be before /:id route)
router.route('/company/:companyId')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getCompanySalesHistory);

// Invoice details route (must be before /:id route)
router.route('/invoice/:invoiceId')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getInvoiceDetails);

// Product search route (must be before /:id route)
router.route('/products/search')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), searchProducts);

// Sales search route (must be before /:id route)
router.route('/search')
  .get((req, res, next) => {
    console.log('[DEBUG] Sales search route hit:', req.originalUrl);
    console.log('[DEBUG] Query params:', req.query);
    next();
  }, auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), searchSales);

// Invoice statistics route (must be before /:id route)
router.route('/invoice-stats/:scopeType/:scopeId')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getInvoiceStats);

// Next invoice number route (must be before /:id route)
router.route('/next-invoice/:scopeType/:scopeId')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getNextInvoiceNumber);

// Salesperson invoice statistics route (must be before /:id route)
router.route('/salesperson-stats/:warehouseId/:userId')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getSalespersonInvoiceStats);

// Outstanding payments routes (must be before /:id route)
router.route('/outstanding')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), searchOutstandingPayments);

router.route('/clear-outstanding')
  .post(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), clearOutstandingPayment);

router.route('/:id')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getSale)
  .put(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), checkCashierSalesPermission, validateSaleUpdate, updateSale)
  .delete(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), checkCashierSalesPermission, deleteSale);

module.exports = router;
