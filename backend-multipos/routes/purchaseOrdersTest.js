const express = require('express');
const router = express.Router();
const {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  getSuppliers
} = require('./controllers/purchaseOrderController');

// Routes WITHOUT authentication middleware for testing
router.get('/', getPurchaseOrders);
router.get('/suppliers', getSuppliers);
router.get('/:id', getPurchaseOrder);
router.post('/', createPurchaseOrder);
router.put('/:id/status', updatePurchaseOrderStatus);
router.delete('/:id', deletePurchaseOrder);

module.exports = router;
