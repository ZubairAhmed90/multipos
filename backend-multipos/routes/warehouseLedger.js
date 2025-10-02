const express = require('express');
const router = express.Router();
const {
  getWarehouseLedgerAccounts,
  createWarehouseLedgerAccount,
  updateWarehouseLedgerAccount,
  deleteWarehouseLedgerAccount,
  getWarehouseLedgerEntries,
  createWarehouseLedgerEntry,
  updateWarehouseLedgerEntry,
  deleteWarehouseLedgerEntry,
  getWarehouseBalanceSummary
} = require('../controllers/warehouseLedgerController');
const requireAuth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper } = require('../middleware/rbac');

// Warehouse Ledger Accounts Routes
router.get('/accounts/:warehouseId', requireAuth, getWarehouseLedgerAccounts);
router.post('/accounts', requireAuth, createWarehouseLedgerAccount);
router.put('/accounts/:id', requireAuth, updateWarehouseLedgerAccount);
router.delete('/accounts/:id', requireAuth, deleteWarehouseLedgerAccount);

// Warehouse Ledger Entries Routes
router.get('/entries/:warehouseId', requireAuth, getWarehouseLedgerEntries);
router.post('/entries', requireAuth, createWarehouseLedgerEntry);
router.put('/entries/:id', requireAuth, updateWarehouseLedgerEntry);
router.delete('/entries/:id', requireAuth, deleteWarehouseLedgerEntry);

// Warehouse Balance Summary Route
router.get('/balance-summary/:warehouseId', requireAuth, getWarehouseBalanceSummary);

module.exports = router;
