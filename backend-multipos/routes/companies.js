const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const auth = require('../middleware/auth');
const { 
  requireAdmin, 
  requireWarehouseKeeper, 
  requireCashier
} = require('../middleware/rbac');
const { companyValidation } = require('../middleware/validation');
const { 
  // Warehouse company permissions
  checkWarehouseKeeperCompanyCreatePermission,
  checkWarehouseKeeperCompanyEditPermission,
  checkWarehouseKeeperCompanyDeletePermission,
  checkWarehouseKeeperCompanyPermission,
  
  // Branch company permissions (for cashiers)
  checkBranchCompanyCreatePermission,
  checkBranchCompanyEditPermission,
  checkBranchCompanyDeletePermission,
  checkBranchCompanyPermission
} = require('../middleware/branchPermissions');

// ========== BASIC COMPANY ROUTES ==========

// @route   GET /api/companies
// @desc    Get all companies (with filtering by scope)
// @access  Private (All authenticated users)
router.get('/', auth, companyController.getCompanies);

// @route   GET /api/companies/export
// @desc    Export companies summary
// @access  Private (All authenticated users)
router.get('/export', auth, companyController.exportCompanies);

// @route   GET /api/companies/:id
// @desc    Get single company
// @access  Private (All authenticated users with access to the company)
router.get('/:id', auth, companyController.getCompany);

// @route   GET /api/companies/:id/details
// @desc    Get company detailed analytics
// @access  Private (All authenticated users with access to the company)
router.get('/:id/details', auth, companyController.getCompanyDetails);

// @route   GET /api/companies/:id/export
// @desc    Export company detail report
// @access  Private (All authenticated users with access to the company)
router.get('/:id/export', auth, companyController.exportCompanyDetails);

// ========== WAREHOUSE-SPECIFIC ROUTES ==========

// @route   GET /api/companies/warehouse
// @desc    Get companies for warehouse keepers (their warehouse only)
// @access  Private (Warehouse Keepers)
router.get('/warehouse', auth, requireWarehouseKeeper, companyController.getCompanies);

// @route   POST /api/companies/warehouse
// @desc    Create new company in warehouse scope
// @access  Private (Admin or Warehouse Keeper with create permission)
router.post(
  '/warehouse', 
  auth, 
  requireWarehouseKeeper,
  checkWarehouseKeeperCompanyCreatePermission,
  companyValidation, 
  companyController.createCompany
);

// @route   PUT /api/companies/warehouse/:id
// @desc    Update company in warehouse scope
// @access  Private (Admin or Warehouse Keeper with edit permission)
router.put(
  '/warehouse/:id', 
  auth, 
  requireWarehouseKeeper,
  checkWarehouseKeeperCompanyEditPermission,
  companyValidation, 
  companyController.updateCompany
);

// @route   DELETE /api/companies/warehouse/:id
// @desc    Delete company in warehouse scope
// @access  Private (Admin only)
router.delete(
  '/warehouse/:id', 
  auth, 
  requireAdmin, 
  companyController.deleteCompany
);

// ========== BRANCH-SPECIFIC ROUTES (for Cashiers) ==========

// @route   GET /api/companies/branch
// @desc    Get companies for cashiers (their branch only)
// @access  Private (Cashiers)
router.get('/branch', auth, requireCashier, companyController.getCompanies);

// @route   POST /api/companies/branch
// @desc    Create new company in branch scope
// @access  Private (Admin or Cashier with create permission)
router.post(
  '/branch', 
  auth, 
  requireCashier,
  checkBranchCompanyCreatePermission,
  companyValidation, 
  companyController.createCompany
);

// @route   PUT /api/companies/branch/:id
// @desc    Update company in branch scope
// @access  Private (Admin or Cashier with edit permission)
router.put(
  '/branch/:id', 
  auth, 
  requireCashier,
  checkBranchCompanyEditPermission,
  companyValidation, 
  companyController.updateCompany
);

// @route   DELETE /api/companies/branch/:id
// @desc    Delete company in branch scope
// @access  Private (Admin only)
router.delete(
  '/branch/:id', 
  auth, 
  requireAdmin, 
  companyController.deleteCompany
);

// ========== ADMIN-ONLY ROUTES ==========

// @route   GET /api/companies/scope/:scopeType/:scopeId
// @desc    Get companies by scope (Admin only)
// @access  Private (Admin only)
router.get('/scope/:scopeType/:scopeId', auth, requireAdmin, companyController.getCompanies);

// ========== LEGACY ROUTES (for backward compatibility) ==========

// @route   POST /api/companies
// @desc    Create new company (auto-detects scope from user role)
// @access  Private (Admin, Warehouse Keeper with permission, Cashier with permission)
router.post(
  '/', 
  auth, 
  (req, res, next) => {
    // Auto-detect scope based on user role
    if (req.user.role === 'ADMIN') {
      return next();
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      req.body.scopeType = 'WAREHOUSE';
      req.body.scopeId = req.user.warehouseId;
      return checkWarehouseKeeperCompanyCreatePermission(req, res, next);
    } else if (req.user.role === 'CASHIER') {
      req.body.scopeType = 'BRANCH';
      req.body.scopeId = req.user.branchId;
      return checkBranchCompanyCreatePermission(req, res, next);
    }
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  },
  companyValidation, 
  companyController.createCompany
);

// @route   PUT /api/companies/:id
// @desc    Update company (auto-detects scope)
// @access  Private (Admin, or user with edit permission in their scope)
router.put(
  '/:id', 
  auth, 
  async (req, res, next) => {
    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    // First, get the company to determine its scope
    try {
      const Company = require('../models/Company');
      const company = await Company.findById(req.params.id);
      
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }
      
      req.company = company; // Attach for controller use
      
      if (company.scopeType === 'WAREHOUSE') {
        if (req.user.role !== 'WAREHOUSE_KEEPER' || company.scopeId != req.user.warehouseId) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
        return checkWarehouseKeeperCompanyEditPermission(req, res, next);
      } else if (company.scopeType === 'BRANCH') {
        if (req.user.role !== 'CASHIER' || company.scopeId != req.user.branchId) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
        return checkBranchCompanyEditPermission(req, res, next);
      } else {
        return next();
      }
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  companyValidation, 
  companyController.updateCompany
);

// @route   DELETE /api/companies/:id
// @desc    Delete company
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, companyController.deleteCompany);

module.exports = router;