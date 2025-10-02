const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper } = require('../middleware/rbac');
const { companyValidation } = require('../middleware/validation');
const { checkWarehouseKeeperCompanyPermission } = require('../middleware/branchPermissions');

// @route   GET /api/companies
// @desc    Get all companies
// @access  Private (Admin, Warehouse Keeper)
router.get('/', auth, companyController.getCompanies);

// @route   GET /api/companies/:id
// @desc    Get single company
// @access  Private (Admin, Warehouse Keeper)
router.get('/:id', auth, requireWarehouseKeeper, companyController.getCompany);

// @route   POST /api/companies
// @desc    Create new company
// @access  Private (Admin, Warehouse Keeper with permission)
router.post('/', auth, requireWarehouseKeeper, checkWarehouseKeeperCompanyPermission, companyValidation, companyController.createCompany);

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private (Admin, Warehouse Keeper)
router.put('/:id', auth, requireWarehouseKeeper, companyValidation, companyController.updateCompany);

// @route   DELETE /api/companies/:id
// @desc    Delete company
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, companyController.deleteCompany);

module.exports = router;
