const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper, requireCashier } = require('../middleware/rbac');
const { companyValidation } = require('../middleware/validation');
const { checkWarehouseKeeperCompanyPermission } = require('../middleware/branchPermissions');

// @route   GET /api/companies
// @desc    Get all companies
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', auth, companyController.getCompanies);

// @route   GET /api/companies/export
// @desc    Export companies summary
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/export', auth, companyController.exportCompanies);

// @route   GET /api/companies/:id/export
// @desc    Export company detail report
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/:id/export', auth, requireCashier, companyController.exportCompanyDetails);

// @route   GET /api/companies/:id/details
// @desc    Get company detailed analytics
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/:id/details', auth, requireCashier, companyController.getCompanyDetails);

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
