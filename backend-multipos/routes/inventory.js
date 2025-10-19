const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const excelImportController = require('../controllers/excelImportController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper, requireCashier, rbac } = require('../middleware/rbac');
const { inventoryItemValidation, inventoryItemUpdateValidation } = require('../middleware/validation');
const { 
  checkWarehouseKeeperInventoryPermission, 
  checkCashierInventoryPermission,
  checkCrossBranchVisibility 
} = require('../middleware/branchPermissions');
const { requireShiftAccessForInventory } = require('../middleware/shiftAccess');
const { uploadSingle, handleUploadError } = require('../middleware/upload');

// @route   GET /api/inventory
// @desc    Get all inventory items
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), inventoryController.getInventoryItems);

// @route   GET /api/inventory/cross-branch
// @desc    Get cross-branch inventory (branches only, not warehouses)
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/cross-branch', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), checkCrossBranchVisibility, inventoryController.getCrossBranchInventory);

// @route   GET /api/inventory/:id
// @desc    Get single inventory item
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/:id', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), inventoryController.getInventoryItem);

// @route   POST /api/inventory
// @desc    Create new inventory item
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.post('/', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), requireShiftAccessForInventory, checkWarehouseKeeperInventoryPermission, checkCashierInventoryPermission, inventoryItemValidation, inventoryController.createInventoryItem);

// @route   PUT /api/inventory/:id
// @desc    Update inventory item
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.put('/:id', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), requireShiftAccessForInventory, checkWarehouseKeeperInventoryPermission, checkCashierInventoryPermission, inventoryItemUpdateValidation, inventoryController.updateInventoryItem);

// @route   DELETE /api/inventory/:id
// @desc    Delete inventory item
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, inventoryController.deleteInventoryItem);

// @route   PATCH /api/inventory/:id/quantity
// @desc    Update inventory quantity
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.patch('/:id/quantity', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'), requireShiftAccessForInventory, checkWarehouseKeeperInventoryPermission, checkCashierInventoryPermission, inventoryController.updateQuantity);

// Real-time data endpoints (replaces WebSocket)
router.get('/changes',
  auth,
  rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'),
  inventoryController.getLatestInventoryChanges
);

router.get('/changes/since',
  auth,
  rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'),
  inventoryController.getInventoryChangesSince
);

router.get('/summary',
  auth,
  rbac('ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'),
  inventoryController.getSummary
);

// Excel import routes
// @route   POST /api/inventory/import-excel
// @desc    Import inventory data from Excel file
// @access  Private (Admin, Warehouse Keeper)
router.post('/import-excel', 
  auth, 
  (req, res, next) => {
    // Allow Admin, Warehouse Keeper, and Cashier with inventory permission
    if (req.user.role === 'ADMIN' || req.user.role === 'WAREHOUSE_KEEPER' || 
        (req.user.role === 'CASHIER' && req.user.inventoryPermission)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin, Warehouse Keeper, or Cashier with inventory permission required.'
      });
    }
  },
  uploadSingle, 
  handleUploadError, 
  excelImportController.importInventoryFromExcel
);

// @route   GET /api/inventory/excel-template
// @desc    Download Excel template for inventory import
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
router.get('/excel-template', 
  auth, 
  (req, res, next) => {
    // Allow Admin, Warehouse Keeper, and Cashier with inventory permission
    if (req.user.role === 'ADMIN' || req.user.role === 'WAREHOUSE_KEEPER' || 
        (req.user.role === 'CASHIER' && req.user.inventoryPermission)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin, Warehouse Keeper, or Cashier with inventory permission required.'
      });
    }
  },
  excelImportController.getExcelTemplate
);

module.exports = router;
