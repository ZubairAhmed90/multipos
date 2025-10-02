const Branch = require('../models/Branch');

/**
 * Middleware to check if cashier has permission to edit sales
 * If toggle is off, cashiers can only view (read-only)
 * If toggle is on, cashiers can add/edit/delete sales
 */
const checkCashierSalesPermission = async (req, res, next) => {
  try {
    
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'CASHIER') {
      
      if (!req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Cashier must be assigned to a branch to perform this action'
        });
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
      
      if (!settings.allowCashierSalesEdit) {
        return res.status(403).json({
          success: false,
          message: 'Cashiers are not allowed to add/edit/delete sales in this branch. View only mode.'
        });
      }
      
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkCashierSalesPermission
};
