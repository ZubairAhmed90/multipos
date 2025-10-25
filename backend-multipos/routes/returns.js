const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { getReturnRestock, restockReturnItem } = require('../controllers/returnsController');

// Admin-only Return Restock log
router.get('/restock', auth, rbac('ADMIN'), getReturnRestock);

// Restock a single return line (ADMIN, WAREHOUSE_KEEPER, CASHIER with scope)
router.post('/:returnId/items/:itemId/restock', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), restockReturnItem);

module.exports = router;


