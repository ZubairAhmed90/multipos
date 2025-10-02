const Branch = require('../models/Branch');

// Check if warehouse keeper can add companies
const checkWarehouseKeeperCompanyPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next(); // Admin can always add companies
    }

    if (req.user.role !== 'WAREHOUSE_KEEPER') {
      return res.status(403).json({
        success: false,
        message: 'Only warehouse keepers can add companies'
      });
    }

    const { scopeType, scopeId } = req.body;
    
    if (scopeType === 'BRANCH') {
      const branch = await Branch.findById(scopeId);
      if (!branch) {
        return res.status(400).json({
          success: false,
          message: 'Branch not found'
        });
      }
      
      if (!branch.settings.allowWarehouseKeeperCompanyAdd) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse keeper is not allowed to add companies to this branch'
        });
      }
    } else if (scopeType === 'WAREHOUSE') {
      // For warehouse scope, check if user has access to that warehouse
      if (req.user.warehouseId && req.user.warehouseId.toString() !== scopeId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this warehouse'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Check if cashier can edit inventory
const checkCashierInventoryPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN' || req.user.role === 'WAREHOUSE_KEEPER') {
      return next(); // Admin and warehouse keepers can always edit inventory
    }

    if (req.user.role !== 'CASHIER') {
      return res.status(403).json({
        success: false,
        message: 'Only cashiers can edit inventory'
      });
    }

    const { scopeType, scopeId } = req.body;
    
    if (scopeType === 'BRANCH') {
      const branch = await Branch.findById(scopeId);
      if (!branch) {
        return res.status(400).json({
          success: false,
          message: 'Branch not found'
        });
      }
      
      if (!branch.settings.allowCashierInventoryEdit) {
        return res.status(403).json({
          success: false,
          message: 'Cashier is not allowed to edit inventory for this branch'
        });
      }
    } else if (scopeType === 'WAREHOUSE') {
      return res.status(403).json({
        success: false,
        message: 'Cashiers cannot edit warehouse inventory'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Check if warehouse keeper can edit inventory
const checkWarehouseKeeperInventoryPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next(); // Admin can always edit inventory
    }

    if (req.user.role !== 'WAREHOUSE_KEEPER') {
      return res.status(403).json({
        success: false,
        message: 'Only warehouse keepers can edit inventory'
      });
    }

    const { scopeType, scopeId } = req.body;
    
    // Warehouse keepers can only edit their own warehouse inventory
    if (scopeType === 'WAREHOUSE') {
      if (scopeId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse keepers can only edit their own warehouse inventory'
        });
      }
    } else if (scopeType === 'BRANCH') {
      return res.status(403).json({
        success: false,
        message: 'Warehouse keepers cannot edit branch inventory'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Check if warehouse keeper can sell to retailers
const checkWarehouseKeeperSalesPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next(); // Admin can always sell to retailers
    }

    if (req.user.role !== 'WAREHOUSE_KEEPER') {
      return res.status(403).json({
        success: false,
        message: 'Only warehouse keepers can sell to retailers'
      });
    }

    // Check if warehouse keeper has permission to sell to retailers
    // This would be controlled by admin settings
    // For now, allowing all warehouse keepers to sell
    next();
  } catch (error) {
    next(error);
  }
};

// Check if warehouse keeper can edit inventory (admin controlled)
const checkWarehouseKeeperInventoryEditPermission = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next(); // Admin can always edit inventory
    }

    if (req.user.role !== 'WAREHOUSE_KEEPER') {
      return res.status(403).json({
        success: false,
        message: 'Only warehouse keepers can edit inventory'
      });
    }

    // Check admin permission for warehouse keeper inventory editing
    // This would be controlled by a global admin setting
    // For now, allowing all warehouse keepers to edit inventory
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkWarehouseKeeperCompanyPermission,
  checkCashierInventoryPermission,
  checkWarehouseKeeperInventoryPermission,
  checkWarehouseKeeperSalesPermission,
  checkWarehouseKeeperInventoryEditPermission
};
