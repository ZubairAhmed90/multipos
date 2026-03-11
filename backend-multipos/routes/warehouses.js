const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { getWarehouseSettings, updateWarehouseSettings } = require('../controllers/simplifiedWarehouseSettingsController');
const { requireAdmin, requireWarehouseKeeper, requireWarehouseSettingsAccess } = require('../middleware/rbac');
const { warehouseValidation } = require('../middleware/validation');
// auth is already applied globally in server.js — do NOT add it here

router.get('/', requireWarehouseKeeper, warehouseController.getWarehouses);
router.get('/:id', requireWarehouseKeeper, warehouseController.getWarehouse);
router.post('/', requireAdmin, warehouseValidation, warehouseController.createWarehouse);
router.put('/:id', requireAdmin, warehouseValidation, warehouseController.updateWarehouse);
router.get('/:id/settings', requireWarehouseSettingsAccess, getWarehouseSettings);
router.put('/:id/settings', requireAdmin, updateWarehouseSettings);
router.delete('/:id', requireAdmin, warehouseController.deleteWarehouse);

module.exports = router;