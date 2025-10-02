const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');

// Middleware to check if cashiers can add inventory
const checkCashierInventoryPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'CASHIER') {
      const branch = await Branch.findById(req.user.branchId);
      
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }
      
      // Parse settings if it's a string
      let settings = branch.settings;
      if (typeof settings === 'string') {
        settings = JSON.parse(settings);
      }
      
      if (!settings.allowCashierInventoryEdit) {
        return res.status(403).json({
          success: false,
          message: 'Cashiers are not allowed to add/edit inventory in this branch'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if warehouse keepers can add suppliers/companies
const checkWarehouseKeeperCompanyPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'WAREHOUSE_KEEPER') {
      const warehouse = await Warehouse.findById(req.user.warehouseId);
      
      if (!warehouse) {
        return res.status(404).json({
          success: false,
          message: 'Warehouse not found'
        });
      }

      // Parse settings if it's a string
      let settings = warehouse.settings;
      if (typeof settings === 'string') {
        settings = JSON.parse(settings);
      }
      
      if (!warehouse.allow_warehouse_company_crud && !settings?.allowWarehouseCompanyCRUD) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse keepers are not allowed to add suppliers/companies in this warehouse'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if warehouse keepers can add retailers
const checkWarehouseKeeperRetailerPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'WAREHOUSE_KEEPER') {
      const warehouse = await Warehouse.findById(req.user.warehouseId);
      
      if (!warehouse) {
        return res.status(404).json({
          success: false,
          message: 'Warehouse not found'
        });
      }

      // Parse settings if it's a string
      let settings = warehouse.settings;
      if (typeof settings === 'string') {
        settings = JSON.parse(settings);
      }
      
      if (!settings?.allowWarehouseRetailerCRUD) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse keepers are not allowed to add retailers in this warehouse'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if warehouse keepers can add inventory
const checkWarehouseKeeperInventoryPermission = async (req, res, next) => {
  try {
    
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'CASHIER') {
      // Cashiers are handled by checkCashierInventoryPermission
      return next();
    }

    if (req.user.role === 'WAREHOUSE_KEEPER') {
      const { scopeType, scopeId } = req.body;
      
      
      // Warehouse keepers can only add inventory to their own warehouse
      if (scopeType === 'WAREHOUSE') {
        if (parseInt(scopeId) !== parseInt(req.user.warehouseId)) {
          return res.status(403).json({
            success: false,
            message: 'Warehouse keepers can only add inventory to their own warehouse'
          });
        }
      } else if (scopeType === 'BRANCH') {
        return res.status(403).json({
          success: false,
          message: 'Warehouse keepers cannot add inventory to branches'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check return permissions
const checkReturnPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const branch = await Branch.findById(req.user.branchId);
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    if (req.user.role === 'CASHIER') {
      // Parse settings if it's a string
      let settings = branch.settings;
      if (typeof settings === 'string') {
        settings = JSON.parse(settings);
      }
      
      if (!settings.allowCashierReturns) {
        return res.status(403).json({
          success: false,
          message: 'Cashiers are not allowed to process returns in this branch'
        });
      }
    }

    if (req.user.role === 'WAREHOUSE_KEEPER') {
      const warehouse = await Warehouse.findById(req.user.warehouseId);
      
      if (!warehouse) {
        return res.status(404).json({
          success: false,
          message: 'Warehouse not found'
        });
      }

      // Parse settings if it's a string
      let settings = warehouse.settings;
      if (typeof settings === 'string') {
        settings = JSON.parse(settings);
      }
      
      if (!settings.allowWarehouseReturns) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse keepers are not allowed to process returns in this warehouse'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check cross-branch visibility
const checkCrossBranchVisibility = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const branch = await Branch.findById(req.user.branchId);
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Parse settings if it's a string
    let settings = branch.settings;
    if (typeof settings === 'string') {
      settings = JSON.parse(settings);
    }
    
    if (!settings.openAccountSystem) {
      return res.status(403).json({
        success: false,
        message: 'Cross-branch visibility is disabled for this branch'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkCashierInventoryPermission,
  checkWarehouseKeeperCompanyPermission,
  checkWarehouseKeeperRetailerPermission,
  checkWarehouseKeeperInventoryPermission,
  checkReturnPermission,
  checkCrossBranchVisibility
};

