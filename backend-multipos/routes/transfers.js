const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { validateTransfer, validateTransferRejection } = require('../middleware/validation');
const {
  createTransfer,
  getTransfers,
  getTransfer,
  approveTransfer,
  rejectTransfer,
  completeTransfer,
  cancelTransfer
} = require('../controllers/transferController');

// All routes require authentication
router.use(auth);

// Create transfer
router.post('/',
  validateTransfer,
  createTransfer
);

// Get transfers
router.get('/',
  getTransfers
);

// Get single transfer
router.get('/:id',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER']),
  getTransfer
);

// Approve transfer
router.put('/:id/approve',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER']),
  approveTransfer
);

// Reject transfer
router.put('/:id/reject',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER']),
  validateTransferRejection,
  rejectTransfer
);

// Complete transfer
router.put('/:id/complete',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER']),
  completeTransfer
);

// Cancel transfer
router.put('/:id/cancel',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER']),
  cancelTransfer
);

module.exports = router;
