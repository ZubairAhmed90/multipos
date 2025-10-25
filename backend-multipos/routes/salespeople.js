const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const {
  getSalespeople,
  getSalesperson,
  createSalesperson,
  updateSalesperson,
  deleteSalesperson,
  getSalespersonPerformance,
  getSalespeopleForWarehouseBilling
} = require('../controllers/salespersonController');

// Salespeople routes
router.route('/')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getSalespeople)
  .post(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), createSalesperson);

// Warehouse billing specific route (must be before /:id route)
router.route('/warehouse-billing')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getSalespeopleForWarehouseBilling);

router.route('/:id')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getSalesperson)
  .put(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), updateSalesperson)
  .delete(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), deleteSalesperson);

// Salesperson performance route
router.route('/:id/performance')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getSalespersonPerformance);

module.exports = router;
