const { validationResult } = require('express-validator');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private (Admin, Warehouse Keeper)
const getCompanies = async (req, res, next) => {
  try {
    const { status, scopeType, scopeId, transactionType } = req.query;
    
    // Build conditions object for filtering
    const conditions = {};
    if (status) conditions.status = status;
    if (scopeType) conditions.scopeType = scopeType;
    if (scopeId) conditions.scopeId = scopeId;
    if (transactionType) conditions.transactionType = transactionType;
    
    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can only see companies in their warehouse scope
      conditions.scopeType = 'WAREHOUSE';
      conditions.scopeId = req.user.warehouseId;
    } else if (req.user.role === 'CASHIER') {
      // Cashiers can only see companies in their branch scope
      conditions.scopeType = 'BRANCH';
      conditions.scopeId = req.user.branchId;
    }
    // Admins can see all companies (no additional filtering)
    
    // Get companies using the MySQL-based model
    const companies = await Company.find(conditions, { 
      sort: '-created_at'
    });
    
    res.json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving companies',
      error: error.message
    });
  }
};

// @desc    Get single company
// @route   GET /api/companies/:id
// @access  Private (Admin, Warehouse Keeper)
const getCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('scope', 'name code')
      .populate('creator', 'username email');
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new company
// @route   POST /api/companies
// @access  Private (Admin, Warehouse Keeper with permission)
const createCompany = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { name, code, contactPerson, phone, email, address, status, scopeType, scopeId, transactionType } = req.body;
    
    // Set default scope based on user role
    let finalScopeType = scopeType;
    let finalScopeId = scopeId;
    
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      finalScopeType = 'WAREHOUSE';
      finalScopeId = req.user.warehouseId;
    } else if (req.user.role === 'CASHIER') {
      finalScopeType = 'BRANCH';
      finalScopeId = req.user.branchId;
    } else if (!scopeType || !scopeId) {
      // Admin creating company without scope - default to COMPANY scope
      finalScopeType = 'COMPANY';
      finalScopeId = 1;
    }

    // Check if scope exists (for validation)
    if (finalScopeType === 'BRANCH') {
      const branch = await Branch.findById(finalScopeId);
      if (!branch) {
        return res.status(400).json({
          success: false,
          message: 'Invalid branch ID'
        });
      }
    } else if (finalScopeType === 'WAREHOUSE') {
      const warehouse = await Warehouse.findById(finalScopeId);
      if (!warehouse) {
        return res.status(400).json({
          success: false,
          message: 'Invalid warehouse ID'
        });
      }
    }

    // Prepare company data
    const companyData = {
      name,
      code,
      contactPerson,
      phone,
      email,
      address,
      status: status || 'active',
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      transactionType: transactionType || 'CASH',
      createdBy: req.user.id
    };

    const company = await Company.create(companyData);
    
    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });
  }
};

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Private (Admin, Warehouse Keeper)
const updateCompany = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      if (company.scopeType !== 'WAREHOUSE' || company.scopeId != req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (req.user.role === 'CASHIER') {
      if (company.scopeType !== 'BRANCH' || company.scopeId != req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Company updated successfully',
      data: updatedCompany
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Private (Admin only)
const deleteCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      if (company.scopeType !== 'WAREHOUSE' || company.scopeId != req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (req.user.role === 'CASHIER') {
      if (company.scopeType !== 'BRANCH' || company.scopeId != req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }
    
    await company.deleteOne();
    
    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany
};
