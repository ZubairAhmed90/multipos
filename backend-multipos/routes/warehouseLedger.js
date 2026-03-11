const express = require('express');
const router = express.Router();
const {
  getWarehouseLedgerAccounts, createWarehouseLedgerAccount, updateWarehouseLedgerAccount,
  deleteWarehouseLedgerAccount, getWarehouseLedgerEntries, createWarehouseLedgerEntry,
  updateWarehouseLedgerEntry, deleteWarehouseLedgerEntry, getWarehouseBalanceSummary
} = require('../controllers/warehouseLedgerController');

router.get('/accounts/:warehouseId', getWarehouseLedgerAccounts);
router.post('/accounts', createWarehouseLedgerAccount);
router.put('/accounts/:id', updateWarehouseLedgerAccount);
router.delete('/accounts/:id', deleteWarehouseLedgerAccount);

router.get('/entries/:warehouseId', getWarehouseLedgerEntries);
router.post('/entries', createWarehouseLedgerEntry);
router.put('/entries/:id', updateWarehouseLedgerEntry);
router.delete('/entries/:id', deleteWarehouseLedgerEntry);

router.get('/balance-summary/:warehouseId', getWarehouseBalanceSummary);

module.exports = router;