const express = require('express');
const router = express.Router();
const {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  updatePurchaseOrder,
  getSuppliers
} = require('../controllers/purchaseOrderController');
const auth = require('../middleware/auth');
const { rbac, requireAdmin } = require('../middleware/rbac');

router.put('/:id', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), updatePurchaseOrder);


// Apply authentication and role-based access
// @route   GET /api/purchase-orders
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getPurchaseOrders);

// @route   GET /api/purchase-orders/suppliers
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/suppliers', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getSuppliers);

// @route   GET /api/purchase-orders/:id
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/:id', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), getPurchaseOrder);

// @route   POST /api/purchase-orders
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.post('/', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), createPurchaseOrder);

// @route   PUT /api/purchase-orders/:id/status
// @access  Private (Admin only)
router.put('/:id/status', auth, requireAdmin, updatePurchaseOrderStatus);

// @route   DELETE /api/purchase-orders/:id
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, deletePurchaseOrder);

module.exports = router;
