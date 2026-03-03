const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getRetailers,
  getRetailer,
  createRetailer,
  updateRetailer,
  deleteRetailer
} = require('../controllers/retailersController');
const auth = require('../middleware/auth');
const { rbac, requireAdmin, requireWarehouseKeeper } = require('../middleware/rbac');
const { 
  checkWarehouseKeeperRetailerCreatePermission,
  checkWarehouseKeeperRetailerEditPermission,
  checkWarehouseKeeperRetailerDeletePermission,
  checkWarehouseKeeperRetailerPermission
} = require('../middleware/branchPermissions');

// Validation rules
const retailerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('phone')
    .optional({ checkFalsy: true, nullable: true })
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Address cannot exceed 255 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  body('creditLimit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Credit limit must be a positive number'),
  body('paymentTerms')
    .optional()
    .isIn(['CASH', 'NET_15', 'NET_30', 'NET_45', 'NET_60'])
    .withMessage('Invalid payment terms'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
    .withMessage('Invalid status'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];

// ========== MAIN RETAILER ROUTES ==========

// @route   GET /api/retailers
// @desc    Get all retailers (with optional filtering by warehouse)
// @access  Private (Admin, Warehouse Keeper)
router.get('/', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getRetailers);

// @route   GET /api/retailers/warehouse
// @desc    Get retailers for warehouse keepers (their warehouse only)
// @access  Private (Warehouse Keepers)
router.get('/warehouse', auth, requireWarehouseKeeper, (req, res, next) => {
  // Add warehouse filter to query
  req.query.warehouseId = req.user.warehouseId;
  return getRetailers(req, res, next);
});

// @route   GET /api/retailers/:id
// @desc    Get single retailer
// @access  Private (Admin, Warehouse Keeper with access to this retailer)
router.get('/:id', auth, async (req, res, next) => {
  if (req.user.role === 'ADMIN') {
    return getRetailer(req, res, next);
  }
  
  if (req.user.role === 'WAREHOUSE_KEEPER') {
    try {
      const Retailer = require('../models/Retailer');
      const retailer = await Retailer.findById(req.params.id);
      
      if (!retailer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Retailer not found' 
        });
      }
      
      // FIXED: Convert both to numbers for comparison
      if (Number(retailer.warehouseId) !== Number(req.user.warehouseId)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied - This retailer does not belong to your warehouse' 
        });
      }
      
      return getRetailer(req, res, next);
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
  
  return res.status(403).json({ 
    success: false, 
    message: 'Unauthorized' 
  });
});

// ========== WAREHOUSE RETAILER ROUTES ==========

// @route   POST /api/retailers/warehouse
// @desc    Create new retailer in warehouse scope
// @access  Private (Admin or Warehouse Keeper with create permission)
router.post(
  '/warehouse', 
  auth, 
  requireWarehouseKeeper,
  checkWarehouseKeeperRetailerCreatePermission,
  retailerValidation, 
  (req, res, next) => {
    // Ensure warehouseId is set to user's warehouse
    req.body.warehouseId = req.user.warehouseId;
    return createRetailer(req, res, next);
  }
);

// @route   PUT /api/retailers/warehouse/:id
// @desc    Update retailer in warehouse scope
// @access  Private (Admin or Warehouse Keeper with edit permission)
router.put(
  '/warehouse/:id', 
  auth, 
  requireWarehouseKeeper,
  checkWarehouseKeeperRetailerEditPermission,
  retailerValidation, 
  updateRetailer
);

// @route   DELETE /api/retailers/warehouse/:id
// @desc    Delete retailer in warehouse scope
// @access  Private (Admin only - warehouse keepers cannot delete retailers)
router.delete(
  '/warehouse/:id', 
  auth, 
  requireAdmin, 
  deleteRetailer
);

// ========== LEGACY/UNIFIED ROUTES (for backward compatibility) ==========

// @route   POST /api/retailers
// @desc    Create new retailer (auto-detects scope from user role)
// @access  Private (Admin, Warehouse Keeper with create permission)
router.post(
  '/', 
  auth, 
  (req, res, next) => {
    // Auto-detect scope based on user role
    if (req.user.role === 'ADMIN') {
      return next();
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      req.body.warehouseId = req.user.warehouseId;
      return checkWarehouseKeeperRetailerCreatePermission(req, res, next);
    }
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized - Insufficient permissions' 
    });
  },
  retailerValidation, 
  createRetailer
);

// @route   PUT /api/retailers/:id
// @desc    Update retailer (auto-detects scope)
// @access  Private (Admin, or Warehouse Keeper with edit permission in their warehouse)
// @route   PUT /api/retailers/:id
// @desc    Update retailer (auto-detects scope)
// @access  Private (Admin, or Warehouse Keeper with edit permission in their warehouse)
router.put(
  '/:id', 
  auth, 
  async (req, res, next) => {
        console.log('PUT /:id hit, role:', req.user.role, 'id:', req.params.id);

    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      try {
        const Retailer = require('../models/Retailer');
        const retailer = await Retailer.findById(req.params.id);
        
        if (!retailer) {
          return res.status(404).json({ 
            success: false, 
            message: 'Retailer not found' 
          });
        }
        
        // Attach retailer to request for the permission middleware
        req.retailer = retailer;
        
        // Check warehouse ownership first
        if (Number(retailer.warehouseId) !== Number(req.user.warehouseId)) {
          return res.status(403).json({ 
            success: false, 
            message: 'Access denied - This retailer does not belong to your warehouse' 
          });
        }
        
        // Now check edit permission
        return checkWarehouseKeeperRetailerEditPermission(req, res, next);
        
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    }
    
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized - Insufficient permissions' 
    });
  },
  retailerValidation, 
  updateRetailer
);
// @route   DELETE /api/retailers/:id
// @desc    Delete retailer
// @access  Private (Admin only - warehouse keepers cannot delete)
router.delete('/:id', auth, requireAdmin, deleteRetailer);

// @route   GET /api/retailers/warehouse/:warehouseId
// @desc    Get retailers by warehouse ID (Admin only)
// @access  Private (Admin only)
router.get('/warehouse/:warehouseId', auth, requireAdmin, (req, res, next) => {
  req.query.warehouseId = req.params.warehouseId;
  return getRetailers(req, res, next);
});

// @route   GET /api/retailers/stats/summary
// @desc    Get retailer statistics
// @access  Private (Admin, Warehouse Keeper)
router.get('/stats/summary', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), async (req, res) => {
  try {
    const { getRetailerStats } = require('../controllers/retailersController');
    return getRetailerStats(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;