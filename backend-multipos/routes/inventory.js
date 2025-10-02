const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper, requireCashier } = require('../middleware/rbac');
const { inventoryItemValidation, inventoryItemUpdateValidation } = require('../middleware/validation');
const { 
  checkWarehouseKeeperInventoryPermission, 
  checkCashierInventoryPermission,
  checkCrossBranchVisibility 
} = require('../middleware/branchPermissions');
const { requireShiftAccessForInventory } = require('../middleware/shiftAccess');

// @route   GET /api/inventory
// @desc    Get all inventory items
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', auth, requireCashier, inventoryController.getInventoryItems);

// @route   GET /api/inventory/cross-branch
// @desc    Get cross-branch inventory (branches only, not warehouses)
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/cross-branch', auth, requireCashier, checkCrossBranchVisibility, inventoryController.getCrossBranchInventory);

// @route   GET /api/inventory/:id
// @desc    Get single inventory item
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/:id', auth, requireCashier, inventoryController.getInventoryItem);

// @route   POST /api/inventory
// @desc    Create new inventory item
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.post('/', auth, requireCashier, requireShiftAccessForInventory, checkWarehouseKeeperInventoryPermission, checkCashierInventoryPermission, inventoryItemValidation, inventoryController.createInventoryItem);

// @route   PUT /api/inventory/:id
// @desc    Update inventory item
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.put('/:id', auth, requireCashier, requireShiftAccessForInventory, checkWarehouseKeeperInventoryPermission, checkCashierInventoryPermission, inventoryItemUpdateValidation, inventoryController.updateInventoryItem);

// @route   DELETE /api/inventory/:id
// @desc    Delete inventory item
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.delete('/:id', auth, requireCashier, requireShiftAccessForInventory, checkWarehouseKeeperInventoryPermission, checkCashierInventoryPermission, inventoryController.deleteInventoryItem);

// @route   PATCH /api/inventory/:id/quantity
// @desc    Update inventory quantity
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.patch('/:id/quantity', auth, requireCashier, requireShiftAccessForInventory, checkWarehouseKeeperInventoryPermission, checkCashierInventoryPermission, inventoryController.updateQuantity);

// Real-time data endpoints (replaces WebSocket)
router.get('/changes',
  auth,
  requireCashier,
  inventoryController.getLatestInventoryChanges
);

router.get('/changes/since',
  auth,
  requireCashier,
  inventoryController.getInventoryChangesSince
);

router.get('/summary',
  auth,
  requireCashier,
  inventoryController.getSummary
);

module.exports = router;
