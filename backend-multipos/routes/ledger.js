const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const auth = require('../middleware/auth');
const { rbac, requireAdmin, requireWarehouseKeeper } = require('../middleware/rbac');
const { validateLedgerEntry } = require('../middleware/validation');
const {
  getLedger,
  getLedgersByScope,
  addDebitEntry,
  addCreditEntry,
  addEntryByAccountId,
  getLedgerEntries,
  getBalanceSummary,
  getLedgerAccounts,
  createLedgerAccount,
  updateLedgerAccount,
  deleteLedgerAccount,
  updateLedgerEntry,
  deleteLedgerEntry,
  populateDefaultAccounts
} = require('../controllers/ledgerController');

// All routes require authentication
router.use(auth);

// Custom middleware for ledger access (Admin, Manager, Warehouse Keeper)
const requireLedgerAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  const allowedRoles = ['ADMIN', 'MANAGER', 'WAREHOUSE_KEEPER'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Insufficient permissions' 
    });
  }

  next();
};

// Ledger Accounts Management Routes (must come before parameterized routes)
// Get all ledger accounts (chart of accounts)
router.get('/accounts',
  requireLedgerAccess,
  getLedgerAccounts
);

// Create ledger account
router.post('/accounts',
  rbac('ADMIN'),
  [
    body('accountName').notEmpty().withMessage('Account name is required'),
    body('accountType').notEmpty().withMessage('Account type is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('balance').isNumeric().withMessage('Balance must be a number')
  ],
  createLedgerAccount
);

// Update ledger account
router.put('/accounts/:id',
  rbac('ADMIN', 'WAREHOUSE_KEEPER'),
  [
    body('accountName').optional().notEmpty().withMessage('Account name cannot be empty'),
    body('accountType').optional().notEmpty().withMessage('Account type cannot be empty'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('balance').optional().isNumeric().withMessage('Balance must be a number')
  ],
  updateLedgerAccount
);

// Delete ledger account
router.delete('/accounts/:id',
  rbac('ADMIN'),
  deleteLedgerAccount
);

// Populate default accounts (one-time setup)
router.post('/accounts/populate',
  rbac('ADMIN'),
  populateDefaultAccounts
);

// Get all ledger entries (general endpoint)
router.get('/entries',
  requireLedgerAccess,
  getLedgerEntries
);

// Update ledger entry
router.put('/entries/:id',
  requireLedgerAccess,
  [
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('reference').optional().isString(),
    body('referenceId').optional().isString()
  ],
  updateLedgerEntry
);

// Delete ledger entry
router.delete('/entries/:id',
  requireLedgerAccess,
  deleteLedgerEntry
);

// Get balance summary for scope
router.get('/balance/:scopeType/:scopeId',
  requireLedgerAccess,
  getBalanceSummary
);

// Get all ledgers for a scope
router.get('/scope/:scopeType/:scopeId',
  requireLedgerAccess,
  getLedgersByScope
);

// Get ledger entries
router.get('/:scopeType/:scopeId/:partyType/:partyId/entries',
  requireLedgerAccess,
  getLedgerEntries
);

// Add debit entry
router.post('/:scopeType/:scopeId/:partyType/:partyId/debit',
  requireLedgerAccess,
  validateLedgerEntry,
  addDebitEntry
);

// Add credit entry
router.post('/:scopeType/:scopeId/:partyType/:partyId/credit',
  requireLedgerAccess,
  validateLedgerEntry,
  addCreditEntry
);

// Add entry by account ID (simpler approach)
router.post('/account/:accountId/entry',
  requireLedgerAccess,
  validateLedgerEntry,
  addEntryByAccountId
);

// Get ledger by scope and party (must be last as it's the most general)
router.get('/:scopeType/:scopeId/:partyType/:partyId', 
  requireLedgerAccess,
  getLedger
);

module.exports = router;
