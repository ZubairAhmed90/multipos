const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { inventoryItemValidation, companyValidation, userValidation, userUpdateValidation } = require('../middleware/validation');

// @route   GET /api/admin/dashboard
// @desc    Get system-wide dashboard data
// @access  Private (Admin only)
router.get('/dashboard', auth, requireAdmin, adminController.getSystemDashboard);

// @route   GET /api/admin/branches
// @desc    Get all branches with their settings
// @access  Private (Admin only)
router.get('/branches', auth, requireAdmin, adminController.getAllBranches);

// @route   PUT /api/admin/branches/:id/settings
// @desc    Update branch settings/permissions
// @access  Private (Admin only)
router.put('/branches/:id/settings', auth, requireAdmin, adminController.updateBranchSettings);

// @route   PUT /api/admin/branches/bulk-settings
// @desc    Bulk update branch settings
// @access  Private (Admin only)
router.put('/branches/bulk-settings', auth, requireAdmin, adminController.bulkUpdateBranchSettings);

// @route   GET /api/admin/inventories
// @desc    Get all inventories across all branches and warehouses
// @access  Private (Admin only)
router.get('/inventories', auth, requireAdmin, adminController.getAllInventories);

// @route   PUT /api/admin/inventories/:id
// @desc    Update any inventory item
// @access  Private (Admin only)
router.put('/inventories/:id', auth, requireAdmin, inventoryItemValidation, adminController.updateAnyInventory);

// @route   GET /api/admin/companies
// @desc    Get all companies across all branches and warehouses
// @access  Private (Admin only)
router.get('/companies', auth, requireAdmin, adminController.getAllCompanies);

// @route   GET /api/admin/sales
// @desc    Get all sales across all branches
// @access  Private (Admin only)
router.get('/sales', auth, requireAdmin, adminController.getAllSales);

// @route   GET /api/admin/ledgers
// @desc    Get all ledgers across all branches
// @access  Private (Admin only)
router.get('/ledgers', auth, requireAdmin, adminController.getAllLedgers);

// @route   POST /api/admin/users
// @desc    Create a new user
// @access  Private (Admin only)
router.post('/users', auth, requireAdmin, userValidation, adminController.createUser);

// @route   GET /api/admin/users
// @desc    Get all users with their roles and permissions
// @access  Private (Admin only)
router.get('/users', auth, requireAdmin, adminController.getAllUsers);

// @route   PUT /api/admin/users/:id
// @desc    Update user role and permissions
// @access  Private (Admin only)
router.put('/users/:id', auth, requireAdmin, userUpdateValidation, adminController.updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/users/:id', auth, requireAdmin, adminController.deleteUser);

module.exports = router;

