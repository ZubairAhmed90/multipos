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
const { rbac } = require('../middleware/rbac');
const { checkWarehouseKeeperRetailerPermission } = require('../middleware/branchPermissions');

// Validation rules
const retailerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('phone')
    .optional()
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
  body('state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),
  body('zipCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Zip code cannot exceed 20 characters'),
  body('businessType')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Business type cannot exceed 50 characters'),
  body('taxId')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Tax ID cannot exceed 50 characters'),
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

// @route   GET /api/retailers
// @desc    Get all retailers
// @access  Private (Admin, Warehouse Keeper)
router.get('/', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getRetailers);

// @route   GET /api/retailers/:id
// @desc    Get single retailer
// @access  Private (Admin, Warehouse Keeper)
router.get('/:id', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getRetailer);

// @route   POST /api/retailers
// @desc    Create new retailer
// @access  Private (Admin, Warehouse Keeper)
router.post('/', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), checkWarehouseKeeperRetailerPermission, retailerValidation, createRetailer);

// @route   PUT /api/retailers/:id
// @desc    Update retailer
// @access  Private (Admin, Warehouse Keeper)
router.put('/:id', auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), checkWarehouseKeeperRetailerPermission, retailerValidation, updateRetailer);

// @route   DELETE /api/retailers/:id
// @desc    Delete retailer
// @access  Private (Admin only)
router.delete('/:id', auth, rbac('ADMIN'), deleteRetailer);

module.exports = router;