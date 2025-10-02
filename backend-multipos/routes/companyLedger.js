const express = require('express');
const router = express.Router();
const {
  getCompanyLedgerEntries,
  createCompanyLedgerEntry,
  getCompanyLedgerBalance
} = require('../controllers/companyLedgerController');
const auth = require('../middleware/auth');

// @route   GET /api/company-ledger/entries/:companyId
// @desc    Get company ledger entries
// @access  Private
router.get('/entries/:companyId', auth, getCompanyLedgerEntries);

// @route   POST /api/company-ledger/entries
// @desc    Create company ledger entry
// @access  Private
router.post('/entries', auth, createCompanyLedgerEntry);

// @route   GET /api/company-ledger/balance/:companyId
// @desc    Get company ledger balance summary
// @access  Private
router.get('/balance/:companyId', auth, getCompanyLedgerBalance);

module.exports = router;





