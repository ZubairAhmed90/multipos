const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const auth = require('../middleware/auth');
const { requireAdmin, requireWarehouseKeeper, requireCashier } = require('../middleware/rbac');
const { validateShift, validateShiftUpdate, validateShiftAssignment } = require('../middleware/validation');

// @route   GET /api/shifts
// @desc    Get all shifts
// @access  Private (Admin, Warehouse Keeper, Cashier)
router.get('/', auth, requireCashier, shiftController.getShifts);

// @route   GET /api/shifts/current
// @desc    Get current shift for user
// @access  Private (All authenticated users)
router.get('/current', auth, shiftController.getCurrentShift);

// @route   GET /api/shifts/validate-pos-access
// @desc    Validate POS access for current user
// @access  Private (All authenticated users)
router.get('/validate-pos-access', auth, shiftController.validatePOSAccess);

// @route   GET /api/shifts/branch/:branchId
// @desc    Get shifts for a specific branch
// @access  Private (Admin, Warehouse Keeper)
router.get('/branch/:branchId', auth, requireWarehouseKeeper, shiftController.getShifts);

// @route   GET /api/shifts/recent-sessions
// @desc    Get user's recent shift sessions
// @access  Private (Cashier)
router.get('/recent-sessions', auth, requireCashier, shiftController.getRecentShiftSessions);

// @route   GET /api/shifts/active/:cashierId
// @desc    Get active shift for cashier
// @access  Private (Cashier, Admin)
router.get('/active/:cashierId', auth, shiftController.getActiveShift);

// @route   GET /api/shifts/:id
// @desc    Get single shift
// @access  Private (Admin, Warehouse Keeper)
router.get('/:id', auth, requireWarehouseKeeper, shiftController.getShift);

// @route   POST /api/shifts/:id/assign-user
// @desc    Assign user to shift
// @access  Private (Admin, Warehouse Keeper)
router.post('/:id/assign-user', auth, requireWarehouseKeeper, shiftController.assignUserToShift);

// @route   DELETE /api/shifts/:id/assign-user/:userId
// @desc    Remove user from shift
// @access  Private (Admin, Warehouse Keeper)
router.delete('/:id/assign-user/:userId', auth, requireWarehouseKeeper, shiftController.removeUserFromShift);

module.exports = router;
