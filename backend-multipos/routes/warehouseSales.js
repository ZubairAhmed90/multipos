const express = require('express');
const router = express.Router();
const warehouseSalesController = require('../controllers/warehouseSalesController');
const auth = require('../middleware/auth');
const { requireWarehouseKeeper, requireAdmin } = require('../middleware/rbac');
const { validateWarehouseSale } = require('../middleware/validation');

// @route   POST /api/warehouse-sales
// @desc    Create warehouse sale to retailer
// @access  Private (Warehouse Keeper, Admin)
router.post('/', auth, requireWarehouseKeeper, validateWarehouseSale, warehouseSalesController.createWarehouseSale);

// @route   GET /api/warehouse-sales
// @desc    Get all warehouse sales
// @access  Private (Warehouse Keeper, Admin)
router.get('/', auth, requireWarehouseKeeper, warehouseSalesController.getWarehouseSales);

// @route   GET /api/warehouse-sales/summary
// @desc    Get warehouse sales summary
// @access  Private (Warehouse Keeper, Admin)
router.get('/summary', auth, requireWarehouseKeeper, warehouseSalesController.getWarehouseSalesSummary);

// @route   GET /api/warehouse-sales/:id
// @desc    Get single warehouse sale
// @access  Private (Warehouse Keeper, Admin)
router.get('/:id', auth, requireWarehouseKeeper, warehouseSalesController.getWarehouseSale);

// @route   PUT /api/warehouse-sales/:id
// @desc    Update warehouse sale
// @access  Private (Admin only)
router.put('/:id', auth, requireAdmin, validateWarehouseSale, warehouseSalesController.updateWarehouseSale);

// @route   DELETE /api/warehouse-sales/:id
// @desc    Delete warehouse sale
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, warehouseSalesController.deleteWarehouseSale);

module.exports = router;
