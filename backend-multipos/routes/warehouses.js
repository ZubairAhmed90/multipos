const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { getWarehouseSettings, updateWarehouseSettings } = require('../controllers/simplifiedWarehouseSettingsController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper, requireWarehouseSettingsAccess } = require('../middleware/rbac');
const { warehouseValidation } = require('../middleware/validation');

// @route   GET /api/warehouses
// @desc    Get all warehouses
// @access  Private (Admin, Warehouse Keeper)
router.get('/', auth, requireWarehouseKeeper, warehouseController.getWarehouses);

// @route   GET /api/warehouses/:id
// @desc    Get single warehouse
// @access  Private (Admin, Warehouse Keeper)
router.get('/:id', auth, requireWarehouseKeeper, warehouseController.getWarehouse);

// @route   POST /api/warehouses
// @desc    Create new warehouse
// @access  Private (Admin only)
router.post('/', auth, requireAdmin, warehouseValidation, warehouseController.createWarehouse);

// @route   PUT /api/warehouses/:id
// @desc    Update warehouse
// @access  Private (Admin only)
router.put('/:id', auth, requireAdmin, warehouseValidation, warehouseController.updateWarehouse);

// @route   GET /api/warehouses/:id/settings
// @desc    Get warehouse settings
// @access  Private (Admin, Warehouse Keeper for own warehouse)
router.get('/:id/settings', auth, requireWarehouseSettingsAccess, getWarehouseSettings);

// @route   PUT /api/warehouses/:id/settings
// @desc    Update warehouse settings only
// @access  Private (Admin only)
router.put('/:id/settings', auth, requireAdmin, updateWarehouseSettings);

// @route   DELETE /api/warehouses/:id
// @desc    Delete warehouse
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, warehouseController.deleteWarehouse);

module.exports = router;
