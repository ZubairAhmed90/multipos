const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { getBranchSettings, updateBranchSettings } = require('../controllers/simplifiedBranchSettingsController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper, requireCashier, requireBranchSettingsAccess } = require('../middleware/rbac');
const { branchValidation } = require('../middleware/validation');

// @route   GET /api/branches
// @desc    Get all branches
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', auth, requireCashier, branchController.getBranches);

// @route   GET /api/branches/:id
// @desc    Get single branch
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/:id', auth, requireCashier, branchController.getBranch);

// @route   POST /api/branches
// @desc    Create new branch
// @access  Private (Admin only)
router.post('/', auth, requireAdmin, branchValidation, branchController.createBranch);

// @route   PUT /api/branches/:id
// @desc    Update branch
// @access  Private (Admin only)
router.put('/:id', auth, requireAdmin, branchValidation, branchController.updateBranch);

// @route   GET /api/branches/:id/settings
// @desc    Get branch settings
// @access  Private (Admin, Cashier for own branch)
router.get('/:id/settings', auth, requireBranchSettingsAccess, getBranchSettings);

// @route   PUT /api/branches/:id/settings
// @desc    Update branch settings only
// @access  Private (Admin only)
router.put('/:id/settings', auth, requireAdmin, updateBranchSettings);

// @route   DELETE /api/branches/:id
// @desc    Delete branch
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, branchController.deleteBranch);

module.exports = router;
