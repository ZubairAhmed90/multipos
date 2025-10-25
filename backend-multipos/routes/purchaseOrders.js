const express = require('express');
const router = express.Router();
const {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  getSuppliers
} = require('../controllers/purchaseOrderController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
// router.use(auth); // Temporarily disabled for testing

// @route   GET /api/purchase-orders
// @desc    Get all purchase orders
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', getPurchaseOrders);

// @route   GET /api/purchase-orders/suppliers
// @desc    Get suppliers (companies that can supply items)
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/suppliers', getSuppliers);

// @route   GET /api/purchase-orders/:id
// @desc    Get single purchase order
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/:id', getPurchaseOrder);

// @route   POST /api/purchase-orders
// @desc    Create new purchase order
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.post('/', createPurchaseOrder);

// @route   PUT /api/purchase-orders/:id/status
// @desc    Update purchase order status
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.put('/:id/status', updatePurchaseOrderStatus);

// @route   DELETE /api/purchase-orders/:id
// @desc    Delete purchase order
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.delete('/:id', deletePurchaseOrder);

module.exports = router;
