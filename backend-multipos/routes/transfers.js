const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const {
  createTransfer,
  getTransfers,
  getTransfer,
  updateTransferStatus,
  getLocationTransferSettings,
  getTransferSettings,
  updateTransferSettings,
  completeTransfer,
  getTransferLogs,
  getTransferMovements,
  getTransferStatistics
} = require('../controllers/transferController');

// Transfer validation rules
const transferValidation = [
  body('fromScopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('From scope type must be BRANCH or WAREHOUSE'),
  body('fromScopeId')
    .isInt({ min: 1 })
    .withMessage('From scope ID must be a positive integer'),
  body('toScopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('To scope type must be BRANCH or WAREHOUSE'),
  body('toScopeId')
    .isInt({ min: 1 })
    .withMessage('To scope ID must be a positive integer'),
  body('transferType')
    .isIn(['BRANCH_TO_BRANCH', 'WAREHOUSE_TO_WAREHOUSE', 'BRANCH_TO_WAREHOUSE', 'WAREHOUSE_TO_BRANCH'])
    .withMessage('Invalid transfer type'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Transfer must contain at least one item'),
  body('items.*.inventoryItemId')
    .isInt({ min: 1 })
    .withMessage('Inventory item ID must be a positive integer'),
  body('items.*.quantityRequested')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity requested must be greater than 0'),
  body('expectedDate')
    .optional()
    .isISO8601()
    .withMessage('Expected date must be a valid date')
];

const statusValidation = [
  body('status')
    .isIn(['PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED'])
    .withMessage('Invalid status'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

// Transfer routes
router.route('/')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getTransfers)
  .post(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), transferValidation, createTransfer);

// Specific routes must come BEFORE parameterized routes
router.route('/logs')
  .get(auth, rbac('ADMIN'), getTransferLogs);

router.route('/statistics')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getTransferStatistics);

router.route('/settings')
  .get(auth, rbac('ADMIN'), getTransferSettings)
  .put(auth, rbac('ADMIN'), updateTransferSettings);

router.route('/settings/:type/:id')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getLocationTransferSettings);

// Parameterized routes come AFTER specific routes
router.route('/:id')
  .get(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), getTransfer);

router.route('/:id/status')
  .put(auth, rbac('ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER'), statusValidation, updateTransferStatus);

router.route('/:id/complete')
  .put(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), completeTransfer);

router.route('/:id/movements')
  .get(auth, rbac('ADMIN', 'WAREHOUSE_KEEPER'), getTransferMovements);

module.exports = router;