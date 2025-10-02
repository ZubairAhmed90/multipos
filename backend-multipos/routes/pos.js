const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rbac, requireBranchAccess } = require('../middleware/rbac');
const { validateHoldBill, validateCompleteBill } = require('../middleware/validation');
const { requireShiftAccess, requireShiftAccessForSales } = require('../middleware/shiftAccess');
const {
  getBranchPOS,
  getAllPOS,
  getPOS,
  createPOS,
  updatePOS,
  deletePOS,
  getPOSStatus,
  updatePOSStatus,
  getPOSSales,
  getPOSInventory
} = require('../controllers/posController');

// POS Terminal Management Routes
router.route('/')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getAllPOS)
  .post(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), createPOS);

router.route('/branch/:branchId')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), requireBranchAccess, getBranchPOS);

// Held Bills Routes (must come before /:id route)
router.route('/hold')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), (req, res) => {
    // Placeholder for held bills - would need to implement this functionality
    res.json({
      success: true,
      data: [],
      message: 'Held bills functionality not yet implemented'
    });
  });

router.route('/:id')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getPOS)
  .put(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), updatePOS)
  .delete(auth, rbac('ADMIN'), deletePOS);

// POS Status Routes
router.route('/:id/status')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getPOSStatus)
  .put(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), updatePOSStatus);

// POS Sales Routes
router.route('/:id/sales')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getPOSSales);

// POS Inventory Routes
router.route('/:id/inventory')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getPOSInventory);

module.exports = router;
